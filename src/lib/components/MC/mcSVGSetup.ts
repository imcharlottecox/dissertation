import * as d3 from "d3";

export function addMCContentGroup(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>){
    let g = svg.select<SVGGElement>(".content-group");
    if (g.empty()){ 
        g = svg.append("g").attr("class", "content-group");
        g.append("g").attr("class", "halos");
        g.append("g").attr("class", "subgraph-arrows");
        g.append("g").attr("class", "edges");
        g.append("g").attr("class", "path-highlight").attr("pointer-events", "none");
        g.append("g").attr("class", "labels");
        g.append("g").attr("class", "nodes");
    }
    return g;
}

