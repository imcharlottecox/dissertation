<script lang="ts">
    import { onMount, createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import * as d3 from "d3";
    import type { HGraph, HStateNode, HEdge, Subgraph } from "$lib/graph/graphTypes";
    import type { Rect } from "../sharedGraph/rectangleUtilityHelpers";

    import { sectionColour } from "$lib/graph/nodeColours";
    import { createDragHandler } from "$lib/graph/graphBehaviours";
	import { logEvent } from "$lib/supabase/logging";
    import { computePositionLayout } from "../MC/mcLayoutPositions";
    import { makeZoomControls, measureHeight } from "$lib/components/sharedGraph/screenControls";
    import {drawArrowheads, drawHalos} from "../sharedGraph/graphRendering";
    import { drawEdges, drawNodes, type MCRenderContext } from "../MC/mcRendering"
    import { addMCContentGroup} from "../MC/mcSVGSetup";
    import { collapseSubgraph, subgraphShouldExpand, addSubEdges, addSubNodes, hideAnchorAndEdges } from "../sharedGraph/subgraphExpansion";
    import { runCollisionAvoidance } from "$lib/components/sharedGraph/subgraphLayoutCA";
    import { recomputeLiveHaloSgRects } from "$lib/components/sharedGraph/rectangleUtilityHelpers";
    import { drawInterSgArrows } from "../MC/interHaloArrows";
    import { fadeOutPathHighlight, drawPathHighlight, type PathWalked , buildFallbackPath, computeWalkedPathFlat} from "$lib/components/sharedGraph/pathwalk"
    import { resetHGraph } from "../sharedGraph/lifecycle";

    export let markovStates: string[] = [];
    export let markovTransitions: { from: string; to: string; probability: number }[] = [];
    export let mStartingStates: string[] = [];
    export let endState: string[] = [];
    export let fineChains: Record<string, {
        markovStates: string[];
        mStartingStates: string[];
        markovTransitions: { from: string; to: string; probability: number }[];
    }> = {};
    export let renderKey: string = "";
    export let inputSequence: string = "";
    export let isFullScreen: boolean = false;

    export let filterPairs: [string, string][] = [];
    export let showDirectionalColours: boolean = false;
    export let showEdgeLabels: boolean = true;
    export let weightedThickness: boolean = true;

    export let page: string = "unknown";
   
    const ZOOM_EXPAND_THRESHOLD = 1.2;
    const BASE_NODE_RADIUS = 15;
    const WORD_NODE_RADIUS = 15;
    const LABEL_OFFSET = 6;
   
    let svgElement: SVGSVGElement;
    let wrapperElement: HTMLDivElement;
    let g: d3.Selection<SVGGElement, unknown, null, undefined>;
    let zoomBehaviour: d3.ZoomBehavior<SVGSVGElement, unknown>;
    let dragBehaviour: d3.DragBehavior<SVGGElement, HStateNode, unknown>;

    let graphWidth = 800;
    let graphHeight = 600;
    let currentZoomTransform = d3.zoomIdentity;
    let lastZoomK = 1;
    let lastSemanticZoomK = 1;
    let evaluating = false;
    let mounted = false;
    let lastRenderKey = "";
    let zoomIn: () => void;
    let zoomOut: () => void;
    let zoomReset: () => void;
    let nodeRadius = 15;

    $: filterActiveNodes = filterPairs.length > 0 ? new Set<string>(filterPairs.flatMap(([a, b]) => [a, b])) : null; 
    $: filterActiveEdges = filterPairs.length > 0 ? new Set<string>(filterPairs.map(([a, b]) => `${a}->${b}`)) : null;
    $: subgraphs = fineChainsToSubgraph(fineChains);
    const subgraphRects = new Map<string, Rect>();
    const subgraphParent = new Map<string, string | null>();
    let focusClickedNodeId: string | null = null;
    let focusClickNodeIds  = new Set<string>();
    let focusClickEdgeIds  = new Set<string>();
    let hg: HGraph = {
        nodes: new Map<string, HStateNode>(),
        edges: new Map<string, HEdge>(),
        activeSubgraphs: new Set<string>(),
    };
    let canonicalBasePos = new Map<string, { x: number; y: number }>();
    let hiddenEdgesBySubgraph = new Map<string, string[]>();
import { benchRows, downloadBenchRowsAsCsv, measure, clearBenchRows } from "$lib/components/benchmarking/profiler";
import { makeSyntheticMCDS } from "$lib/components/benchmarking/makeSyntheticMCDS";
import { tick } from "svelte";

    let trials = 5;
let benchMode = false;
let benchN = 100;
let benchSeed = 22;
let statusText = "";

    function median(xs: number[]) {
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function loadSyntheticDS(n: number, seed: number) {
    const data = makeSyntheticMCDS({ n, seed });
    markovStates = data.markovStates;
    markovTransitions = data.markovTransitions;
    endState = data.acceptingStates;
    mStartingStates = data.startingStates;
    renderKey = `bench:${n}:${seed}:${Date.now()}`;
}

// function runBenchmarkPass(n: number) {
//     measure("mc:buildBaseHGraph", n, () => buildBaseHGraph());
//     measure("mc:drawNodes",       n, () => drawNodes(makeContext()));
//     measure("mc:drawEdges",       n, () => drawEdges(makeContext()));
//     measure("mc:totalRender",     n, () => {
//         buildBaseHGraph();
//         drawNodes(makeContext());
//         drawEdges(makeContext());
//     });
// }
function runBenchmarkPass(n: number) {
    buildBaseHGraph();
    measure("mc:buildBaseHGraph", n, () => buildBaseHGraph());
    measure("mc:drawNodes",       n, () => drawNodes(makeContext()));
    measure("mc:drawEdges",       n, () => drawEdges(makeContext()));
    measure("mc:drawHalos",       n, () => drawHalos(g, hg, nodeRadius, subgraphRects, subgraphs, haloColour));
    measure("mc:drawInterSgArrows", n, () => drawInterSgArrows(g, hg, markovTransitions, "url(#arrowhead-sg)"));
    measure("mc:totalRender",     n, () => {
        drawNodes(makeContext());
        drawEdges(makeContext());
        drawHalos(g, hg, nodeRadius, subgraphRects, subgraphs, haloColour);
        drawInterSgArrows(g, hg, markovTransitions, "url(#arrowhead-sg)");
    });
}
async function runBenchmarkMedian(n: number, trialCount: number) {
    benchMode = true;
    statusText = `Running n=${n}...`;
    await tick();
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    runBenchmarkPass(n);
    clearBenchRows();

    const timeScore = new Map<string, number[]>();
    for (let i = 0; i < trialCount; i++) {
        clearBenchRows();
        runBenchmarkPass(n);
        for (const row of benchRows) {
            if (!timeScore.has(row.name)) timeScore.set(row.name, []);
            timeScore.get(row.name)!.push(row.ms);
        }
    }

    clearBenchRows();
    for (const [name, times] of timeScore.entries()) {
        benchRows.push({ name, n, ms: median(times) });
    }
    benchMode = false;
    statusText = `Done n=${n}`;
}

async function runFullSuite() {
    clearBenchRows();
    const allN = [10, 100, 500, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000, 2250, 2500, 3000, 3500, 4000,];
    
    for (const n of allN) {
        loadSyntheticDS(n, benchSeed);
        await tick();
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        await runBenchmarkMedian(n, trials);
        downloadBenchRowsAsCsv(`MC_benchfull_sqrt_n${n}.csv`);
        clearBenchRows();
        await new Promise<void>(resolve => setTimeout(resolve, 100));
    }
    statusText = "Full suite complete";
}

    function fineChainsToSubgraph(wc: typeof fineChains): Record<string, Subgraph>{
            return Object.fromEntries(
                Object.entries(wc).map(([id, chain]) => [id, {
                    depthLevel: 1,
                    entry: "entry",
                    exit: "exit",
                    states: chain.markovStates,
                    acceptingStates: [],
                    startingStates: chain.mStartingStates,
                    transitions: chain.markovTransitions.map(t => ({from: t.from, to: t.to, label: t.probability.toFixed(2),
                    })),
                } satisfies Subgraph])
            );
    }
    function nodeColour(n: HStateNode): string {
        if (n.kind === "base") return sectionColour(n.id);
        const base = sectionColour(n.parent ?? "");
        return d3.color(base)?.brighter(0.7)?.formatHex() ?? "#f5f5f5";
    }
    function haloColour(id: string){
        return sectionColour(id);
    }
   
    function expandSubgraph(parentId: string){
        const sg = subgraphs[parentId];
        if (!sg || hg.activeSubgraphs.has(parentId)) return;

        const anchorNode = hg.nodes.get(parentId);
        if (!anchorNode?.visible) return;

        const localPos = computePositionLayout(sg.transitions, nodeRadius, renderKey, sg.states, sg.startingStates, graphWidth, graphHeight, 60, {x: anchorNode.x, y: anchorNode.y});

        //nesting
        const containerId = sg.parentState ? (anchorNode.parent ?? null) : null;
        const containerRect = containerId ? (subgraphRects.get(containerId) ?? {x:0, y:0, w:0, h:0}) : {x:0, y:0, w:0, h:0};
        if (sg.parentState && !containerRect) return; //parent must be expanded before 
        subgraphParent.set(parentId, containerId);
        addSubNodes(hg, parentId, sg, containerRect, localPos, anchorNode);
        addSubEdges(hg, parentId, sg);
        // addWarpEdges(hg, parentId, sg, warps, subgraphParent);

        const hiddenEdges = hideAnchorAndEdges(hg, parentId, containerId, sg);
        hiddenEdgesBySubgraph.set(parentId, hiddenEdges);
        hg.activeSubgraphs.add(parentId);
    }
    function updateExpansionsForZoom(k: number): boolean {
        const entries = Object.entries(subgraphs).sort((a, b) => (a[1]?.depthLevel ?? 1) - (b[1]?.depthLevel ?? 1));
        let changed = false;
        //collapse deepest levels first
        const desc = [...entries].sort((a, b) => (b[1]?.depthLevel ?? 1) - (a[1]?.depthLevel ?? 1));
        for (const [id, sg] of desc){
            const active = hg.activeSubgraphs.has(id);
            const want = subgraphShouldExpand(sg, k);
            if (active && !want){
                collapseSubgraph(id, hg, subgraphs, subgraphParent, hiddenEdgesBySubgraph, subgraphRects);
                changed = true;
            }
        }

        //expand lower levels first
        for (const [id, sg] of entries){
            const active = hg.activeSubgraphs.has(id);
            const want = subgraphShouldExpand(sg, k);
            if (!active && want){
                const anchor = hg.nodes.get(id);
                if (!anchor || anchor.visible === false) continue;
                expandSubgraph(id);
                changed = true;
            }
        }
        if (changed && hg.activeSubgraphs.size > 0){
            recomputeLiveHaloSgRects(hg, hg.activeSubgraphs, WORD_NODE_RADIUS, subgraphRects);
            runCollisionAvoidance({graphWidth, graphHeight, hg, nodeRadius: WORD_NODE_RADIUS, subgraphRects, subgraphParent, siblingGrowthAxis: "horizontal"})
        }
        return changed;
    }

    function semanticTickGuard() {
        if (evaluating) return;
        evaluating = true;
        const changed = updateExpansionsForZoom(lastZoomK);
        if (changed) rerenderGraph();
        evaluating = false;
    }
    function buildBaseHGraph() {
        resetHGraph(hg);

        const positions = computePositionLayout(markovTransitions, 15, renderKey, markovStates, mStartingStates, graphWidth, graphHeight, 60);
        for (const id of markovStates) {
            const p = positions.get(id) ?? { x: graphWidth / 2, y: graphHeight / 2 };
            hg.nodes.set(id, {
                id, 
                displayName: id,
                x: p.x, 
                y: p.y,
                parent: null, 
                depth: 1,
                visible: true, 
                kind: "base",
            });
            canonicalBasePos.set(id, { x: p.x, y: p.y });
        }

        for (const t of markovTransitions) {
            const id = `base:${t.from}->${t.to}`;
            hg.edges.set(id, {
                id, 
                from: t.from, 
                to: t.to,
                label: t.probability.toFixed(2),
                visible: true, 
                kind: "base", 
                parent: null,
            });
        }
    }

    function computeFocusClickSets(id: string | null) {
        focusClickedNodeId = id;
        focusClickNodeIds  = new Set<string>();
        focusClickEdgeIds  = new Set<string>();
        if (!id) return;
        focusClickNodeIds.add(id);
        for (const e of hg.edges.values()) {
            if (!e.visible) continue;
            if (e.from === id || e.to === id) {
                focusClickEdgeIds.add(e.id);
                focusClickNodeIds.add(e.from);
                focusClickNodeIds.add(e.to);
            }
        }
    }
    function makeContext(): MCRenderContext {
        return {
            g,
            hg,
            nodeRadius,
            loopRadius: 27,
            labelOffset: LABEL_OFFSET,
            acceptingStates: endState,
            startingStates: mStartingStates,
            arrowheadBlack: "url(#arrowhead-black)",
            arrowheadPink: "url(#arrowhead-pink)",
            showDirectionalColours,
            weightedThickness,
            showEdgeLabels,
            focusClickedNodeId,
            focusClickEdgeIds,
            filterActiveEdges,
            isInView,
            handleNodeClick,
            dragBehaviour,
            nodeColour,
            focusClickNodeIds,
            filterActiveNodes
        };
    }
    function handleNodeClick(id: string) {
        if (focusClickedNodeId === id) {
            computeFocusClickSets(null);
        } else {
            computeFocusClickSets(id);
            logEvent('node_click', { page, nodeId: id, toggled_off: focusClickedNodeId === id });
        }
        drawNodes(makeContext());
        drawEdges(makeContext());
    }

    function rerenderGraph() {
        g.attr("transform", currentZoomTransform.toString());
        drawHalos(g, hg, nodeRadius, subgraphRects, subgraphs, haloColour);
        drawInterSgArrows(g, hg, markovTransitions, "url(#arrowhead-sg)");
        drawEdges(makeContext());
        drawNodes(makeContext());
        if (inputSequence && inputSequence.trim()) drawPathHighlightLocal();
    }
    
    function isInView(node: HStateNode) {
        const x = node.x * currentZoomTransform.k + currentZoomTransform.x;
        const y = node.y * currentZoomTransform.k + currentZoomTransform.y;
        return (x >= 0 && x <= graphWidth && y >= 0 && y <= graphHeight);
    }
   
    function runHGraph() {
        const dimensions = measureHeight(wrapperElement,  svgElement);
        graphWidth = dimensions.graphWidth;
        graphHeight = dimensions.graphHeight;
        buildBaseHGraph();
        computeFocusClickSets(null);
        lastZoomK = 1;
        lastSemanticZoomK = 1;
        rerenderGraph();
    }   

    onMount(() => {
        const svg = d3.select(svgElement);
        drawArrowheads(svg);
        g = addMCContentGroup(svg);       
        dragBehaviour = createDragHandler(() => { drawEdges(makeContext()); drawHalos(g, hg, nodeRadius, subgraphRects, subgraphs, haloColour); drawInterSgArrows(g, hg, markovTransitions,"url(#arrowhead-sg)");  });
        
        zoomBehaviour = d3.zoom<SVGSVGElement, unknown>()
            .filter(event => !event.type.startsWith("dblclick") && (event instanceof WheelEvent || event.button === 0))
            .on('zoom', (event) => {
                currentZoomTransform = event.transform;
                g.attr('transform', event.transform.toString());
                drawEdges(makeContext());
                if (event.sourceEvent instanceof WheelEvent ){ 
                    lastZoomK = event.transform.k;
                    if (Math.abs(lastZoomK - lastSemanticZoomK) > 0.05){
                        lastSemanticZoomK = lastZoomK;
                        requestAnimationFrame(semanticTickGuard); 
                    }
                }
            });

        svg.call(zoomBehaviour).on("dblclick.zoom", null);
        svg.on("dblclick", event => event.preventDeafult());
        ({ zoomIn, zoomOut, zoomReset } = makeZoomControls(svgElement, zoomBehaviour));
        mounted = true;

        const onResize = () => runHGraph();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize",onResize);
        
    });


    $: if (mounted && (renderKey !== lastRenderKey)) {
        lastRenderKey = renderKey;
        runHGraph();
    }
    $: if(mounted && isFullScreen !== undefined){
        requestAnimationFrame(() => {const dimensions = measureHeight(wrapperElement, svgElement); 
            graphHeight = dimensions.graphHeight;
            graphWidth = dimensions.graphWidth;
            buildBaseHGraph(); 
            rerenderGraph(); });
    } 

    $: if (mounted && filterPairs !== undefined){
        rerenderGraph();
    }
    $: if (mounted){
        showDirectionalColours;
        showEdgeLabels;
        weightedThickness;
        drawEdges(makeContext());
    }
    $: if (mounted) {
        if (!inputSequence || inputSequence.trim() === "") {
            fadeOutPathHighlight(g.select("g.path-highlight"), 600);
        } else {
            drawPathHighlightLocal();
        }
    }

    function drawPathHighlightLocal(){
        if (!g) return;
        const {steps, highlightedNodeIds } = computeWalkedPath(inputSequence ?? "");
        drawPathHighlight(g.select("g.path-highlight"), steps, highlightedNodeIds, hg);
    }

    function computeWalkedPath(sequence: string){
        const isHierarchical = Object.keys(subgraphs).length > 0
        if (!isHierarchical){
            const flatTransitions = markovTransitions.map(t => ({...t, label: t.to}));
            return computeWalkedPathFlat(sequence, flatTransitions, mStartingStates, markovStates, hg, (t, token) => t.label === token, (sequnce) => sequence.split(" ").filter(Boolean));
        }
        return computeWalkedPathHierarchical(sequence);
    }

    function computeWalkedPathHierarchical(sequnce: string){
        const steps: PathWalked[] = [];
        const highlightedNodesIds = new Set<string>();
        
        const subgraphId = hg.activeSubgraphs.size > 0 ? Array.from(hg.activeSubgraphs)[0] : Object.keys(subgraphs)[0];

        const sg = subgraphs[subgraphId];
        if (!sg) return {steps, highlightedNodesIds};
        const expanded = hg.activeSubgraphs.has(subgraphId);
        if (!expanded){
            const anchor = hg.nodes.get(subgraphId);
            if (anchor?.visible) highlightedNodesIds.add(subgraphId);
            return {subgraphId, highlightedNodesIds};
        } 
        const {steps: innerSteps} = computeWalkedPathFlat(sequnce, sg.transitions, sg.startingStates, sg.states, hg, (t, token) => t.label === token, (sequnce) => sequnce.split(" ").filter(Boolean));

        for (const s of innerSteps){
            const fromid = `${subgraphId}.${s.from}`;
            const toid = `${subgraphId}.${s.to}`;
            steps.push({from: fromid, to: toid, path: buildFallbackPath(hg, fromid, toid)});
            highlightedNodesIds.add(toid);
        }
        return {steps, highlightedNodesIds: highlightedNodesIds};

    }
</script>

<div class="graphWrapper" bind:this={wrapperElement}>
    <svg bind:this={svgElement}></svg>

    <div class="zoomControls">
        <button type="button" class="zoomButton" title="{isFullScreen ? 'Exit fullscreen' : 'Expand'}" on:click={() => dispatch('toggleFullscreen')}>{isFullScreen ? '✕' : '⤢'}</button>

        <button type="button" class="zoomButton" on:click={zoomIn}>+</button>
        <button type="button" class="zoomButton" on:click={zoomOut}>−</button>
        <button type="button" class="zoomButton" on:click={zoomReset}>⟳</button>
    </div>
    <!-- <div class="zoomHint">
        {#if hg.activeSubgraphs.size > 0}
            Word chains visible - zoom out to collapse
        {:else}
            Zoom in to explore word-level chains
        {/if}
    </div> -->
</div>
<div style="display: flex; flex-direction: column;"class="benchControls">
    <select bind:value={benchN}>
                <option value={10}>10</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={800}>800</option>
                <option value={900}>900</option>
                <option value={1000}>1000</option>
                <option value={1200}>1200</option>
                <option value={1400}>1400</option>
                <option value={1600}>1600</option>
                <option value={1800}>1800</option>
                <option value={2000}>2000</option>
                <option value={2250}>2250</option>
                <option value={2500}>2500</option>
                <option value={3000}>3000</option>
                <option value={3500}>3500</option>
                <option value={4000}>4000</option>
                <option value={4500}>4500</option>
                <option value={5000}>5000</option>
                <option value={5500}>5500</option>
                <option value={6000}>6000</option>
                <option value={6500}>6500</option>
                <option value={7000}>7000</option>
                <option value={7500}>7500</option>
                <option value={8000}>8000</option>
                <option value={8500}>8500</option>
                <option value={9000}>9000</option>
                <option value={9500}>9500</option>
                <option value={10000}>10000</option>
                <option value={10500}>10500</option>
                <option value={11000}>11000</option>
                <option value={11500}>11500</option>
    </select>

    <input type="number" min="1" bind:value={benchSeed} style="width:60px" />
    <input type="number" min="1" max="20" bind:value={trials} style="width:50px" />
<button on:click={runFullSuite}>
    Run full suite + download all n
</button>
    <button on:click={() => loadSyntheticDS(benchN, benchSeed)}>
        Load graph
    </button>

    <button on:click={async () => { await runBenchmarkMedian(benchN, trials); console.log(benchRows); }}>
        Benchmark (median)
    </button>

    <button on:click={() => downloadBenchRowsAsCsv(`MC_bench_n${benchN}.csv`)}>
        Download CSV
    </button>

    {#if statusText}
        <span style="font-size:13px; color:#555; font-style:italic;">{statusText}</span>
    {/if}
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
</style>