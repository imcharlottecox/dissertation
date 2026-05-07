import * as d3 from "d3";
import type {fTransition, HGraph, HStateNode} from "$lib/graph/graphTypes";
import { computeSelfLoop } from "$lib/graph/graphBehaviours";

export type PathWalked = {from: string, to: string, path: string};
type HStep = {id: string; path: string; opacity: number; delay:number};
const highlightColour = "hotpink";
const travelMs = 350;
const fadeMs = 600;
const staggerMs = 30;

export function drawPathHighlight(edgelayer: d3.Selection<SVGGElement, unknown, null, undefined>, nodelayer: d3.Selection<SVGGElement, unknown, null, undefined>, steps: PathWalked[], highlightedNodeIds: Set<string>, hg: HGraph,){
    //to ensure all path steps are drawn in the case of quick typing
    edgelayer.selectAll("path.highlightedge").interrupt();
    nodelayer.selectAll("circle.highlightnode").interrupt();

    const stepsTaken: HStep[] = steps.map((s, i) => ({
        id: `highlight:${s.from}->${s.to}:${i}`,
        path: s.path,
        opacity: steps.length === 1 ? 0.8 : 0.4+0.4*((i+1)/steps.length),
        delay: i * staggerMs,
    }));

    edgelayer.selectAll<SVGPathElement, HStep>("path.highlightedge")
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
    const highlightedNodes = Array.from(highlightedNodeIds).map(nId => hg.nodes.get(nId)).filter((n): n is HStateNode => !!n && n.visible);
    const nodeData = highlightedNodes.map((n, i) => ({
        id: `highlightnode:${n?.id}`,
        x: n?.x,
        y: n?.y,
        opacity: 0.4+0.4*((i+1)/steps.length),
        
    }));

    nodelayer.selectAll<SVGCircleElement, HStateNode>("circle.highlightnode")
        .data(nodeData, d=>d.id)
        .join(
            enter => enter.append("circle")
                .attr("class", "highlightnode")
                .attr("pointer-events", "none")
                .attr("fill", "none")
                .attr("stroke", highlightColour)
                .attr("stroke-width", 2.5)
                .attr("cx", d => d.x)
                .attr("cy", d => d.y)
                .attr("r", 15+5)
                .attr("opacity", 0)
                .call(s => s.transition().duration(200).attr("opacity", d=> d.opacity )),
            update => update
                .attr("cx", d=>d.x)
                .attr("cy", d=>d.y)
                .attr("opacity", d=>d.opacity),
            exit => exit.transition().duration(fadeMs).attr("opacity", 0).remove(),

        );

}

//user completely deletes their input
export function fadeOutPathHighlight(edgelayer: d3.Selection<SVGGElement, unknown, null, undefined>, nodelayer: d3.Selection<SVGGElement, unknown, null, undefined>, fadeMs: number){
    edgelayer.selectAll("path.highlightedge")
        .transition().duration(fadeMs)
        .attr("opacity",0)
        .on("end", function () {d3.select(this).remove(); });
    nodelayer.selectAll("circle.highlightnode")
        .transition().duration(fadeMs)
        .attr("opacity",0)
        .on("end", function () {d3.select(this).remove(); });

}

export function computeWalkedPathFlat(sequence: string, fsmTransitions: fTransition[], startingStates: string[], fsmStates: string[], hg: HGraph,
    matchFn: (t: fTransition, token: string) => boolean = (t, token) => t.label === token, 
    tokenise: (sequence: string) => string[] = (sequence) =>{
        const wordLevel = fsmTransitions.some(t => (t.label ?? "").includes(" "));
        return wordLevel ? sequence.split(" ").filter(Boolean) : sequence.split("");
    }
): {steps: PathWalked[]; highlightedNodeIds: Set<string>} {
    const steps: PathWalked[] = [];
    const highlightedNodeIds = new Set<string>();
    if (!sequence) return {steps, highlightedNodeIds};

    // //test if theres a space in the input to differentaite between kinds of datasets: Cartons versus variable name, for example
    // let wordLevel = false;
    // for (const t of fsmTransitions){
    //     if ((t.label ?? "").includes(" ")){
    //         wordLevel = true;
    //         break;
    //     }
    // }
    const tokens = tokenise(sequence);

    let current = startingStates[0] ?? fsmStates[0];
    highlightedNodeIds.add(current);

    for (const token of tokens){
        const t = fsmTransitions.find(tran => tran.from === current && matchFn(tran, token));
        if (!t) break;

        const edgeId = `base:${t.from}-${t.to}-${t.label ?? "undefined"}`;
        const path = buildFallbackPath(hg, t.from, t.to);

        steps.push({from: t.from, to:t.to, path: path ?? ""});
        highlightedNodeIds.add(t.to);
        current = t.to;
    }
    return {steps, highlightedNodeIds};
}
export function buildFallbackPath(hg: HGraph, fromId: string, toId: string){
    const source = hg.nodes.get(fromId);
    const target = hg.nodes.get(toId);
    if (!source||!target) return "";
    if (fromId === toId) return computeSelfLoop(source.x, source.y, 27 )
    return `M${source.x},${source.y} L${target.x},${target.y}`;
}