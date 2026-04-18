import * as d3 from "d3";

export function makeZoomControls(svgElement: SVGSVGElement, zoomBehaviour: d3.ZoomBehavior<SVGSVGElement, unknown>){
    function zoomIn() {
        d3.select(svgElement)
            .transition()
            .duration(150)
            .call(zoomBehaviour.scaleBy as any, 1.2);  
    }
    function zoomOut() {
        d3.select(svgElement)
            .transition()
            .duration(150)
            .call(zoomBehaviour.scaleBy as any, 1 / 1.2);  
    }
    function zoomReset() {
        d3.select(svgElement)
            .transition()
            .duration(150)
            .call(zoomBehaviour.transform as any, d3.zoomIdentity);  
    }
    return { zoomIn, zoomOut, zoomReset };
}

// export function measureHeight(wrapperElement: HTMLDivElement, graphWidth: number, graphHeight: number, svgElement: SVGSVGElement) {
//     const r = wrapperElement.getBoundingClientRect();
//     graphWidth = Math.max(1, Math.floor(r.width));
//     graphHeight = Math.max(1, Math.floor(r.height));

//     d3.select(svgElement).attr("width", graphWidth).attr("height", graphHeight);
// }
export function measureHeight(wrapperElement: HTMLDivElement, svgElement: SVGSVGElement) {
    const container = wrapperElement.parentElement ?? wrapperElement;
    const r = container.getBoundingClientRect();
    const graphWidth = Math.max(1, Math.floor(r.width));
    const graphHeight = Math.max(1, Math.floor(r.height));

    d3.select(svgElement).attr("width", graphWidth).attr("height", graphHeight);
    return { graphWidth, graphHeight}
}