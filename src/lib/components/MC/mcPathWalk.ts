

const HIGHLIGHT_COLOUR = "#f72585";
const TRAVEL_MS        = 350;
const FADE_MS          = 600;
const STAGGER_MS       = 40;

type WalkedStep = { from: string; to: string; pathD: string };

function computeWalkedPath(seq: string): { steps: WalkedStep[]; litNodeIds: Set<string> } {
    const steps: WalkedStep[] = [];
    const litNodeIds = new Set<string>();
    if (!seq) return { steps, litNodeIds };

    const hasWordChains = Object.keys(wordChains).length > 0;

    if (!hasWordChains) {
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

        if (expanded) {
            const startNodeId = `${sectionId}.${current}`;
            const n = hg.nodes.get(startNodeId);
            if (n?.visible) litNodeIds.add(startNodeId);
        } else {
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

    layer.selectAll("path.hl-edge, circle.hl-node").interrupt();

    type HStep = { id: string; pathD: string; opacity: number; delay: number };
    const stepData: HStep[] = steps.map((s, i) => ({
        id: `hl:${s.from}>${s.to}:${i}`,
        pathD: s.pathD,
        opacity: steps.length === 1 ? 0.8 : 0.4 + 0.4 * ((i + 1) / steps.length),
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
