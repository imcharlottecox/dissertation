<script lang="ts">
    import { onMount, createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import * as d3 from "d3";
    import type { fTransition, Subgraph, Warp, EdgeRenderDatum, StateNode, HGraph, HStateNode, HEdge, EdgeRenderingData } from "$lib/graph/graphTypes";
    import { getGraphDefaultsFSM } from "$lib/graph/graphDefaults";
    import { computeLevelsMap, computeNodePositions, splitWarp, computeNodePositionsWithBackbone } from "./fsmHierarchicalHelpers";
    import { addContentGroup, drawArrowheads } from "$lib/components/fsm/fsmSVGSetup";
    import { drawNodes, drawEdges, type RenderContext } from "$lib/components/fsm/fsmRendering";
    import { createDragNoSim } from "$lib/graph/graphBehaviours";
    import {runCollisionAvoidance} from "$lib/components/fsm/fsmSubgraphLayoutCA";
    import type {Rect}  from "$lib/components/fsm/fsmRectangleUtilityHelpers"; 
    import {rectContainsRect, rectOverlapsRect, clampRectangleInside}  from "$lib/components/fsm/fsmRectangleUtilityHelpers"; 
    import { downloadBenchRowsAsCsv, measure, clearBenchRows } from "$lib/benchmarking/profiler";
    
    export let fsmStates: string[] = [];
    export let fsmTransitions: fTransition[] = [];
    export let acceptingStates: string[] = [];
    export let startingStates: string[] = [];
    export let subgraphs: Record<string, Subgraph> = {};
    export let warps: Warp[] = [];
    export let showDepthBox: boolean = true;
    let depthText = "";
    export let renderKey: string = "";
    export let inputSequence: string ="";
    export let isFullScreen: boolean = false;
    let lastRenderKey = "";
    let lastViewportKey = "";
    let g: d3.Selection<SVGGElement, unknown, null, undefined>;
    let nodeRender: d3.Selection<SVGGElement, HStateNode, SVGGElement, unknown>;
    let edgeRender: d3.Selection<SVGPathElement, EdgeRenderingData, SVGGElement, unknown>;
    let labelRender: d3.Selection<SVGTextElement, EdgeRenderingData, SVGGElement, unknown>;

    const { nodeRadius, padding } = getGraphDefaultsFSM();
    const ZOOM_LEVEL_THRESHOLDS = new Map<number, number>([
        [1, 1.1],
        [2, 1.3],
        [3, 1.5],
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
    function semanticTickGuard() {
        if (evaluating) return;
        evaluating = true;
        const changed = updateExpansionsForZoom(lastZoomK);
        if (changed) resetBaseNodesToCanon();
            // runRectPipeline({graphWidth, graphHeight, hg, nodeRadius, subgraphRects, subgraphParent});        
        runCollisionAvoidance({graphWidth: svgElement.clientWidth, graphHeight: 0.9*svgElement.clientHeight, hg, nodeRadius, subgraphRects, subgraphParent});

        rerunDepthBox();
        rerenderGraph();
        evaluating = false;
    }

    function measureHeight() {
        const r = wrapperElement.getBoundingClientRect();
        graphWidth = Math.max(1, Math.floor(r.width));
        graphHeight = Math.max(1, Math.floor(r.height));

        d3.select(svgElement).attr("width", graphWidth).attr("height", graphHeight);

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
    const HALO_BASE_COLOURS: Record<number, string> = {
        1: "#bde0fe",
        2: "#c8b6e2",
        3: "#b9fbc0",
    };
    const HALO_FALLBACK = "#e0e0e0";

    function haloColourForDepth(depth: number): string {
        return HALO_BASE_COLOURS[depth] ?? (d3.color(HALO_FALLBACK)?.darker(depth * 0.3).formatHex() ?? HALO_FALLBACK);
    }

    function sgDepthForId(id: string): number {
        return subgraphs[id]?.depthLevel ?? 1;
    }

    function drawHalos() {
        type HaloData = { id: string; x: number; y: number; w: number; h: number; colour: string; depth: number };
        const halos: HaloData[] = [];

        for (const [id, r] of subgraphRects.entries()) {
            const depth = sgDepthForId(id);
            halos.push({ id, x: r.x, y: r.y, w: r.w, h: r.h, colour: haloColourForDepth(depth), depth });
        }

        // Draw deepest halos first so shallower ones render on top
        halos.sort((a, b) => b.depth - a.depth);

        g.select<SVGGElement>("g.debug")
            .selectAll<SVGGElement, HaloData>("g.halo")
            .data(halos, (d: HaloData) => d.id)
            .join(
                enter => {
                    const hg2 = enter.append("g").attr("class", "halo").attr("pointer-events", "none");
                    hg2.append("rect").attr("rx", 12).attr("ry", 12)
                        .attr("fill-opacity", 0.18).attr("stroke-opacity", 0.6)
                        .attr("stroke-width", 1.5).attr("stroke-dasharray", "6 3");
                    hg2.append("text").attr("font-size", 11).attr("font-weight", "600").attr("fill-opacity", 0.75);
                    return hg2;
                },
                update => update,
                exit => exit.remove()
            )
            .each(function(d) {
                const s = d3.select(this);
                const strokeCol = d3.color(d.colour)?.darker(0.8).formatHex() ?? d.colour;
                const labelCol  = d3.color(d.colour)?.darker(1.5).formatHex() ?? "#333";
                s.select("rect")
                    .attr("x", d.x).attr("y", d.y)
                    .attr("width", d.w).attr("height", d.h)
                    .attr("fill", d.colour).attr("stroke", strokeCol);
                s.select("text")
                    .attr("x", d.x + 8).attr("y", d.y + 16)
                    .attr("fill", labelCol)
                    .text(d.id);
            });
    }
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

    //TODO EDIT
    function expandSubgraph(parentId: string){
        const sg = subgraphs[parentId];
        if (!sg) {
            console.warn(`No subgraph found with id ${parentId} to expand`);
            return;
        }
        if (hg.activeSubgraphs.has(parentId)) return;
        // hg.activeSubgraphs.add(parentId);

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

        // Centre the rect on the anchor node using the true layout midpoint (W/2, H/2).
        // b.centreX/Y is unreliable: it excludes port nodes and is biased by padding,
        // causing the subgraph to drift downward instead of centering on the anchor.
        let rect: Rect = {
            x: anchorNode.x - W / 2,
            y: anchorNode.y - H / 2,
            w: W,
            h: H
        };

        //nest subsubgraphs inside parent subgraph
        let containerId: string | null = null;
        let containerRect: Rect | null = null;

        if (sg.parentState){
            containerId = hg.nodes.get(anchorId)?.parent ?? null;
            containerRect = subgraphRects.get(containerId) ?? null;

            if (!containerRect) return;

            const PAD = 20;
            const escapes = rect.x < containerRect.x + PAD
                || rect.x + rect.w > containerRect.x + containerRect.w - PAD
                || rect.y < containerRect.y + PAD
                || rect.y + rect.h > containerRect.y + containerRect.h - PAD;
            if (escapes) {
                rect = clampRectangleInside(containerRect, rect, PAD);
            }

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
            const entryOutgoing = sg.transitions.filter(t => t.from === sg.entry && t.to !== sg.exit);
            for (const t of sg.transitions){
                if (t.to !== sg.entry) continue;
                if (t.from === sg.entry) continue;
                const fromId = mkNodeId(parentId, t.from);
                if (!hg.nodes.has(fromId)) continue;

                for (const outTran of entryOutgoing){
                    const toId = mkNodeId(parentId, outTran.to);
                    if (!hg.nodes.has(toId)) continue;
                    const edgeId = `warpInChain:${parentId}:${fromId}-${toId}-${t.label ?? "undefined"}`;
                    if (hg.edges.has(edgeId)) continue;
                    hg.edges.set(edgeId,{
                        id: edgeId,
                        from: fromId,
                        to: toId,
                        label: t.label,
                        visible: true,
                        kind: "sub",
                        parent: parentId
                    });
                }
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

        for (const w of warps) {
            if (!w.into) continue;
            const { warpParent: intoParent, warpEntryExit: intoEntry } = splitWarp(w.into);
            if (intoParent !== parentId) continue;
            if (intoEntry !== sg.entry) continue;
            const sourceNode = hg.nodes.get(w.from);
            if (!sourceNode || !sourceNode.visible || sourceNode.parent === null) continue;
            if (w.from === parentId) continue;
            for (const t of sg.transitions.filter(t => t.from === sg.entry && t.to !== sg.exit)) {
                const toId = mkNodeId(parentId, t.to);
                if (!hg.nodes.has(toId)) continue;
                const edgeId = `crossWarpIn:${parentId}:${w.from}-${toId}-${t.label ?? "undefined"}`;
                if (hg.edges.has(edgeId)) continue;
                hg.edges.set(edgeId, {
                    id: edgeId,
                    from: w.from,
                    to: toId,
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
        resetHGraph();

        graphWidth = svgElement.clientWidth;
        const start = startingStates?.[0] ?? fsmStates[0];

        const levels = computeLevelsMap(fsmTransitions, start, fsmStates);
        const nodePositions = computeNodePositionsWithBackbone(
            levels,
            graphWidth,
            graphHeight,
            padding,
            acceptingStates,
            fsmTransitions,
            start,
        );    


        function snapshotBasePos(){
            canonicalBasePos.clear();
            for (const n of hg.nodes.values()){
                if (!n.parent){
                    canonicalBasePos.set(n.id, {x:n.x, y:n.y});
                }
            }
        }

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

        snapshotBasePos();
        rerunDepthBox();
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

    // let focusClickedNodeId: string | null = null;
    // let focusNodeIds = new Set<string>();
    // let focusEdgePairs = new Set<string>(); // `${from}->${to}`

    // function computeFocusSets(hg: HGraph, clickedId: string | null) {
    //     focusNodeIds = new Set();
    //     focusEdgePairs = new Set();
    //     focusClickedNodeId = clickedId;

    //     if (!clickedId) return;

    //     focusNodeIds.add(clickedId);

    //     for (const e of hg.edges.values()) {
    //         if (!e.visible) continue;
    //         if (e.from !== clickedId) continue;

    //         focusNodeIds.add(e.to);
    //         focusEdgePairs.add(`${e.from}->${e.to}`);
    //     }
    // }

    // function applyFocusOpacity(context: RenderContext) {
    //     const { g } = context;

    //     g.select("g.nodes")
    //         .selectAll<SVGGElement, HStateNode>("g.node")
    //         .attr("opacity", d => {
    //             if (!focusClickedNodeId) return 1;
    //             return focusNodeIds.has(d.id) ? 1 : 0.001;
    //         });

    //     g.select("g.edges")
    //         .selectAll<SVGPathElement, any>("path.edge")
    //         .attr("opacity", (d: any) => {
    //             if (!focusClickedNodeId) return 1;
    //             return focusEdgePairs.has(`${d.sourceNode.id}->${d.targetNode.id}`) ? 1 : 0.1;
    //         });

    //     g.select("g.labels")
    //         .selectAll<SVGTextElement, any>("text")
    //         .attr("opacity", (d: any) => {
    //             if (!focusClickedNodeId) return 1;
    //             return focusEdgePairs.has(`${d.sourceNode.id}->${d.targetNode.id}`) ? 1 : 0.1;
    //         });
    // }

    // function handleFSMNodeClick(context: RenderContext, id: string) {
    //     if (focusClickedNodeId === id) computeFocusSets(context.hg, null);
    //     else computeFocusSets(context.hg, id);

    //     applyFocusOpacity(context);
    // }

    function rerenderGraph() {
        g.attr("transform", currentZoomTransform.toString());
        const context = makeContext();
        
        drawHalos();
        drawEdges(context);
        drawNodes(context, dragBehaviour);
        if(inputSequence&& inputSequence.trim()) drawPathHighlight();

        // context.g.select("g.nodes")
        //     .selectAll<SVGGElement, HStateNode>("g.node")
        //     .on("click", (event, d) => {
        //         event.stopPropagation();
        //         handleFSMNodeClick(context, d.id);
        //     });

        // svg.on("click", () => {
        //     computeFocusSets(context.hg, null);
        //     applyFocusOpacity(context);
        // });

        // applyFocusOpacity(context);
        // drawDebugNodeRects();
    }

    function runBenchmark(n: number){
        measure("buildBaseHGraph", n, () => buildBaseHGraph());
        measure("runCollisionAvoidance", n, () => runCollisionAvoidance({graphWidth: svgElement.clientWidth, graphHeight: svgElement.clientHeight, hg, nodeRadius, subgraphRects, subgraphParent}));
        measure("totalRender", n, () => rerenderGraph());
    }
    function rerunHGraph(){
        buildBaseHGraph();
        // runRectPipeline({graphWidth: svgElement.clientWidth, graphHeight: svgElement.clientHeight, hg, nodeRadius, subgraphRects, subgraphParent});

        runCollisionAvoidance({graphWidth: svgElement.clientWidth, graphHeight: svgElement.clientHeight, hg, nodeRadius, subgraphRects, subgraphParent});
        rerunDepthBox();
        rerenderGraph();
    }
    function rerunDepthBox(){
        if (!showDepthBox) return;
        let maxDepthExpanded = 0;

        if (hg.activeSubgraphs.size > 0){
            for (const id of hg.activeSubgraphs){
                const d = subgraphs[id]?.depthLevel ?? 1;
                if (d > maxDepthExpanded) maxDepthExpanded = d;
            }
        }
        depthText = `Subgraph Depth Expanded: ${maxDepthExpanded}`;
    }
    
    onMount(() => {
        //initial render and props sorted here
        const svg = d3.select(svgElement);
        drawArrowheads(svg);
        g = addContentGroup(svg);       
        measureHeight();
        dragBehaviour = createDragNoSim(() => { drawEdges(makeContext()); drawHalos(); });

        
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
                    if (Math.abs(lastZoomK - lastSemanticZoomK) > 0.05){
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
        rerunHGraph();
    }
    $: if(mounted && isFullScreen !== undefined){
        requestAnimationFrame(() => { measureHeight(); rerenderGraph();});
    } 
    $: showDepthBox = Object.keys(subgraphs ?? {}).length > 0;
    $: if (!showDepthBox) depthText = "";

    const HIGHLIGHT_COLOUR = "#f72585";
    const TRAVEL_MS        = 350;
    const FADE_MS          = 600;
    const STAGGER_MS       = 40;

    type WalkedStep = { from: string; to: string; pathD: string };

    function buildFallbackPath(fromId: string, toId: string): string {
        const src = hg.nodes.get(fromId);
        const tgt = hg.nodes.get(toId);
        if (!src || !tgt) return "";
        if (fromId === toId) {
            const r = LOOP_RADIUS;
            return `M ${src.x} ${src.y} C ${src.x - r},${src.y - r * 2} ${src.x + r},${src.y - r * 2} ${tgt.x + 3},${tgt.y}`;
        }
        return `M ${src.x},${src.y} L ${tgt.x},${tgt.y}`;
    }

    function computeWalkedPath(seq: string): { steps: WalkedStep[]; litNodes: Set<string> } {
        const steps: WalkedStep[] = [];
        const litNodes = new Set<string>();
        if (!seq) return { steps, litNodes };

        // Infer token granularity from transition labels
        const hasSpaceLabel = fsmTransitions.some(t => (t.label ?? "").includes(" "));
        const tokens = hasSpaceLabel ? seq.split(" ").filter(Boolean) : seq.split("");

        let current = startingStates[0] ?? fsmStates[0];
        litNodes.add(current);

        for (const token of tokens) {
            const t = fsmTransitions.find(tr => tr.from === current && tr.label === token);
            if (!t) break;

            const edgeId = `base:${t.from}-${t.to}-${t.label ?? "undefined"}`;
            const edge   = hg.edges.get(edgeId);
            const pathD  = edge?.cachedPath ?? buildFallbackPath(t.from, t.to);

            steps.push({ from: t.from, to: t.to, pathD });
            litNodes.add(t.to);
            current = t.to;
        }
        return { steps, litNodes };
    }

    function drawPathHighlight() {
        if (!g) return;
        const { steps, litNodes } = computeWalkedPath(inputSequence ?? "");
        const layer = g.select<SVGGElement>("g.path-highlight");
        layer.selectAll("path.hl-edge, circle.hl-node").interrupt();

        // Edges
        type HStep = { id: string; pathD: string; opacity: number; delay: number };
        const stepData: HStep[] = steps.map((s, i) => ({
            id: `hl:${s.from}>${s.to}:${i}`,
            pathD: s.pathD,
            opacity: steps.length === 1 ? 0.8 : 0.4 + 0.4 * ((i + 1) / steps.length),
            delay: i * STAGGER_MS,
        }));

        layer.selectAll<SVGPathElement, HStep>("path.hl-edge")
            .data(stepData, d => d.id)
            .join(
                enter => {
                    const p = enter.append("path")
                        .attr("class", "hl-edge")
                        .attr("fill", "none")
                        .attr("stroke", HIGHLIGHT_COLOUR)
                        .attr("stroke-width", 4)
                        .attr("stroke-linecap", "round")
                        .attr("pointer-events", "none");
                    p.each(function(d) {
                        const el = this as SVGPathElement;
                        el.setAttribute("d", d.pathD);
                        const len = el.getTotalLength?.() ?? 80;
                        d3.select(el)
                            .attr("stroke-dasharray", len)
                            .attr("stroke-dashoffset", len)
                            .attr("opacity", 0)
                            .transition()
                            .delay(d.delay)
                            .duration(TRAVEL_MS)
                            .ease(d3.easeCubicOut)
                            .attr("stroke-dashoffset", 0)
                            .attr("opacity", d.opacity);
                    });
                    return p;
                },
                // update => update.attr("d", d => d.pathD).attr("opacity", d => d.opacity),
                update => {
                    update.each(function (d){
                    const el = this as SVGPathElement;
                    el.setAttribute("d", d.pathD);
                        const len = el.getTotalLength?.() ?? 80;
                        d3.select(el)
                            .attr("stroke-dasharray", len)
                            .attr("stroke-dashoffset", 0)
                            .attr("opacity", d.opacity);
                    });
                    return update;
                },                
                exit => exit.transition().duration(FADE_MS).attr("opacity", 0).remove(),
            );

        // Nodes
        type HNode = { id: string; x: number; y: number; r: number; opacity: number };
        const litArr = Array.from(litNodes)
            .map(nid => hg.nodes.get(nid))
            .filter((n): n is HStateNode => !!n && n.visible);

        const nodeData: HNode[] = litArr.map((n, i) => ({
            id: `hl-node:${n.id}`,
            x: n.x, y: n.y,
            r: nodeRadius + 5,
            opacity: litArr.length === 1 ? 0.8 : 0.4 + 0.4 * ((i + 1) / litArr.length),
        }));

        layer.selectAll<SVGCircleElement, HNode>("circle.hl-node")
            .data(nodeData, d => d.id)
            .join(
                enter => enter.append("circle")
                    .attr("class", "hl-node")
                    .attr("pointer-events", "none")
                    .attr("fill", "none")
                    .attr("stroke", HIGHLIGHT_COLOUR)
                    .attr("stroke-width", 2.5)
                    .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", d => d.r)
                    .attr("opacity", 0)
                    .call(sel => sel.transition().duration(200).attr("opacity", d => d.opacity)),
                update => update
                    .attr("cx", d => d.x).attr("cy", d => d.y)
                    .attr("opacity", d => d.opacity),
                exit => exit.transition().duration(FADE_MS).attr("opacity", 0).remove(),
            );
    }

    function fadeOutHighlight() {
        if (!g) return;
        g.select<SVGGElement>("g.path-highlight")
            .selectAll("path.hl-edge, circle.hl-node")
            .transition().duration(FADE_MS)
            .attr("opacity", 0)
            .on("end", function() { d3.select(this).remove(); });
    }

    $: if (mounted) {
        if (!inputSequence || inputSequence.trim() === "") {
            fadeOutHighlight();
        } else {
            drawPathHighlight();
        }
    }
</script> 

<div class="graphWrapper" bind:this={wrapperElement}>
    <svg bind:this={svgElement}></svg>

    <div class="zoomControls">
        <button type="button" class="zoomButton" title="{isFullScreen ? 'Exit fullscreen' : 'Expand'}" on:click={() => dispatch('toggleFullscreen')}>{isFullScreen ? '✕' : '⤢'}</button>
        <button type="button" class="zoomButton" on:click={zoomIn}>+</button>
        <button type="button" class="zoomButton" on:click={zoomOut}>-</button>
        <button type="button" class="zoomButton" on:click={zoomReset}>⟳</button>
    </div>
    {#if showDepthBox}
        <div class = "depthBox">{depthText}</div>
    {/if}

    <!-- <div>
        <button on:click={() => { clearBenchRows(); runBenchmark(fsmStates.length); console.log(benchRows); }}>
            Run Benchmark
        </button>
        <button on:click={() => downloadBenchRowsAsCsv(`bench_${fsmStates.length}.csv`)}>
            Download Benchmark CSV
        </button>
    </div> -->
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
    .depthBox{
        position: absolute;
        top: 10px;
        left: 10px;
        padding: 4px 8px;
        border: 1px solid #ccc;
        background: rgba(255,255,255,0.85);
        border-radius: 8px;
        font-size: 14px;
        color: #333;
        user-select: none;
        pointer-events: none;
    }
</style>