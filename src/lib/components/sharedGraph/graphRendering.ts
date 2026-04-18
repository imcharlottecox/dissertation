import { computeCurvedPath, computeEdgePoints, computeSelfLoop, computeSelfLoopPath } from "$lib/graph/graphBehaviours";
import type { EdgeRenderingData, HGraph, HStateNode } from "$lib/graph/graphTypes";
import "$lib/styles/theme.css"
export function buildEdgeRenderData(hg: HGraph, nodeRadius: number, labelOffset: number, loopRadius: number): EdgeRenderingData[]{
    const visibleEdgeData = Array.from(hg.edges.values()).filter(t => t.visible);
    const edgePairName = new Set(visibleEdgeData.map(t => `${t.from}->${t.to}`));

    return visibleEdgeData.flatMap(t => {
        const sourceNode = hg.nodes.get(t.from);
        const targetNode = hg.nodes.get(t.to);
        if (!sourceNode || !targetNode) return [];
        
        const isSelfLoop = t.from === t.to;
        const isBidirectional = !isSelfLoop && edgePairName.has(`${t.to}->${t.from}`);
        const p = parseFloat(t.label ?? "0");

        let path: string;
        let labelX: number;
        let labelY: number;

        if (isSelfLoop){
            path = computeSelfLoopPath(sourceNode, nodeRadius);
            labelX = sourceNode.x ;
            labelY = sourceNode.y - loopRadius *2 ;
        } else if (isBidirectional){
            path = computeCurvedPath(sourceNode, targetNode, nodeRadius, 1);
            const curve = 14;
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const length = Math.hypot(dx, dy);
            labelX = (sourceNode.x + targetNode.x) / 2 + (-dy / length) * curve;
            labelY = (sourceNode.y + targetNode.y) / 2 + (dx / length) * curve;
        } else{
            const { x1, y1, x2, y2} = computeEdgePoints(sourceNode, targetNode, nodeRadius);
            path = `M ${x1} ${y1} L ${x2} ${y2}`;
            labelX = (sourceNode.x + targetNode.x) / 2 + 8;
            labelY = (sourceNode.y + targetNode.y) / 2 - labelOffset;
        }
        
        const angleRadius = Math.atan2(targetNode.y - sourceNode.y , targetNode.x - sourceNode.x);
        let angleDegrees = angleRadius * (180/Math.PI);
        if (angleDegrees > 90 || angleDegrees < -90 ) angleDegrees +=180; //to avoid upside down labels
        
        return [{
            id: t.id,
            label: t.label,
            from: t.from,
            to: t.to,
            sourceNode,
            targetNode,
            path,
            labelX,
            labelY,
            probability: p,
            isSelfLoop,
            isBidirectional,
            angle: isSelfLoop ? 0 : angleDegrees,
            isUpward: targetNode.y < sourceNode.y
        }];
    });
}

export function drawArrowheads(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
    const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");

    function addArrowhead(id: string, refX: number, refY: number, colour: string){
        const arrowhead = defs.select<SVGMarkerElement>(`#${id}`).empty() ? defs.append("marker").attr("id", id) : defs.select<SVGMarkerElement>(`#${id}`);
            arrowhead            
            .attr("viewBox", [0, 0, 10, 10])
            .attr("refX", refX).attr("refY", refY)
            .attr("markerUnits", "strokeWidth")
            .attr("markerWidth", 6).attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", colour);
    }
    addArrowhead("arrowhead-black", 9, 5, "black");
    addArrowhead("arrowhead-pink", 9, 5, "lightpink");
    addArrowhead("arrowhead-sg", 9, 5, "var(--text-muted)");

    return {
        arrowheadBlack: "url(#arrowhead-black)",
        arrowheadPink: "url(#arrowhead-pink)",
        arrowheadSg: "url(#arrowhead-sg)"
    };
}
