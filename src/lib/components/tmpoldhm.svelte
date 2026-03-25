<script lang="ts">
    import { onMount } from "svelte";
    import * as d3 from "d3";
    import type { StateNode, mTransition, HGraph, HStateNode, HEdge } from '$lib/graph/graphTypes';
    import { getGraphDefaultsMarkov } from '$lib/graph/graphDefaults';
    import { createDragNoSim, computeEdgePoints, computeCurvedPath, computeSelfLoopPath } from '$lib/graph/graphBehaviours';

    //export props
    export let markovStates: string[] = [];
    export let markovTransitions: mTransition[] = [];
    export let mStartingStates: string[] = [];
    export let endState: string[] = [];
    export let filterPairs: [string,string][] = [];
    export let showDirectionalColours: boolean = false;
    export let showEdgeLabels: boolean = true;
    export let weightedThickness: boolean = true;
    export let renderKey: string = "";
    export let wordChains: Record<string, {markovStates: string[]; mStartingStates: string[]; markovTransitions: mTransition[]} > = {};

    //consts
    const minstrokewidth = 0.01;
    const ZOOM_EXPAND_THRESHOLD = 1.8;
    const BASE_NODE_RADIUS = 15;
    // const WORD_NODE_RADIUS = 10;    
    const LABEL_OFFSET = 6;
    const COLOUR_PALETTE = //TODO: CHANGE GENERAL
    [
        "#bde0fe","#ffc8dd","#cdb4db","#b9fbc0","#fde8b0",
    ]; 
    const DEFAULT_COLOUR = "#e0e0e0";

    //svg
    let svgElement: SVGSVGElement;
    let wrapperElement: HTMLDivElement;
    let g: d3.Selection<SVGGElement, unknown, null, undefined>;
    let dragBehaviour: d3.DragBehavior<SVGGElement, HStateNode, unknown>;
    let zoomBehaviour: d3.ZoomBehavior<SVGSVGElement, unknown>;
    let graphWidth = 800;
    let { graphHeight, padding } = getGraphDefaultsMarkov();
        //todo: shared with fsm viewer
    let currentZoomTransform = d3.zoomIdentity;
    let evaluating = false;
    let lastZoomK = 1;
    let lastSemanticZoomK = 1;
    let mounted = false;
    let lastRenderKey = "";
    let subgraphColours: Record<string, string> = {};

    //hgraph - share w fsm other than 
    let hg: HGraph = {
        nodes: new Map<string, HStateNode>(),
        edges: new Map<string, HEdge>(),
        activeSubgraphs: new Set<string>()
    };
    let hiddenEdgesBySubgraph = new Map<string, string[]>(); //subgraphId -> edgeIds
    let canonicalSectionPos = new Map<string, { x: number; y: number }>();
    let levels = new Map<string,number>();
    let maxLevel = 0;
    type EdgeRender = {
        id: string; from: string; to:string; label: string | undefined;
        path: string; labelX: number; labelY: number;
        angle: number; strokeWidth: number; isUpward: boolean; probability: number;
        isBidirectional: boolean;
        sourceNode: HStateNode; targetNode: HStateNode;
    };

    //focus and filter
    let focusClckdNodeId: string | null = null;
    let focusClckNodeIds = new Set<string>();
    let focusClckEdgeIds = new Set<string>();
    // type EdgeDatum = {
    //     source: StateNode;
    //     target: StateNode;
    //     probability: number;
    //     curvature?: number;
    // };
    // let graphNodes: StateNode[] = [];
    // let visibleEdges: EdgeDatum[] = [];
    // let visibleEdgesCopy: EdgeDatum[] = []; //mutable
    // let nodeLayer: any;
    // let edgeLayer: any;
    // let edgeLabelLayer: any;
    let activeNodeIds = new Set<string>();
    // let nodeRadius = 15;
    // let ready = false;

    
    
    //helpers TODO: abstract

    function measureHeight() {
        const r = wrapperElement.getBoundingClientRect();
        graphWidth = Math.max(1, Math.floor(r.width));
        graphHeight = Math.max(10, Math.floor(r.height));
        d3.select(svgElement).attr("width", graphWidth).attr("height", graphHeight);
    }

    function buildSubgraphColours(){
        subgraphColours = {};
        markovStates.forEach((id, i) => {
            subgraphColours[id] = COLOUR_PALETTE[i % COLOUR_PALETTE.length];
        });
    }

    function nodeColour(d: HStateNode){
        if (d.kind === "base") return subgraphColours[d.id] ??  DEFAULT_COLOUR;
        const base = subgraphColours[d.parent ?? ""] ?? DEFAULT_COLOUR;
        return d3.color(base)?.brighter(0.7)?.formatHex() ?? DEFAULT_COLOUR;
    }

    //layout
    function calculatePositionLayout() {
        levels.clear();
        maxLevel = 0;
        const innerW = graphWidth - 2*padding;
        const innerH = graphHeight - 2*padding;
        const centerx = padding + innerW / 2;
        const centery = padding + innerH / 2;
        const adjacency = new Map<string, string[]>();
        const positions = new Map<string, { x: number; y: number }>();

        for (const t of markovTransitions) {
            if (!adjacency.has(t.from)) adjacency.set(t.from, []);
            adjacency.get(t.from)!.push(t.to);
        };

        // Step 1: identify BFS levels for each node from start, if there is a starting state.
        const hasStartingState = mStartingStates.length > 0;
        const start = mStartingStates[0] ?? markovStates[0];
        const queue: string[] = [];


        if (hasStartingState) {
            for (const s of mStartingStates) {
                levels.set(s, 0);
                queue.push(s);
            }

            while (queue.length > 0) {
                const current = queue.shift()!;
                for (const next of adjacency.get(current) ?? []) {
                    if (!levels.has(next)) {
                        levels.set(next, (levels.get(current) ?? 0) + 1);
                        queue.push(next);
                    }
                }
            }
            maxLevel = Math.max(...levels.values());
            //if unreadcagvle, put it at max+1
            for (const s of markovStates) if (!levels.has(s)) levels.set(s, maxLevel + 1);


            //start of special edits for python assignments
            if (levels.get("=") === 3|| levels.get(" ") === 2) {
                levels.set("=", 1.5);
                levels.set(" ", 1.5);
            }
            
            const letters = "abcdefghijklmnopqrstuvwxyz";
            const digits = new Set("0123456789".split(""));
            const row1 = new Set(letters.slice(0, 14).split(""));
            const row2 = new Set(letters.slice(14).split(""));
            if (renderKey === "5::7::S4:END::S0:START"){
                for (const [id, lvl] of levels.entries()) {
                // if (lvl !== 1) continue;
                if (digits.has(id)) {
                    levels.set(id, 2.5);
                    continue;
                }
                const base = id.toLowerCase();
                if (row1.has(base)) levels.set(id, 0.6);
                else if (row2.has(base)) levels.set(id, 1.1);
            }
            if (levels.get("_") === 1) levels.set("_", 1.1);
            //end of edits for python assignments
            }

            
            //
            // Step 2: spread out nodes horizonatally within their vertical spacing BFS levels
            //
            const groupedByLevel = new Map<number, string[]>();
            for (const [s, lvl] of levels) {
                if (!groupedByLevel.has(lvl)) groupedByLevel.set(lvl, []);
                groupedByLevel.get(lvl)!.push(s);
            }
            const rowSpacing = innerH / Math.max(maxLevel);

            for (const [lvl, nodes] of groupedByLevel){
                const y = padding + lvl * rowSpacing;
                const colSpacing = innerW / (nodes.length+1);
                nodes.forEach((id, i) =>{
                    positions.set(id, { x: padding + colSpacing * (i + 1), y });
                })
            }
            //pin start and end
            for (const s of mStartingStates){
                positions.set(s, { x: graphWidth/2, y: BASE_NODE_RADIUS*2 });
            }
            for (const s of endState){
                positions.set(s, { x: graphWidth/2, y: graphHeight - BASE_NODE_RADIUS*2 });
            }

            //linear becomes zigzag
            const allSingletons = Array.from(groupedByLevel.values()).every(arr => arr.length ===1);
            if (allSingletons && maxLevel >= 2) {
                const ZIG = 50;
                for (const [level, nodes] of groupedByLevel){
                    if (level === 0 ) continue;
                    const pos = positions.get(nodes[0])!;
                    pos.x = graphWidth/2 +(level%2 ===1? ZIG : -ZIG*0.35);
                }
            }
        }
        else {
            //circle/polygon if no starting state
            const angleStep = (2 * Math.PI) / markovStates.length;
            markovStates.forEach((s, i) => {
                const angle = i * angleStep;
                positions.set(s, {
                     x: centerx + (innerW / 2 - BASE_NODE_RADIUS - 10) * Math.cos(angle),
                     y: centery + (innerH / 2 - BASE_NODE_RADIUS - 10) * Math.sin(angle)
                });
                levels.set(s, 0);
            });
            maxLevel = 0;
        }
        return positions;
    }

    function computeSubgraphLayout(parentId: string, anchorX: number, anchorY: number): Map<string, {x: number; y: number}>{
        const COLUMN_W = 52;
        const ROW_H = 42;
        const SQUEEZE_PX_THRESH = 270; //18 node radiuses
        const MAX_ROW_NODES = Math.max(2, Math.floor(SQUEEZE_PX_THRESH/COLUMN_W));
        const ZIG = 40;
        
        const sg = wordChains[parentId];
        if (!sg) return new Map<string, {x: number; y: number}>();
        const { markovStates: states, markovTransitions: transitions, mStartingStates: starts } = sg;

        const adj = new Map<string, string[]>();
        for (const t of transitions){
            if (!adj.has(t.from)) adj.set(t.from, []);
            adj.get(t.from)!.push(t.to);
        }

        const levels = new Map<string, number>();
        const startNode = starts[0] ?? states[0];
        levels.set(startNode, 0);
        const queue = [startNode];
        while (queue.length > 0){
            const current = queue.shift()!;
            for (const next of adj.get(current) ?? []){
                if (!levels.has(next)){
                    levels.set(next, (levels.get(current)!) + 1);
                    queue.push(next);
                }
            }
        }

        const maxLevel = levels.size > 0 ? Math.max(...levels.values()) : 0;
        for (const s of states) if (!levels.has(s)) levels.set(s, maxLevel + 1);

        const groupedByLevel = new Map<number, string[]>();
        for (const [s, lvl] of levels) {
            if (!groupedByLevel.has(lvl)) groupedByLevel.set(lvl, []);
            groupedByLevel.get(lvl)!.push(s);
        }

        // if bottom BFS is a wide layer, rerun a second BFS on the layer to wrap 
        const allBunchedNodes = Array.from(groupedByLevel.values()).every(arr => arr.length === 1);
        function betweenBunchedOrder(levelNodes: string[]): string[]{
            const nodes = new Set(levelNodes);

            const intraAdj = new Map<string, string[]>();
            const intraIndegree = new Map<string, number>();
            for (const n of levelNodes){ intraAdj.set(n, []); intraIndegree.set(n,0);}
            for (const t of transitions){
                if(nodes.has(t.from) && nodes.has(t.to)){
                    intraAdj.get(t.from)!.push(t.to);
                    intraIndegree.set(t.to, (intraIndegree.get(t.to) ?? 0) + 1);
                    intraAdj.get(t.to)!.push(t.from);
                    intraIndegree.set(t.from, (intraIndegree.get(t.from) ?? 0) + 1);
                }
            }

            const sortedHigestDeg = [...nodes].sort((a,b) => (intraIndegree.get(b) ?? 0) - (intraIndegree.get(a) ?? 0));
            const visited = new Set<string>();
            const order: string[] = [];
            const bfsQ : string[] = [];

            for (const n of sortedHigestDeg){
                if (visited.has(n)) continue;
                bfsQ.push(n);
                visited.add(n);
                while (bfsQ.length > 0){
                    const current = bfsQ.shift()!;
                    order.push(current);
                    const neighbours = (intraAdj.get(current) ?? []).filter(n => !visited.has(n)).sort((a,b) => (intraIndegree.get(b) ?? 0) - (intraIndegree.get(a) ?? 0));
                    for (const next of neighbours){
                        if (!visited.has(next)){
                            visited.add(next);
                            bfsQ.push(next);
                        }
                    }
                }
            }
            return order;

        }
        //build rows
        type pRows = {levelNodes: string[]; xOffset: number};
        const rows: pRows[] = [];
        for (const lvl of Array.from(groupedByLevel.keys()).sort((a,b) => a-b)){
            const levelNodes = groupedByLevel.get(lvl) ?? [];
            if (allBunchedNodes){
                //linear chain
                rows.push({levelNodes, xOffset: lvl%2 ===1 ? ZIG : -ZIG*0.35 });
            } else if (levelNodes.length * COLUMN_W > SQUEEZE_PX_THRESH && levelNodes.length > MAX_ROW_NODES){
                //crowded bottom BFS
                const wrappedNodes = betweenBunchedOrder(levelNodes);
                for (let i = 0; i < wrappedNodes.length; i+=MAX_ROW_NODES){
                    rows.push({levelNodes: wrappedNodes.slice(i, i+MAX_ROW_NODES), xOffset: 0});
                }
            } else {
                //normal BFS row
                rows.push({levelNodes, xOffset: 0});
            }
        }

        //position assing
        const totalH = Math.max(rows.length * ROW_H, 80);
        const topY = anchorY - totalH/2;
        const positions = new Map<string, {x: number; y: number}>();

        rows.forEach((row, rowIndex)=>{
            const y = topY + rowIndex * ROW_H + ROW_H/2;
            const totalRowW = (row.levelNodes.length - 1) * COLUMN_W;
            row.levelNodes.forEach((id, i) => {
                positions.set(id, {
                    x: anchorX + row.xOffset + (row.levelNodes.length === 1 ? 0 : i * COLUMN_W - totalRowW/2),
                    y
                });
            });
        });

        return positions;

    }


    //todo fsm abstract
    function resetHGraph() {
        hg.nodes.clear();
        hg.edges.clear();
        hg.activeSubgraphs.clear();
        hiddenEdgesBySubgraph.clear();
        canonicalSectionPos.clear();
    }
    function buildBaseHGraph() {
        resetHGraph();

        const positions = calculatePositionLayout();
        for (const id of markovStates) {
            const p = positions.get(id);
            if (!p) continue;
            hg.nodes.set(id, {
                id,
                displayName: id,
                x: p.x,
                y: p.y,
                parent: null,
                depth: 1,
                visible: true,
                kind: "base"
            });
            canonicalSectionPos.set(id, { x: p.x, y: p.y });
        }


        for (const t of markovTransitions) {
            const id = `base:${t.from}-${t.to}`;
            hg.edges.set(id, {
                id,
                from: t.from,
                to: t.to,
                label: t.probability?.toFixed(2),
                visible: true,
                kind: "base",
                parent: null
            });
        }
    }
    function expandSubgraph(parentId: string){
        if (hg.activeSubgraphs.has(parentId)) return;
        const chain = wordChains[parentId];
        if (!chain) return;
        const anchor = hg.nodes.get(parentId);
        if (!anchor || !anchor.visible) return;   

        const sgPos = computeSubgraphLayout(parentId, anchor.x, anchor.y);

        for (const sgId of chain.markovStates){
            const nodeId = `${parentId}:${sgId}`;
            const p = sgPos.get(sgId) ?? {x: anchor.x, y: anchor.y};
            hg.nodes.set(nodeId, {
                id: nodeId,
                displayName: sgId,
                x: p.x,
                y: p.y,
                parent: parentId,
                depth: anchor.depth + 1,
                visible: true,
                kind: "sub"
            });
        }

        for (const t of chain.markovTransitions){
            const fromId = `${parentId}:${t.from}`;
            const toId = `${parentId}:${t.to}`;
            const edgeId = `sub:${parentId}:${fromId}-${toId}`;
            hg.edges.set(edgeId, {
                id: edgeId,
                from: fromId,
                to: toId,
                label: t.probability?.toFixed(2),
                visible: true,
                kind: "sub",
                parent: parentId
            });
        }

        anchor.visible = false;
        const hidden: string[] = [];
        for (const [edgeId, edge] of hg.edges){
            if (edge.kind !== "base") continue;
            if (edge.from === parentId || edge.to === parentId){
                    edge.visible = false;
                    hidden.push(edgeId);
            }
        }
        hiddenEdgesBySubgraph.set(parentId, hidden);
        hg.activeSubgraphs.add(parentId);
    }
    function collapseSubgraph(parentId: string){
        if (!hg.activeSubgraphs.has(parentId)) return;
        for (const [id, node] of hg.nodes){
            if (node.parent === parentId) hg.nodes.delete(id);
        }
        for (const [id, edge] of hg.edges){
            if (edge.parent === parentId) hg.edges.delete(id);
        }
        const anchor = hg.nodes.get(parentId);
        if (anchor){
            anchor.visible = true;
            const canonicalPos = canonicalSectionPos.get(parentId);
            if (canonicalPos) {
                anchor.x = canonicalPos.x;
                anchor.y = canonicalPos.y;
            }
        }
        const hidden = hiddenEdgesBySubgraph.get(parentId) ?? [];
        for (const edgeId of hidden){
            const edge = hg.edges.get(edgeId);
            if (edge) edge.visible = true;
        }
        hiddenEdgesBySubgraph.delete(parentId);
        hg.activeSubgraphs.delete(parentId);
    }
    function computeFocusClckSets(id: string|null){
        focusClckdNodeId = id;
        focusClckNodeIds = new Set();
        focusClckEdgeIds = new Set();
        if (!id) return;

        focusClckNodeIds.add(id);

        for (const e of hg.edges.values()){
            if (!e.visible) continue;
            if (e.from === id || e.to === id){
                focusClckEdgeIds.add(e.id);
                focusClckNodeIds.add(e.from);
                focusClckNodeIds.add(e.to);
            }
        }
    }
    function isInView(node: StateNode, transform: d3.ZoomTransform) {
        const x = node.x * transform.k + transform.x;
        const y = node.y * transform.k + transform.y;
        return (x >= 0 && x <= graphWidth && y >= 0 && y <= graphHeight);
    }

    function handleNodeClick(id: string){
        if (focusClckdNodeId === id) {
            computeFocusClckSets(null);
        } else {
            computeFocusClckSets(id);
        }
        drawNodes();
        drawEdges();
    }
    function drawNodes() {
        // const dragHandler = createDragNoSim(() => drawEdges());
        const nodeData = Array.from(hg.nodes.values()).filter(n => n.visible);

        g.select<SVGGElement>("g.nodes")
            .selectAll<SVGGElement, StateNode>("g.node")
            .data(nodeData, (n: any) => n.id)
            .join(enter => {
                const n = enter.append("g")
                    .attr("class", "node")
                    .attr("transform", d => `translate(${d.x},${d.y})`)
                    .call(dragBehaviour as any)
                    .on("click", (_, d) => handleNodeClick(d.id));
                n.append("circle")
                    .attr("r", BASE_NODE_RADIUS)
                    .attr("stroke-width", d => (endState.includes(d.id) ? 3 : 0.5))
                n.append("text")
                    .attr("text-anchor", "middle")
                    .attr("dy", 4)
                    .attr("font-size", 9)
                    .attr("pointer-events", "none");         
                return n;
            },
            update => update.attr("transform", d => `translate(${d.x},${d.y})`),
            exit => exit.remove(),
        ).each(function(d: HStateNode){
            const sel = d3.select(this);
            sel.select("circle")
                .attr("fill", d => endState.includes(d.id) ? "lightgreen" : mStartingStates.includes(d.id) ? "lightgrey" : DEFAULT_COLOUR)
                .attr("opacity", () => {
                    if (focusClckdNodeId) return focusClckNodeIds.has(d.id) ? 1 : 0.2;
                    if (activeNodeIds.size === 0) return 1;
                    return activeNodeIds.has(d.id) ? 1 : 0.2;
                })
                .attr("stroke",
                    mStartingStates.includes(d.id) ? "#3a86ff" : endState.includes(d.id) ? "#2dc653" : "#555"
                );
            sel.select("text").text(d.displayName);
            });

    }

    function drawEdges() {
            const edgeData = Array.from(hg.edges.values()).filter(e => e.visible);
            const pairSet = new Set(edgeData.map(e => `${e.from}|${e.to}`));

            const renderData: EdgeRender[] = edgeData.flatMap(e => {
                const sourceNode = hg.nodes.get(e.from);
                const targetNode = hg.nodes.get(e.to);
                if (!sourceNode || !targetNode) return [];
                const isSelfLoop = e.from === e.to;
                const isBidirectional = !isSelfLoop && pairSet.has(`${e.to}|${e.from}`);
                const p = parseFloat(e.label ?? "0");
                let path: string; let labelX: number; let labelY: number;
                const LOOP_RADIUS = Math.max(BASE_NODE_RADIUS + 12, 24);

                if (isSelfLoop) {
                    path   = computeSelfLoopPath(sourceNode, LOOP_RADIUS);
                    labelX = sourceNode.x + LOOP_RADIUS + 10;
                    labelY = sourceNode.y - LOOP_RADIUS * 2;
                } else if (isBidirectional) {
                    path   = computeCurvedPath(sourceNode, targetNode, LOOP_RADIUS, 1);
                    // labelX = (sourceNode.x + targetNode.x) / 2 + 12;
                    // labelY = (sourceNode.y + targetNode.y) / 2 - LABEL_OFFSET;
                    const CURVE = 14;
                    const mx = (sourceNode.x + targetNode.x) / 2;
                    const my = (sourceNode.y + targetNode.y) / 2;
                    const dx = targetNode.x - sourceNode.x;
                    const dy = targetNode.y - sourceNode.y;
                    const len = Math.hypot(dx, dy) || 1;
                    labelX = mx + (-dy / len) * CURVE;
                    labelY = my + ( dx / len) * CURVE;
                } else {
                    const { x1, y1, x2, y2 } = computeEdgePoints(sourceNode, targetNode, BASE_NODE_RADIUS);
                    path   = `M ${x1},${y1} L ${x2},${y2}`;
                    labelX = (sourceNode.x + targetNode.x) / 2 + 8;
                    labelY = (sourceNode.y + targetNode.y) / 2 - LABEL_OFFSET;
                }

                const angleRad = Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x);
                let angleDeg   = angleRad * (180 / Math.PI);
                if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;

                return [{
                    id: e.id, from: e.from, to: e.to, label: e.label,
                    path, labelX, labelY,
                    angle: isSelfLoop ? 0 : angleDeg,
                    strokeWidth: Math.max(0.5, p * 2),
                    isUpward: targetNode.y < sourceNode.y,
                    isBidirectional,
                    probability: p, sourceNode, targetNode, 
                }];
            });

        const visibleRenderData = renderData.filter(d => 
            isInView(d.sourceNode, currentZoomTransform) && isInView(d.targetNode, currentZoomTransform)
        );

        const edgeLayer = g.select(".edges")
            .selectAll<SVGPathElement, EdgeRender>("path.edge")
            .data(visibleRenderData, d => d.id)
            .join(
                enter => enter.append("path").attr("class", "edge"),
                update => update,
                exit => exit.remove()
            )
            .attr("fill", "none")
			.attr('stroke', d => {
                if (!showDirectionalColours) return 'black';
                return (d.isUpward ? 'lightpink' : 'black');
            })
            .attr("stroke-width", d => {
                if (!weightedThickness) return 1;
                let thickness =d.probability*2;
                if (d.probability < 0.036) thickness = 0.01;
                return thickness;
            })
            .attr('marker-end', d => {
                   if (!showDirectionalColours) return 'url(#arrow-black)';
                   return d.isUpward ? 'url(#arrow-black)' : 'url(#arrow-pink)';
                })
            .attr("d", d => d.path)
            .attr("opacity", (d: EdgeRender) => {
                if (focusClckdNodeId) {
                    return focusClckEdgeIds.has(d.id) ? 1 : 0.1;
                }
                if (activeNodeIds.size === 0) return 1;
                return (activeNodeIds.has(d.from) && activeNodeIds.has(d.to)) ? 1 : 0.05;
            });
        //hover probability tooltip
        edgeLayer.select("title").remove() // avoid duplicates
        edgeLayer.append("title").text((d) => `${d.from} → ${d.to}\nP = ${d.probability}`);

        // function labelBumpCurved(d: EdgeRender){ {
        //     if (d.from === d.to) {
        //         return -3.5;
        //     }
        //     // else return (d.from < d.to) ? -1: 2;
        //     else if (d.from < d.to && d.source.x < d.target.x) return 2;
        //     else if (d.from > d.to && d.source.x < d.target.x) return 2;
        //     else if (d.from < d.to && d.source.x > d.target.x) return -1;
        //     else if (d.from > d.to && d.source.x > d.target.x) return -1;
        //     }
        // }


        g.select("g.edge-labels")
            .selectAll<SVGTextElement, EdgeRender>("text.edge-label")
            .data(showEdgeLabels ? visibleRenderData : [],  d => d.id)
            .join(
                enter => enter.append("text").attr("class", "edge-label"),
                update => update,
                exit => exit.remove()
            )
            .attr("font-size", 9)
            .attr("text-anchor", "middle")
            .attr("transform", d => (d.isBidirectional || d.from === d.to) ? `translate(${d.labelX},${d.labelY})`:`translate(${d.labelX},${d.labelY}) rotate(${d.angle})`)
            .attr("pointer-events", "none")
            .attr("fill", "#555")
            .attr("opacity", d => {
                if (focusClckdNodeId) {
                    return focusClckEdgeIds.has(d.id) ? 1 : 0.1;
                }
                if (activeNodeIds.size > 0) {
                    return (activeNodeIds.has(d.from) && activeNodeIds.has(d.to)) ? 1 : 0.05;
                }
                return 1;
            })
            .text(d => d.label ?? "")
        
    }

    function drawHalos(){
        type HaloData = {id: string; x: number; y:number; w:number; h:number; colour:string}
        const halos: HaloData[] =[];

        for (const sectionId of hg.activeSubgraphs){
            const children = Array.from(hg.nodes.values()).filter(n => n.parent === sectionId && n.visible);
            if (!children.length) continue;
            const xs = children.map(n => n.x);
            const ys = children.map(n => n.y);
            const pad = BASE_NODE_RADIUS *2.5;
            halos.push({
                id: sectionId, 
                x: Math.min(...xs) - pad, y: Math.min(...ys) - pad,
                w: Math.max(...xs) - Math.min(...xs) + pad * 2,
                h: Math.max(...ys) - Math.min(...ys) + pad * 2,
                colour: COLOUR_PALETTE[Math.random()*4+1] ?? DEFAULT_COLOUR,
            });
        }

        g.select<SVGGElement>("g.halos")
            .selectAll<SVGGElement, HaloData>("g.halo")
            .data(halos, d=> d.id)
            .join(
                enter => {
                    const hg2 = enter.append("g").attr("class", "halo");
                    hg2.append("rect")
                        .attr("rx", 12)
                        .attr("ry", 12)
                        .attr("fill-opacity", 0.15)
                        .attr("stroke-opacity",0.5)
                        .attr("stroke-width",1.5)
                        .attr("stroke-dasharray","6 3");
                    hg2.append("text").attr("font-size",12).attr("font-weight", 600).attr("fill-opacity", 0.7);
                    return hg2;
                },
                update => update,
                exit => exit.remove(),
            )
            .each(function(d){
                const s = d3.select(this);
                s.select("rect")
                    .attr("x", d.x)
                    .attr("y", d.y)
                    .attr("width",d.w)
                    .attr("height",d.h)
                    .attr("fill", d.colour)
                    .attr("stroke",d.colour)
                s.select("text")
                    .attr("x", d.x+8)
                    .attr("y",d.y+16)
                    .attr("fill", d3.color(d.colour)?.darker(1.2).formatHex() ?? "#333")
                    .text(d.id);
            });
    }
    function drawSectionEdges(){}; //TODO complete
    function updateExpansionsForZoom(k: number){
        let changed = false;
        for (const parentId of markovStates){
            if (!wordChains[parentId]) continue;
            const want = k >= ZOOM_EXPAND_THRESHOLD;
            const has = hg.activeSubgraphs.has(parentId);
            if (want && !has) {
                expandSubgraph(parentId);
                changed=true;
            } else if (!want && has){
                collapseSubgraph(parentId);
                changed = true;
            }
        }
        return changed;

    }
    function semanticTickGuard() {
        if (evaluating) return;
        evaluating = true;
        const changed = updateExpansionsForZoom(lastZoomK);
        if (changed) rerenderGraph();
        evaluating = false;
    }
    function rerenderGraph() {
        g.attr("transform", currentZoomTransform.toString());
        drawHalos();
        drawSectionEdges();
        drawEdges();
        drawNodes();
    }
    function init() {
        buildSubgraphColours();
        measureHeight();
        buildBaseHGraph();
        lastZoomK = 1;
        lastSemanticZoomK = 1;
        rerenderGraph();
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
    onMount(() => {
        const svg = d3.select(svgElement);
 
        g = svg.append("g").attr("class", "content-group");
        g.append("g").attr("class", "halos");
        g.append("g").attr("class", "section-edges");
        g.append("g").attr("class", "edges");
        g.append("g").attr("class", "edge-labels");
        g.append("g").attr("class", "nodes");
 
        const defs = svg.append("defs");
 
       [
            { id: "arrow-black", color: "black" },
            { id: "arrow-pink", color: "lightpink" }
        ].forEach(({ id, color }) => {
            defs.append("marker")
                .attr("id", id)
                .attr("viewBox", [0, 0, 10, 10])
                .attr("refX", 7)
                .attr("refY", 5)
                .attr("markerUnits", "strokeWidth")
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("orient", "auto")
                .append("path")
                .attr("d", "M 0 0 L 10 5 L 0 10 z")
                .attr("fill", color);
        });
        // defs.append("marker")
        //     .attr("id", "arrow-section")
        //     .attr("viewBox", [0, 0, 10, 10])
        //     .attr("refX", 9).attr("refY", 5)
        //     .attr("markerUnits", "userSpaceOnUse")
        //     .attr("markerWidth", 10).attr("markerHeight", 10)
        //     .attr("orient", "auto")
        //     .append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", "#888");
 
        dragBehaviour = createDragNoSim(() => { drawEdges(); drawHalos(); drawSectionEdges(); });
 
        zoomBehaviour = d3.zoom<SVGSVGElement, unknown>()
            .on("zoom", event => {
                currentZoomTransform = event.transform;
                g.attr("transform", event.transform.toString());
                if (event.sourceEvent instanceof WheelEvent) {
                    lastZoomK = event.transform.k;
                    if (Math.abs(lastZoomK - lastSemanticZoomK) > 0.05) {
                        lastSemanticZoomK = lastZoomK;
                        requestAnimationFrame(semanticTickGuard);
                    }
                }
            });
 
        svg.call(zoomBehaviour);
        mounted = true;
        init();
 
        const handleResize = () => {graphWidth = svgElement.clientWidth;};
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    });

    $: if (mounted && renderKey !== lastRenderKey) {
        lastRenderKey = renderKey;
        init();
    }
    $: if (mounted){
        showDirectionalColours;
        showEdgeLabels;
        weightedThickness;
        drawEdges();    
    }
    $: if (mounted && filterPairs){
        if (filterPairs.length === 0) {
            for (const e of hg.edges.values()){
                if (e.kind  === "base") {
                e.visible = true;
                }
            }
        } else {
            const pairSet = new Set(filterPairs.map(([a,b]) => `${a}|${b}`));
            activeNodeIds = new Set<string>();
            for (const e of hg.edges.values()){
                if (e.kind  !== "base") continue;
                const match = pairSet.has(`${e.from}|${e.to}`);
                e.visible = match;
                if (match) { activeNodeIds.add(e.from); activeNodeIds.add(e.to);}
            }
        }
        drawNodes();
        drawEdges();
    }
</script>

<div style="flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
    <div class="controls">
    </div>
    <div class="graphWrapper" bind:this={wrapperElement}>
        <svg bind:this={svgElement}></svg>
        <div class="zoomControls">
            <button type="button" class="zoomButton" on:click={zoomIn}>+</button>
            <button type="button" class="zoomButton" on:click={zoomOut}>−</button>
            <button type="button" class="zoomButton" on:click={zoomReset}>⟳</button>
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

</style>
