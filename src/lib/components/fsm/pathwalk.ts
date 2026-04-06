import * as d3 from "d3";
import type {fTransition, HGraph, HStateNode} from "$lib/graph/graphTypes";
import { computeSelfLoop } from "$lib/graph/graphBehaviours";
import  LOOP_RADIUS  from "./fsmediting.svelte"; 

export type PathWalked = {from: string, to: string, path: string};
type HStep = {id: string; path: string; opacity: number; delay:number};
const highlightColour = "hotpink";
const travelMs = 350;
const fadeMs = 600;
const staggerMs = 30;

export function drawPathHighlight(layer: d3.Selection<SVGGElement, unknown, null, undefined>, steps: PathWalked[], highlightedNodeIds: Set<string>, hg: HGraph,){
    //to ensure all path steps are drawn in the case of quick typing
    layer.selectAll("path.highlightedge, circle.highlightnode").interrupt();

    const stepsTaken: HStep[] = steps.map((s, i) => ({
        id: `highlight:${s.from}->${s.to}:${i}`,
        path: s.path,
        opacity: steps.length === 1 ? 0.8 : 0.4+0.4*((i+1)/steps.length),
        delay: i * staggerMs,
    }));

    layer.selectAll<SVGPathElement, HStep>("path.highlightedge")
        .data(stepsTaken, d=>d.id)
        .join(
            enter => {
                const p = enter.append("path")
                    .attr("class", "highlightedge")
                    .attr("fill", "none")
                    .attr("stroke", highlightColour)
                    .attr("stroke-width", 4)
                    .attr("stroke-linecap", "round")
                    .attr("pointer-events", "none");
                p.each(function (d) {
                    const edge = this as SVGPathElement;
                    edge.setAttribute("d", d.path);
                    const len = edge.getTotalLength?.() ?? 80;
                    d3.select(edge)
                        .attr("stroke-dasharray", len)
                        .attr("stroke-dashoffset", len)
                        .attr("opacity", 0)
                        .transition()
                        .delay(d.delay)
                        .duration(travelMs)
                        .ease(d3.easeCubicOut)
                        .attr("stroke-dashoffset", 0)
                        .attr("opacity", d.opacity);
                });
                return p;
            },
            update => {
                update.each(function (d){
                    const edge = this as SVGPathElement;
                    edge.setAttribute("d", d.path);
                    const len = edge.getTotalLength?.() ?? 80;
                    d3.select(edge)
                        .attr("stroke-dasharray", len)
                        .attr("stroke-dashoffset", 0)
                        .attr("opacity", d.opacity);
                });
                return update;
            },
            //if input changes on just one transition, for example
            exit => exit.transition().duration(fadeMs).attr("opacity", 0).remove(),
        );


}

//user completely deletes their input
export function fadeOutPathHighlight(layer:d3.Selection<SVGGElement, unknown, null, undefined>, fadeMs: number){
    layer.selectAll("path.highlightedge, circle.higlightnode")
        .transition().duration(fadeMs)
        .attr("opacity",0)
        .on("end", function () {d3.select(this).remove(); });

}

export function computeWalkedPathFSM(sequence: string, fsmTransitions: fTransition[], startingStates: string[], fsmStates: string[], hg: HGraph): {steps: PathWalked[]; highlightedNodeIds: Set<string>} {
    const steps: PathWalked[] = [];
    const highlightedNodeIds = new Set<string>();
    if (!sequence) return {steps, highlightedNodeIds};

    //test if theres a space in the input to differentaite between kinds of datasets: Cartons versus variable name, for example
    let wordLevel = false;
    for (const t of fsmTransitions){
        if ((t.label ?? "").includes(" ")){
            wordLevel = true;
            break;
        }
    }
    const tokens = wordLevel ? sequence.split(" ").filter(Boolean) : sequence.split("");

    let current = startingStates[0] ?? fsmStates[0];
    highlightedNodeIds.add(current);

    for (const token of tokens){
        const t = fsmTransitions.find(tran => tran.from === current && tran.label === token);
        if (!t) break;

        const edgeId = `base:${t.from}-${t.to}-${t.label ?? "undefined"}`;
        const path = hg.edges.get(edgeId)?.cachedPath ?? buildFallbackPath(hg, t.from, t.to);

        steps.push({from: t.from, to:t.to, path: path ?? ""});
        highlightedNodeIds.add(t.to);
        current = t.to;
    }
    return {steps, highlightedNodeIds};
}
function buildFallbackPath(hg: HGraph, fromId: string, toId: string){
    const source = hg.nodes.get(fromId);
    const target = hg.nodes.get(toId);
    if (!source||!target) return "";
    if (fromId === toId) return computeSelfLoop(source.x, source.y, LOOP_RADIUS )
    return `M${source.x},${source.y} L${target.x},${target.y}`;
}