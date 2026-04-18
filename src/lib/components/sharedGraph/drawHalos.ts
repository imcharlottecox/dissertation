import * as d3 from "d3";
import type { HGraph, Subgraph} from "$lib/graph/graphTypes"
import { subgraphColour } from "$lib/graph/nodeColours";
import type { Rect } from "./rectangleUtilityHelpers";
import { recomputeLiveHaloSgRects } from "./rectangleUtilityHelpers";

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
