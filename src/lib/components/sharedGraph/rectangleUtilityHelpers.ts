export type Rect = { x:number, y: number, w: number, h: number };
import type { HGraph, HStateNode } from "$lib/graph/graphTypes";
function right(r: Rect){
    return r.x + r.w;
}

function bottom(r: Rect){
    return r.y + r.h;
}

export function expandRect(r: Rect, padding: number): Rect{
    return {
        x: r.x-padding,
        y: r.y-padding,
        w: r.w + 2*padding,
        h: r.h + 2*padding,
    };
}
export function rectOverlapsRect(a: Rect, b: Rect, padding = 0): boolean {
    const rect1 = padding !== 0 ? expandRect(a, padding) : a;
    const rect2 = padding !== 0 ? expandRect(b, padding) : b;
    
    return !(
        right(rect1) <= rect2.x ||
        rect1.x >= right(rect2) ||
        bottom(rect1) <= rect2.y ||
        rect1.y >= bottom(rect2)
    );
} 
export function rectContainsRect(outer: Rect, inner: Rect, padding = 0): boolean {
    return (
        inner.x >= outer.x + padding &&
        inner.y >= outer.y + padding &&
        right(inner) <= right(outer) - padding &&
        bottom(inner) <= bottom(outer) - padding
    );
}
export function clampRectangleInside(container: Rect, rect: Rect, pad = 20){
    const minX = container.x + pad;
    const minY = container.y + pad;
    const maxX = right(container) - rect.w - pad;
    const maxY = bottom(container) - rect.h - pad;

    
    const x = Math.max(minX, Math.min(rect.x, maxX));
    const y = Math.max(minY, Math.min(rect.y, maxY));

    return { ...rect, x, y};
}

export function isPointInRect(x: number, y:number, r: Rect, padding = 0): boolean {
    const rect1 = padding !== 0 ? expandRect(r,padding) : r;
    return (x > rect1.x) && (x <= right(rect1)) && (y >= rect1.y) && (y <= bottom(rect1));
}

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
    if (!a) return b;
    if (!b) return a;
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(right(a), right(b));
    const maxY = Math.max(bottom(a), bottom(b));

    return {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
    };
}
export function recomputeLiveHaloSgRects(hg: HGraph, activeSubgraphs: Set<string>, nodeRadius: number, subgraphRects: Map<string, Rect>){
    const haloPadding = nodeRadius* 2.5;
    for (const sgId of activeSubgraphs){    
        const rect = liveHaloRects(hg, sgId, haloPadding);
        if (rect) subgraphRects.set(sgId, rect);
        else subgraphRects.delete(sgId);
    }
}

export function liveHaloRects(hg: HGraph, subgraphId: string, pad: number){
    const children = Array.from(hg.nodes.values()).filter(n => n.visible && (n.parent === subgraphId || isInSubtree(n, subgraphId, hg)));
        if (!children.length) return null;
        const xLocs = children.map(n => n.x);
        const yLocs = children.map(n => n.y);

        return {
            x: Math.min(...xLocs) - pad,
            y: Math.min(...yLocs) - pad,
            w: Math.max(...xLocs) - Math.min(...xLocs) + 2*pad,
            h: Math.max(...yLocs) - Math.min(...yLocs) + 2*pad
        };
}
function isInSubtree(n: HStateNode, sgId: string, hg: HGraph): Boolean{
    let p = n.parent;
    while (p){
        if (p === sgId) return true;
        const parentNode = hg.nodes.get(p);
        p = parentNode?.parent ?? null;
    }
    return false;
}
// line from rect to a target point
export function rectBorderPoint(r: Rect, targetX: number, targetY: number): {x:number, y:number}{
    const centreX = r.x + r.w /2;
    const centreY = r.y + r.h/2;
    const dx = targetX - centreX;
    const dy = targetY - centreY;
    if (dx === 0 && dy === 0) return {x: centreX, y: centreY};

    const targets= [];
    if (dx!==0) {
        targets.push((r.x-centreX)/dx);
        targets.push((r.x+r.w-centreX)/dx);
    }
    if (dy!==0) {
        targets.push((r.y-centreY)/dy);
        targets.push((r.y+r.h-centreY)/dy);
    }
    const target = targets.filter(t => t>0.00001).reduce((a,b) => Math.min(a,b), Infinity);
    return {
        x: centreX + target*dx,
        y: centreY + target*dy,
    }

}

//checkes whether 12 evenly space poimts along the curve land inside a halo: c are the control points
export function bezierClear(startx: number, starty: number, cx1: number, cy1: number, cx2: number, cy2: number, endx: number, endy: number, obstacles: Rect[], samples=12
): boolean{
    for (let s = 1; s<samples; s++){
        const t = s/samples; //12 evenly spaced points
        const mt = 1-t;
        const b0 = mt*mt*mt;
        const b1  = 3* mt*mt * t;
        const b2 = 3* mt * t*t;
        const b3 = t*t*t;

        const sampleX = b0* startx + b1*cx1 + b2*cx2 + b3*endx;
        const sampleY = b0* starty + b1*cy1 + b2*cy2 + b3*endy;
        if (obstacles.some(ob => isPointInRect(sampleX, sampleY, ob, 0))) return false;

    }
    return true;
}

export function bezierMidpoint(startx: number, starty: number, cx1: number, cy1: number, cx2: number, cy2: number, endx: number, endy: number,){
    return {
        x: 0.125*startx +0.375*cx1 + 0.375*cx2 + 0.125*endx,
        y: 0.125*starty +0.375*cy1 + 0.375*cy2 + 0.125*endy
    };
}