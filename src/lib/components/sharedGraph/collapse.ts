import { getSgDescendants } from "../fsm/fsmSubgraphExpansion";
import type { Subgraph, HGraph } from "$lib/graph/graphTypes";
import type { Rect } from "../fsm/fsmRectangleUtilityHelpers";
const ZOOM_LEVEL_THRESHOLDS = new Map<number, number>([
    [1, 1.1],
    [2, 1.3],
    [3, 1.5],
]);

export function collapseSubgraph(parentId: string, hg: HGraph, subgraphs: Record<string, Subgraph> , subgraphParent: Map<string, string | null>, hiddenEdgesBySubgraph: Map<string, string[]>, subgraphRects: Map<string, Rect>){
    const sg = subgraphs[parentId];
    if (!sg) return;

    if (!hg.activeSubgraphs.has(parentId)) return;

    const childrenDescendants = getSgDescendants(parentId, hg, subgraphParent);

    for (const childId of childrenDescendants){
        collapseSubgraph(childId, hg, subgraphs, subgraphParent, hiddenEdgesBySubgraph, subgraphRects);
    }

    for (const [id, node] of hg.nodes){
        if (node.parent === parentId){
            hg.nodes.delete(id);
        }
    }

    for (const [id, edge] of hg.edges){
        if (edge.parent === parentId){
            hg.edges.delete(id);
        }   
    }
    
    const anchorNode = hg.nodes.get(parentId);
    if (anchorNode) anchorNode.visible = true;

    const hiddenEdges = hiddenEdgesBySubgraph.get(parentId) ?? [];
    for (const edgeId of hiddenEdges){
        const edge = hg.edges.get(edgeId);
        if (edge) edge.visible = true;
    }

    hiddenEdgesBySubgraph.delete(parentId);
    // hiddenNodesBySubgraph.delete(parentId);
    subgraphRects.delete(parentId);
    subgraphParent.delete(parentId);
    hg.activeSubgraphs.delete(parentId);
}

export function subgraphShouldExpand(sg: Subgraph, k: number): boolean {
    const lvl = sg.depthLevel ?? 1;
    const threshold = ZOOM_LEVEL_THRESHOLDS.get(lvl) ?? 3.0
    return k >= threshold;
}