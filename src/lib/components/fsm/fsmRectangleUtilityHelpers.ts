export type Rect = { x:number, y: number, w: number, h: number };

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

export function isPointInRect(x: number, y:number, r: Rect, padding: 0): boolean {
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