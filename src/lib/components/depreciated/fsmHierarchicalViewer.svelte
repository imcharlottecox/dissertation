<script lang="ts">
    import { onMount } from "svelte";
    import * as d3 from "d3";
    import { createDragNoSim, createDragSubgraph } from "$lib/graph/graphBehaviours";
    import type { fTransition, Subgraph, Warp, EdgeRenderDatum, StateNode, HGraph, HStateNode, HEdge } from "$lib/graph/graphTypes";
    import { getGraphDefaultsFSM } from "$lib/graph/graphDefaults";
    import { computeLevelsMap, computeNodePositions, splitWarp } from "../fsm/fsmHierarchicalHelpers";
    
    export let fsmStates: string[] = [];
    export let fsmTransitions: fTransition[] = [];
    export let acceptingStates: string[] = [];
    export let startingStates: string[] = [];
    export let subgraphs: Record<string, Subgraph> = {};
    export let warps: Warp[] = [];
    
    // const start = startingStates?.[0] ?? fsmStates[0];
    const { graphHeight, nodeRadius, padding } = getGraphDefaultsFSM();
    let graphWidth = 720;
    let svgElement: SVGSVGElement;
    const LABEL_OFFSET = 6;
    const LOOP_RADIUS = Math.max(nodeRadius + 12, 24);
    const cleanId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const haloBounds: Record<string, { x: number, y: number, w: number, h: number }> = {};

    // let hiddenNodes = new Set<string>();
    let currentZoomTransform = d3.zoomIdentity;
    // let graphNodes: StateNode[] = [];
    let baseEdges: fTransition[] = [];
    let visibleEdges: fTransition[] = [];
    let graphState = {
        activeRoot: "0:START",
        expanded: new Set<string>(), //node w opened subgraphs
        nodes: [],
        edges: [],
    }
    let g: d3.Selection<SVGGElement, unknown, null, undefined>;
    let nodeRender: d3.Selection<SVGGElement, HStateNode, SVGGElement, unknown>;
    let edgeRender: d3.Selection<SVGPathElement, EdgeRenderDatum, SVGGElement, unknown>;
    let labelRender: d3.Selection<SVGTextElement, EdgeRenderDatum, SVGGElement, unknown>;
    // let activeSubgraph: string | null = null;
    let activeSubgraphs: Set<string> = new Set();
    // let subNodePositions: Record<string, { id: string; x: number; y: number, parent: string }> = {};
    let hg: HGraph = {
        nodes: new Map(),
        edges: new Map(),
        activeSubgraphs: new Set()
    };
    const forcedYOffset: Record<string, number> = {};
    const lanes: Record<string, { 
        top: number; 
        bottom: number; 
        x: number; 
        width: number; 
    }> = {};
    const childLanes: Record<string, { top: number, bottom: number }[]> = {};
    let depthDisplayText: d3.Selection<SVGTextElement, unknown, null, undefined>;


    // function lookupNode(id: string): {id: string, x: number, y: number} | undefined {
    //     return graphNodes.find(n => n.id === id) || subNodePositions[id];
    // }
    function showNode(id: string) {
        // hiddenNodes.delete(id);
        // nodeRender.filter(d => d.id === id).style("display", null);
        // g.selectAll("g.subnode")
        //     .filter((d: any) => d.id === id)
        //     .style("display", null);
        const n = hg.nodes.get(id);
        if (n) n.visible = true;
    }

    function hideNode(id: string) {
        // hiddenNodes.add(id);
        // nodeRender.filter(d => d.id === id).style("display", "none");
        // g.selectAll("g.subnode").filter((d: any) => d.id === id).style("display", "none");
        const n = hg.nodes.get(id);
        if (n) n.visible = false;
    }
    function handleNodeClick(id: string) {
        if (!subgraphs[id]) return; //if not a subgraph, ignore
        // if (activeSubgraph === id) { // todo logic doesnt work anymore bc parent node disappears when sub displayed
        //     removeSubgraph(id);
        // }
        // else drawSubgraph(id);
    }
    function isNodeInViewport(x: number, y: number, transform: any) {
        const sx = x * transform.k + transform.x;
        const sy = y * transform.k + transform.y;
        return sx >= 0 && sx <= graphWidth && sy >= 0 && sy <= graphHeight;
    }

    //hides the edges to/from a subgraph node 
    function applyWarpsFor() {

        //removes parent node edges
        console.log("active subg", activeSubgraphs);
        console.log("general subgraphs:", subgraphs);
        let edges: fTransition[] = [...baseEdges];

        for (const parentId of activeSubgraphs){
            const subgraph = subgraphs[parentId];
            if (!subgraph) {continue};
            // edges = edges.filter(e => e.from !== parentId && e.to !== parentId);
            // edges = edges.filter(e => !hiddenNodes.has(e.from) && !hiddenNodes.has(e.to));
            edges = edges.filter(e =>
                hg.nodes.get(e.from)?.visible !== false &&
                hg.nodes.get(e.to)?.visible !== false
            );
            const entryWarp = warps.find(w => {
                const { warpParent, warpEntryExit } = splitWarp(w.into);
                return warpParent === parentId && warpEntryExit === subgraph.entry;
            });
            //add edges entry warp to subgraph nodes
            if (entryWarp) {
                subgraph.transitions
                    .filter(t => t.from === subgraph.entry)
                    .forEach(t => {
                        if (t.to !== subgraph.exit) {
                            edges.push({
                                from: entryWarp.from,
                                to: t.to,
                                label: t.label
                            });
                        }
                    });
            }

            //add internal edges exclusing etry exit
            edges.push(...subgraph.transitions.filter(t => 
                t.from !== subgraph.entry && 
                t.to !== subgraph.exit &&
                t.from !== subgraph.exit &&
                t.to !== subgraph.entry
            ));

            const exitWarp = warps.find(w => {
                if (!w.from || !w.backto) return false;
                const { warpParent, warpEntryExit } = splitWarp(w.from);
                return warpParent === parentId && warpEntryExit === subgraph.exit;
            });
            if (exitWarp) {
                subgraph.transitions
                    .filter(t => t.to === subgraph.exit)
                    .forEach(t => {
                        edges.push({
                            from: t.from,
                            to: exitWarp.backto ?? "",
                            label: t.label
                        });
                    });
            }
        }

        visibleEdges = edges;
    }

    function drawEdges() {
        const edges = Array.from(hg.edges.values()).filter(e => e.visible);
        
        // const coord = new Map();
        // graphNodes.forEach(n => coord.set(n.id, { x: n.x, y: n.y }));
        // Object.entries(subNodePositions).forEach(([id, p]) =>
        //     coord.set(id, { x: p.x, y: p.y })
        // );

        const data: EdgeRenderDatum[] = edges
            .map(t => {
                const source = hg.nodes.get(t.from);
                const target = hg.nodes.get(t.to);
                if (!source || !target) return null;
                const isLoop = t.from === t.to;
                const labelX = (source.x + target.x) / 2;
                const labelY = (source.y + target.y) / 2 - LABEL_OFFSET;
                const path = isLoop
                    ? `M ${source.x} ${source.y}
                    C ${source.x - LOOP_RADIUS}, ${source.y - LOOP_RADIUS * 2},
                        ${source.x + LOOP_RADIUS}, ${source.y - LOOP_RADIUS * 2},
                        ${target.x +3}, ${target.y}`
                    : `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
                return {
                    key: `${t.from}-${t.to}-${t.label}`,
                    label: t.label,
                    fromId: t.from,
                    toId: t.to,
                    source,
                    target,
                    path,
                    labelX,
                    labelY: isLoop? labelY -40 : labelY,
                    isLoop
                };
            })
            .filter(Boolean) as EdgeRenderDatum[];

        edgeRender = g
            .select<SVGGElement>(".edges")
            .selectAll<SVGPathElement, EdgeRenderDatum>("path")
            .data(data, d => d.key)
            .join(
                enter => enter.append("path").attr("class", "edge"),
                update => update,
                exit => exit.remove() 
            )
            .attr("class", "edge")
            .attr("fill", "none")
            .attr("stroke", "grey")
            .attr("marker-end", d =>
                d.isLoop ? "url(#arrowhead-loop)" : "url(#arrowhead-straight)"
            )
            .attr("d", (d: EdgeRenderDatum) => d.path);

        labelRender = g
            .select<SVGGElement>(".labels")
            .selectAll<SVGTextElement, EdgeRenderDatum>("text")
            .data(data, d => d.key)
            .join(
                enter => enter.append("text"),
                update => update,
                exit => exit.remove() 
            )
            .attr("font-size", 9)
            .attr("text-anchor", "middle")
            .attr("x", d => d.labelX)
            .attr("y", d => d.labelY)
            .text(d => d.label ?? "");
            
    }

    function drawNodes() {
        const drag = createDragNoSim(drawEdges);
        const data = Array.from(hg.nodes.values()).filter(n => n.visible);

        nodeRender = g
            .select<SVGGElement>(".nodes")
            .selectAll<SVGGElement, HStateNode>("g")
            // .data(graphNodes)
            .data(data, d => d.id)
            .join(enter => {
                const n = enter
                    .append("g")
                    .attr("transform", d => `translate(${d.x},${d.y})`)
                    .call(drag)
                    .on("click", (_, d: StateNode) => handleNodeClick(d.id));
                n.append("circle")
                    .attr("r", nodeRadius)
                    .attr("fill", d => acceptingStates.includes(d.id) ? "lightgreen" : startingStates.includes(d.id) ? "lightgrey" :"lightblue")
                    .attr("stroke", "black")
                    .attr("stroke-width", d => (acceptingStates.includes(d.id) ? 3 : 0.5));

                n.append("text")
                    .attr("text-anchor", "middle")
                    .attr("dy", 4)
                    .attr("font-size", 9)
                    .text(d => d.id);

                return n;
            },
            update =>
                update.attr("transform", d => `translate(${d.x},${d.y})`),
            exit => exit.remove()
        );

        // nodeRender.attr("transform", d => `translate(${d.x},${d.y})`);
    
    }
function computeSubgraphHorizontalBounds(parentNode: HStateNode, entryWarp, exitWarp, graphWidth: number) {
    const entryX = entryWarp
        ? (hg.nodes.get(entryWarp.from)?.x ?? parentNode.x)
        : parentNode.x;

    const exitX = exitWarp
        ? (exitWarp.backto ? (hg.nodes.get(exitWarp.backto)?.x ?? parentNode.x) : parentNode.x)
        : parentNode.x;

    const minX = Math.min(entryX, exitX);
    const maxX = Math.max(entryX, exitX);

    const layoutWidth = Math.max(120, maxX - minX);

    return { minX, maxX, layoutWidth };
}
function computeSubgraphVerticalBounds(parentNode: HStateNode) {
    const availableAbove = parentNode.y - 40;
    const availableBelow = graphHeight - parentNode.y - 40;

    const layoutHeight = Math.max(80, Math.min(availableAbove + availableBelow, 200));

    return {
        layoutHeight,
        centerY: parentNode.y
    };
}
function updateDepthDisplay() {
    // Get only expanded subgraphs
    const active = [...hg.activeSubgraphs];

    if (active.length === 0) {
        depthDisplayText.text("Max subgraph depth: 1");
        return;
    }

    let maxDepth = 1;
    for (const id of active) {
        const sg = subgraphs[id];
        if (sg?.level && sg.level > maxDepth) {
            maxDepth = sg.level;
        }
    }

    depthDisplayText.text(`Max subgraph depth: ${maxDepth}`);
}

//     function drawSubgraph(parentId: string) {
//         const subgraph = subgraphs[parentId];
//         if (!subgraph) return;
//         if (hg.activeSubgraphs.has(parentId)) return;
//         hg.activeSubgraphs.add(parentId);

//         const parentNode = hg.nodes.get(parentId) || (subgraph.parentState ? hg.nodes.get(subgraph.parentState) : undefined);

//         const entryWarp = warps.find(w => {
//             const { warpParent, warpEntryExit } = splitWarp(w.into);
//             return warpParent === parentId && warpEntryExit === subgraph.entry;
//         });
//         const exitWarp = warps.find(w => {
//             const { warpParent, warpEntryExit } = splitWarp(w.from);
//             return warpParent === parentId && warpEntryExit === subgraph.exit;
//         });

//         const { minX, layoutWidth } = computeSubgraphHorizontalBounds(parentNode, entryWarp, exitWarp, graphWidth);

//         // --- COMPUTE LAYOUT HEIGHT FROM VERTICAL SPACE ---
//         // const { layoutHeight, centerY } =  computeSubgraphVerticalBounds(parentNode);

//         // if (parentNode) parentNode.visible = false;
//         // let parentNode = lookupNode(parentId);
//         // if (!parentNode) {
//         //     const sg = subgraphs[parentId];
//         //     if (sg?.parentState) {
//         //         parentNode = lookupNode(sg.parentState);
//         //     }
//         // }
//         const levels = computeLevelsMap(subgraph.transitions, subgraph.entry, subgraph.states);
//         // const layout = computeNodePositions(levels, 250, 150, 20);

        
// const maxLevel = Math.max(...levels.values());
// const rows = maxLevel + 1;
// const rowHeight = 60;  
// const layoutHeight = Math.max(80, rows * rowHeight);
// const layout = computeNodePositions(levels, layoutWidth, layoutHeight , 10); 
// const baseY = parentNode!.y;
// const bandTop = baseY - layoutHeight/2 + 60;
// const bandBottom = baseY + layoutHeight/2 + 10;
// const fullSubTop    = baseY - layoutHeight/2;
// const fullSubBottom = baseY + layoutHeight/2;
// const overlapping = [...hg.nodes.values()].filter(n =>
//     n.visible &&
//     n.parent !== parentId &&
//     n.y >= fullSubTop &&
//     n.y <= fullSubBottom
// );

// const overlappers = overlapping.map(n => n.y);

// let shift = 0;

// if (subgraph.level > 1 && overlapping.length > 0) {
//         const minOverlapY = Math.min(...overlappers);
//         shift =  fullSubBottom - minOverlapY;
//         if (shift < 0) shift = 0;
// }
// console.log("shift for subgraph", parentId, "is", shift);
// // Apply the shift
// if (shift > 0) {
//     for (const node of hg.nodes.values()) {
//         if (node.parent !== parentId && node.y > baseY) {
//             node.y += shift;
//         }
//     }
// }

//     const subgraphBaseY = baseY + shift;
//         const offsetX = minX;
//         const offsetY = subgraphBaseY - layoutHeight / 2;


//         for (const stateId of subgraph.states) {
//             if (stateId === subgraph.entry || stateId === subgraph.exit) continue;

//             const position = layout.get(stateId);
//             if (!position) continue;
            
//             hg.nodes.set(stateId, {
//                 id: stateId,
//                 // x: (parentNode?.x ?? 0) + position.x,
//                 // y: (parentNode?.y ?? 0) + position.y,
//                 x: offsetX + position.x,
//                 y: offsetY + position.y,
//                 parent: parentId,
//                 level: (subgraph.level ?? 1) + 1,
//                 visible: true,
//                 kind: "sub"
//             });
//         }
//         for (const t of subgraph.transitions) {
//             if (t.from === subgraph.entry || t.to === subgraph.exit) continue;
//             hg.edges.set(`${t.from}-${t.to}-${t.label}-${parentId}`, {
//                 id: `${t.from}-${t.to}-${t.label}-${parentId}`,
//                 from: t.from,
//                 to: t.to,
//                 label: t.label,
//                 visible: true,
//                 kind: "sub",
//                 parent: parentId
//             });
//         }

//         if (entryWarp) {
//             for (const t of subgraph.transitions.filter(t => t.from === subgraph.entry && t.to !== subgraph.exit)) {
//                 hg.edges.set(`${entryWarp.from}-${t.to}-entry-${parentId}`, {
//                     id: `${entryWarp.from}-${t.to}-entry-${parentId}`,
//                     from: entryWarp.from,
//                     to: t.to,
//                     label: t.label,
//                     visible: true,
//                     kind: "warp",
//                     parent: parentId

//                 });
//             }
//         };
//         if (exitWarp) {
//             for (const t of subgraph.transitions.filter(t => t.to === subgraph.exit)) {
//                 hg.edges.set(`${t.from}-${exitWarp.backto}-exit-${parentId}`, {
//                     id: `${t.from}-${exitWarp.backto}-exit-${parentId}`,
//                     from: t.from,
//                     to: exitWarp.backto!,
//                     label: t.label,
//                     visible: true,
//                     kind: "warp",
//                     parent: parentId

//                 });
//             }
//         }
//         if (parentNode) parentNode.visible = false;
//         for (const [id, edge] of hg.edges) {
//             if (edge.from === parentId || edge.to === parentId ||
//                 edge.from === subgraph.parentState || edge.to === subgraph.parentState) {
//                 edge.visible = false;
//             }
//         }
//         drawNodes();
//         drawEdges();
//         // const entryNode = entryWarp ? lookupNode(entryWarp.from) : parentNode;
//         // const exitNode = lookupNode(exitWarp?.backto ?? "") ?? parentNode;

//         // //only draw within parent's graph bounds todo: maybe implement layoutheight for y as well in case of busier graphs
//         // const minX = Math.min(entryNode?.x ?? 0, exitNode?.x ?? graphWidth);
        
//         // const maxX = Math.max(entryNode?.x ?? graphWidth, exitNode?.x ?? graphWidth);
//         // const layoutWidth = maxX - minX;
//         // const layoutHeight = 120; 
//         // const centerY = parentNode.y;
//         // const yBase = subgraph.level > 1 ? (centerY - layoutHeight / 2) : entryNode!.y;   

//         // const insideStates = subgraph.states.filter(s => s !== subgraph.entry && s !== subgraph.exit);
        
//         // // const levels = computeLevelsMap(subgraph.transitions, subgraph.entry, subgraph.states);
//         // // // get subgraph relative xy positions by calling compute node pos
//         // const allPositions = computeNodePositions(levels, layoutWidth, layoutHeight , 10); 
//         // const entryPortPos = allPositions.get(subgraph.entry);
//         // const entryX = entryPortPos?.x ?? padding;
//         // const entryY = entryPortPos?.y ?? padding;
                
//         // const pos = new Map();
//         // insideStates.forEach(id => {
//         //     if (!allPositions.has(id)) {
//         //         allPositions.set(id, {x: entryX + Math.random() * 40, y: entryY + Math.random() * 40});
//         //     }
//         //     pos.set(id, allPositions.get(id)!);
//         // });

//         // //transform x y into parent relative global positions
//         // const subNodes = insideStates.map(id => {
//         //     const nodePos = pos.get(id);
//         //     const xOffset = nodePos.x - entryX;
//         //     const yOffset = nodePos.y - entryY;
//         //     return {
//         //         id,
//         //         x: minX + xOffset,           
//         //         y: yBase + yOffset,  
//         //         starting: subgraph.startingStates.includes(id),
//         //         accepting: subgraph.acceptingStates.includes(id)
//         //     };
//         // });
//         // if (parentId === "3:VALUE.EXPR") {
//         //     subNodes.forEach(n => n.y += 200);
//         //     forcedYOffset[parentId] = 200;
//         // } else {
//         //     forcedYOffset[parentId] = 0;
//         // }
//         // subNodes.forEach(n => (subNodePositions[n.id] = { x: n.x, y: n.y, parent: parentId })); //global nodestates needed for sub edge drawing
        
//         // const drag = createDragSubgraph(drawEdges, subNodePositions, () => currentZoomTransform);
//         // const xs = subNodes.map(n => n.x);
//         // const ys = subNodes.map(n => n.y);

//         // const paddingHalo = 30; // softness margin

//         // const haloX = d3.min(xs)! - paddingHalo;
//         // const haloY = d3.min(ys)! - paddingHalo;
//         // const haloW = (d3.max(xs)! - haloX) + paddingHalo;
//         // const haloH = (d3.max(ys)! - haloY) + paddingHalo;
//         // const HALO_COLOURS = {
//         //     1: "rgba(230,230,230,0.35)", 
//         //     2: "rgba(210,210,255,0.25)", 
//         //     3: "rgba(200,255,200,0.20)",
//         // };
        
//         // const rename = `subgraph-${cleanId(parentId)}`;
//         // //hide node where came from
//         // if (subgraph.parentState) {
//         //     hideNode(subgraph.parentState);
//         // } else {
//         //     hideNode(parentId);
//         // }

//         // const group = g.append("g").attr("class", rename).attr("opacity", 0);
//         // group.append("g").attr("class", "edges");
//         // group.append("g").attr("class", "labels");

//         // group.insert("rect", ":first-child")
//         //     .attr("class", "halo-rect")
//         //     .attr("x", haloX)
//         //     // .attr("y", haloY)
//         //     .attr("y", haloY )
//         //     .attr("width", haloW)
//         //     .attr("height", haloH)
//         //     .attr("rx", 10)
//         //     .attr("fill", HALO_COLOURS[subgraph.level] || "rgba(220,220,220,0.3)")
//         //     .attr("stroke", "rgba(120,120,120,0.5)")
//         //     .attr("stroke-width", 1)
//         //     .style("opacity", 0)
//         //     .transition()
//         //     .duration(200)
//         //     .style("opacity", 1);
        
//         // group.selectAll("g.subnode")
//         //     .data(subNodes)
//         //     .join(enter => {
//         //         const sn = enter
//         //             .append("g")
//         //             .attr("class", "subnode")
//         //             .attr("transform", d => `translate(${d.x},${d.y})`)
//         //             .call(drag);

//         //         sn.append("circle")
//         //             .attr("r", 12)
//         //             .attr("stroke", "black")
//         //             .attr("stroke-width", d => (d.accepting ? 2 : 1))
//         //             .attr("fill", d => d.accepting ? "lightgreen" : d.starting ? "lightgrey" : "lightblue");

//         //         sn.append("text")
//         //             .attr("text-anchor", "middle")
//         //             .attr("dy", 4)
//         //             .attr("font-size", 9)
//         //             .text(d => d.id);
    


//         // group.append("text")
//         //     .attr("class", "halo-label")
//         //     .attr("x", haloX + haloW/12)
//         //     .attr("y", haloY + 8)
//         //     .attr("font-size", 6)
//         //     .attr("fill", "grey")
//         //     .text(`from: ${parentId}`);
//         //         return sn;
//         //     });


//         // activeSubgraphs.add(parentId);
//         // applyWarpsFor();
//         // drawEdges();
//         // labelRender.raise();
//         // group.raise().transition().duration(200).attr("opacity", 1);
//     }
function drawHaloForSubgraph(parentId: string, subgraph: Subgraph) {
    // Collect all nodes belonging to this subgraph
    const nodes = [...hg.nodes.values()].filter(n => n.parent === parentId);

    if (nodes.length === 0) return;

    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);

    const padding = 30;

    const haloX = d3.min(xs)! - padding;
    const haloY = d3.min(ys)! - padding;
    const haloW = (d3.max(xs)! - d3.min(xs)!) + padding * 2;
    const haloH = (d3.max(ys)! - d3.min(ys)!) + padding * 2;

    const colourMap = {
        1: "rgba(230,230,255,0.25)",
        2: "rgba(200,255,200,0.22)",
        3: "rgba(255,230,200,0.22)"
    };

    const haloGroup = g.append("g")
        .attr("class", `halo-${cleanId(parentId)}`)
        .lower(); // ensure halos sit behind nodes

    haloGroup.append("rect")
        .attr("x", haloX)
        .attr("y", haloY)
        .attr("width", haloW)
        .attr("height", haloH)
        .attr("rx", 12)
        .attr("fill", colourMap[subgraph.level] || "rgba(220,220,220,0.25)")
        .attr("stroke", "rgba(100,100,100,0.4)")
        .attr("stroke-width", 1.2)
        .attr("opacity", 0)
        .transition()
        .duration(180)
        .attr("opacity", 1);

        haloGroup.append("text")
        .attr("x", haloX + 10)
        .attr("y", haloY + 18)
        .attr("font-size", 9)
        .attr("fill", "grey")
        .text(`Subgraph: ${parentId}`);

    haloBounds[parentId] = { x: haloX, y: haloY, w: haloW, h: haloH };

}

function removeHalo(parentId: string) {
    g.selectAll(`.halo-${cleanId(parentId)}`).remove();
}
function allocateLane(parentId: string, parentNode: HStateNode, W: number, H: number) {
    const GAP = 60;  // vertical space between lanes
    const stack = childLanes[parentId];

    // Natural placement: directly below parent
    let top = parentNode.y + GAP;
    let bottom = top + H;

    // Resolve collisions with existing lanes
    for (const otherId of Object.keys(lanes)) {
        const L = lanes[otherId];

        const overlap =
            (top <= L.bottom && bottom >= L.top);

        if (overlap) {
            top = L.bottom + GAP;
            bottom = top + H;
        }
    }

    // Horizontal centring on parent
    const x = parentNode.x - W / 2;

    lanes[parentId] = { top, bottom, x, width: W };
    return lanes[parentId];
}

function computeLaneWidth(parentNode: HStateNode, entryWarp, exitWarp, minWidth = 140) {
    const anchors = [parentNode.x];

    if (entryWarp) {
        const src = hg.nodes.get(entryWarp.from);
        if (src) anchors.push(src.x);
    }
    if (exitWarp && exitWarp.backto) {
        const t = hg.nodes.get(exitWarp.backto);
        if (t) anchors.push(t.x);
    }

    const minX = Math.min(...anchors);
    const maxX = Math.max(...anchors);

    return Math.max(minWidth, maxX - minX + 80);  // add breathing room
}

function computeHaloBounds(parentId: string) {
    const nodes = [...hg.nodes.values()].filter(n => n.parent === parentId);
    if (nodes.length === 0) return null;

    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);

    const minX = Math.min(...xs) - 20;
    const minY = Math.min(...ys) - 20;
    const maxX = Math.max(...xs) + 20;
    const maxY = Math.max(...ys) + 20;

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}


// function drawSubgraph(parentId: string) {
//     const subgraph = subgraphs[parentId];
//     if (!subgraph) return;
//     if (hg.activeSubgraphs.has(parentId)) return;
//     hg.activeSubgraphs.add(parentId);

//     const parentNode =
//         hg.nodes.get(parentId) ||
//         (subgraph.parentState ? hg.nodes.get(subgraph.parentState) : undefined);

//     if (!parentNode) return;

//     // --- Find entry/exit warp anchors ---
//     const entryWarp = warps.find(w => {
//         const { warpParent, warpEntryExit } = splitWarp(w.into);
//         return warpParent === parentId && warpEntryExit === subgraph.entry;
//     });

//     const exitWarp = warps.find(w => {
//         const { warpParent, warpEntryExit } = splitWarp(w.from);
//         return warpParent === parentId && warpEntryExit === subgraph.exit;
//     });

//     // --- Compute horizontal lane ---
//     const { minX, layoutWidth } = computeSubgraphHorizontalBounds(
//         parentNode,
//         entryWarp,
//         exitWarp,
//         graphWidth
//     );

//     // --- Compute internal subgraph layout (relative positions) ---
//     const levels = computeLevelsMap(
//         subgraph.transitions,
//         subgraph.entry,
//         subgraph.states
//     );

//     const maxLevel = Math.max(...levels.values());
//     const rows = maxLevel + 1;
//     const rowHeight = 60;
//     const layoutHeight = Math.max(80, rows * rowHeight);

//     const layout = computeNodePositions(levels, layoutWidth, layoutHeight, 10);

//     // === NEW: Compute ACTUAL footprint relative to parent ===
//     const relPositions = [...layout.values()];
//     const relMinY = Math.min(...relPositions.map(p => p.y));
//     const relMaxY = Math.max(...relPositions.map(p => p.y));

//     const baseY = parentNode.y;

//     // Projected absolute top/bottom before shifting
//     const projectedTop =
//         baseY - layoutHeight / 2 + relMinY;
//     const projectedBottom =
//         baseY - layoutHeight / 2 + relMaxY;

//     // === NEW: detect overlapping nodes using projected future footprint ===
//     const overlapping = [...hg.nodes.values()].filter(n =>
//         n.visible &&
//         n.parent !== parentId &&
//         n.y >= projectedTop &&
//         n.y <= projectedBottom
//     );

//     let shift = 0;

//     if (subgraph.level > 1 && overlapping.length > 0) {
//         const nearest = Math.min(...overlapping.map(n => n.y));
//         shift = (projectedBottom - nearest) + 30;
//         if (shift < 0) shift = 0;
//     }

//     // === Apply downward shift to all nodes BELOW parent ===
//     if (shift > 0) {
//         for (const node of hg.nodes.values()) {
//             if (node.parent !== parentId && node.y > baseY) {
//                 node.y += shift;
//             }
//         }
//     }

//     // Final base Y after shift
//     const subgraphBaseY = baseY + shift;
//     let offsetX = minX;
//     let offsetY = subgraphBaseY - layoutHeight / 2;
// if (parentId === "3:VALUE.EXPR") {
//     const boolHalo = haloBounds["3:VALUE.BOOL"];

//     if (boolHalo) {
//         // place EXPR above BOOL
//         const exprCenterX = hg.nodes.get("3:VALUE")?.x ?? parentNode.x;
//         offsetX = exprCenterX - layoutWidth / 2;

//         offsetY = boolHalo.y - 200 - 40; // 40px gap
//     }
// }

// if (parentId === "3:VALUE.BOOL") {
//     const exprHalo = haloBounds["3:VALUE.EXPR"];

//     if (exprHalo) {
//         // place BOOL beneath EXPR
//         const boolCenterX = hg.nodes.get("3:VALUE")?.x ?? parentNode.x;
//         offsetX = boolCenterX - layoutWidth / 2;

//         offsetY = exprHalo.y + exprHalo.h + 40; // 40px gap
//     }
// }
// if (haloBounds["3:VALUE.EXPR"]) {
//     const expr = haloBounds["3:VALUE.EXPR"];

//     const floatNode = hg.nodes.get("FLOAT");
//     if (floatNode) {
//         floatNode.y = expr.y + expr.h + 60; // 60px gap
//     }
// }
//     // --- Insert subgraph nodes ---
//     for (const stateId of subgraph.states) {
//         if (stateId === subgraph.entry || stateId === subgraph.exit) continue;

//         const pos = layout.get(stateId);
//         if (!pos) continue;

//         hg.nodes.set(stateId, {
//             id: stateId,
//             x: offsetX + pos.x,
//             y: offsetY + pos.y,
//             parent: parentId,
//             level: (subgraph.level ?? 1) + 1,
//             visible: true,
//             kind: "sub"
//         });
//     }

//     // --- Internal edges ---
//     for (const t of subgraph.transitions) {
//         if (t.from === subgraph.entry || t.to === subgraph.exit) continue;

//         hg.edges.set(`${t.from}-${t.to}-${t.label}-${parentId}`, {
//             id: `${t.from}-${t.to}-${t.label}-${parentId}`,
//             from: t.from,
//             to: t.to,
//             label: t.label,
//             visible: true,
//             kind: "sub",
//             parent: parentId
//         });
//     }

//     // --- Warp ENTRY edges ---
//     if (entryWarp) {
//         for (const t of subgraph.transitions.filter(t => t.from === subgraph.entry && t.to !== subgraph.exit)) {
//             hg.edges.set(`${entryWarp.from}-${t.to}-entry-${parentId}`, {
//                 id: `${entryWarp.from}-${t.to}-entry-${parentId}`,
//                 from: entryWarp.from,
//                 to: t.to,
//                 label: t.label,
//                 visible: true,
//                 kind: "warp",
//                 parent: parentId
//             });
//         }
//     }

//     // --- Warp EXIT edges ---
//     if (exitWarp) {
//         for (const t of subgraph.transitions.filter(t => t.to === subgraph.exit)) {
//             hg.edges.set(`${t.from}-${exitWarp.backto}-exit-${parentId}`, {
//                 id: `${t.from}-${exitWarp.backto}-exit-${parentId}`,
//                 from: t.from,
//                 to: exitWarp.backto!,
//                 label: t.label,
//                 visible: true,
//                 kind: "warp",
//                 parent: parentId
//             });
//         }
//     }

//     // --- Hide parent node and edges ---
//     parentNode.visible = false;

//     for (const edge of hg.edges.values()) {
//         if (
//             edge.from === parentId ||
//             edge.to === parentId ||
//             edge.from === subgraph.parentState ||
//             edge.to === subgraph.parentState
//         ) {
//             edge.visible = false;
//         }
//     }
//     drawHaloForSubgraph(parentId, subgraph);

//     drawNodes();
//     drawEdges();
// }
function drawSubgraph(parentId: string) {
    const subgraph = subgraphs[parentId];
    if (!subgraph) return;
    if (hg.activeSubgraphs.has(parentId)) return;
    hg.activeSubgraphs.add(parentId);

    // Node that this subgraph hangs off
    const parentNode =
        hg.nodes.get(parentId) ||
        (subgraph.parentState ? hg.nodes.get(subgraph.parentState) : undefined);

    if (!parentNode) return;

    const entryWarp = warps.find(w => {
        const { warpParent, warpEntryExit } = splitWarp(w.into);
        return warpParent === parentId && warpEntryExit === subgraph.entry;
    });

    const exitWarp = warps.find(w => {
        const { warpParent, warpEntryExit } = splitWarp(w.from);
        return warpParent === parentId && warpEntryExit === subgraph.exit;
    });

    const levels = computeLevelsMap(
        subgraph.transitions,
        subgraph.entry,
        subgraph.states
    );

    const maxLevel = Math.max(...levels.values());
    const rows = maxLevel + 1;
    const rowHeight = 60;
    let H = Math.max(100, rows * rowHeight);
    if (parentId === "3:VALUE.BOOL") {
        H = 180; 
    }
    const W = computeLaneWidth(parentNode, entryWarp, exitWarp);

    const layout = computeNodePositions(levels, W, H, 12);


    let offsetX: number;
    let offsetY: number;

    if (!subgraph.parentState) {
        // Top-level subgraph: centred on its own parent node
        const top = parentNode.y - H / 2;
        const bottom = top + H;
        const x = parentNode.x - W / 2;
        lanes[parentId] = { top, bottom, x, width: W };

        offsetX = x;
        offsetY = top;
    } else {
        // Simple default for nested subgraphs: just under their parent node
        const top = parentNode.y + 40;
        const bottom = top + H;
        const x = parentNode.x - W / 2;

        lanes[parentId] = { top, bottom, x, width: W };

        offsetX = x;
        offsetY = top;
    }


    const valueNode = hg.nodes.get("3:VALUE");
    if (valueNode && (parentId === "3:VALUE.BOOL" || parentId === "3:VALUE.EXPR")) {
        const cx = valueNode.x;
        const cy = valueNode.y;
        const GAP = 150; // vertical distance from VALUE centre

        offsetX = cx - W / 2;

        if (parentId === "3:VALUE.BOOL") {
            // BOOL above VALUE
            offsetY = (cy - GAP) - H / 2;
        } else {
            // EXPR below VALUE
            offsetY = (cy + GAP) - H / 2;
        }
    }


    for (const stateId of subgraph.states) {
        if (stateId === subgraph.entry || stateId === subgraph.exit) continue;

        const p = layout.get(stateId);
        if (!p) continue;

        hg.nodes.set(stateId, {
            id: stateId,
            x: offsetX + p.x,
            y: offsetY + p.y,
            parent: parentId,
            level: (subgraph.level ?? 1) + 1,
            visible: true,
            kind: "sub"
        });
    }

    // Internal edges
    for (const t of subgraph.transitions) {
        if (t.from === subgraph.entry || t.to === subgraph.exit) continue;

        hg.edges.set(`${t.from}-${t.to}-${t.label}-${parentId}`, {
            id: `${t.from}-${t.to}-${t.label}-${parentId}`,
            from: t.from,
            to: t.to,
            label: t.label,
            visible: true,
            kind: "sub",
            parent: parentId
        });
    }

    // Entry warps
    if (entryWarp) {
        for (const t of subgraph.transitions.filter(t => t.from === subgraph.entry && t.to !== subgraph.exit)) {
            hg.edges.set(`${entryWarp.from}-${t.to}-entry-${parentId}`, {
                id: `${entryWarp.from}-${t.to}-entry-${parentId}`,
                from: entryWarp.from,
                to: t.to,
                label: t.label,
                visible: true,
                kind: "warp",
                parent: parentId
            });
        }
    }

    // Exit warps
    if (exitWarp) {
        for (const t of subgraph.transitions.filter(t => t.to === subgraph.exit)) {
            hg.edges.set(`${t.from}-${exitWarp.backto}-exit-${parentId}`, {
                id: `${t.from}-${exitWarp.backto}-exit-${parentId}`,
                from: t.from,
                to: exitWarp.backto!,
                label: t.label,
                visible: true,
                kind: "warp",
                parent: parentId
            });
        }
    }


    // if (!subgraph.parentState) {
    //     parentNode.visible = false;

    //     for (const edge of hg.edges.values()) {
    //         if (edge.from === parentId || edge.to === parentId) {
    //             edge.visible = false;
    //         }
    //     }
    // }
    const parentToHide = subgraph.parentState || parentId;
const parentNodeToHide = hg.nodes.get(parentToHide);

if (parentNodeToHide) {
    parentNodeToHide.visible = false;
}

// Hide edges touching the hidden parent
for (const edge of hg.edges.values()) {
    if (edge.from === parentToHide || edge.to === parentToHide) {
        edge.visible = false;
    }
}


    const hb = computeHaloBounds(parentId);
    if (hb) {
        g.append("rect")
            .attr("class", `halo-${cleanId(parentId)}`)
            .attr("x", hb.x)
            .attr("y", hb.y)
            .attr("width", hb.width)
            .attr("height", hb.height)
            .attr("rx", 12)
            .attr("fill", "rgba(220,220,255,0.22)")
            .attr("stroke", "rgba(100,100,100,0.4)")
            .attr("stroke-width", 1.1)
            .lower()
            .transition()
            .duration(180)
            .attr("opacity", 1);

        
    }
    updateDepthDisplay();

    drawNodes();
    drawEdges();
}

    function removeSubgraph(parentId: string) {
        const sg = subgraphs[parentId];
        if (!sg) return;
        for (const [id, node] of hg.nodes) {
            if (node.parent === parentId) {
                hg.nodes.delete(id);
            }
        }
        for (const [id, edge] of hg.edges) {
            if (edge.parent === parentId) {
                hg.edges.delete(id);
            }
            if (edge.parent === undefined || edge.parent === null) {
                if (edge.from === parentId || edge.to === parentId ||
                    edge.from === sg.parentState || edge.to === sg.parentState) {
                    edge.visible = true;
                }
            }
        }

        const parentState = sg.parentState ?? parentId;
        const parentNode = hg.nodes.get(parentState);
        // reshow parent nodes 
        if (parentNode) {
            parentNode.visible = true;
        } else {
            showNode(parentId);
        }
        restoreParentEdges(parentId, sg);
    removeHalo(parentId);
updateDepthDisplay();

        hg.activeSubgraphs.delete(parentId);
        applyWarpsFor();
        drawNodes();
        drawEdges();
    }
function restoreParentEdges(parentId: string, sg: Subgraph) {
    const parentState = sg.parentState ?? parentId;

    for (const edge of hg.edges.values()) {
        if (edge.parent === parentId) continue;

        if (
            edge.from === parentId ||
            edge.to === parentId ||
            edge.from === parentState ||
            edge.to === parentState
        ) {
            edge.visible = true;
        }
    }
}


    function handleSemanticZoom(k: number, transform: any) {
        const width = graphWidth; //curent viewport size, may change
        const height = graphHeight;
        const threshold1 = 1.1;  
        const threshold2 = 1.6;  
        const threshold3 = 3.0; 

        for (const parentId of Object.keys(subgraphs)) {
            const sg = subgraphs[parentId];
            let parentNode = hg.nodes.get(parentId) || hg.nodes.get(sg.parentState);

            // if (!parentNode && sg.parentState) {
            //     parentNode = hg.nodes.get(sg.parentState);
            // }

            if (!parentNode) {
                continue;
            }
            // const parentVisible = parentNode.visible !== false;
            // const inView = isNodeInViewport(parentNode.x, parentNode.y, transform);
            // if (!inView) { //colapse subgraph if parent not in view
            //     if (hg.activeSubgraphs.has(parentId)) {
            //         removeSubgraph(parentId);
            //         applyWarpsFor();
            //         drawEdges();
            //     }
            //     continue;
            // }
            
            const level = sg.level ?? 1;
            // if (!isNodeInViewport(parentNode.x, parentNode.y, transform)) continue;
            // let shouldExpand =
            //     (level <= 1 && k >= threshold1) ||
            //     (level <= 2 && k >= threshold2) ||
            //     (level <= 3 && k >= threshold3);

            const threshold =
                level === 1 ? threshold1 :
                level === 2 ? threshold2 :
                threshold3;

            const shouldExpand = k >= threshold;
            if (shouldExpand) {
                //expand only if not already expanded
                if (!hg.activeSubgraphs.has(parentId)) {
                    drawSubgraph(parentId);
                    applyWarpsFor();
                    drawEdges();
                    // labelRender.raise();
                }
            } else {
                if (hg.activeSubgraphs.has(parentId)) {
                    removeSubgraph(parentId); //collapse if now below threshold
                    applyWarpsFor();
                    drawEdges();
                    // labelRender.raise();
                }
            }
            // for (const sgId of Object.keys(subgraphs)) {
            //     // const pos = subNodePositions[sgId];
            //     // const pos = hg.nodes.get(sgId)
            //     // if (!pos) continue; // not drawn at this level
            //     const parent = hg.nodes.get(sgId) || hg.nodes.get(subgraphs[sgId].parentState);
            //     if (!parent) continue;
            //     const pos = parent; 
            //     if (isNodeInViewport(pos.x, pos.y, transform)) {
            //         if (!hg.activeSubgraphs.has(sgId)) {
            //             drawSubgraph(sgId);
            //             // applyWarpsFor();
            //             // drawEdges();
            //         }
            //     }
            // }           
        }
    }

    
    onMount(() => {
        graphWidth = svgElement.clientWidth;
        const start = startingStates?.[0] ?? fsmStates[0];
        const levels = computeLevelsMap(fsmTransitions, start, fsmStates);
        const pos = computeNodePositions(levels, graphWidth, graphHeight, padding);
        // graphNodes = fsmStates.map(id => ({
        //     id,
        //     x: pos.get(id)?.x ?? graphWidth / 2,
        //     y: pos.get(id)?.y ?? graphHeight / 2
        // }));

        for (const nodeId of fsmStates) {
            const p = pos.get(nodeId)!;
            hg.nodes.set(nodeId, {
                id: nodeId,
                x: p.x,
                y: p.y,
                parent: null,
                level: 1,
                visible: true,
                kind: "base"
            });
        }
        // baseEdges = fsmTransitions;
        // visibleEdges = [...baseEdges];
        for (const t of fsmTransitions) {
            hg.edges.set(`${t.from}->${t.to}`, {
                id: `${t.from}->${t.to}`,
                from: t.from,
                to: t.to,
                label: t.label,
                visible: true,
                kind: "base",
                parent: ""
            });
        }
        const svg = d3.select(svgElement);
            const depthDisplay = svg.append("g")
        .attr("class", "depthDisplay");

        depthDisplay.append("rect")
            .attr("x", 10)
            .attr("y", 10)
            .attr("width", 140)
            .attr("height", 22)
            .attr("rx", 6)
            .attr("fill", "white")
            .attr("stroke", "#aaa")
            .attr("opacity", 0.85);

        depthDisplayText = depthDisplay.append("text")
            .attr("x", 18)
            .attr("y", 26)
            .attr("font-size", 11)
            .attr("fill", "#333")
            .text("Max subgraph depth: 0");
        g = svg.append("g").attr("class", "content-group");
        g.append("g").attr("class", "edges");
        g.append("g").attr("class", "labels");
        g.append("g").attr("class", "nodes");
        
        let zoomLevel = 1;
        let evaluating = false;
        // let lastTransform = null;
        let lastTransform: d3.ZoomTransform = d3.zoomIdentity;

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .on('zoom', (event) => {
                zoomLevel = event.transform.k;
                g.attr('transform', event.transform);
                lastTransform = event.transform;
                currentZoomTransform = event.transform;

                // handleSemanticZoom(zoomLevel, event.transform);

                requestAnimationFrame(semanticTickGuard);
            });
        svg.call(zoom);
        
        function semanticTickGuard() {
            if (evaluating) return;
            evaluating = true;
            handleSemanticZoom(lastTransform.k, lastTransform);
            evaluating = false;
        }


        const defs = svg.append("defs");
        defs.append("defs")
            .append("marker")
            .attr("id", "arrowhead-straight")
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("refX", 20)
            .attr("refY", 3)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M 0 0 L 6 3 L 0 6 z");

        defs.append("defs")
            .append("marker")
            .attr("id", "arrowhead-loop")
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("refX", 19)
            .attr("refY", 2)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M 0 0 L 6 3 L 0 6 z");
        
        defs.append("filter")
            .attr("id", "halo-glow")
            .attr("x", "-50%")
            .attr("y", "-50%")
            .attr("width", "200%")
            .attr("height", "200%")
            .html(`
                <filter id="halo-glow">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur"/>
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.3"/>
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <filter id="halo-blur">
                    <feGaussianBlur stdDeviation="6" result="blur"/>
                </filter>
            `);

        drawNodes();
        drawEdges();
   });

</script>

 <svg bind:this={svgElement} width="100%" height="600"></svg>

<style>
    svg {
        background: snow;
        border: 1px solid #ccc;
        display: block;
    }
</style>