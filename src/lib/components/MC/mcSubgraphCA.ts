import type { HGraph } from "$lib/graph/graphTypes";
import { rectOverlapsRect, type Rect } from "../fsm/fsmRectangleUtilityHelpers";

function sectionHaloRect(sectionId: string, pad: number): Rect | null {
    const children = Array.from(hg.nodes.values()).filter(n => n.parent === sectionId && n.visible);
    if (!children.length) return null;
    const xs = children.map(n => n.x);
    const ys = children.map(n => n.y);
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad,
                w: Math.max(...xs) - Math.min(...xs) + pad * 2,
                h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
}

function shiftSection(sectionId: string, dx: number, dy: number) {
    for (const n of hg.nodes.values())
        if (n.parent === sectionId) { n.x += dx; n.y += dy; }
}

function runHaloCollisionAvoidance() {
    const HALO_PAD = WORD_NODE_RADIUS * 5;
    const GAP      = WORD_NODE_RADIUS * 1.5;
    const MAX_ITER = 120;
    const sections = Array.from(hg.activeSubgraphs);
    for (let iter = 0; iter < MAX_ITER; iter++) {
        let changed = false;
        for (let i = 0; i < sections.length; i++) {
            for (let j = i + 1; j < sections.length; j++) {
                const ra = sectionHaloRect(sections[i], HALO_PAD);
                const rb = sectionHaloRect(sections[j], HALO_PAD);
                if (!ra || !rb || !rectsOverlap(ra, rb, GAP)) continue;
                const ox = Math.min(ra.x + ra.w - rb.x, rb.x + rb.w - ra.x);
                const oy = Math.min(ra.y + ra.h - rb.y, rb.y + rb.h - ra.y);
                if (ox <= oy) {
                    const h = (ox + GAP) / 2;
                    shiftSection(sections[i], -h, 0); shiftSection(sections[j], h, 0);
                } else {
                    const h = (oy + GAP) / 2;
                    shiftSection(sections[i], 0, -h); shiftSection(sections[j], 0, h);
                }
                changed = true;
            }
        }
        if (!changed) break;
    }
}

function liveHaloRect(sectionId: string): (Rect & { cx: number; cy: number }) | null {
    const HALO_PAD = WORD_NODE_RADIUS * 2.5;
    const children = Array.from(hg.nodes.values()).filter(n => n.parent === sectionId && n.visible);
    if (!children.length) return null;
    const xs = children.map(n => n.x);
    const ys = children.map(n => n.y);
    const x = Math.min(...xs) - HALO_PAD;
    const y = Math.min(...ys) - HALO_PAD;
    const w = Math.max(...xs) - Math.min(...xs) + HALO_PAD * 2;
    const h = Math.max(...ys) - Math.min(...ys) + HALO_PAD * 2;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

function rectBorderPoint(r: Rect & { cx: number; cy: number }, tx: number, ty: number): { x: number; y: number } {
    const dx = tx - r.cx;
    const dy = ty - r.cy;
    if (dx === 0 && dy === 0) return { x: r.cx, y: r.cy };
    // Parametric t values where the ray hits each face
    const ts: number[] = [];
    if (dx !== 0) { ts.push((r.x          - r.cx) / dx); ts.push((r.x + r.w - r.cx) / dx); }
    if (dy !== 0) { ts.push((r.y          - r.cy) / dy); ts.push((r.y + r.h - r.cy) / dy); }
    // Smallest positive t is the exit point
    const t = ts.filter(v => v > 1e-9).reduce((a, b) => Math.min(a, b), Infinity);
    return { x: r.cx + t * dx, y: r.cy + t * dy };
}
