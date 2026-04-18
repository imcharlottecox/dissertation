import { liveHaloRects, rectBorderPoint} from "../fsm/fsmRectangleUtilityHelpers";
import type { mTransition, HGraph } from "$lib/graph/graphTypes";
import "$lib/styles/theme.css"

type SgArrow = { 
    id: string; 
    path: string; //of shape `M{}{}L{}{}`
    label: string;
    midpointX: number;
    midpointY: number;
    strokeWidth: number;

}


function computeInterSgArrows(hg: HGraph, markovTransitions: mTransition[]){
    const arrowData: SgArrow[] = [];

    if (hg.activeSubgraphs.size > 0){
        for (const t of markovTransitions){
            const rectA = liveHaloRects(hg, t.from, 15*2.5);
            const rectB = liveHaloRects(hg, t.to, 15*2.5);
            if (!rectA || !rectB) continue;

            const rectACentrex = rectA.x + rectA.w/2; 
            const rectACentrey = rectA.y + rectA.h/2; 
            const rectBCentrex = rectB.x + rectB.w/2; 
            const rectBCentrey = rectB.y + rectB.h/2; 

            const point1 = rectBorderPoint(rectA, rectBCentrex, rectBCentrey);
            const point2 = rectBorderPoint(rectB, rectACentrex, rectACentrey);

            arrowData.push({
                id: `sgArrow:${t.from}->${t.to}`,
                path: `M${point1.x},${point1.y}L${point2.x},${point2.y}`,
                label: t.probability.toFixed(2),
                midpointX: (point1.x+point2.x)/2,
                midpointY: (point1.y+point2.y)/2 -7,
                strokeWidth: Math.max(1, t.probability*3)
            })
        }
    }
    return arrowData;

}
export function drawInterSgArrows(g: d3.Selection<SVGGElement, unknown, null, undefined>, hg: HGraph, markovTransitions: mTransition[], arrowheadSg:string){
    const arrowData = computeInterSgArrows(hg, markovTransitions);
    const layer = g.select<SVGGElement>("g.subgraph-arrows");
 console.log("arrowData", computeInterSgArrows(hg, markovTransitions));
    console.log("layer empty?", g.select<SVGGElement>("g.subgraph-arrows").empty());
    console.log("layer node", g.select<SVGGElement>("g.subgraph-arrows").node());

    layer.selectAll<SVGPathElement, SgArrow>("path.subgraph-arrow")
        .data(arrowData, (d:SgArrow) => d.id)
        .join(
            enter => enter.append("path").attr("class", "subgraph-arrow"),
            update => update,
            exit => exit.remove()
        )
        .attr("d", (d: SgArrow)=> d.path)
        .attr("fill", "none")
        .attr("stroke-width", (d: SgArrow) => d.strokeWidth)
        .attr("stroke-dasharray", "6 3")
        .attr("marker-end", "url(#arrowhead-sg)")
        .attr("stroke", "var(--text-muted)")

    layer.selectAll<SVGGElement, SgArrow>("text.subgraph-arrow-label")
        .data(arrowData, d => d.id)
        .join(
            enter => enter.append("text").attr("class", "subgraph-arrow-label"),
            update => update,
            exit => exit.remove()
        )
        .attr("x", d=>d.midpointX)
        .attr("y", d=>d.midpointY)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("font-weight", 600)
        .attr("fill", "var(--text-muted)")
        .attr("pointer-events", "none")
        .text(d => d.label)
}