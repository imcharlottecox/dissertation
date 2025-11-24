import * as d3 from 'd3';
import type { StateNode } from './graphTypes';
// import type { WarpLink } from '$lib/graphTypes';

export function createZoom(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
  return d3.zoom<SVGSVGElement, unknown>()
    .on('zoom', (event) => g.attr('transform', event.transform));
}

// drag handler: remembers and saves positions of node drags, to persist state across window resizes
export function createDrag(simulation: d3.Simulation<any, any>, tick: () => void, graphNodes: any[]): d3.DragBehavior<SVGGElement, any, any>  {
  return d3.drag<SVGGElement, StateNode>()
    .on('start', (event, d: any) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    })
    .on('drag', (event, d: any) => {
        d.fx = d.x = event.x;
        d.fy = d.y = event.y;
        tick();
    })
    .on('end', (event, d: any) => {
        const index = graphNodes.findIndex(n => n.id === d.id);
        if (!event.active) simulation.alphaTarget(0);
        if (index !== -1) {
            graphNodes[index].fx = d.x;
            graphNodes[index].fy = d.y;
        }
    });
}

export function createDragNoSim(updateEdges: () => void) {
  return d3.drag<SVGGElement, any>()
    .on("start", function () {
      d3.select(this).raise();
    })
    .on("drag", function (event, d) {
      d.x = event.x;
      d.y = event.y;
      d3.select(this).attr("transform", `translate(${event.x},${event.y})`);
      updateEdges();
    });
}

export function createDragSubgraph(redrawEdges, subNodePositions) {
    return d3.drag<SVGGElement, any>()
        .on("start", (event, d) => {
            d3.select(event.sourceEvent.target.closest("g")).raise();
        })
        .on("drag", (event, d:any) => {
            d.x = event.x;
            d.y = event.y;

            if (subNodePositions[d.id]) {
                subNodePositions[d.id].x = d.x;
                subNodePositions[d.id].y = d.y;
            }

            d3.select(event.sourceEvent.target.closest("g"))
                .attr("transform", `translate(${d.x},${d.y})`);

            redrawEdges();
        });
}
