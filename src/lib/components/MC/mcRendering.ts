import { buildEdgeRenderData } from "../sharedGraph/graphRendering";
import type { EdgeRenderingData, HGraph, HStateNode } from "$lib/graph/graphTypes";
import { NODE_COLOURS, NODE_STROKES } from "$lib/graph/nodeColours";

export type MCRenderContext = {
    g: d3.Selection<SVGGElement, unknown, null, undefined>;
    hg: HGraph;
    nodeRadius: number;
    nodeColour: (d: HStateNode) => string;
    loopRadius: number;
    labelOffset: number;
    acceptingStates: string[];
    startingStates: string[];
    arrowheadBlack: string;
    arrowheadPink: string;
    showDirectionalColours: boolean;
    weightedThickness: boolean;
    showEdgeLabels: boolean;
    focusClickedNodeId: string | null;
    focusClickEdgeIds: Set<string>;
    focusClickNodeIds: Set<string>;
    filterActiveEdges: Set<string> | null;
    filterActiveNodes: Set<string> | null;
    isInView: (node: HStateNode) => boolean;
    dragBehaviour: d3.DragBehavior<SVGGElement, HStateNode, unknown>;
    handleNodeClick: (nodeId: string) => void;
}
export function drawEdges(context: MCRenderContext) {
    const { g , hg, nodeRadius, loopRadius, labelOffset, arrowheadBlack, arrowheadPink, showDirectionalColours, weightedThickness, showEdgeLabels, focusClickedNodeId, focusClickEdgeIds, filterActiveEdges, isInView } = context;
    const renderData = buildEdgeRenderData(hg, nodeRadius, labelOffset, loopRadius).filter(d => isInView(d.sourceNode) && isInView(d.targetNode));
    
    const edges = g.select<SVGGElement>("g.edges")
        .selectAll<SVGPathElement, EdgeRenderingData>("path")
        .data(renderData, (d: EdgeRenderingData) => d.id)
        .join(
            enter => enter.append("path").attr("class", "edge"),
            update => update,
            exit => exit.remove() 
        )         
        .attr("fill", "none")
        .attr("stroke", d => showDirectionalColours ? (d.isUpward ? "lightpink" : "black") : "black")
        .attr("stroke-width", d => weightedThickness ? Math.min(4,Math.max(0.08, Math.exp(d.probability+1.5)-4.5)) : 1)
        .attr("opacity", d => {
            if( focusClickedNodeId){ return focusClickEdgeIds.has(d.id) ? 1 : 0.05;} 
            if (filterActiveEdges){ return filterActiveEdges.has(`${d.from}->${d.to}`) ? 1 : 0.05;}   
            return 1;})
        .attr("marker-end", d => showDirectionalColours && d.isUpward ? arrowheadPink : arrowheadBlack)
        .attr("d", (d: EdgeRenderingData) => d.path);
    edges.selectAll("title").remove();
    edges.append("title").text(d => `${d.from} \u2192 ${d.to}\nP = ${d.probability}`);
    
    g.select<SVGGElement>("g.labels")
        .selectAll<SVGTextElement, EdgeRenderingData>("text")
        .data(showEdgeLabels ? renderData : [], (d: EdgeRenderingData) => d.id)
        .join(
            enter => enter.append("text"),
            update => update,
            exit => exit.remove() 
        )
        .attr("opacity", d => {
            if (focusClickedNodeId)
                return focusClickEdgeIds.has(d.id) ? 1 : 0.06;
            if (filterActiveEdges)
                return filterActiveEdges.has(`${d.from}->${d.to}`) ? 1 : 0.06;
            return 1;
        })
        .attr("font-size", 9)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("transform", d => `translate(${d.labelX},${d.labelY}) rotate(${d.angle})`)
        .text(d => d.label ?? "")
}

export function drawNodes(context: MCRenderContext) {
    const { g, hg, nodeRadius, acceptingStates, startingStates,focusClickedNodeId, nodeColour, focusClickNodeIds, filterActiveNodes, dragBehaviour, handleNodeClick } = context;
    const nodeData = Array.from(hg.nodes.values()).filter(n => n.visible);

    g.select<SVGGElement>("g.nodes")
        .selectAll<SVGGElement, HStateNode>("g.node")
        .data(nodeData, (d: HStateNode) => d.id)
        .join(enter => {
                const n = enter
                    .append("g")
                    .attr("transform", d => `translate(${d.x},${d.y})`)
                    .attr("class", "node")
                    .call(dragBehaviour as any)
                    .on("click", (event, d) => { event.stopPropagation(); handleNodeClick(d.id); });
                n.append("circle")
                    .attr("r", nodeRadius)
                n.filter(d => d.kind === "base" && acceptingStates.includes(d.id))
                    .append("circle")
                    .attr("r", nodeRadius-3) //double ring
                    .attr("fill", "none")
                    .attr("stroke", NODE_STROKES.accepting)
                    .attr("stroke-width", 1.5);
                n.append("text")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("font-size", d => d.kind === "base" ? 10 : 7)
                    .attr("pointer-events", "none")
                    .text(d => d.displayName);
                n.append("title").text(d => d.id);
                return n;
            },
            update => update.attr("transform", d => `translate(${d.x},${d.y})`),
            exit => exit.remove(),
        )
        .select("circle")
        .attr("fill", d => {
            if (d.kind !== "base") return nodeColour(d);
            if (startingStates.includes(d.id)) return NODE_COLOURS.starting;
            if (acceptingStates.includes(d.id)) return NODE_COLOURS.accepting;
            return NODE_COLOURS.regular;
        })
        .attr("stroke", d => {
            if (d.kind !== "base") return "#777373";
            if (startingStates.includes(d.id)) return NODE_STROKES.starting;
            if (acceptingStates.includes(d.id)) return NODE_STROKES.accepting;
            return NODE_STROKES.regular;
        })
        .attr("stroke-width", d => {
            if (d.kind !== "base") return 0.8;
            if (startingStates.includes(d.id) || acceptingStates.includes(d.id)) return 2.5;
            return 1.5;
        })
        .selection()
        .attr("opacity", d => {
            if (focusClickedNodeId)
                return focusClickNodeIds.has(d.id) ? 1 : 0.15;
            if (filterActiveNodes)
                return filterActiveNodes.has(d.id) ? 1 : 0.15;
            return 1;
        })

}