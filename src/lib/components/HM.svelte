<script lang="ts">
    import { onMount } from "svelte";
    import * as d3 from "d3";
    import type { HGraph, HStateNode, HEdge } from "$lib/graph/graphTypes";
    import { getGraphDefaultsMarkov } from "$lib/graph/graphDefaults";
    import { createDragNoSim, computeEdgePoints, computeCurvedPath, computeSelfLoopPath } from "$lib/graph/graphBehaviours";

    // -------------------------------------------------------------------------
    // Props
    // -------------------------------------------------------------------------
    export let markovStates: string[] = [];
    export let markovTransitions: { from: string; to: string; probability: number }[] = [];
    export let mStartingStates: string[] = [];
    export let endState: string[] = [];
    export let wordChains: Record<string, {
        markovStates: string[];
        mStartingStates: string[];
        markovTransitions: { from: string; to: string; probability: number }[];
    }> = {};
    export let renderKey: string = "";
    /** Live sequence string from the compute box — drives path highlighting */
    export let inputSequence: string = "";

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    const ZOOM_EXPAND_THRESHOLD = 1.8;
    const BASE_NODE_RADIUS = 20;
    const WORD_NODE_RADIUS = 12;
    const LABEL_OFFSET = 6;

    const SECTION_COLOURS: Record<string, string> = {
        verse:     "#bde0fe",
        chorus:    "#ffc8dd",
        prechorus: "#cdb4db",
        bridge:    "#b9fbc0",
        outro:     "#fde8b0",
    };
    const DEFAULT_COLOUR = "#e0e0e0";

    // -------------------------------------------------------------------------
    // DOM / D3 refs
    // -------------------------------------------------------------------------
    let svgElement: SVGSVGElement;
    let wrapperElement: HTMLDivElement;
    let g: d3.Selection<SVGGElement, unknown, null, undefined>;
    let zoomBehaviour: d3.ZoomBehavior<SVGSVGElement, unknown>;
    let dragBehaviour: d3.DragBehavior<SVGGElement, HStateNode, unknown>;

    let graphWidth = 800;
    let graphHeight = 600;
    let currentZoomTransform = d3.zoomIdentity;
    let lastZoomK = 1;
    let lastSemanticK = 1;
    let evaluating = false;
    let mounted = false;
    let lastRenderKey = "";

    // -------------------------------------------------------------------------
    // HGraph state
    // -------------------------------------------------------------------------
    let hg: HGraph = {
        nodes: new Map<string, HStateNode>(),
        edges: new Map<string, HEdge>(),
        activeSubgraphs: new Set<string>(),
    };
    let canonicalSectionPos = new Map<string, { x: number; y: number }>();
    let hiddenEdgesBySection = new Map<string, string[]>();

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    function measureHeight() {
        const r = wrapperElement.getBoundingClientRect();
        graphWidth = Math.max(1, Math.floor(r.width));
        graphHeight = Math.max(1, Math.floor(r.height));
        d3.select(svgElement).attr("width", graphWidth).attr("height", graphHeight);
    }

    function nodeRadius(d: HStateNode): number {
        return d.kind === "base" ? BASE_NODE_RADIUS : WORD_NODE_RADIUS;
    }

    function nodeColour(d: HStateNode): string {
        if (d.kind === "base") return SECTION_COLOURS[d.id] ?? DEFAULT_COLOUR;
        const base = SECTION_COLOURS[d.parent ?? ""] ?? DEFAULT_COLOUR;
        return d3.color(base)?.brighter(0.7)?.formatHex() ?? "#f5f5f5";
    }

    // -------------------------------------------------------------------------
    // Layout — top-down BFS, matching old Markov viewer convention
    // -------------------------------------------------------------------------
    function computeSectionLayout(): Map<string, { x: number; y: number }> {
        const adj = new Map<string, string[]>();
        for (const t of markovTransitions) {
            if (!adj.has(t.from)) adj.set(t.from, []);
            adj.get(t.from)!.push(t.to);
        }

        const levels = new Map<string, number>();
        const start = mStartingStates[0] ?? markovStates[0];
        const queue = [start];
        levels.set(start, 0);
        while (queue.length) {
            const cur = queue.shift()!;
            for (const nb of adj.get(cur) ?? []) {
                if (!levels.has(nb)) {
                    levels.set(nb, (levels.get(cur) ?? 0) + 1);
                    queue.push(nb);
                }
            }
        }
        const maxLvl = levels.size ? Math.max(...levels.values()) : 0;
        for (const s of markovStates) if (!levels.has(s)) levels.set(s, maxLvl + 1);

        const byLevel = new Map<number, string[]>();
        for (const [s, l] of levels) {
            if (!byLevel.has(l)) byLevel.set(l, []);
            byLevel.get(l)!.push(s);
        }

        // BFS level → Y, siblings spread horizontally (matches old Markov viewer)
        const pad = 60;
        const innerW = graphWidth - 2 * pad;
        const innerH = graphHeight - 2 * pad;
        const rowSpacing = innerH / Math.max(maxLvl, 1);

        const positions = new Map<string, { x: number; y: number }>();
        for (const [lvl, nodes] of byLevel) {
            const y = pad + lvl * rowSpacing;
            const colSpacing = innerW / (nodes.length + 1);
            nodes.forEach((id, i) => {
                positions.set(id, { x: pad + colSpacing * (i + 1), y });
            });
        }
        // Pin starting state to top centre
        positions.set(start, { x: graphWidth / 2, y: pad });

        // Subtle zigzag: when every BFS level has exactly one node (pure linear
        // chain), all nodes are collinear and back/skip edges are invisible.
        // Nudge odd levels slightly right so back-edges get a visible angle,
        // without destroying the clean vertical feel.
        const allSingletons = Array.from(byLevel.values()).every(arr => arr.length === 1);
        if (allSingletons && maxLvl >= 2) {
            const ZIG = 55; // px — small enough to feel intentional, not accidental
            for (const [lvl, nodes] of byLevel) {
                if (lvl === 0) continue;
                const pos = positions.get(nodes[0])!;
                pos.x = graphWidth / 2 + (lvl % 2 === 1 ? ZIG : -ZIG * 0.35);
            }
        }

        return positions;
    }

    /**
     * Top-down BFS layout for a word chain, centred around its anchor.
     * Positions are keyed by raw word id (before namespacing).
     */
    function computeWordChainLayout(
        sectionId: string,
        anchorX: number,
        anchorY: number,
    ): Map<string, { x: number; y: number }> {
        const chain = wordChains[sectionId];
        if (!chain) return new Map();
        const { markovStates: words, markovTransitions: trans, mStartingStates: starts } = chain;

        const adj = new Map<string, string[]>();
        for (const t of trans) {
            if (!adj.has(t.from)) adj.set(t.from, []);
            adj.get(t.from)!.push(t.to);
        }

        const levels = new Map<string, number>();
        const startWord = starts[0] ?? words[0];
        const queue = [startWord];
        levels.set(startWord, 0);
        while (queue.length) {
            const cur = queue.shift()!;
            for (const nb of adj.get(cur) ?? []) {
                if (!levels.has(nb)) {
                    levels.set(nb, (levels.get(cur) ?? 0) + 1);
                    queue.push(nb);
                }
            }
        }
        const maxLvl = levels.size ? Math.max(...levels.values()) : 0;
        for (const w of words) if (!levels.has(w)) levels.set(w, maxLvl + 1);

        const byLevel = new Map<number, string[]>();
        for (const [w, l] of levels) {
            if (!byLevel.has(l)) byLevel.set(l, []);
            byLevel.get(l)!.push(w);
        }
   // Layout constants
        const COL_W         = 52;
        const ROW_H         = 42;
        const SQUEEZE_PX    = 260;
        const MAX_ROW_NODES = Math.max(2, Math.floor(SQUEEZE_PX / COL_W));
        const ZIG           = 40;

        const allSingletons = Array.from(byLevel.values()).every(arr => arr.length === 1);

        /**
         * For a wide level: reorder nodes using a mini BFS over *intra-level*
         * edges only. This groups nodes that transition to each other adjacently
         * so wrapped rows are locally meaningful rather than arbitrary chunks.
         *
         * Strategy:
         *  1. Build a bidirectional adjacency restricted to this level's node set.
         *  2. BFS from the node with the highest intra-level out-degree (most
         *     connected = best "spine seed"), visit neighbours in degree order.
         *  3. Any unreached nodes (isolated within the level) are appended at end.
         */
        function intraLevelOrder(levelNodes: string[]): string[] {
            const nodeSet = new Set(levelNodes);

            // Intra-level adjacency (directed, but we'll treat as undirected for BFS)
            const intraAdj = new Map<string, string[]>();
            const intraDeg = new Map<string, number>();
            for (const n of levelNodes) { intraAdj.set(n, []); intraDeg.set(n, 0); }

            for (const t of trans) {
                if (nodeSet.has(t.from) && nodeSet.has(t.to)) {
                    intraAdj.get(t.from)!.push(t.to);
                    intraAdj.get(t.to)!.push(t.from); // undirected so BFS spreads both ways
                    intraDeg.set(t.from, (intraDeg.get(t.from) ?? 0) + 1);
                    intraDeg.set(t.to,   (intraDeg.get(t.to)   ?? 0) + 1);
                }
            }

            // Seed from highest-degree node; if all isolated, keep original order
            const sorted = [...levelNodes].sort((a, b) => (intraDeg.get(b) ?? 0) - (intraDeg.get(a) ?? 0));
            const visited = new Set<string>();
            const ordered: string[] = [];
            const bfsQ: string[] = [];

            for (const seed of sorted) {
                if (visited.has(seed)) continue;
                // Start a new connected component
                bfsQ.push(seed);
                visited.add(seed);
                while (bfsQ.length) {
                    const cur = bfsQ.shift()!;
                    ordered.push(cur);
                    // Visit neighbours in descending degree order for a denser-first spread
                    const neighbours = (intraAdj.get(cur) ?? [])
                        .filter(n => !visited.has(n))
                        .sort((a, b) => (intraDeg.get(b) ?? 0) - (intraDeg.get(a) ?? 0));
                    for (const nb of neighbours) { visited.add(nb); bfsQ.push(nb); }
                }
            }

            return ordered;
        }

        // Build physical rows
        type PhysRow = { nodes: string[]; xOffset: number };
        const physRows: PhysRow[] = [];

        for (const lvl of Array.from(byLevel.keys()).sort((a, b) => a - b)) {
            const nodes = byLevel.get(lvl)!;

            if (allSingletons) {
                // Linear chain: zigzag
                physRows.push({ nodes, xOffset: lvl % 2 === 1 ? ZIG : -ZIG * 0.35 });
            } else if (nodes.length * COL_W > SQUEEZE_PX && nodes.length > MAX_ROW_NODES) {
                // Wide level: reorder by intra-level connectivity, then wrap into rows
                const ordered = intraLevelOrder(nodes);
                for (let i = 0; i < ordered.length; i += MAX_ROW_NODES)
                    physRows.push({ nodes: ordered.slice(i, i + MAX_ROW_NODES), xOffset: 0 });
            } else {
                physRows.push({ nodes, xOffset: 0 });
            }
        }

        // Assign positions
        const totalH = Math.max(physRows.length * ROW_H, 80);
        const topY   = anchorY - totalH / 2;
        const positions = new Map<string, { x: number; y: number }>();

        physRows.forEach((row, rowIdx) => {
            const y = topY + rowIdx * ROW_H + ROW_H / 2;
            const totalRowW = (row.nodes.length - 1) * COL_W;
            row.nodes.forEach((id, i) => {
                positions.set(id, {
                    x: anchorX + row.xOffset + (row.nodes.length === 1 ? 0 : -totalRowW / 2 + i * COL_W),
                    y,
                });
            });
        });
       
        return positions;
    }

    // -------------------------------------------------------------------------
    // HGraph build
    // -------------------------------------------------------------------------
    function buildBaseHGraph() {
        hg.nodes.clear();
        hg.edges.clear();
        hg.activeSubgraphs.clear();
        hiddenEdgesBySection.clear();
        canonicalSectionPos.clear();

        const positions = computeSectionLayout();
        for (const id of markovStates) {
            const p = positions.get(id) ?? { x: graphWidth / 2, y: graphHeight / 2 };
            hg.nodes.set(id, {
                id, displayName: id,
                x: p.x, y: p.y,
                parent: null, depth: 1,
                visible: true, kind: "base",
            });
            canonicalSectionPos.set(id, { x: p.x, y: p.y });
        }

        for (const t of markovTransitions) {
            const id = `base:${t.from}->${t.to}`;
            hg.edges.set(id, {
                id, from: t.from, to: t.to,
                label: t.probability.toFixed(2),
                visible: true, kind: "base", parent: null,
            });
        }
    }

    // -------------------------------------------------------------------------
    // Expand / collapse
    // -------------------------------------------------------------------------
    function expandSection(sectionId: string) {
        if (hg.activeSubgraphs.has(sectionId)) return;
        const chain = wordChains[sectionId];
        if (!chain) return;
        const anchor = hg.nodes.get(sectionId);
        if (!anchor || !anchor.visible) return;

        const wordPos = computeWordChainLayout(sectionId, anchor.x, anchor.y);

        for (const wordId of chain.markovStates) {
            const nodeId = `${sectionId}.${wordId}`;
            const p = wordPos.get(wordId) ?? { x: anchor.x, y: anchor.y };
            hg.nodes.set(nodeId, {
                id: nodeId, displayName: wordId,
                x: p.x, y: p.y,
                parent: sectionId, depth: 2,
                visible: true, kind: "sub",
            });
        }

        for (const t of chain.markovTransitions) {
            const fromId = `${sectionId}.${t.from}`;
            const toId   = `${sectionId}.${t.to}`;
            const edgeId = `sub:${sectionId}:${t.from}->${t.to}`;
            hg.edges.set(edgeId, {
                id: edgeId, from: fromId, to: toId,
                label: t.probability.toFixed(2),
                visible: true, kind: "sub", parent: sectionId,
            });
        }

        anchor.visible = false;
        const hidden: string[] = [];
        for (const [edgeId, edge] of hg.edges) {
            if (edge.kind !== "base") continue;
            if (edge.from === sectionId || edge.to === sectionId) {
                edge.visible = false;
                hidden.push(edgeId);
            }
        }
        hiddenEdgesBySection.set(sectionId, hidden);
        hg.activeSubgraphs.add(sectionId);
    }

    function collapseSection(sectionId: string) {
        if (!hg.activeSubgraphs.has(sectionId)) return;

        for (const [id, node] of hg.nodes) {
            if (node.parent === sectionId) hg.nodes.delete(id);
        }
        for (const [id, edge] of hg.edges) {
            if (edge.parent === sectionId) hg.edges.delete(id);
        }

        const anchor = hg.nodes.get(sectionId);
        if (anchor) {
            anchor.visible = true;
            const canon = canonicalSectionPos.get(sectionId);
            if (canon) { anchor.x = canon.x; anchor.y = canon.y; }
        }

        for (const edgeId of hiddenEdgesBySection.get(sectionId) ?? []) {
            const e = hg.edges.get(edgeId);
            if (e) e.visible = true;
        }
        hiddenEdgesBySection.delete(sectionId);
        hg.activeSubgraphs.delete(sectionId);
    }

    function isNodeInFocus(_sectionId: string, k: number): boolean {
        return k >= ZOOM_EXPAND_THRESHOLD;
        // Future: add viewport centre check here for per-node independent expansion
    }

    function updateExpansionsForZoom(k: number): boolean {
        let changed = false;
        for (const sectionId of markovStates) {
            if (!wordChains[sectionId]) continue;
            const want = isNodeInFocus(sectionId, k);
            const has  = hg.activeSubgraphs.has(sectionId);
            if (want && !has)  { expandSection(sectionId);   changed = true; }
            else if (!want && has) { collapseSection(sectionId); changed = true; }
        }
        if (changed && hg.activeSubgraphs.size > 1) runHaloCollisionAvoidance();
        return changed;
    }

    function semanticTickGuard() {
        if (evaluating) return;
        evaluating = true;
        const changed = updateExpansionsForZoom(lastZoomK);
        if (changed) rerenderGraph();
        evaluating = false;
    }

    // -------------------------------------------------------------------------
    // Halo collision avoidance (single-level)
    // -------------------------------------------------------------------------
    type Rect = { x: number; y: number; w: number; h: number };

    function sectionHaloRect(sectionId: string, pad: number): Rect | null {
        const children = Array.from(hg.nodes.values()).filter(n => n.parent === sectionId && n.visible);
        if (!children.length) return null;
        const xs = children.map(n => n.x);
        const ys = children.map(n => n.y);
        return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad,
                 w: Math.max(...xs) - Math.min(...xs) + pad * 2,
                 h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    }

    function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
        return !(a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x ||
                 a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y);
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

    // -------------------------------------------------------------------------
    // Section-level transition edges — drawn between halo borders, never through them
    // -------------------------------------------------------------------------

    /** Live halo rect using the same padding as drawHalos. */
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

    /**
     * Find the point on the border of rect r that lies on the ray from r's
     * centre toward external point (tx, ty).  This is the true centre→exterior
     * intersection — the arrow starts/ends flush with the halo edge.
     */
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

    function drawSectionEdges() {
        type SE = { id: string; d: string; label: string; mx: number; my: number; sw: number };
        const data: SE[] = [];

        if (hg.activeSubgraphs.size > 0) {
            // Collect all live rects (same padding as drawHalos)
            const allRects = new Map<string, ReturnType<typeof liveHaloRect>>();
            for (const sid of hg.activeSubgraphs) allRects.set(sid, liveHaloRect(sid));

            // Label zones: the top-left corner of each halo hosts a text label (~80×20px).
            // Treat this as a small extra obstacle rect.
            const labelZones: Rect[] = [];
            for (const rc of allRects.values()) {
                if (!rc) continue;
                labelZones.push({ x: rc.x, y: rc.y, w: 90, h: 22 });
            }

            // All visible sub-nodes, used as point obstacles (expanded by node radius)
            const nodeObstacles = Array.from(hg.nodes.values())
                .filter(n => n.visible && n.kind === "sub")
                .map(n => ({ x: n.x - WORD_NODE_RADIUS, y: n.y - WORD_NODE_RADIUS,
                             w: WORD_NODE_RADIUS * 2,   h: WORD_NODE_RADIUS * 2 }));

            /** Test if a point (px, py) is inside a rect */
            function inRect(px: number, py: number, r: Rect): boolean {
                return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
            }

            /** Sample N points along a cubic bezier and test against all obstacle rects.
             *  Returns true if the path is clear. */
            function bezierClear(
                x1: number, y1: number, cx1: number, cy1: number,
                cx2: number, cy2: number, x2: number, y2: number,
                obstacles: Rect[], samples = 12,
            ): boolean {
                for (let s = 1; s < samples; s++) {
                    const t  = s / samples;
                    const mt = 1 - t;
                    const px = mt*mt*mt*x1 + 3*mt*mt*t*cx1 + 3*mt*t*t*cx2 + t*t*t*x2;
                    const py = mt*mt*mt*y1 + 3*mt*mt*t*cy1 + 3*mt*t*t*cy2 + t*t*t*y2;
                    for (const ob of obstacles) {
                        if (inRect(px, py, ob)) return false;
                    }
                }
                return true;
            }

            /** Midpoint of a cubic bezier at t=0.5 */
            function bezierMid(x1: number, y1: number, cx1: number, cy1: number,
                               cx2: number, cy2: number, x2: number, y2: number) {
                return {
                    x: 0.125*x1 + 0.375*cx1 + 0.375*cx2 + 0.125*x2,
                    y: 0.125*y1 + 0.375*cy1 + 0.375*cy2 + 0.125*y2,
                };
            }

            for (const t of markovTransitions) {
                const ra = allRects.get(t.from);
                const rb = allRects.get(t.to);
                if (!ra || !rb) continue;

                const p1 = rectBorderPoint(ra, rb.cx, rb.cy);
                const p2 = rectBorderPoint(rb, ra.cx, ra.cy);

                const dx = p2.x - p1.x; const dy = p2.y - p1.y;
                const len = Math.hypot(dx, dy);
                if (len < 1) continue;
                const ux = dx / len; const uy = dy / len;
                const MARGIN = 4;
                const x1 = p1.x + ux * MARGIN; const y1 = p1.y + uy * MARGIN;
                const x2 = p2.x - ux * MARGIN; const y2 = p2.y - uy * MARGIN;

                // All obstacles for this specific edge:
                // other halo rects + their label zones + sub-nodes
                const obstacles: Rect[] = [...labelZones, ...nodeObstacles];
                for (const [sid, rc] of allRects) {
                    if (sid === t.from || sid === t.to || !rc) continue;
                    obstacles.push({ x: rc.x, y: rc.y, w: rc.w, h: rc.h });
                }

                // Perpendicular directions (left and right of travel)
                const perpL = { x: -uy, y:  ux };
                const perpR = { x:  uy, y: -ux };

                // Try bulge magnitudes: small first, then larger if needed
                const bulges = [
                    Math.max(ra.w, ra.h) * 0.5,
                    Math.max(ra.w, ra.h) * 0.8,
                    Math.max(ra.w, ra.h) * 1.2,
                ];

                let pathD: string;
                let midX: number, midY: number;
                let found = false;

                // First check straight line
                const straightClear = bezierClear(x1, y1, x1, y1, x2, y2, x2, y2, obstacles);
                if (straightClear) {
                    pathD = `M ${x1},${y1} L ${x2},${y2}`;
                    midX = (x1 + x2) / 2;
                    midY = (y1 + y2) / 2 - 7;
                    found = true;
                }

                // Try left then right, at increasing bulge magnitudes
                if (!found) {
                    outer: for (const bulge of bulges) {
                        for (const perp of [perpL, perpR]) {
                            const cx1b = x1 + perp.x * bulge;
                            const cy1b = y1 + perp.y * bulge;
                            const cx2b = x2 + perp.x * bulge;
                            const cy2b = y2 + perp.y * bulge;
                            if (bezierClear(x1, y1, cx1b, cy1b, cx2b, cy2b, x2, y2, obstacles)) {
                                pathD = `M ${x1},${y1} C ${cx1b},${cy1b} ${cx2b},${cy2b} ${x2},${y2}`;
                                const mid = bezierMid(x1, y1, cx1b, cy1b, cx2b, cy2b, x2, y2);
                                midX = mid.x + perp.x * 10;
                                midY = mid.y + perp.y * 10;
                                found = true;
                                break outer;
                            }
                        }
                    }
                }

                // Fallback: use largest left bulge regardless
                if (!found) {
                    const bulge = Math.max(ra.w, ra.h) * 1.2;
                    const cx1b = x1 + perpL.x * bulge; const cy1b = y1 + perpL.y * bulge;
                    const cx2b = x2 + perpL.x * bulge; const cy2b = y2 + perpL.y * bulge;
                    pathD = `M ${x1},${y1} C ${cx1b},${cy1b} ${cx2b},${cy2b} ${x2},${y2}`;
                    const mid = bezierMid(x1, y1, cx1b, cy1b, cx2b, cy2b, x2, y2);
                    midX = mid.x + perpL.x * 10;
                    midY = mid.y + perpL.y * 10;
                }

                data.push({
                    id: `section:${t.from}->${t.to}`,
                    d: pathD!,
                    label: t.probability.toFixed(2),
                    mx: midX!, my: midY!,
                    sw: Math.max(1, t.probability * 3),
                });
            }
        }

        const layer = g.select<SVGGElement>("g.section-edges");

        layer.selectAll<SVGPathElement, SE>("path.section-edge")
            .data(data, d => d.id)
            .join(enter => enter.append("path").attr("class", "section-edge"), u => u, e => e.remove())
            .attr("fill", "none")
            .attr("stroke", "#888")
            .attr("stroke-width", d => d.sw)
            .attr("stroke-dasharray", "5 3")
            .attr("marker-end", "url(#arrow-section)")
            .attr("d", d => d.d);

        layer.selectAll<SVGTextElement, SE>("text.section-edge-label")
            .data(data, d => d.id)
            .join(enter => enter.append("text").attr("class", "section-edge-label"), u => u, e => e.remove())
            .attr("x", d => d.mx).attr("y", d => d.my)
            .attr("text-anchor", "middle")
            .attr("font-size", 10).attr("font-weight", "600").attr("fill", "#777")
            .attr("pointer-events", "none")
            .text(d => d.label);
    }

    // -------------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------------
    function drawHalos() {
        type HaloData = { id: string; x: number; y: number; w: number; h: number; colour: string };
        const halos: HaloData[] = [];

        for (const sectionId of hg.activeSubgraphs) {
            const children = Array.from(hg.nodes.values()).filter(n => n.parent === sectionId && n.visible);
            if (!children.length) continue;
            const xs = children.map(n => n.x);
            const ys = children.map(n => n.y);
            const pad = WORD_NODE_RADIUS * 2.5;
            halos.push({
                id: sectionId,
                x: Math.min(...xs) - pad, y: Math.min(...ys) - pad,
                w: Math.max(...xs) - Math.min(...xs) + pad * 2,
                h: Math.max(...ys) - Math.min(...ys) + pad * 2,
                colour: SECTION_COLOURS[sectionId] ?? DEFAULT_COLOUR,
            });
        }

        g.select<SVGGElement>("g.halos")
            .selectAll<SVGGElement, HaloData>("g.halo")
            .data(halos, d => d.id)
            .join(
                enter => {
                    const hg2 = enter.append("g").attr("class", "halo");
                    hg2.append("rect").attr("rx", 12).attr("ry", 12)
                        .attr("fill-opacity", 0.15).attr("stroke-opacity", 0.5)
                        .attr("stroke-width", 1.5).attr("stroke-dasharray", "6 3");
                    hg2.append("text").attr("font-size", 12).attr("font-weight", "600").attr("fill-opacity", 0.7);
                    return hg2;
                },
                update => update,
                exit => exit.remove(),
            )
            .each(function(d) {
                const s = d3.select(this);
                s.select("rect")
                    .attr("x", d.x).attr("y", d.y)
                    .attr("width", d.w).attr("height", d.h)
                    .attr("fill", d.colour).attr("stroke", d.colour);
                s.select("text")
                    .attr("x", d.x + 8).attr("y", d.y + 16)
                    .attr("fill", d3.color(d.colour)?.darker(1.2).formatHex() ?? "#333")
                    .text(d.id);
            });
    }

    function drawNodes() {
        const nodeData = Array.from(hg.nodes.values()).filter(n => n.visible);

        g.select<SVGGElement>("g.nodes")
            .selectAll<SVGGElement, HStateNode>("g.node")
            .data(nodeData, d => d.id)
            .join(
                enter => {
                    const n = enter.append("g")
                        .attr("class", "node")
                        .attr("transform", d => `translate(${d.x},${d.y})`)
                        .call(dragBehaviour as any);
                    n.append("circle")
                        .attr("r", d => nodeRadius(d))
                        .attr("fill", d => nodeColour(d))
                        .attr("stroke", d => {
                            if (d.kind !== "base") return "#555";
                            if (mStartingStates.includes(d.id)) return "#3a86ff";
                            if (endState.includes(d.id)) return "#2dc653";
                            return "#555";
                        })
                        .attr("stroke-width", d => {
                            if (d.kind !== "base") return 0.8;
                            if (mStartingStates.includes(d.id) || endState.includes(d.id)) return 3;
                            return 1.5;
                        });
                    // Double ring for end states
                    n.filter(d => d.kind === "base" && endState.includes(d.id))
                        .append("circle")
                        .attr("r", d => nodeRadius(d) - 4)
                        .attr("fill", "none")
                        .attr("stroke", "#2dc653")
                        .attr("stroke-width", 1.5);
                    n.append("text")
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("font-size", d => d.kind === "base" ? 10 : 7)
                        .attr("pointer-events", "none")
                        .text(d => d.displayName);
                    n.append("title").text(d => d.id);
                    return n;
                },
                update => update.attr("transform", d => `translate(${d.x},${d.y})`),
                exit => exit.remove(),
            );
    }

    function drawEdges() {
        const edgeData = Array.from(hg.edges.values()).filter(e => e.visible);
        const pairSet  = new Set(edgeData.map(e => `${e.from}|${e.to}`));

        type EdgeRender = {
            id: string; label: string | undefined;
            path: string; labelX: number; labelY: number;
            angle: number; strokeWidth: number;
        };

        const renderData: EdgeRender[] = edgeData.flatMap(e => {
            const src = hg.nodes.get(e.from);
            const tgt = hg.nodes.get(e.to);
            if (!src || !tgt) return [];

            const isSelfLoop      = e.from === e.to;
            const isBidirectional = !isSelfLoop && pairSet.has(`${e.to}|${e.from}`);
            const r = nodeRadius(src);
            const p = parseFloat(e.label ?? "0");

            let path: string;
            let labelX: number;
            let labelY: number;

            if (isSelfLoop) {
                path   = computeSelfLoopPath(src, r);
                labelX = src.x + r + 10;
                labelY = src.y - r * 2;
            } else if (isBidirectional) {
                path   = computeCurvedPath(src, tgt, r, 1);
                labelX = (src.x + tgt.x) / 2 + 12;
                labelY = (src.y + tgt.y) / 2 - LABEL_OFFSET;
            } else {
                const { x1, y1, x2, y2 } = computeEdgePoints(src, tgt, r);
                path   = `M ${x1},${y1} L ${x2},${y2}`;
                labelX = (src.x + tgt.x) / 2 + 8;
                labelY = (src.y + tgt.y) / 2 - LABEL_OFFSET;
            }

            const angleRad = Math.atan2(tgt.y - src.y, tgt.x - src.x);
            let angleDeg   = angleRad * (180 / Math.PI);
            if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;

            return [{
                id: e.id, label: e.label,
                path, labelX, labelY,
                angle: isSelfLoop ? 0 : angleDeg,
                strokeWidth: Math.max(0.5, p * 2),
            }];
        });

        g.select<SVGGElement>("g.edges")
            .selectAll<SVGPathElement, EdgeRender>("path.edge")
            .data(renderData, d => d.id)
            .join(
                enter => enter.append("path").attr("class", "edge"),
                update => update,
                exit => exit.remove(),
            )
            .attr("fill", "none")
            .attr("stroke", "black")
            .attr("stroke-width", d => d.strokeWidth)
            .attr("marker-end", "url(#arrow-black)")
            .attr("d", d => d.path);

        g.select<SVGGElement>("g.labels")
            .selectAll<SVGTextElement, EdgeRender>("text.edge-label")
            .data(renderData, d => d.id)
            .join(
                enter => enter.append("text").attr("class", "edge-label"),
                update => update,
                exit => exit.remove(),
            )
            .attr("font-size", 7)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#555")
            .attr("pointer-events", "none")
            .attr("transform", d => `translate(${d.labelX},${d.labelY}) rotate(${d.angle})`)
            .text(d => d.label ?? "");
    }

    function rerenderGraph() {
        g.attr("transform", currentZoomTransform.toString());
        drawHalos();
        drawSectionEdges();
        drawEdges();
        drawNodes();
        if (inputSequence && inputSequence.trim()) drawPathHighlight();
    }

    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------
    function init() {
        measureHeight();
        buildBaseHGraph();
        lastZoomK = 1;
        lastSemanticK = 1;
        rerenderGraph();
    }

    // Buttons use scaleBy — NOT WheelEvents, so semantic zoom gate ignores them.
    function zoomIn()    { d3.select(svgElement).transition().duration(150).call(zoomBehaviour.scaleBy as any, 1.2); }
    function zoomOut()   { d3.select(svgElement).transition().duration(150).call(zoomBehaviour.scaleBy as any, 1 / 1.2); }
    function zoomReset() { d3.select(svgElement).transition().duration(150).call(zoomBehaviour.transform as any, d3.zoomIdentity); }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------
    onMount(() => {
        const svg = d3.select(svgElement);

        g = svg.append("g").attr("class", "content-group");
        g.append("g").attr("class", "halos");
        g.append("g").attr("class", "section-edges");
        g.append("g").attr("class", "edges");
        // path-highlight sits above edges but below labels and nodes
        g.append("g").attr("class", "path-highlight").attr("pointer-events", "none");
        g.append("g").attr("class", "labels");
        g.append("g").attr("class", "nodes");

        const defs = svg.append("defs");

        // Word-level arrowhead — scales with stroke width, kept small
        defs.append("marker")
            .attr("id", "arrow-black")
            .attr("viewBox", [0, 0, 10, 10])
            .attr("refX", 7).attr("refY", 5)
            .attr("markerUnits", "strokeWidth")
            .attr("markerWidth", 6).attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", "black");

        // Section-level arrowhead — fixed pixel size so thick edges don't get giant heads
        defs.append("marker")
            .attr("id", "arrow-section")
            .attr("viewBox", [0, 0, 10, 10])
            .attr("refX", 9).attr("refY", 5)
            .attr("markerUnits", "userSpaceOnUse")
            .attr("markerWidth", 10).attr("markerHeight", 10)
            .attr("orient", "auto")
            .append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", "#888");

        dragBehaviour = createDragNoSim(() => {
            drawEdges();
            drawHalos();
            drawSectionEdges();
            if (inputSequence && inputSequence.trim()) drawPathHighlight();
        });

        zoomBehaviour = d3.zoom<SVGSVGElement, unknown>()
            .on("zoom", event => {
                currentZoomTransform = event.transform;
                g.attr("transform", event.transform.toString());
                // Only wheel events drive semantic zoom; button pans never change scale
                if (event.sourceEvent instanceof WheelEvent) {
                    lastZoomK = event.transform.k;
                    if (Math.abs(lastZoomK - lastSemanticK) > 0.05) {
                        lastSemanticK = lastZoomK;
                        requestAnimationFrame(semanticTickGuard);
                    }
                }
            });

        svg.call(zoomBehaviour);
        mounted = true;
        init();

        const onResize = () => init();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    });

    $: if (mounted && renderKey !== lastRenderKey) {
        lastRenderKey = renderKey;
        init();
    }

    // -------------------------------------------------------------------------
    // Path highlighting — driven by inputSequence prop
    // -------------------------------------------------------------------------

    const HIGHLIGHT_COLOUR = "#f72585";
    const TRAVEL_MS        = 350;
    const FADE_MS          = 600;
    const STAGGER_MS       = 40;

    type WalkedStep = { from: string; to: string; pathD: string };

    /**
     * Walk the Markov graph with the current input.
     *
     * When subgraphs are collapsed (base view): walk section-level nodes.
     * When any subgraph is expanded: walk word-chain nodes inside it.
     *
     * Token splitting is auto-detected:
     *   - Single-character state names → split by character ("Car" → ["C","a","r"])
     *   - Multi-character state names  → split by space ("verse chorus" → ["verse","chorus"])
     */
    function computeWalkedPath(seq: string): { steps: WalkedStep[]; litNodeIds: Set<string> } {
        const steps: WalkedStep[] = [];
        const litNodeIds = new Set<string>();
        if (!seq) return { steps, litNodeIds };

        // ── Decide which transition set to use ────────────────────────────────
        //
        // A) "Flat Markov" — wordChains is empty, markovTransitions are the
        //    actual typed-token transitions (possibly with a START node).
        //
        // B) "Hierarchical Markov" — markovStates are section names, and typed
        //    tokens walk word-chains. Always use a word-chain regardless of
        //    expansion state (the section may still be collapsed).
        //
        const hasWordChains = Object.keys(wordChains).length > 0;

        if (!hasWordChains) {
            // ── Case A: flat Markov ───────────────────────────────────────────
            // Exclude START/END from charLevel detection — they are infrastructure
            // nodes, not typed tokens, and their length > 1 would break the check.
            const typedStates = markovStates.filter(s => s !== "START" && s !== "END");
            const charLevel = typedStates.length > 0 && typedStates.every(s => s.length === 1);
            const tokens = charLevel ? seq.split("") : seq.split(" ").filter(Boolean);

            const hasStartNode = markovTransitions.some(t => t.from === "START");
            let current = hasStartNode ? "START" : (mStartingStates[0] ?? markovStates[0]);

            const startNode = hg.nodes.get(current);
            if (startNode?.visible) litNodeIds.add(current);

            for (const token of tokens) {
                const match = markovTransitions.find(tr => tr.from === current && tr.to === token)
                           ?? markovTransitions.find(tr =>
                                tr.from === current &&
                                tr.to.toLowerCase().startsWith(token.toLowerCase())
                              );
                if (!match) break;
                steps.push({ from: match.from, to: match.to, pathD: buildBaseLevelPath(match.from, match.to) });
                litNodeIds.add(match.to);
                current = match.to;
            }
        } else {
            // ── Case B: hierarchical — walk the relevant word-chain ──────────
            // Use the active expanded section if any, else the first chain.
            const sectionId = hg.activeSubgraphs.size > 0
                ? Array.from(hg.activeSubgraphs)[0]
                : Object.keys(wordChains)[0];

            const chain = wordChains[sectionId];
            if (!chain) return { steps, litNodeIds };

            const charLevel = chain.markovStates.every(s => s.length === 1);
            const tokens = charLevel ? seq.split("") : seq.split(" ").filter(Boolean);

            const chainHasStart = chain.markovTransitions.some(t => t.from === "START");
            let current = chainHasStart ? "START"
                        : (chain.mStartingStates[0] ?? chain.markovStates[0]);

            const expanded = hg.activeSubgraphs.has(sectionId);

            // Seed the start node ring
            if (expanded) {
                const startNodeId = `${sectionId}.${current}`;
                const n = hg.nodes.get(startNodeId);
                if (n?.visible) litNodeIds.add(startNodeId);
            } else {
                // Section collapsed: highlight the anchor bubble
                const anchor = hg.nodes.get(sectionId);
                if (anchor?.visible) litNodeIds.add(sectionId);
            }

            for (const token of tokens) {
                const match = chain.markovTransitions.find(tr => tr.from === current && tr.to === token)
                           ?? chain.markovTransitions.find(tr =>
                                tr.from === current &&
                                tr.to.toLowerCase().startsWith(token.toLowerCase())
                              );
                if (!match) break;

                if (expanded) {
                    const fromId = `${sectionId}.${match.from}`;
                    const toId   = `${sectionId}.${match.to}`;
                    const pathD  = buildSubLevelPath(fromId, toId);
                    if (pathD) steps.push({ from: fromId, to: toId, pathD });
                    litNodeIds.add(toId);
                }
                // When collapsed we still advance `current` so the walk is correct,
                // but there are no sub-nodes to render — just the anchor ring.
                current = match.to;
            }
        }

        return { steps, litNodeIds };
    }

    function buildBaseLevelPath(fromId: string, toId: string): string {
        const src = hg.nodes.get(fromId);
        const tgt = hg.nodes.get(toId);
        if (!src || !tgt) return "";
        if (fromId === toId) return computeSelfLoopPath(src, BASE_NODE_RADIUS);
        const isBi = hg.edges.has(`base:${toId}->${fromId}`);
        if (isBi) return computeCurvedPath(src, tgt, BASE_NODE_RADIUS, 1);
        const { x1, y1, x2, y2 } = computeEdgePoints(src, tgt, BASE_NODE_RADIUS);
        return `M ${x1},${y1} L ${x2},${y2}`;
    }

    function buildSubLevelPath(fromId: string, toId: string): string {
        const src = hg.nodes.get(fromId);
        const tgt = hg.nodes.get(toId);
        if (!src || !tgt) return "";
        if (fromId === toId) return computeSelfLoopPath(src, WORD_NODE_RADIUS);
        const isBi = Array.from(hg.edges.values()).some(e =>
            e.visible && e.from === toId && e.to === fromId
        );
        if (isBi) return computeCurvedPath(src, tgt, WORD_NODE_RADIUS, 1);
        const { x1, y1, x2, y2 } = computeEdgePoints(src, tgt, WORD_NODE_RADIUS);
        return `M ${x1},${y1} L ${x2},${y2}`;
    }

    function drawPathHighlight() {
        if (!g) return;
        const { steps, litNodeIds } = computeWalkedPath(inputSequence ?? "");
        const layer = g.select<SVGGElement>("g.path-highlight");

        // Edges
        type HStep = { id: string; pathD: string; opacity: number; delay: number };
        const stepData: HStep[] = steps.map((s, i) => ({
            id: `hl:${s.from}>${s.to}:${i}`,
            pathD: s.pathD,
            opacity: steps.length === 1 ? 1.0 : 0.45 + 0.55 * ((i + 1) / steps.length),
            delay: i * STAGGER_MS,
        }));

        layer.selectAll<SVGPathElement, HStep>("path.hl-edge")
            .data(stepData, d => d.id)
            .join(
                enter => {
                    const p = enter.append("path")
                        .attr("class", "hl-edge")
                        .attr("fill", "none")
                        .attr("stroke", HIGHLIGHT_COLOUR)
                        .attr("stroke-width", 4)
                        .attr("stroke-linecap", "round")
                        .attr("pointer-events", "none");
                    p.each(function(d) {
                        const el = this as SVGPathElement;
                        el.setAttribute("d", d.pathD);
                        const len = el.getTotalLength?.() ?? 80;
                        d3.select(el)
                            .attr("stroke-dasharray", len)
                            .attr("stroke-dashoffset", len)
                            .attr("opacity", 0)
                            .transition()
                            .delay(d.delay)
                            .duration(TRAVEL_MS)
                            .ease(d3.easeCubicOut)
                            .attr("stroke-dashoffset", 0)
                            .attr("opacity", d.opacity);
                    });
                    return p;
                },
                update => {
                    // Recompute dasharray from the new path geometry so the full
                    // stroke is always visible after a node drag repositions endpoints.
                    update.each(function(d) {
                        const el = this as SVGPathElement;
                        el.setAttribute("d", d.pathD);
                        const len = el.getTotalLength?.() ?? 80;
                        d3.select(el)
                            .attr("stroke-dasharray", len)
                            .attr("stroke-dashoffset", 0)
                            .attr("opacity", d.opacity);
                    });
                    return update;
                },
                exit => exit.transition().duration(FADE_MS).attr("opacity", 0).remove(),
            );

        // Nodes
        type HNode = { id: string; x: number; y: number; r: number; opacity: number };
        const litArr = Array.from(litNodeIds)
            .map(nid => hg.nodes.get(nid))
            .filter((n): n is HStateNode => !!n && n.visible);

        const nodeData: HNode[] = litArr.map((n, i) => ({
            id: `hl-node:${n.id}`,
            x: n.x, y: n.y,
            r: (n.kind === "base" ? BASE_NODE_RADIUS : WORD_NODE_RADIUS) + 5,
            opacity: litArr.length === 1 ? 1.0 : 0.4 + 0.6 * ((i + 1) / litArr.length),
        }));

        layer.selectAll<SVGCircleElement, HNode>("circle.hl-node")
            .data(nodeData, d => d.id)
            .join(
                enter => enter.append("circle")
                    .attr("class", "hl-node")
                    .attr("pointer-events", "none")
                    .attr("fill", "none")
                    .attr("stroke", HIGHLIGHT_COLOUR)
                    .attr("stroke-width", 2.5)
                    .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", d => d.r)
                    .attr("opacity", 0)
                    .call(sel => sel.transition().duration(200).attr("opacity", d => d.opacity)),
                update => update
                    .attr("cx", d => d.x).attr("cy", d => d.y)
                    .attr("opacity", d => d.opacity),
                exit => exit.transition().duration(FADE_MS).attr("opacity", 0).remove(),
            );
    }

    function fadeOutHighlight() {
        if (!g) return;
        g.select<SVGGElement>("g.path-highlight")
            .selectAll("path.hl-edge, circle.hl-node")
            .transition().duration(FADE_MS)
            .attr("opacity", 0)
            .on("end", function() { d3.select(this).remove(); });
    }

    $: if (mounted) {
        if (!inputSequence || inputSequence.trim() === "") {
            fadeOutHighlight();
        } else {
            drawPathHighlight();
        }
    }
</script>

<div class="graphWrapper" bind:this={wrapperElement}>
    <svg bind:this={svgElement}></svg>

    <div class="zoomControls">
        <button type="button" class="zoomButton" on:click={zoomIn}>+</button>
        <button type="button" class="zoomButton" on:click={zoomOut}>−</button>
        <button type="button" class="zoomButton" on:click={zoomReset}>⟳</button>
    </div>

    <div class="zoomHint">
        {#if hg.activeSubgraphs.size > 0}
            Word chains visible · zoom out to collapse
        {:else}
            Zoom in to explore word-level chains
        {/if}
    </div>
</div>

<style>
    svg {
        background: snow;
        border: 1px solid #ccc;
        display: block;
        width: 100%;
        height: 100%;
    }
    .graphWrapper {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 0;
    }
    .zoomControls {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }
    .zoomRow {
        display: flex;
        flex-direction: row;
        gap: 4px;
    }
    .zoomControls button {
        width: 34px;
        height: 34px;
        border: 1px solid #ccc;
        background: white;
        border-radius: 8px;
        cursor: pointer;
        font-size: 18px;
    }
    .zoomControls button:hover { background: #f0f0f0; }
    .zoomHint {
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        padding: 4px 10px;
        border: 1px solid #ccc;
        background: rgba(255,255,255,0.85);
        border-radius: 8px;
        font-size: 12px;
        color: #555;
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
    }
</style>