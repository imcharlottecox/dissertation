<script lang="ts">
    import { onMount } from "svelte";
    import * as d3 from "d3";
    import type { fTransition, Subgraph, Warp, EdgeRenderDatum, StateNode, HGraph, HStateNode, HEdge, EdgeRenderingData } from "$lib/graph/graphTypes";
    import { getGraphDefaultsFSM } from "$lib/graph/graphDefaults";
    import { computeLevelsMap, computeNodePositions, splitWarp, computeNodePositionsWithBackbone } from "$lib/components/fsm/fsmLayoutPositions";
    import { addContentGroup, drawArrowheads } from "$lib/components/fsm/fsmSVGSetup";
    import { drawNodes, drawEdges, drawEdges2,patchEdgesPaths,computeEdgeGeometryForIds, computeEdgeGeometry, type RenderContext, syncEdgeToDom } from "$lib/components/fsm/fsmRendering";
    import { createDragNoSim, createDragSelective } from "$lib/graph/graphBehaviours";
    import {runCollisionAvoidance} from "$lib/components/fsm/fsmSubgraphLayoutCA";
    import type {Rect}  from "$lib/components/fsm/fsmRectangleUtilityHelpers"; 
    import {rectContainsRect, rectOverlapsRect, clampRectangleInside}  from "$lib/components/fsm/fsmRectangleUtilityHelpers"; 
    import { benchRows, downloadBenchRowsAsCsv, measure, clearBenchRows } from "$lib/benchmarking/profiler";
    import { tick } from "svelte";
    import { makeSyntheticFsmDS } from "$lib/benchmarking/makeSyntheticFsmDS";



    export let fsmStates: string[] = [];
    export let fsmTransitions: fTransition[] = [];
    export let acceptingStates: string[] = [];
    export let startingStates: string[] = [];
    export let subgraphs: Record<string, Subgraph> = {};
    export let warps: Warp[] = [];
    // export let showDepth: boolean = false;
    export let renderKey: string = "";
    let lastRenderKey = "";
    let lastViewportKey = "";
    let g: d3.Selection<SVGGElement, unknown, null, undefined>;
    let nodeRender: d3.Selection<SVGGElement, HStateNode, SVGGElement, unknown>;
    let edgeRender: d3.Selection<SVGPathElement, EdgeRenderingData, SVGGElement, unknown>;
    let labelRender: d3.Selection<SVGTextElement, EdgeRenderingData, SVGGElement, unknown>;
    let edgesLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
    let benchN = 100;
    let benchSeed = 22;
    let trials = 5;
    let benchMode = false;
    type BenchReport = (name: string, ms: number) => void;
    let patchEdgeIds = new Map<string, string[]>(); //nodeId to edgeIds
    let edgeElById = new Map<string, SVGPathElement>();
    const { nodeRadius, padding } = getGraphDefaultsFSM();
    const ZOOM_LEVEL_THRESHOLDS = new Map<number, number>([
        [1, 1.1],
        [2, 1.6],
        [3, 3.0],
    ]);
    let graphWidth = 720;
    let graphHeight = 200;
    const LABEL_OFFSET = 6;
    const LOOP_RADIUS = Math.max(nodeRadius + 12, 24);
    let wrapperElement: HTMLDivElement;
    let svgElement: SVGSVGElement;
    let canonicalBasePos = new Map<string, {x:number, y:number}>();

    const subgraphRects = new Map<string, Rect>(); // for each subgraph location
    const subgraphParent = new Map<string, string | null>(); //nested parent id, not parentState 

    let arrowheadStraight = "url(#arrowhead-straight)";
    let arrowheadLoop = "url(#arrowhead-loop)";
    let mounted = false;
    let currentZoomTransform = d3.zoomIdentity;
    let evaluating = false;
    let lastZoomK = 1;
    let lastSemanticZoomK = 1;
    let dragBehaviour: d3.DragBehavior<SVGGElement, HStateNode, unknown>;
    let zoomBehaviour: d3.ZoomBehavior<SVGSVGElement, unknown>;
    let hiddenEdgesBySubgraph = new Map<string, string[]>(); //subgraphId -> edgeIds
    let hiddenNodesBySubgraph = new Map<string, string[]>(); //subgraphId -> nodeIds
    let hg: HGraph = {
        nodes: new Map<string, HStateNode>(),
        edges: new Map<string, HEdge>(),
        activeSubgraphs: new Set<string>()
    };

    const benchmarkReport: BenchReport = (name, ms) => {
        if (!benchMode) return;
        const n = fsmStates.length;
        benchRows.push({ name: `fsm:${name}`, n, ms });
    }
    function median(xs: number[]){
        const sorted = [...xs].sort((a,b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0){
            return (sorted[mid -1] + sorted [mid]) / 2;
        } else {
            return sorted[mid];
        }
    }

    async function loadSyntheticDS(n: number, seed: number){
        const data = makeSyntheticFsmDS({n, seed, includeBackbone: true});
        fsmStates = data.fsmStates;
        fsmTransitions = data.fsmTransitions;
        acceptingStates = data.acceptingStates;
        startingStates = data.startingStates;

        renderKey = `bench:${n}:${seed}:${Date.now()}`;
        await onDatasetChange();
    }

    async function runBenchmarkMedian(n: number, trials: number){
        if (!mounted) return;
        benchMode = true;
        await tick();
        clearBenchRows();
        runBenchmark(n);

        const timeScore = new Map<string, number[]>();

        for (let i = 0; i < trials; i++){
            clearBenchRows();
            await runBenchmark(n);

            for (const row of benchRows){
                if (!timeScore.has(row.name)){
                    timeScore.set(row.name, []);
                }
                timeScore.get(row.name)?.push(row.ms);
            }
        }

        clearBenchRows();
        for (const [name, times] of timeScore.entries()){
            const med = median(times);
            benchRows.push({ name, n, ms: med });
        }

        benchMode = false;
    }


    function resetBaseNodesToCanon(){
        for (const n of hg.nodes.values()){
            if (n.parent) continue;
            if (!n.visible) continue;
            const p = canonicalBasePos.get(n.id);
            if (p){
                n.x=p.x;
                n.y=p.y;
            }
        }
    }

    function patcheEdgesForNode(nodeId: string){
        const edgeIds = patchEdgeIds.get(nodeId);
        if (!edgeIds) return;
        computeEdgeGeometryForIds(hg, edgeIds, LOOP_RADIUS, LABEL_OFFSET);
        patchEdgesPaths(hg, edgeIds, edgeElById);
    }
    function semanticTickGuard() {
        if (evaluating) return;
        evaluating = true;
        const changed = updateExpansionsForZoom(lastZoomK);
        if (changed) resetBaseNodesToCanon();
            // runRectPipeline({graphWidth, graphHeight, hg, nodeRadius, subgraphRects, subgraphParent});        
        runCollisionAvoidance({graphWidth, graphHeight: 0.9*graphHeight, hg, nodeRadius, subgraphRects, subgraphParent});
        computeEdgeGeometry(hg, LOOP_RADIUS, LABEL_OFFSET);

        rerenderGraph();
        evaluating = false;
    }

    function measureHeight() {
        let t = performance.now();
        const r = wrapperElement.getBoundingClientRect();
        benchmarkReport("measureHeight:getBoundingClientRect", performance.now() - t);
        t = performance.now();
        graphWidth = Math.max(1, Math.floor(r.width));
        graphHeight = Math.max(1, Math.floor(r.height));

        d3.select(svgElement).attr("width", graphWidth).attr("height", graphHeight);
        benchmarkReport("measureHeight:setSvgDimensions", performance.now() - t);
        t = performance.now();

    }
    function mkNodeId(subgraphId: string, localStateId: string){
        return `${subgraphId}.${localStateId}`;
    }
    function zoomIn() {
        d3.select(svgElement)
            .transition()
            .duration(150)
            .call(zoomBehaviour.scaleBy as any, 1.2);  
    }
    function zoomOut() {
        d3.select(svgElement)
            .transition()
            .duration(150)
            .call(zoomBehaviour.scaleBy as any, 1 / 1.2);  
    }
    function zoomReset() {
        d3.select(svgElement)
            .transition()
            .duration(150)
            .call(zoomBehaviour.transform as any, d3.zoomIdentity);  
    }
    // function drawDebugRects() {
    //     const rects = [...subgraphRects.entries()].map(([id, r]) => ({ id, ...r }));

    //     const layer = g.select<SVGGElement>("g.debug")
    //         .selectAll<SVGGElement, unknown>("g.debug-rects")
    //         .data([null])
    //         .join("g")
    //         .attr("class", "debug-rects");

    //     layer.selectAll<SVGRectElement, any>("rect")
    //         .data(rects, (d: any) => d.id)
    //         .join("rect")
    //         .attr("x", d => d.x)
    //         .attr("y", d => d.y)
    //         .attr("width", d => d.w)
    //         .attr("height", d => d.h)
    //         .attr("fill", "orange")
    //         .attr("fill-opacity", 0.08)
    //         .attr("stroke", "orange")
    //         .attr("stroke-width", 1)
    //         .attr("stroke-dasharray", "4 3")
    //         .attr("pointer-events", "none")

    //     layer.selectAll<SVGTextElement, any>("text")
    //         .data(rects, (d: any) => d.id)
    //         .join("text")
    //         .attr("x", d => d.x + 6)
    //         .attr("y", d => d.y + 14)
    //         .attr("font-size", 10)
    //         .attr("fill", "orange")
    //         .text(d => d.id);
    // }
    // function drawDebugNodeRects() {
    //     const nodes = [...hg.nodes.values()].filter(n => n.visible);
    //     const rects = nodes.map(n => ({
    //         id: n.id,
    //         x: n.x - (nodeRadius + 5),
    //         y: n.y - (nodeRadius + 5),
    //         w: 2*(nodeRadius + 5),
    //         h: 2*(nodeRadius + 5)
    //     }));

    //     const layer = g.select<SVGGElement>("g.debug")
    //         .selectAll("g.debug-node-rects")
    //         .data([null])
    //         .join("g")
    //         .attr("class", "debug-node-rects")

    //     layer.selectAll("rect")
    //         .data(rects, (d: any) => d.id)
    //         .join("rect")
    //         .attr("x", (d:any) => d.x)
    //         .attr("y", (d:any) => d.y)
    //         .attr("width", (d:any) => d.w)
    //         .attr("height", (d:any) => d.h)
    //         .attr("fill", "deepskyblue")
    //         .attr("fill-opacity", 0.05)
    //         .attr("stroke", "deepskyblue")
    //         .attr("stroke-width", 1);
    // }

    function getAnchorParentId(parentId: string, sg: Subgraph){
        return parentId; //node to be replaced on sg expansion
    }

    function findContainingParentSubgraphId(anchorNodeId: string): string | null {
        const node = hg.nodes.get(anchorNodeId);
        return node?.parent ?? null;
    }

    // function rectOverlapsRect(a: Rect, b: Rect, padding = 0){
    //     return !(
    //         a.x + a.w + padding < b.x ||
    //         a.x > b.x + b.w + padding ||
    //         a.y + a.h + padding < b.y ||
    //         a.y > b.y + b.h + padding
    //     );
    // }

    // function rectContainsRect(outer: Rect, inner: Rect, padding = 0){
    //     return (
    //         inner.x >= outer.x + padding &&
    //         inner.y >= outer.y + padding &&
    //         inner.x + inner.w <= outer.x + outer.w - padding &&
    //         inner.y + inner.h <= outer.y + outer.h - padding
    //     );
    // }

    function computeLocalBounds(localPos: Map<string, {x:number, y:number}>, sg: Subgraph) {
        const xs: number[] = [];
        const ys: number[] = [];
        for (const id of sg.states){
            if (id === sg.entry || id === sg.exit) continue;
            const pos = localPos.get(id);
            if (!pos) continue;
            xs.push(pos.x);
            ys.push(pos.y);
        }
        const minX = xs.length ? Math.min(...xs) : 0;
        const maxX = xs.length ? Math.max(...xs) : 0;
        const minY = ys.length ? Math.min(...ys) : 0;
        const maxY = ys.length ? Math.max(...ys) : 0;
        return { minX, maxX, minY, maxY, centreX: (minX + maxX) / 2, centreY: (minY + maxY) / 2};

    }
    // function clampRectangleInside(container: Rect, rect: Rect, pad = 20){
    //     const x = Math.max(container.x + pad, Math.min(rect.x, container.x + container.w - rect.w - pad));
    //     const y = Math.max(container.y + pad, Math.min(rect.y, container.y + container.h - rect.h - pad));
    //     return { ...rect, x, y};
    // }
    function getEntryWarp(parentId: string, entry: string){
        return warps.find(w => {
            const { warpParent, warpEntryExit} = splitWarp(w.into);
            return warpParent === parentId && warpEntryExit === entry;
        });
    }

    function getExitWarp(parentId: string, exit: string){
        return warps.find(w => {
            const { warpParent, warpEntryExit} = splitWarp(w.from);
            return warpParent === parentId && warpEntryExit === exit;
        });
    }

    function expandSubgraph(parentId: string){
        const sg = subgraphs[parentId];
        if (!sg) {
            console.warn(`No subgraph found with id ${parentId} to expand`);
            return;
        }
        if (hg.activeSubgraphs.has(parentId)) return;
        // hg.activeSubgraphs.add(parentId);
        rebuildPatch();

        const anchorId = getAnchorParentId(parentId, sg);
        const anchorNode = hg.nodes.get(anchorId);
        if (!anchorNode || anchorNode.visible === false) return;

        const entryWarp = getEntryWarp(parentId, sg.entry);
        const exitWarp = getExitWarp(parentId, sg.exit);

        const levels = computeLevelsMap(sg.transitions, sg.entry, sg.states);
        const maxLevel = Math.max(...levels.values());
        const rowHeight = 60;
        const colWidth = 140;

        const rows = maxLevel + 1;
        const cols = maxLevel + 1;

        const H = Math.max(140, rows * rowHeight);
        const W = Math.max(180, cols * colWidth);

        const localPos = computeNodePositions(levels, W, H, 12);
        const b = computeLocalBounds(localPos, sg);

        //potential inline rect around the anchor parent node
        let rect: Rect = {
            x: anchorNode.x - b.centreX,
            y: anchorNode.y - b.centreY,
            w: W,
            h: H
        };

        //nest subsubgraphs inside parent subgraph
        let containerId: string | null = null;
        let containerRect: Rect | null = null;

        if (sg.parentState){
            // containerId = findContainingParentSubgraphId(anchorId); //the anchor node parent
            // containerId = sg.parentState;
            containerId = hg.nodes.get(anchorId)?.parent ?? null;
            containerRect = subgraphRects.get(containerId) ?? null;

            // if (containerId){
            //     containerRect = subgraphRects.get(containerId) ?? null;
            // }

            if (!containerRect) return;

            rect = clampRectangleInside(containerRect, rect, 20);

            subgraphParent.set(parentId, containerId);
            } else {
                subgraphParent.set(parentId, null); 
            }

            //for depthlevel 1 to avoid unnecessary downwards offset
            const PADDING = 20;

            function collidesWithSibligns(test: Rect) {
            for (const [otherId, r] of subgraphRects.entries()){
                if (otherId === parentId) continue;
                //avoid colldiign wiht siblings in the same container if nested
                if (containerId){
                    if (subgraphParent.get(otherId) !== containerId) continue;
                } else {
                    //must be top level so avoid the other top level rects
                    if (subgraphParent.get(otherId) !== null) continue;
                }

                if (rectOverlapsRect(test, r, PADDING) ){
                    return true;
                }
            }
            return false;
        }

        if (collidesWithSibligns(rect)) {
            //try shifting around a little
            const steps = [
                {dx: 0, dy: 80},
                {dx: 0, dy: -80},
                {dx: 120, dy: 0},
                {dx: -120, dy: 0},
                {dx: 0, dy: 160},
                {dx: 0, dy: -160},
            ];
            let placed = false;
            for (const step of steps){
                const candidate = {...rect, x:rect.x + step.dx, y: rect.y + step.dy};
                const c2 = containerRect ? clampRectangleInside(containerRect, candidate, 30) : candidate;
                if (!collidesWithSibligns(c2)) {rect = c2; placed = true; break;}
            }

            //todo fallback if fail push down in a loop
        }

        subgraphRects.set(parentId, rect);

        //add subnodes but skip the ports
        for (const stateId of sg.states){
            if (stateId == sg.entry || stateId == sg.exit) continue;
            const p = localPos.get(stateId);
            if (!p) continue;
            const nodeId = mkNodeId(parentId, stateId);
            
            hg.nodes.set(nodeId, {
                id: nodeId,
                displayName: stateId,
                x: rect.x + p.x,
                y: rect.y + p.y,
                parent: parentId,
                depth: anchorNode.depth + 1,
                visible: true,
                kind: "sub"
            });
        }

        //add subedges skip ports
        for (const t of sg.transitions){
            if (t.from === sg.entry || t.from === sg.exit || t.to === sg.entry || t.to === sg.exit) continue;
        
            const fromId = mkNodeId(parentId, t.from);
            const toId = mkNodeId(parentId, t.to);
            const id = `sub:${parentId}:${fromId}-${toId}-${t.label ?? "undefined"}`;
            hg.edges.set(id, {
                id,
                from: fromId,
                to: toId,
                label: t.label,
                visible: true,
                kind: "sub",
                parent: parentId
            });
        }

            //warp edges for entry exit skipping ports bc theyre invisible
        if (entryWarp) {
            for (const t of sg.transitions.filter(t => t.from === sg.entry && t.to !== sg.exit)){
                const toId = mkNodeId(parentId, t.to);
                const edgeId = `warpIn:${parentId}:${entryWarp.from}-${toId}-${t.label ?? "undefined"}`;
                hg.edges.set(edgeId, {
                    id: edgeId,
                    from: entryWarp.from,
                    to: toId,
                    label: t.label,
                    visible: true,
                    kind: "warp",
                    parent: parentId
                });
            }
        }
        if (exitWarp && exitWarp.backto) {
            for (const t of sg.transitions.filter(t => t.to === sg.exit)){
                const fromId = mkNodeId(parentId, t.from);
                const edgeId = `warpOut:${parentId}:${fromId}-${exitWarp.backto}-${t.label ?? "undefined"}`;
                hg.edges.set(edgeId, {
                    id: edgeId,
                    from: fromId,
                    to: exitWarp.backto ?? "",
                    label: t.label,
                    visible: true,
                    kind: "warp",
                    parent: parentId
                });
            }
        }

            //hide anchor nodes
        const hiddenEdges: string[] = [];
        const hiddenNodes: string[] = [];
        
        anchorNode.visible = false;
        hiddenNodes.push(anchorId);

        for (const [edgeId, edge] of hg.edges.entries()){
            if (edge.from !== anchorId && edge.to !== anchorId) continue;

            if (!sg.parentState){
                if (edge.kind !== "base") continue;
            } else {
                if (edge.parent !== containerId) continue;
            }

            if (edge.visible){
                edge.visible = false;
                hiddenEdges.push(edgeId);
            }
        }

        hiddenEdgesBySubgraph.set(parentId, hiddenEdges);
        hiddenNodesBySubgraph.set(parentId, hiddenNodes);
        hg.activeSubgraphs.add(parentId);

    }


    function getSgDescendants(parentId:string): string[] {
        const descs: string[] = [];
        for (const id of hg.activeSubgraphs){
            let parent = subgraphParent.get(id) ?? null;
            while (parent){
                if (parent === parentId) {
                    descs.push(id);
                    break;
                }
                parent = subgraphParent.get(parent) ?? null;
            }
        }
        descs.sort((a,b) => sgDepthFinder(b) - sgDepthFinder(a));
        return descs;
    }

    function sgDepthFinder(id: string): number {
        let depth = 0;
        let parent = subgraphParent.get(id) ??  null;
        while (parent){
            depth++;
            parent = subgraphParent.get(parent) ?? null;
        }
        return depth;
    }

    function collapseSubgraph(parentId: string){
        const sg = subgraphs[parentId];
        if (!sg) return;

        if (!hg.activeSubgraphs.has(parentId)) return;
        rebuildPatch();

        // const childrenDescendants =  [...hg.activeSubgraphs]
        //     .filter(id => id !== parentId && id.startsWith(parentId + "."))
        //     .sort((a, b) => (subgraphs[b]?.depthLevel ?? 1) - (subgraphs[a]?.depthLevel ?? 1));
        const childrenDescendants = getSgDescendants(parentId);

        for (const childId of childrenDescendants){
            collapseSubgraph(childId);
        }

        for (const [id, node] of hg.nodes){
            if (node.parent === parentId){
                hg.nodes.delete(id);
            }
        }

        for (const [id, edge] of hg.edges){
            if (edge.parent === parentId){
                hg.edges.delete(id);
            }   
        }
        
        const anchorId = getAnchorParentId(parentId, sg);
        const anchorNode = hg.nodes.get(anchorId);
        if (anchorNode) anchorNode.visible = true;

        const hiddenEdges = hiddenEdgesBySubgraph.get(parentId) ?? [];
        for (const edgeId of hiddenEdges){
            const edge = hg.edges.get(edgeId);
            if (edge) edge.visible = true;
        }

        hiddenEdgesBySubgraph.delete(parentId);
        hiddenNodesBySubgraph.delete(parentId);
        subgraphRects.delete(parentId);
        subgraphParent.delete(parentId);
        hg.activeSubgraphs.delete(parentId);
    }

    function shouldExpand(sg: Subgraph, k: number): boolean {
        const lvl = sg.depthLevel ?? 1;
        const threshold = ZOOM_LEVEL_THRESHOLDS.get(lvl) ?? 3.0
        return k >= threshold;
    }

    function updateExpansionsForZoom(k: number): boolean {
        const entries = Object.entries(subgraphs).sort((a, b) => (a[1]?.depthLevel ?? 1) - (b[1]?.depthLevel ?? 1));
        let changed = false;
        //collapse deepest levels first
        const desc = [...entries].sort((a, b) => (b[1]?.depthLevel ?? 1) - (a[1]?.depthLevel ?? 1));
        for (const [id, sg] of desc){
            const active = hg.activeSubgraphs.has(id);
            const want = shouldExpand(sg, k);
            if (active && !want){
                collapseSubgraph(id);
                changed = true;
            }
        }

        //expand lower levels first
        for (const [id, sg] of entries){
            const active = hg.activeSubgraphs.has(id);
            const want = shouldExpand(sg, k);
            if (!active && want){
                const anchorId = getAnchorParentId(id, sg);
                const anchor = hg.nodes.get(anchorId);
                if (!anchor || anchor.visible === false) continue;
                expandSubgraph(id);
                changed = true;
            }
        }
        return changed;
    }

    function resetHGraph() {
        hg.nodes.clear();
        hg.edges.clear();
        hg.activeSubgraphs.clear();
    }

    function buildBaseHGraph() {
        let t = performance.now();
        resetHGraph();
        benchmarkReport("buildBase:reset_graph", performance.now() - t);
        t = performance.now();
        
        rebuildPatch();
        benchmarkReport("buildBase:rebuildPatch", performance.now() - t);

        t = performance.now();
        const start = startingStates?.[0] ?? fsmStates[0];
        benchmarkReport("buildBaseHGraph:setStart", performance.now() - t);
        t = performance.now();

        const levels = computeLevelsMap(fsmTransitions, start, fsmStates, (phase, ms) => benchRows.push({name: `computeLevelsMap:${phase}`, n: fsmStates.length, ms}));
        benchmarkReport("buildBaseHGraph:computeLevelsMap", performance.now() - t);
        t = performance.now();        
        const nodePositions = computeNodePositionsWithBackbone(
            levels,
            graphWidth,
            graphHeight,
            padding,
            acceptingStates,
            fsmTransitions,
            start,
            (phase, ms) => benchRows.push({name: `computeNodePositionsWithBackbone:${phase}`, n: fsmStates.length, ms})
        );    
        benchmarkReport("buildBase:computeNodePositionsWithBackbone", performance.now() - t);
        t = performance.now();    

        for (const nodeId of fsmStates) {
            const p = nodePositions.get(nodeId);
            if (!p) continue;
            hg.nodes.set(nodeId, {
                id: nodeId,
                displayName: nodeId,
                x: p.x,
                y: p.y,
                parent: null,
                depth: 1,
                visible: true,
                kind: "base"
            });
        }  

        benchmarkReport("buildBase:setNodes", performance.now() - t);
        t = performance.now();    
        for (const t of fsmTransitions) {
            const id = `base:${t.from}-${t.to}-${t.label ?? "undefined"}`;
            hg.edges.set(id, {
                id,
                from: t.from,
                to: t.to,
                label: t.label,
                visible: true,
                kind: "base",
                parent: null
            });
        }
        benchmarkReport("buildBase:setEdges", performance.now() - t);
        t = performance.now(); 

        function snapshotBasePos(){
            canonicalBasePos.clear();
            for (const n of hg.nodes.values()){
                if (!n.parent){
                    canonicalBasePos.set(n.id, {x:n.x, y:n.y});
                }
            }
        } 
        snapshotBasePos();
        benchmarkReport("buildBase:snapshotBasePos", performance.now() - t);
        t = performance.now();   
    }

    function makeContext(): RenderContext {
        return {
            g,
            hg,
            nodeRadius,
            loopRadius: LOOP_RADIUS,
            labelOffset: LABEL_OFFSET,
            acceptingStates,
            startingStates,
            arrowheadStraight,
            arrowheadLoop,
        };
    }

    function rerenderGraph() {
        let t = performance.now();   
        if (!mounted || !g) return;
        g.attr("transform", currentZoomTransform.toString());
        benchmarkReport("rerender:ZoomTransform", performance.now() - t);
        t = performance.now();   
        const context = makeContext();
        benchmarkReport("rerender:makeContext", performance.now() - t);
        t = performance.now();   
        
        computeEdgeGeometry(hg, LOOP_RADIUS, LABEL_OFFSET);
        benchmarkReport("rerender:computeEdgeGeometry", performance.now() - t);
        t = performance.now();

        drawEdges(context);
        benchmarkReport("rerender:drawEdges", performance.now() - t);
        t = performance.now();   

        drawNodes(context, dragBehaviour);
        benchmarkReport("rerender:drawNodes", performance.now() - t);

        // drawDebugRects();
        // drawDebugNodeRects();
    }
    function rerenderGraphStruct(){
        let t = performance.now();   
        if (!mounted || !g) return;
        g.attr("transform", currentZoomTransform.toString());
        benchmarkReport("rerenderGraphStruct:ZoomTransform", performance.now() - t);
        t = performance.now();   
        const context = makeContext();
        benchmarkReport("rerenderGraphStruct:makeContext", performance.now() - t);
        t = performance.now();   
        
        computeEdgeGeometry(hg, LOOP_RADIUS, LABEL_OFFSET);
        benchmarkReport("rerenderGraphStruct:computeEdgeGeometry", performance.now() - t);
        t = performance.now();

        syncEdgeToDom(edgesLayer, hg, arrowheadStraight, arrowheadLoop, edgeElById);
        
        benchmarkReport("rerenderGraphStruct:syncEdgeToDom", performance.now() - t);
        t = performance.now();

        patchEdgesPaths(hg, hg.edges.keys(), edgeElById);

        benchmarkReport("rerenderGraphStruct:patchEdgesPaths", performance.now() - t);
        t = performance.now();
        drawNodes(context, dragBehaviour);

        benchmarkReport("rerenderGraphStruct:drawNodes", performance.now() - t);
    }

    async function runBenchmark(n: number){
        measure("fsm:buildBaseHGraph", n, () => buildBaseHGraph());
        measure("fsm:runCollisionAvoidance", n, () => runCollisionAvoidance({graphWidth, graphHeight, hg, nodeRadius, subgraphRects, subgraphParent}));
        measure("fsm:totalRender", n, () => rerenderGraph());
        measure("fsm:totalRenderStruct", n, () => rerenderGraphStruct());
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    }
    function rerunHGraph(){
        let t = performance.now();
        buildBaseHGraph();
        benchmarkReport("rerunHGraph:buildBaseHGraph", performance.now() - t);
        t = performance.now();
        // runRectPipeline({graphWidth: svgElement.clientWidth, graphHeight: svgElement.clientHeight, hg, nodeRadius, subgraphRects, subgraphParent});

        runCollisionAvoidance({graphWidth, graphHeight, hg, nodeRadius, subgraphRects, subgraphParent});
        benchmarkReport("rerunHGraph:runCollisionAvoidance", performance.now() - t);
        t = performance.now();

        // rerenderGraph();
        rerenderGraphStruct();
        benchmarkReport("rerunHGraph:rerenderGraphStruct", performance.now() - t);

    }

    async function onDatasetChange(){
        let t = performance.now();
        await tick(); //allows svelete to commit the old DOM updates
        await new Promise<void>(resolve => requestAnimationFrame(resolve)); //gives the browser time
        benchmarkReport("onDatasetChanges:await", performance.now() - t);
        t = performance.now();  
        measureHeight();
        benchmarkReport("onDatasetChanges:measureHeight", performance.now() - t);
        t = performance.now();  
        rerunHGraph();
        benchmarkReport("onDatasetChanges:rerunHGraph", performance.now() - t);
        t = performance.now();  
    }
    
    function rebuildPatch(){
        patchEdgeIds.clear();
        for (const edge of hg.edges.values()){
            const a = patchEdgeIds.get(edge.from) ?? [];
            a.push(edge.id);
            patchEdgeIds.set(edge.from, a);
            const b = patchEdgeIds.get(edge.to) ?? [];
            b.push(edge.id);
            patchEdgeIds.set(edge.to, b);
        }
    }

    
    onMount(() => {
        //initial render and props sorted here
        const svg = d3.select(svgElement);
        drawArrowheads(svg);
        g = addContentGroup(svg);        
        edgesLayer = g.select<SVGGElement>("g.edges");
        measureHeight();
        rerunHGraph();
        // dragBehaviour = createDragNoSim(() => {computeEdgeGeometry(hg, LOOP_RADIUS, LABEL_OFFSET); drawEdges(makeContext());});

        dragBehaviour = createDragSelective((nodeId) => patcheEdgesForNode(nodeId));
        
        zoomBehaviour = d3.zoom<SVGSVGElement, unknown>()
            .on('zoom', (event) => {
                currentZoomTransform = event.transform;
                g.attr('transform', event.transform.toString());
                // lastZoomK = event.transform.k;
                // if (event.sourceEvent && Math.abs(lastZoomK - lastSemanticZoomK) > 1e-3){
                //     lastSemanticZoomK = lastZoomK;
                //     requestAnimationFrame(semanticTickGuard); //for throttling
                // }
                lastZoomK = event.transform.k;
                if (event.sourceEvent instanceof WheelEvent ){ //TODO: MORE SOPHISTICATED DIFFERENTIATION BETWEEN WHEEL AND BUTTON EVENT FOR MOBILE PINCH AND ZOOM
                    lastZoomK = event.transform.k;
                    if (Math.abs(lastZoomK - lastSemanticZoomK) > 1e-3){
                        lastSemanticZoomK = lastZoomK;
                        requestAnimationFrame(semanticTickGuard); //for throttling
                    }
                }
            });
        svg.call(zoomBehaviour);
        
        mounted = true;

        // rerunHGraph();

        // drawGraph();
    });

    $: if (mounted && (renderKey !== lastRenderKey)) {
        lastRenderKey = renderKey;
        // rerunHGraph();
        onDatasetChange();
    }
</script> 

<div class="graphWrapper" bind:this={wrapperElement}>
    <svg bind:this={svgElement}></svg>

    <div class="zoomControls">
        <button type="button" class="zoomButton" on:click={zoomIn}>+</button>
        <button type="button" class="zoomButton" on:click={zoomOut}>-</button>
        <button type="button" class="zoomButton" on:click={zoomReset}>⟳</button>
    </div>

    <div>
        <button on:click={() => { clearBenchRows(); runBenchmark(fsmStates.length); console.log(benchRows); }}>
            Run Benchmark
        </button>
        <button on:click={() => downloadBenchRowsAsCsv(`FSM_bench_${fsmStates.length}.csv`)}>
            Download Benchmark CSV
        </button>

        <div class="benchControls">
            <select bind:value={benchN}>
                <option value={10}>10</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
            </select>

            <input type="number" min="1" bind:value={benchSeed} style="width:70px" />
            <input type="number" min="1" max="20" bind:value={trials} style="width:60px" />

            <button on:click={() => loadSyntheticDS(benchN, benchSeed)}>
                Load 20% graph
            </button>

            <button on:click={async () => { await runBenchmarkMedian(benchN, trials); console.log(benchRows); }}>
                Benchmark (median)
            </button>

            <button on:click={() => downloadBenchRowsAsCsv(`FSM_bench_aftrOnDsChanges_n${benchN}.csv`)}>
                Download CSV
            </button>
            </div>

    </div>
</div>

<style>
    svg {
        background: snow;
        border: 1px solid #ccc;
        display: block;
    }

    .graphWrapper{
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 0;
    }

    .zoomControls{
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .zoomControls button {
        width: 34px;
        height: 34px;
        border: 1px solid #ccc;
        background: white;
        border-radius: 8px;
        cursor: pointer;
        font-size: 18px;

    }

    .zoomControls button:hover {
        background: #f0f0f0;
    }
</style>