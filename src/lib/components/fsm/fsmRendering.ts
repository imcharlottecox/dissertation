import * as d3 from "d3";
import type { HGraph, HStateNode, EdgeRenderingData, HEdge} from "$lib/graph/graphTypes"
// import { createDragNoSim } from "$lib/graph/graphBehaviours";
import { benchRows, measure } from "$lib/benchmarking/profiler";
import { NODE_COLOURS, NODE_STROKES } from "$lib/graph/nodeColours";

export type RenderContext = {
    g: d3.Selection<SVGGElement, unknown, null, undefined>;
    hg: HGraph;
    nodeRadius: number;
    loopRadius: number;
    labelOffset: number;
    acceptingStates: string[];
    startingStates: string[];
    arrowheadStraight: string;
    arrowheadLoop: string;
}

const benchmarkReport = (name: string, n: number, ms: number) => {
    benchRows.push({ name: `fsm:${name}`, n, ms });
}
function makeNodeLines(d: HStateNode): string[] {
    const full = d.displayName ?? d.id;

    if (d.depth === 1 || d.kind === "base") {
        const [s, restRaw] = full.split(":", 2);
        const rest = restRaw ?? "";
        const restPretty = rest.replaceAll("_", " ");

        const words = restPretty.split(/\s+/).filter(Boolean);
        if (words.length <= 2) return rest ? [s + ":", restPretty] : [full];

        const mid = Math.ceil(words.length / 2);
        return [s + ":", words.slice(0, mid).join(" "), words.slice(mid).join(" ")].slice(0, 2);
    }

    const afterColon = full.split(":")[1] ?? full;
    const parts = afterColon.split(".");
    const tail = parts.slice(-2); 
    return tail.map(x => x.replaceAll("_", " "));
}


function setTspansCentered(
  textSel: d3.Selection<SVGTextElement, HStateNode, any, any>,
  lines: string[]
) {
    textSel.selectAll("tspan").remove();

    const lineHeightEm = 1.05;
    const startDy = -((lines.length - 1) * lineHeightEm) / 2;

    lines.forEach((line, i) => {
        textSel.append("tspan")
        .attr("x", 0)
        .attr("dy", `${i === 0 ? startDy : lineHeightEm}em`)
        .text(line);
    });
}
export function drawNodes(context: RenderContext, drag: d3.DragBehavior<SVGGElement, HStateNode, unknown>) {
    const n = context.hg.nodes.size;
    const t0 = performance.now();

    const { g, hg, nodeRadius, acceptingStates, startingStates} = context;
    const nodeData = Array.from(hg.nodes.values()).filter(n => n.visible);
    
    const nodeSel = g.select<SVGGElement>("g.nodes")
        .selectAll<SVGGElement, HStateNode>("g.node")
        .data(nodeData, (d:HStateNode) => d.id)
        .join(enter => {
            const n = enter
                .append("g")
                .attr("transform", d => `translate(${d.x},${d.y})`)
                .attr("class", "node")
                .call(drag)
            n.append("circle")
                .attr("r", nodeRadius)
                .attr("fill", d => acceptingStates.includes(d.id) ? NODE_COLOURS.accepting : startingStates.includes(d.id) ? NODE_COLOURS.starting : NODE_COLOURS.regular)
                .attr("stroke", d => acceptingStates.includes(d.id) ? NODE_STROKES.accepting : startingStates.includes(d.id) ? NODE_STROKES.starting : NODE_STROKES.regular)
                // .attr("stroke-width", d => (acceptingStates.includes(d.id) ? 2.5 : 0.5));
                .attr("stroke-width", d => {
                    if (d.kind !== "base") return 0.8;
                    if (startingStates.includes(d.id) || acceptingStates.includes(d.id)) return 2.5;
                    return 1.5;
                });
            // n.append("text")
            //     .attr("text-anchor", "middle")
            //     .attr("dy", 4)
            //     .attr("font-size", 9)
            //     .text(d => d.displayName);
            n.filter(d => d.kind === "base" && acceptingStates.includes(d.id))
                .append("circle")
                .attr("r", nodeRadius - 3)
                .attr("fill", "none")
                .attr("stroke", NODE_STROKES.accepting)
                .attr("stroke-width", 1.5);
            const label = n.append("g").attr("class", "label");
            // label.append("text")
            // .attr("class", "label-stroke")
            // .attr("text-anchor", "middle")
            // .attr("font-size", 10)
            // .attr("x", 0)
            // .attr("y", 0)
            // .attr("stroke", "white")
            // .attr("stroke-width", 1)
            // .attr("fill", "none")
            //         .attr("dominant-baseline", "middle")
            // .attr("paint-order", "stroke");

            label.append("text")
            .attr("class", "label-main")
            .attr("x", 0)
            .attr("y", 0)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-size", 10);

            label.append("title");


            return n;
        },
            update => update.attr("transform", d => `translate(${d.x},${d.y})`),
            exit => exit.remove() //exiting for collapsing subgraphs
        );


        nodeSel.each(function (d) {
            const n = d3.select(this);
            const full = d.displayName ?? d.id;

            const lines = makeNodeLines(d);
            const stroke = n.select<SVGTextElement>("text.label-stroke");
            const main = n.select<SVGTextElement>("text.label-main");
            const title = n.select("title");
            setTspansCentered(stroke as any, lines);
            setTspansCentered(main as any, lines);
            title.text(full);
        });
    nodeSel.call(drag as any);
    benchRows.push({ name: "fsm:drawNodes", n, ms: performance.now() - t0 });
}

export function drawEdges(context: RenderContext) {
    const n = context.hg.nodes.size;
    const t0 = performance.now();
    const { g , hg, loopRadius, labelOffset, arrowheadStraight, arrowheadLoop} = context;
    const visibleHgEdgesFromDataset = Array.from(hg.edges.values()).filter(e => e.visible);

    //type EdgeRenderingData[]
    const renderingEdgeData = visibleHgEdgesFromDataset.map((t) : EdgeRenderingData | null => {
        const sourceNode = hg.nodes.get(t.from);
        const targetNode = hg.nodes.get(t.to);
        if (!sourceNode || !targetNode) return null;
        const isSelfLoop = t.from === t.to;
        const labelX = (sourceNode.x + targetNode.x) / 2;
        const labelY = (sourceNode.y + targetNode.y) / 2 - labelOffset;

        const angleRadius = Math.atan2(targetNode.y - sourceNode.y , targetNode.x - sourceNode.x);
        let angleDegrees = angleRadius * (180/Math.PI);
        if (angleDegrees > 90 || angleDegrees < -90 ) angleDegrees +=180; //to avoid upside down labels

        const path = isSelfLoop
            ? `M ${sourceNode.x} ${sourceNode.y}
            C ${sourceNode.x - loopRadius}, ${sourceNode.y - loopRadius * 2},
                ${sourceNode.x + loopRadius}, ${sourceNode.y - loopRadius * 2},
                ${targetNode.x +3}, ${targetNode.y}`
            : `M ${sourceNode.x} ${sourceNode.y} L ${targetNode.x} ${targetNode.y}`;
        return {
            key: t.id,
            label: t.label,
            sourceNode,
            targetNode,
            path,
            labelX,
            labelY: isSelfLoop? labelY -40 : labelY,
            isSelfLoop,
            angle: isSelfLoop ? 0 : angleDegrees,
        };
    })
    .filter((d): d is EdgeRenderingData => d !== null);
    
    g.select<SVGGElement>("g.edges")
        .selectAll<SVGPathElement, EdgeRenderingData>("path")
        .data(renderingEdgeData, (d: EdgeRenderingData) => d.key)
        .join(
            enter => enter.append("path").attr("class", "edge"),
            update => update,
            exit => exit.remove() 
        )         
        .attr("stroke", "grey")
        .attr("fill", "none")
        .attr("marker-end", (d: EdgeRenderingData) => d.isSelfLoop ? arrowheadLoop : arrowheadStraight)
        .attr("d", (d: EdgeRenderingData) => d.path);

    g.select<SVGGElement>("g.labels")
        .selectAll<SVGTextElement, EdgeRenderingData>("text")
        .data(renderingEdgeData, (d: EdgeRenderingData) => d.key)
        .join(
            enter => enter.append("text"),
            update => update,
            exit => exit.remove() 
        )
        .attr("font-size", 9)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("transform", d => `translate(${d.labelX},${d.labelY}) rotate(${d.angle})`)
        // .attr("x", d => d.labelX)
        // .attr("y", d => d.labelY)
        .text(d => d.label ?? "")


}

export function drawEdges2(context: RenderContext) {
    const n = context.hg.nodes.size;
    const t0 = performance.now();
    const { g , hg, loopRadius, labelOffset, arrowheadStraight, arrowheadLoop} = context;
    const edges = Array.from(hg.edges.values()).filter(e => e.visible);

    
    const sel = g.select<SVGGElement>("g.edges")
        .selectAll<SVGPathElement, typeof edges[number]>("path.edge")
        .data(edges, d => d.id)

    sel.join(
            enter => enter.append("path")
                .attr("class", "edge")
                .attr("stroke", "grey")
                .attr("fill", "none")
                .attr("marker-end", (d) => d.cachedIsSelfLoop ? arrowheadLoop : arrowheadStraight),
            update => update,
            exit => exit.remove() 
        )         
    
        .attr("d", (d) => d.cachedPath ?? "");
    benchRows.push({ name: "fsm:drawEdges", n, ms: performance.now() - t0 });
}

export function computeEdgeGeometry(hg: HGraph, loopRadius: number, labelOffset: number) {
    for (const e of hg.edges.values()) {
        if (!e.visible) continue;

        const sourceNode = hg.nodes.get(e.from);
        const targetNode = hg.nodes.get(e.to);
        if (!sourceNode || !targetNode) continue;

        const isSelfLoop = e.from === e.to;
        e.cachedIsSelfLoop = isSelfLoop;

        const angleRadius = Math.atan2(targetNode.y - sourceNode.y , targetNode.x - sourceNode.x);
        let angleDegrees = angleRadius * (180/Math.PI);
        if (angleDegrees > 90 || angleDegrees < -90 ) angleDegrees +=180; //to avoid upside down labels

        e.cachedPath = isSelfLoop
        ? `M ${sourceNode.x} ${sourceNode.y}
        C ${sourceNode.x - loopRadius}, ${sourceNode.y - loopRadius * 2},
            ${sourceNode.x + loopRadius}, ${sourceNode.y - loopRadius * 2},
            ${targetNode.x +3}, ${targetNode.y}`
        : `M ${sourceNode.x} ${sourceNode.y} L ${targetNode.x} ${targetNode.y}`;

        e.cachedLabelX = (sourceNode.x + targetNode.x) / 2;
        e.cachedLabelY = (sourceNode.y + targetNode.y) / 2 - labelOffset - (isSelfLoop ? 40 : 0);
        e.cachedAngle = isSelfLoop ? 0 : angleDegrees;
    }
}

export function computeEdgeGeometryForIds(hg: HGraph, edgeIds: Iterable<string>, loopRadius: number, labelOffset: number) {
    for (const id of edgeIds) {
        const e = hg.edges.get(id);
        if (!e || !e.visible) continue;

        const sourceNode = hg.nodes.get(e.from);
        const targetNode = hg.nodes.get(e.to);
        if (!sourceNode || !targetNode) continue;

        const isSelfLoop = e.from === e.to;
        e.cachedIsSelfLoop = isSelfLoop;

        const angleRadius = Math.atan2(targetNode.y - sourceNode.y , targetNode.x - sourceNode.x);
        let angleDegrees = angleRadius * (180/Math.PI);
        if (angleDegrees > 90 || angleDegrees < -90 ) angleDegrees +=180; //to avoid upside down labels

        e.cachedPath = isSelfLoop
        ? `M ${sourceNode.x} ${sourceNode.y}
        C ${sourceNode.x - loopRadius}, ${sourceNode.y - loopRadius * 2},
            ${sourceNode.x + loopRadius}, ${sourceNode.y - loopRadius * 2},
            ${targetNode.x +3}, ${targetNode.y}`
        : `M ${sourceNode.x} ${sourceNode.y} L ${targetNode.x} ${targetNode.y}`;

        e.cachedLabelX = (sourceNode.x + targetNode.x) / 2;
        e.cachedLabelY = (sourceNode.y + targetNode.y) / 2 - labelOffset - (isSelfLoop ? 40 : 0);
        e.cachedAngle = isSelfLoop ? 0 : angleDegrees;
    }
}

//for selective patching of dragged edges
export function syncEdgeToDom(edgesLayer: d3.Selection<SVGGElement, unknown, null, undefined>, hg: HGraph, arrowheadStraight: string, arrowheadLoop: string, edgeElemById: Map<string, SVGPathElement>) {
    const edges = Array.from(hg.edges.values()).filter(e => e.visible);
    edgesLayer .selectAll<SVGPathElement, typeof edges[number]>("path.edge")
        .data(edges, d => d.id)
        .join(
            enter => enter.append("path")
                .attr("class", "edge")
                .attr("stroke", "grey")
                .attr("fill", "none")
                .each(function (d) {
                    edgeElemById.set(d.id, this as SVGPathElement);
                }),
            update => update.each(function (d){
                edgeElemById.set(d.id, this as SVGPathElement);
            }),
            exit => exit.each(function (d){
                edgeElemById.delete(d.id);
            }).remove() 
        )         
    
        .attr("marker-end", (d) => d.cachedIsSelfLoop ? arrowheadLoop : arrowheadStraight);
        // .attr("d", (d) => d.cachedPath ?? "");
}

export function patchEdgesPaths(hg: HGraph, edgeIds: Iterable<string>, edgeElemById: Map<string, SVGPathElement>) {
    for (const id of edgeIds) {
        const e = hg.edges.get(id);
        if (!e || !e.visible) continue;
        const edgeElem = edgeElemById.get(id);
        if (!edgeElem) continue;
        edgeElem.setAttribute("d", e.cachedPath ?? "");
    }
}