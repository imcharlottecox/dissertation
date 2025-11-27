import * as d3 from 'd3';
import type { StateNode } from './graphTypes';

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

export function createDragSubgraph(updateEdges, subNodePositions) {
    return d3.drag<SVGGElement, any>()
    .on("start", function () {
        d3.select(this).raise();
    })
    .on("drag", function (event, d: any) {
        // parent <g> is the subgraph container group
        const parentG = this.parentNode as SVGGElement;
        const parentCTM = parentG.getScreenCTM().inverse();

        // convert screen coordinates to LOCAL subgraph coordinates
        const pt = parentG.ownerSVGElement!.createSVGPoint();
        pt.x = event.sourceEvent.clientX;
        pt.y = event.sourceEvent.clientY;
        const local = pt.matrixTransform(parentCTM);

        // update data
        d.x = local.x;
        d.y = local.y;

        if (subNodePositions[d.id]) {
            subNodePositions[d.id].x = local.x;
            subNodePositions[d.id].y = local.y;
        }

        // draw
        d3.select(this).attr("transform", `translate(${local.x},${local.y})`);
        updateEdges();
        });
}

export function computeEdgePoints(source: { x: number; y: number }, target: { x: number; y: number },nodeRadius: number) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) {
        return {
            x1: source.x,
            y1: source.y,
            x2: target.x,
            y2: target.y
        };
    }

    return {
        x1: source.x + (dx * nodeRadius) / dist,
        y1: source.y + (dy * nodeRadius) / dist,
        x2: target.x - (dx * nodeRadius) / dist,
        y2: target.y - (dy * nodeRadius) / dist
    };
}

export function computeCurvedPath(
    source: { x: number; y: number },
    target: { x: number; y: number },
    nodeRadius: number,
    curvature: number
) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.0001) {
        return `M ${source.x},${source.y} L ${source.x + 0.1},${source.y + 0.1}`;
    }
    const { x1, y1, x2, y2 } = computeEdgePoints(source, target, nodeRadius);
    const dx2 = x2 - x1;
    const dy2 = y2 - y1;
    const dist2 = Math.hypot(dx2, dy2);

    if (dist2 < 0.0001) {
        return `M ${x1},${y1} L ${x1 + 0.1},${y1 + 0.1}`;
    }
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    const nx = -dy2 / dist2;
    const ny = dx2 / dist2;

    const curveOffset = curvature * 20;

    const cx = mx + nx * curveOffset;
    const cy = my + ny * curveOffset;

    return `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`;
  }
  export function computeSelfLoopPath(node, r) {
        const LOOP = Math.max(r + 12, 24);
        const x = node.x;
        const y = node.y;

        return `
            M ${x} ${y - r}
            C ${x - LOOP}, ${y - 2*LOOP},
            ${x + LOOP}, ${y - 2*LOOP},
            ${x + 2}, ${y - r}
        `;
    }