import * as d3 from "d3";

export type SvgSel = d3.Selection<SVGSVGElement, unknown, null, undefined>;
export type GSel = d3.Selection<SVGGElement, unknown, null, undefined>;


export function addContentGroup(svg: SvgSel): GSel {
    // svg.selectAll(".content-group").remove(); //wipes the last render, but keeps our defs
    let sel = svg.select<SVGGElement>(".content-group");
    if (sel.empty()){
        sel = svg.append("g").attr("class", "content-group");
        sel.append("g").attr("class", "halos");
        sel.append("g").attr("class", "debug").attr("pointer-events", "none");

        sel.append("g").attr("class", "edges");
        sel.append("g").attr("class", "labels");
        sel.append("g").attr("class", "nodes");
    }
    return sel;
}

export function drawArrowheads(svg:SvgSel) {
    const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");

    function addArrowhead(id: string, refX: number, refY: number){
        const arrowhead = defs.select<SVGMarkerElement>(`#${id}`).empty() ? defs.append("marker").attr("id", id) : defs.select<SVGMarkerElement>(`#${id}`);
            arrowhead.attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("refX", refX)
                .attr("refY", refY)
                .attr("orient", "auto");
            
            if (arrowhead.select("path").empty()) arrowhead.append("path");
            arrowhead.select("path")
                .attr("d", "M 0 0 L 6 3 L 0 6 z");
    }
    addArrowhead("arrowhead-straight", 20, 3);
    addArrowhead("arrowhead-loop", 19, 2);

    return {
        arrowheadStraight: "url(#arrowhead-straight)",
        arrowheadLoop: "url(#arrowhead-loop)"
    };
}


