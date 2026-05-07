import * as d3 from "d3";

export function addContentGroup(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>): d3.Selection<SVGGElement, unknown, null, undefined> {
    let sel = svg.select<SVGGElement>(".content-group");
    if (sel.empty()){
        sel = svg.append("g").attr("class", "content-group");
        sel.append("g").attr("class", "halos");
        // sel.append("g").attr("class", "debug").attr("pointer-events", "none");
        sel.append("g").attr("class", "path-highlight-edges").attr("pointer-events", "none");
        sel.append("g").attr("class", "edges");
        sel.append("g").attr("class", "labels");
        sel.append("g").attr("class", "nodes");
        sel.append("g").attr("class", "path-highlight-nodes").attr("pointer-events", "none");

    }
    return sel;
}




