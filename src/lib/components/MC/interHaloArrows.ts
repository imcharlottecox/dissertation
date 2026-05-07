import { liveHaloRects, rectBorderPoint, bezierMidpoint, bezierClear} from "../sharedGraph/rectangleUtilityHelpers";
import type { Rect } from "../sharedGraph/rectangleUtilityHelpers";
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
    if (hg.activeSubgraphs.size === 0) return [];
    const arrowData: SgArrow[] = [];
    const haloPad = 15*2.5;
    const allRects = new Map<string, Rect>();

    for (const sId of hg.activeSubgraphs){
        const r = liveHaloRects(hg, sId, haloPad);
        if (r) allRects.set(sId, r);
    }

    const nodeObstacles: Rect[] = Array.from(hg.nodes.values()).filter(n => n.visible && n.kind === "sub").map(n => ({x:n.x-15, y:n.y-15, w:30, h:30}));
    console.log("nodeobs",nodeObstacles);



    for (const t of markovTransitions){
        const rectA = allRects.get(t.from);
        const rectB = allRects.get(t.to);
        if (!rectA || !rectB) continue;


        const rectACentrex = rectA.x + rectA.w/2; 
        const rectACentrey = rectA.y + rectA.h/2; 
        const rectBCentrex = rectB.x + rectB.w/2; 
        const rectBCentrey = rectB.y + rectB.h/2; 

        const point1 = rectBorderPoint(rectA, rectBCentrex, rectBCentrey);
        const point2 = rectBorderPoint(rectB, rectACentrex, rectACentrey);

        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        const len = Math.hypot(dx, dy);

        const ux = dx/len;
        const uy = dy/len;
        const margin = 4;
        const x1 = point1.x + ux * margin;
        const x2 = point2.x - ux * margin;
        const y1 = point1.y + uy * margin;
        const y2 = point2.y - uy * margin;

        const obstacles: Rect[] = [...nodeObstacles];
        for (const [sId, rc] of allRects){
            if (sId !== t.from && sId !== t.to) obstacles.push(rc);
        }

        const perpL = {x: -uy, y: ux};
        const perpR = {x: uy, y: -ux};
        const bulges = [0.5, 0.8, 0.9, 1.0,1.2].map(f => f*Math.max(rectA.w, rectA.h));


        let path: string;
        let midX: number;
        let midY: number;
        let found = false;

        if (bezierClear(x1,y1,x1,y1,x2,y2,x2,y2, obstacles)){
            path = `M${x1},${y1}L${x2},${y2}`,
            midX = (x1+x2)/2;
            midY = (y1+y2) / 2- 7;
            found = true;
        }

        if (!found){
            for (const bulge of bulges){
                for (const perp of [perpL, perpR]){
                    const cx1b = x1+ perp.x*bulge;
                    const cy1b = y1+ perp.y*bulge;
                    const cx2b = x2+ perp.x*bulge;
                    const cy2b = y2+ perp.y*bulge;

                    if (bezierClear(x1, y1, cx1b, cy1b, cx2b, cy2b, x2,y2, obstacles)){
                        path = `M${x1}, ${y1}C${cx1b}, ${cy1b}, ${cx2b}, ${cy2b} ${x2}, ${y2}`;
                        const mid = bezierMidpoint(x1, y1, cx1b, cy1b, cx2b, cy2b, x2, y2);
                        midX = mid.x +perp.x*10;
                        midY = mid.y +perp.y*10;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        }

        if (!found){ //fallback
            const bulge = bulges[2];
            const cx1b = x1+ perpL.x*bulge;
            const cy1b = y1+ perpL.y*bulge;
            const cx2b = x2+ perpL.x*bulge;
            const cy2b = y2+ perpL.y*bulge;
            path = `M${x1}, ${y1}C${cx1b}, ${cy1b}, ${cx2b}, ${cy2b} ${x2}, ${y2}`;
            const mid = bezierMidpoint(x1, y1, cx1b, cx2b, cy1b, cy2b, x2, y2);
            const midX = mid.x +perpL.x*10;
            const midY = mid.y +perpL.y*10;
        }

        arrowData.push({
            id: `sgArrow:${t.from}->${t.to}`,
            path: path!,
            label: t.probability.toFixed(2),
            midpointX: midX!,
            midpointY: midY!,
            strokeWidth: Math.max(1, t.probability*3)
        });
    }
    
    return arrowData;

}
export function drawInterSgArrows(g: d3.Selection<SVGGElement, unknown, null, undefined>, hg: HGraph, markovTransitions: mTransition[], arrowheadSg:string){
    const arrowData = computeInterSgArrows(hg, markovTransitions);
    const layer = g.select<SVGGElement>("g.subgraph-arrows");
 
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
        .attr("marker-end", "url(#markov-arrowhead-sg)")
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
