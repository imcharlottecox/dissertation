import type {HGraph, HStateNode } from "$lib/graph/graphTypes"
import { rectOverlapsRect, unionRect, isPointInRect, expandRect}  from "$lib/components/sharedGraph/rectangleUtilityHelpers"; 
import type {Rect}  from "$lib/components/sharedGraph/rectangleUtilityHelpers"; 

type Vec = {dx: number, dy:number};

export function recomputeAllRects(hg: HGraph, nodeRadius: number, subgraphRects: Map<string, Rect>, subgraphParent: Map<string, string|null>) {
    
    const haloPadding = nodeRadius*1.5;
    const nestedSubgraphPadding = nodeRadius*2;

    const allSubgraphIds = [...subgraphParent.keys()];
    const sgsByDepth = [...allSubgraphIds].sort((a,b) => {
        const depthA = depthOf(a, subgraphParent);
        const depthB = depthOf(b, subgraphParent);
        if (depthA !== depthB) return depthB - depthA;
        return a.localeCompare(b);
    }); //deepest sg id first, so you can base parent's size based on size needed for children


    //do deepest children first -bottom up
    for (const sgId of sgsByDepth){
        const thisSgVisibleNodes = [...hg.nodes.values()].filter((n) => n.visible && n.parent == sgId);
        const nodeBox = smallestContainerofNodes(thisSgVisibleNodes, nodeRadius);
        const childIds = allSubgraphIds.filter((childId) => (subgraphParent.get(childId) ?? null) === sgId);
        let r: Rect|null = nodeBox;
        for (const childId of childIds){
            const childR = subgraphRects.get(childId);
            if (childR) r = unionRect(r, expandRect(childR,nestedSubgraphPadding)); //make box big enough to fit child
        }
        if (!r) {subgraphRects.delete(sgId); continue;} //dont draw empty halos
        subgraphRects.set(sgId, expandRect(r, haloPadding));  
    }
}
function smallestContainerofNodes(nodes: HStateNode[], nodeRadius: number): Rect | null{
    let minX = Infinity; //leftmost of node
    let minY = Infinity; 
    let maxX = -Infinity; //rightmost of node
    let maxY = -Infinity;

    for (const n of nodes){
        minX = Math.min(minX, n.x - nodeRadius);
        minY = Math.min(minY, n.y - nodeRadius);
        maxX = Math.max(maxX, n.x + nodeRadius);
        maxY = Math.max(maxY, n.y + nodeRadius);
    }
    if (!isFinite(minX)) return null;
    return {x: minX, y:minY, w: maxX - minX, h: maxY - minY};
}   

function depthOf(subId: string, subgraphParent: Map<string, string|null>): number {
    let depth = 0;
    let p = subgraphParent.get(subId) ?? null;
    while (p) {
        depth++;
        p = subgraphParent.get(p) ??  null;
    }
    return depth;
}

export function runCollisionAvoidance( context: {graphWidth:number; graphHeight: number; hg: HGraph; nodeRadius: number; subgraphRects: Map<string, Rect>; subgraphParent: Map<string, string | null>; siblingGrowthAxis?: "vertical" | "horizontal";}){
    const {hg, nodeRadius, subgraphRects, subgraphParent, siblingGrowthAxis="vertical"} = context;

    const moatPadding = nodeRadius; //non sg nodes must be outside halo plus moat
    const gap = Math.max(2, nodeRadius * 0.75);
    const siblingGap = nodeRadius*4;
    const MAX_ITERATIONS = 150;

    //true if node live in this subgraph or a further nested subgraph?
    function subtreeContains(subId: string, node: HStateNode): boolean{
        return node.parent === subId || isDescendant(subId, node);
    }
    function isDescendant(subId: string, node: HStateNode): boolean{
        let p = node.parent;
        while (p){
            if (p === subId) return true;
            p = subgraphParent.get(p) ?? null;
        }
        return false;
    }
    function obstacleOwnerId(node: HStateNode): string | null{
        return node.parent ?? null;
    }
    function minimalMoveOutsideRect(x: number, y:number, keepOutRect: Rect, preferRight: boolean): Vec{
        if (!isPointInRect(x,y, keepOutRect, 0)) return {dx: 0, dy: 0};
        // const rad = nodeRadius;

        const dyUp = (keepOutRect.y - gap) - (y + nodeRadius);
        const dyDown = (keepOutRect.y + gap + keepOutRect.h) - (y - nodeRadius);
        const dxLeft = (keepOutRect.x - gap) - (x + nodeRadius);
        const dxRight = (keepOutRect.x + gap + keepOutRect.w) - (x - nodeRadius);

        const candidates: Vec[] = [
            {dx: 0, dy: dyUp}, 
            {dx: 0, dy: dyDown},
            {dx: dxLeft, dy:0},
            {dx: dxRight, dy:0},
        ];

        //try vertical first other than for end port (right first)
        candidates.sort((a,b) => {
            const aVertical = a.dx === 0;
            const bVertical = b.dx === 0;
            if (preferRight){
                const score = (v: Vec) => {
                    if (v.dy === 0 && v.dx>0) return 0; //right
                    if (v.dy === 0 && v.dx<0) return 1; //left
                    if (v.dx === 0 && v.dy<0) return 2;// up
                    return 3; //down
                };
                const sa = score(a);
                const sb = score(b);
                if (sa !== sb) return sa-sb;
            } else{
                if (aVertical !== bVertical) return aVertical ? -1 : 1;
                const score = (v: Vec) => {
                    if (v.dx === 0 && v.dy<0) return 0;// up
                    if (v.dx === 0 && v.dy>0) return 1;// down
                    if (v.dy === 0 && v.dx<0) return 2; //left
                    return 3; //right
                };
                const sa = score(a);
                const sb = score(b);
                if (sa !== sb) return sa-sb;
            }

            //choose smallest poss move otherwise
            const am = Math.abs(a.dx) + Math.abs(a.dy);
            const bm = Math.abs(b.dx) + Math.abs(b.dy);
            return am - bm;
        });
        return candidates[0];
    }
    function shiftSubtree(subId: string, move: Vec){
        if (move.dx === 0 && move.dy === 0) return;
        for (const n of hg.nodes.values()){
            if (!n.visible) continue;
            if (subtreeContains(subId, n)){
                n.x += move.dx;
                n.y += move.dy;
            }
        }
    }
    function buildSiblingsByContainer(): Map<string|null, string[]>{
        const byContainer = new Map<string | null, string[]>();
        for (const [id, parentId] of subgraphParent.entries()){
            const key = parentId ?? null;
            const arr = byContainer.get(key) ?? [];
            arr.push(id);
            byContainer.set(key, arr);
        }
        //deterministic stable ordering
        for (const arr of byContainer.values()){
            arr.sort((a,b) => {
                const ra = subgraphRects.get(a);
                const rb = subgraphRects.get(b);
                const ax = ra ? ra.x : 0;
                const bx = rb ? rb.x : 0;
                if (ax !== bx) return ax - bx;
                return a.localeCompare(b);
            });
        }
        return byContainer;
    }

     const sgsByDepth = [...subgraphParent.keys()].sort((a,b) => {
        const depthA = depthOf(a, subgraphParent);
        const depthB = depthOf(b, subgraphParent);
        if (depthA !== depthB) return depthB - depthA;
        return a.localeCompare(b);
    });
    recomputeAllRects(hg, nodeRadius, subgraphRects, subgraphParent);

            
    for (let iter=0; iter< MAX_ITERATIONS; iter++){
        let changed = false;
        console.log("iteration: ", iter);
        recomputeAllRects(hg, nodeRadius, subgraphRects, subgraphParent);

        for (const subId of sgsByDepth){
            const halo = subgraphRects.get(subId);
            if (!halo) continue;
            const keepOutRect = expandRect(halo, moatPadding);

            for (const n of hg.nodes.values()){
                if (!n.visible) continue;
                if (subtreeContains(subId, n)) continue;
                if (!isPointInRect(n.x, n.y, keepOutRect, 0)) continue;

                const owner = obstacleOwnerId(n);
                // console.log("owner", owner, "subId", subId);
                if (owner && owner !== subId) continue;
                // const preferRightforEnd = /:END$/.test(n.id) || /:START$/.test(n.id);
                const preferRightforEnd = /:END$/.test(n.id);
                const move = minimalMoveOutsideRect(n.x, n.y, keepOutRect, preferRightforEnd);
                if (move.dx === 0 && move.dy === 0) continue;
                // if (owner){
                //     //move whole ovner subtree
                //     shiftSubtree(owner, move);
                // } else{
                    //base node, just move the node alone
                    n.x += move.dx;
                    n.y += move.dy;
                // }
                changed = true;
            }
        }

        recomputeAllRects(hg, nodeRadius, subgraphRects, subgraphParent);

        //vetically pack sibling sgs within the same container but split half up half down
        const siblingsByContainer = buildSiblingsByContainer();
        for (const ids of siblingsByContainer.values()){
            for (let i=0; i<ids.length; i++){
                for (let j = i+1; j< ids.length; j++){ //compare all-pairs rather than just adjacent pair sgs
                    const rectAId = ids[i];
                    const rectBId = ids[j];
                    const rectA = subgraphRects.get(rectAId);
                    const rectB = subgraphRects.get(rectBId);
                    if (!rectA || !rectB) continue;
                    if (!rectOverlapsRect(rectA, rectB, 0)) continue;
                    if (siblingGrowthAxis === "horizontal"){ //for MC where empty real estate is horizontal
                        const overlap = (rectA.x + rectA.w + siblingGap) - rectB.x;
                        if (overlap > 0){
                            if (overlap <= 0) continue;
                            const half = overlap / 2;
                            shiftSubtree(rectAId, {dx:-half, dy: 0}); // push A left
                            shiftSubtree(rectBId, {dx:half, dy: 0}); // push B riht
                            changed = true;
                        }

                    } else{
                        const overlap = (rectA.y + rectA.h + siblingGap) - rectB.y;
                        if (overlap <= 0) continue;
                        if (overlap > 0){
                            const half = overlap / 2;
                            shiftSubtree(rectAId, {dx:0, dy: -half}); // push A up
                            shiftSubtree(rectBId, {dx:0, dy:  half}); // push B down
                            changed = true;
                        }
                    }
                }
            }
        }

        if (!changed){
            recomputeAllRects(hg, nodeRadius, subgraphRects, subgraphParent);
            break;
        }
    }
}