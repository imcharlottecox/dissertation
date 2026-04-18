import type { HGraph } from "$lib/graph/graphTypes";

export function resetHGraph(hg: HGraph) {
    hg.nodes.clear();
    hg.edges.clear();
    hg.activeSubgraphs.clear();
}