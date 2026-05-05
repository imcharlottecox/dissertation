import type { HGraph, Warp, HStateNode, Subgraph} from "$lib/graph/graphTypes";
import { clampRectangleInside, rectOverlapsRect, type Rect } from "./rectangleUtilityHelpers";

const ZOOM_LEVEL_THRESHOLDS = new Map<number, number>([
    [1, 1.1],
    [2, 1.3],
    [3, 1.5],
    [4, 1.7],
    [5, 1.9],
    [6, 2.1],
    [7, 2.3],
    [8, 2.5],
    [9, 2.7],
    [10, 2.9],
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

export function mkNodeId(subgraphId: string, localStateId: string){
    return `${subgraphId}.${localStateId}`;
}

export function getSgDescendants(parentId:string, hg:HGraph, subgraphParent:Map<string, string | null>): string[] {
    const descs: string[] = [];
    for (const id of hg.activeSubgraphs){
        let parent = subgraphParent.get(id) ?? null;
        while (parent){
            if (parent === parentId) {
                descs.push(id);
                break;
            }
            parent = subgraphParent.get(parent) ?? null;
        }
    }
    descs.sort((a,b) => sgDepthFinder(b, subgraphParent) - sgDepthFinder(a, subgraphParent));
    return descs;
}

export function sgDepthFinder(id: string, subgraphParent:Map<string, string | null>): number {
    let depth = 0;
    let parent = subgraphParent.get(id) ??  null;
    while (parent){
        depth++;
        parent = subgraphParent.get(parent) ?? null;
    }
    return depth;
}

export function getEntryWarp(parentId: string, entry: string, warps: Warp[]){
    return warps.find(w => {
        const { warpParent, warpEntryExit} = splitWarp(w.into);
        return warpParent === parentId && warpEntryExit === entry;
    });
}

export function getExitWarp(parentId: string, exit: string, warps: Warp[]){
    return warps.find(w => {
        const { warpParent, warpEntryExit} = splitWarp(w.from);
        return warpParent === parentId && warpEntryExit === exit;
    });
}
export function splitWarp(target?: string) {
    if (!target) return { warpParent: "", warpEntryExit: "" };
    const parts = target.split(".");
    return {
        warpParent: parts.slice(0, -1).join("."),
        warpEntryExit: parts[parts.length - 1]
    };
}

export function placeSubgraphRect(parentId: string, anchorNode: HStateNode, W:number, H:number, containerId: string|null, containerRect: Rect|null, subgraphRects: Map<string, Rect>, subgraphParent: Map<string, string | null>): Rect{
    let rect: Rect = {
        x: anchorNode.x - (W/2),
        y: anchorNode.y - (H/2),
        w: W,
        h: H,
    };

    if (containerRect) rect = clampRectangleInside(containerRect, rect, 20);

    if( collidesWithSibligns(rect, subgraphRects, parentId, containerId, subgraphParent) ) {
        const nudges = [
            {dx: 0, dy: 80}, {dx: 0, dy: -80},
            {dx: 120, dy: 0}, {dx: -120, dy: 0},
            {dx: 0, dy: 160}, {dx: 0, dy: -160},
        ]

        let placed = false;
        for (const nudge of nudges) {
            const candidate = {
                ...rect, 
                x: rect.x + nudge.dx,
                y: rect.y + nudge.dy
            }

            const candidate2 = containerRect ? clampRectangleInside(containerRect, candidate, 30) : candidate;
            if (!collidesWithSibligns(candidate2, subgraphRects, parentId, containerId, subgraphParent)) {
                rect = candidate2;
                placed = true;
                break;
            }
        }
    }
    return rect;

}


function collidesWithSibligns(test: Rect, subgraphRects: Map<string, Rect>, parentId: string, containerId: string|null, subgraphParent: Map<string, string | null>) {
    for (const [otherId, r] of subgraphRects.entries()){
        if (otherId === parentId) continue;
        //avoid colldiign wiht siblings in the same container if nested
        if (containerId ){
            if (subgraphParent.get(otherId) !== containerId){ 
                continue;   
            }
        } else{
             if (subgraphParent.get(otherId) !== null){
                //must be top level so avoid the other top level rects
                continue;
             }
        }
        if (rectOverlapsRect(test, r, 20) ) return true;
    }
    return false;
}

//add subnodes but skip the ports
export function addSubNodes(hg: HGraph, parentId: string, sg: Subgraph, rect: Rect, localPos: Map<string, { x: number; y: number }>, anchorNode: HStateNode ): void {
    for (const stateId of sg.states){
        if (stateId == sg.entry || stateId == sg.exit) continue;
        const p = localPos.get(stateId);
        if (!p) continue;
        const nodeId = mkNodeId(parentId, stateId);
        
        hg.nodes.set(nodeId, {
            id: nodeId,
            displayName: stateId,
            x: rect.x + p.x,
            y: rect.y + p.y,
            parent: parentId,
            depth: anchorNode.depth + 1,
            visible: true,
            kind: "sub"
        });
    }
}

//add subedges skip ports
export function addSubEdges(hg: HGraph, parentId: string, sg:Subgraph): void{
    for (const t of sg.transitions){
        if (t.from === sg.entry || t.from === sg.exit || t.to === sg.entry || t.to === sg.exit) continue;
        
        const fromId = mkNodeId(parentId, t.from);
        const toId = mkNodeId(parentId, t.to);
        const id = `sub:${parentId}:${fromId}-${toId}-${t.label ?? "undefined"}`;
        hg.edges.set(id, {
            id,
            from: fromId,
            to: toId,
            label: t.label,
            visible: true,
            kind: "sub",
            parent: parentId
        });
    }
}

export function addWarpEdges(hg: HGraph, parentId: string, sg: Subgraph, warps: Warp[], subgraphParent: Map<string, string | null>){
    
    const entryWarp = getEntryWarp(parentId, sg.entry, warps);
    const exitWarp = getExitWarp(parentId, sg.exit, warps);
    const entryOutgoing = sg.transitions.filter(t => t.from === sg.entry && t.to !== sg.exit);
    //warp edges for entry exit skipping ports bc theyre invisible
    
    if (entryWarp) {
        for (const t of entryOutgoing){
            const toId = mkNodeId(parentId, t.to);
            const edgeId = `warpIn:${parentId}:${entryWarp.from}-${toId}-${t.label ?? "undefined"}`;
            hg.edges.set(edgeId, {
                id: edgeId,
                from: entryWarp.from,
                to: toId,
                label: t.label,
                visible: true,
                kind: "warp",
                parent: parentId
            });
        }
        //nodes that go back to the entry port - TODO: dead code?
        for (const t of sg.transitions.filter(t => t.to === sg.entry && t.from !== sg.entry)){
            const fromId = mkNodeId(parentId, t.from);
            if (!hg.nodes.has(fromId)) continue;
            
            for (const outTransition of entryOutgoing){
                const toId = mkNodeId(parentId, outTransition.to);
                if (!hg.nodes.has(toId)) continue;
                const edgeId = `warpInChain:${parentId}:${fromId}-${toId}-${t.label ?? "undefined"}`;
                if (hg.edges.has(edgeId)) continue;
                hg.edges.set(edgeId,{
                    id: edgeId,
                    from: fromId,
                    to: toId,
                    label: t.label,
                    visible: true,
                    kind: "sub",
                    parent: parentId
                });
            }
        }


    }
    if (exitWarp?.backto) {
        for (const t of sg.transitions.filter(t => t.to === sg.exit)){
            const fromId = mkNodeId(parentId, t.from);
            const edgeId = `warpOut:${parentId}:${fromId}-${exitWarp.backto}-${t.label ?? "undefined"}`;
            hg.edges.set(edgeId, {
                id: edgeId,
                from: fromId,
                to: exitWarp.backto ?? "",
                label: t.label,
                visible: true,
                kind: "warp",
                parent: parentId
            });
        }
    }

    for (const w of warps) {
        if (!w.into) continue;
        const { warpParent: intoParent, warpEntryExit: intoEntry } = splitWarp(w.into);
        if (intoParent !== parentId || intoEntry !== sg.entry) continue;
        const sourceNode = hg.nodes.get(w.from);
        if (!sourceNode || !sourceNode.visible || sourceNode.parent === null || w.from === parentId) continue;
        for (const t of entryOutgoing) {
            const toId = mkNodeId(parentId, t.to);
            if (!hg.nodes.has(toId)) continue;
            const edgeId = `crossWarpIn:${parentId}:${w.from}-${toId}-${t.label ?? "undefined"}`;
            if (hg.edges.has(edgeId)) continue;
            hg.edges.set(edgeId, {
                id: edgeId,
                from: w.from,
                to: toId,
                label: t.label,
                visible: true,
                kind: "warp",
                parent: parentId
            });
        }
    }
}

export function hideAnchorAndEdges(hg: HGraph, anchorId: string, containerId: string|null, sg: Subgraph): string[]{
    const anchorNode = hg.nodes.get(anchorId);
    if (anchorNode) anchorNode.visible = false;
    const hiddenEdges: string[] = [];

    for (const [edgeId, edge] of hg.edges.entries()){
        if (edge.from !== anchorId && edge.to !== anchorId) continue;
        const isAnchorEdge = sg.parentState ? edge.parent === containerId : edge.kind === "base";

        if (isAnchorEdge && edge.visible){
            edge.visible = false;
            hiddenEdges.push(edgeId);
        }
    }
    return hiddenEdges;
}