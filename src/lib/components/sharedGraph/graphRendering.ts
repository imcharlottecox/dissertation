import * as d3 from "d3";
import type { Rect } from "./rectangleUtilityHelpers";
import type { EdgeRenderingData, HGraph, Subgraph } from "$lib/graph/graphTypes";
import { computeCurvedPath, computeEdgePoints, computeSelfLoopPath } from "$lib/graph/graphBehaviours";
import { subgraphColour } from "$lib/graph/nodeColours";
import { recomputeLiveHaloSgRects } from "./rectangleUtilityHelpers";
import "$lib/styles/theme.css"

export function buildEdgeRenderData(hg: HGraph, nodeRadius: number, labelOffset: number, loopRadius: number): EdgeRenderingData[]{
    const visibleEdgeData = Array.from(hg.edges.values()).filter(t => t.visible);
    const edgePairName = new Set(visibleEdgeData.map(t => `${t.from}->${t.to}`));

    return visibleEdgeData.flatMap(t => {
        const sourceNode = hg.nodes.get(t.from);
        const targetNode = hg.nodes.get(t.to);
        if (!sourceNode || !targetNode) return [];
        
        const isSelfLoop = t.from === t.to;
        const isBidirectional = !isSelfLoop && edgePairName.has(`${t.to}->${t.from}`);
        const p = parseFloat(t.label ?? "0");

        let path: string;
        let labelX: number;
        let labelY: number;

        if (isSelfLoop){
            path = computeSelfLoopPath(sourceNode, nodeRadius);
            labelX = sourceNode.x ;
            labelY = sourceNode.y - loopRadius *2 ;
        } else if (isBidirectional){
            path = computeCurvedPath(sourceNode, targetNode, nodeRadius, 1);
            const curve = 14;
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const length = Math.hypot(dx, dy);
            labelX = (sourceNode.x + targetNode.x) / 2 + (-dy / length) * curve;
            labelY = (sourceNode.y + targetNode.y) / 2 + (dx / length) * curve;
        } else{
            const { x1, y1, x2, y2} = computeEdgePoints(sourceNode, targetNode, nodeRadius);
            path = `M ${x1} ${y1} L ${x2} ${y2}`;
            labelX = (sourceNode.x + targetNode.x) / 2 + 8;
            labelY = (sourceNode.y + targetNode.y) / 2 - labelOffset;
        }
        
        const angleRadius = Math.atan2(targetNode.y - sourceNode.y , targetNode.x - sourceNode.x);
        let angleDegrees = angleRadius * (180/Math.PI);
        if (angleDegrees > 90 || angleDegrees < -90 ) angleDegrees +=180; //to avoid upside down labels
        
        return [{
            id: t.id,
            label: t.label,
            from: t.from,
            to: t.to,
            sourceNode,
            targetNode,
            path,
            labelX,
            labelY,
            probability: p,
            isSelfLoop,
            isBidirectional,
            angle: isSelfLoop ? 0 : angleDegrees,
            isUpward: targetNode.y < sourceNode.y
        }];
    });
}

export function drawArrowheads(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
    const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");

    function addArrowhead(id: string, refX: number, refY: number, colour: string){
        defs.select<SVGMarkerElement>(`#${id}`).remove();
        const arrowhead = defs.append("marker").attr("id", id);
            arrowhead            
            .attr("viewBox", [0, 0, 10, 10])
            .attr("refX", refX).attr("refY", refY)
            .attr("markerUnits", "strokeWidth")
            .attr("markerWidth", 6).attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", colour);
    }
    addArrowhead("arrowhead-black", 9, 5, "black");
    addArrowhead("arrowhead-pink", 9, 5, "lightpink");
    addArrowhead("arrowhead-sg", 9, 5, "var(--text-muted)");

    const base = window.location.href.split('#')[0];
    return {
        arrowheadBlack: `url(${base}#arrowhead-black)`,
        arrowheadPink: `url(${base}#arrowhead-pink)`,
        arrowheadSg: "url(#arrowhead-sg)"
    };
}

export function drawHalos(g: d3.Selection<SVGGElement, unknown, null, undefined>, hg: HGraph, nodeRadius: number, subgraphRects: Map<string, Rect>, subgraphs: Record<string, Subgraph>, colourFn?:(id: string, depth: number) => string) {
    const rects = subgraphRects ?? new Map<string, Rect>();
    recomputeLiveHaloSgRects(hg, hg.activeSubgraphs, nodeRadius, rects);
    type HaloData = { id: string; x: number; y: number; w: number; h: number; colour: string; depth: number };
    const halos: HaloData[] = [];

    for (const id of hg.activeSubgraphs) {
        const r = rects.get(id);
        if (!r) continue;

        const depth = subgraphs[id]?.depthLevel ?? 1;
        const colour = colourFn ? colourFn(id, depth) : subgraphColour(depth-1);
        halos.push({ id, x: r.x, y: r.y, w: r.w, h: r.h, colour, depth });
    }

    // Draw deepest halos first so shallower ones render on top
    halos.sort((a, b) => b.depth - a.depth);

    g.select<SVGGElement>("g.halos")
        .selectAll<SVGGElement, HaloData>("g.halo")
        .data(halos, (d: HaloData) => d.id)
       .join(enter => {
            const haloG = enter.append("g").attr("class", "halo")
            haloG.append("rect")
                .attr("rx", 12)
                .attr("ry", 12)
                .attr("fill-opacity", 0.15)
                .attr("stroke-opacity", 0.5)
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "6 3")
            haloG.append("text")
                .attr("font-size", 12)
                .attr("font-weight", 600)
                .attr("fill-opacity", 0.7)
            return haloG;
            },
            update => update,
            exit => exit.remove(),
        )
        .each(function(d) {
            const s = d3.select(this);
            const strokeCol = d3.color(d.colour)?.darker(0.8).formatHex() ?? d.colour;
            const labelCol  = d3.color(d.colour)?.darker(1.5).formatHex() ?? "#333";
            s.select("rect")
                .attr("x", d.x)
                .attr("y", d.y)
                .attr("width", d.w)
                .attr("height", d.h)
                .attr("fill", d.colour)
                .attr("stroke", strokeCol);
            s.select("text")
                .attr("x", d.x + 8)
                .attr("y", d.y + 16)
                .attr("fill", labelCol)
                .text(d.id);
        });
}
