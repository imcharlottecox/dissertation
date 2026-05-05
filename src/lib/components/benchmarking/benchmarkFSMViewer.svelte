<script lang="ts">
    import { onMount, createEventDispatcher } from "svelte";
    import * as d3 from "d3";
    
    import type { fTransition, Subgraph, Warp, HGraph, HStateNode, HEdge } from "$lib/graph/graphTypes";
    import type {Rect}  from "$lib/components/sharedGraph/rectangleUtilityHelpers"; 

    import { getGraphDefaultsFSM } from "$lib/graph/graphDefaults";
    import { computeLevelsMap, computeNodePositions, computeNodePositionsWithBackbone, resetBaseNodesToCanon } from "$lib/components/FSM/fsmLayoutPositions";
    import { addContentGroup } from "$lib/components/FSM/fsmSVGSetup";
    import { drawNodes, drawEdges, type FSMRenderContext } from "$lib/components/FSM/fsmRendering";
    import { createDragHandler } from "$lib/graph/graphBehaviours";
    import {runCollisionAvoidance} from "$lib/components/sharedGraph/subgraphLayoutCA";
    import { makeZoomControls, measureHeight } from "../sharedGraph/screenControls";
    import { drawPathHighlight, fadeOutPathHighlight, computeWalkedPathFlat, type PathWalked } from "../sharedGraph/pathwalk";
    import { collapseSubgraph, subgraphShouldExpand, getSgDescendants, placeSubgraphRect, addSubEdges, addSubNodes, addWarpEdges, hideAnchorAndEdges } from "../sharedGraph/subgraphExpansion";
    import {drawArrowheads, drawHalos} from "../sharedGraph/graphRendering";
    import { resetHGraph } from "../sharedGraph/lifecycle";
    import { benchRows, downloadBenchRowsAsCsv, measure, clearBenchRows } from "$lib/components/benchmarking/profiler";
    import { makeSyntheticFsmDS } from "$lib/components/benchmarking/makeSyntheticFsmDS";
    import { tick } from "svelte";
    import "$lib/styles/theme.css";

    const dispatch = createEventDispatcher();
    const { nodeRadius, padding } = getGraphDefaultsFSM();
    const LABEL_OFFSET = 6;
    const subgraphRects = new Map<string, Rect>(); // for each subgraph location
    const subgraphParent = new Map<string, string | null>(); //nested parent id, not parentState 
    
    export let fsmStates: string[] = [];
    export let fsmTransitions: fTransition[] = [];
    export let acceptingStates: string[] = [];
    export let startingStates: string[] = [];
    export let subgraphs: Record<string, Subgraph> = {}; //dataset definition opposed to runtime state of activeSubgraphs 
    export let warps: Warp[] = [];
    export let showDepthBox: boolean = true;
    export let renderKey: string = "";
    export let inputSequence: string ="";
    export let isFullScreen: boolean = false;
    export let LOOP_RADIUS: number = Math.max(nodeRadius + 12, 24);

    let depthText = "";
    let lastRenderKey = "";
    let lastViewportKey = "";
    let g: d3.Selection<SVGGElement, unknown, null, undefined>;
    let zoomIn = () => {};
    let zoomOut = () => {};
    let zoomReset = () => {};
    let graphWidth = 720;
    let graphHeight = 200;
    let wrapperElement: HTMLDivElement;
    let svgElement: SVGSVGElement;
    let canonicalBasePos = new Map<string, {x:number, y:number}>();
    let arrowheadBlack = "url(#arrowhead-black)";
    let mounted = false;
    let currentZoomTransform = d3.zoomIdentity;
    let evaluating = false;
    let lastZoomK = 1;
    let lastSemanticZoomK = 1;
    let dragBehaviour: d3.DragBehavior<SVGGElement, HStateNode, unknown>;
    let zoomBehaviour: d3.ZoomBehavior<SVGSVGElement, unknown>;
    let hiddenEdgesBySubgraph = new Map<string, string[]>(); //subgraphId -> edgeIds
    let hg: HGraph = {
        nodes: new Map<string, HStateNode>(),
        edges: new Map<string, HEdge>(),
        activeSubgraphs: new Set<string>()
    };
    let trials = 5;
    let benchMode = false;
    let benchN = 100;
    let benchSeed = 22;
    let statusText = "";
    function loadSyntheticDS(n: number, seed: number) {
        const data = makeSyntheticFsmDS({ n, seed, includeBackbone: true, noSelfLoops: true, noDupeEdges: true });
        fsmStates = data.fsmStates;
        fsmTransitions = data.fsmTransitions;
        acceptingStates = data.acceptingStates;
        startingStates = data.startingStates;
        renderKey = `bench:${n}:${seed}:${Date.now()}`;
    }
    function median(xs: number[]) {
        const sorted = [...xs].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }

    function runBenchmarkPass(n: number) {
        measure("fsm:buildBaseHGraph", n, () => buildBaseHGraph());
        measure("fsm:runCollisionAvoidance", n, () =>
            runCollisionAvoidance({
                graphWidth: svgElement.clientWidth,
                graphHeight: svgElement.clientHeight,
                hg, nodeRadius, subgraphRects, subgraphParent
            })
        );
        measure("fsm:drawNodes", n, () => drawNodes(makeContext(), dragBehaviour));
        measure("fsm:drawEdges", n, () => drawEdges(makeContext()));
        measure("fsm:totalRender", n, () => {
            buildBaseHGraph();
            runCollisionAvoidance({
                graphWidth: svgElement.clientWidth,
                graphHeight: svgElement.clientHeight,
                hg, nodeRadius, subgraphRects, subgraphParent
            });
            drawNodes(makeContext(), dragBehaviour);
            drawEdges(makeContext());
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
        statusText = `Done n=${n}...`;
    }

    async function runFullSuite() {
        clearBenchRows();
        for (const n of [10, 100, 500, 1000]) {
            const ds = makeSyntheticFsmDS({ n, seed: 22, noSelfLoops: true, noDupeEdges: true });
            fsmStates = ds.fsmStates;
            fsmTransitions = ds.fsmTransitions;
            acceptingStates = ds.acceptingStates;
            startingStates = ds.startingStates;
            renderKey = `bench-${n}`;
            await tick();
            await runBenchmarkMedian(n, trials);
        }
        downloadBenchRowsAsCsv("FSM_bench_new.csv");
    }
    

    function drawPathHighlightLocal(){
        if (!g) return;
        const {steps, highlightedNodeIds } = computeWalkedPathFlat(inputSequence, fsmTransitions, startingStates, fsmStates, hg);
        drawPathHighlight(g.select("g.path-highlight"), steps, highlightedNodeIds, hg);
    }
    function expandSubgraph(parentId: string){
        const sg = subgraphs[parentId];
        if (!sg || hg.activeSubgraphs.has(parentId)) return;

        const anchorNode = hg.nodes.get(parentId);
        if (!anchorNode?.visible) return;

        //compute how big the expanded sg layout needs to be
        const levels = computeLevelsMap(sg.transitions, sg.entry, sg.states);
        const maxLevel = Math.max(...levels.values());
        const depth = maxLevel + 1;
        const W = Math.max(180, depth * 140);
        const H = Math.max(140, depth * 60);
        const localPos = computeNodePositions(levels, W, H, 12); //TODO: with backbone?

        //nesting
        const containerId = sg.parentState ? (anchorNode.parent ?? null) : null;
        const containerRect = containerId ? (subgraphRects.get(containerId) ?? null) : null;
        if (sg.parentState && !containerRect) return; //parent must be expanded before 
        subgraphParent.set(parentId, containerId);

        const rect = placeSubgraphRect(parentId, anchorNode, W, H, containerId, containerRect, subgraphRects, subgraphParent);
        subgraphRects.set(parentId, rect);

        addSubNodes(hg, parentId, sg, rect, localPos, anchorNode);
        addSubEdges(hg, parentId, sg);
        addWarpEdges(hg, parentId, sg, warps, subgraphParent);

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
        return changed;
    }
    function semanticTickGuard() {
        if (evaluating) return;
        evaluating = true;
        const changed = updateExpansionsForZoom(lastZoomK);
        if (changed) {
            resetBaseNodesToCanon(hg, canonicalBasePos);
            // runRectPipeline({graphWidth, graphHeight, hg, nodeRadius, subgraphRects, subgraphParent});        
            runCollisionAvoidance({graphWidth: svgElement.clientWidth, graphHeight: 0.9*svgElement.clientHeight, hg, nodeRadius, subgraphRects, subgraphParent});
            rerunDepthBox();
            rerenderGraph();
        }
        evaluating = false;
    }
    function buildBaseHGraph() {
        resetHGraph(hg);

        graphWidth = svgElement.clientWidth;
        graphHeight = svgElement.clientHeight;

        //cap padding for ipad width
        const effectivePadding = renderKey.includes("5::7::S4:END::S0:START")
            ? Math.min(padding, Math.floor(graphWidth * 0.03))
            : padding;

        const start = startingStates?.[0] ?? fsmStates[0];

        const levels = computeLevelsMap(fsmTransitions, start, fsmStates);
        const nodePositions = computeNodePositionsWithBackbone(
            levels,
            graphWidth,
            graphHeight,
            effectivePadding,
            acceptingStates,
            fsmTransitions,
            start,
        );    

        for (const nodeId of fsmStates) {
            const p = nodePositions.get(nodeId);
            if (!p) continue;
            hg.nodes.set(nodeId, {
                id: nodeId,
                displayName: nodeId,
                x: p.x,
                y: p.y,
                parent: null,
                depth: 1,
                visible: true,
                kind: "base"
            });
        }  
        for (const t of fsmTransitions) {
            const id = `base:${t.from}-${t.to}-${t.label ?? "undefined"}`;
            hg.edges.set(id, {
                id,
                from: t.from,
                to: t.to,
                label: t.label,
                visible: true,
                kind: "base",
                parent: null
            });
        }

        snapshotBasePos();
        rerunDepthBox();
    }
    function runHGraph(){
        buildBaseHGraph();
        runCollisionAvoidance({graphWidth: svgElement.clientWidth, graphHeight: svgElement.clientHeight, hg, nodeRadius, subgraphRects, subgraphParent});
        rerunDepthBox();
        rerenderGraph();
    }
    function rerenderGraph() {
        g.attr("transform", currentZoomTransform.toString());
        const context = makeContext();
        
        drawHalos(g, hg, nodeRadius, subgraphRects, subgraphs);
        drawEdges(context);
        drawNodes(context, dragBehaviour);
        if(inputSequence&& inputSequence.trim()) drawPathHighlightLocal();

    }
    function snapshotBasePos(){
        canonicalBasePos.clear();
        for (const n of hg.nodes.values()){
            if (!n.parent){
                canonicalBasePos.set(n.id, {x:n.x, y:n.y});
            }
        }
    }
    function makeContext(): FSMRenderContext {
        return {
            g,
            hg,
            nodeRadius,
            loopRadius: LOOP_RADIUS,
            labelOffset: LABEL_OFFSET,
            acceptingStates,
            startingStates,
            arrowheadBlack,
        };
    }

    function rerunDepthBox(){
        if (!showDepthBox) return;
        let maxDepthExpanded = 0;

        if (hg.activeSubgraphs.size > 0){
            for (const id of hg.activeSubgraphs){
                const d = subgraphs[id]?.depthLevel ?? 1;
                if (d > maxDepthExpanded) maxDepthExpanded = d;
            }
        }
        depthText = `Subgraph Depth Expanded: ${maxDepthExpanded}`;
    }
    

    onMount(() => {
        //initial render and props sorted here
        const svg = d3.select(svgElement);
        drawArrowheads(svg);
        g = addContentGroup(svg);       
        measureHeight(wrapperElement, svgElement);
        dragBehaviour = createDragHandler(() => { drawEdges(makeContext()); drawHalos(g, hg, nodeRadius, subgraphRects, subgraphs); });
        
        zoomBehaviour = d3.zoom<SVGSVGElement, unknown>()
            .on('zoom', (event) => {
                currentZoomTransform = event.transform;
                g.attr('transform', event.transform.toString());
                lastZoomK = event.transform.k;
                if (event.sourceEvent instanceof WheelEvent ){ //TODO: MORE SOPHISTICATED DIFFERENTIATION BETWEEN WHEEL AND BUTTON EVENT FOR MOBILE PINCH AND ZOOM
                    if (Math.abs(lastZoomK - lastSemanticZoomK) > 0.05){
                        lastSemanticZoomK = lastZoomK;
                        requestAnimationFrame(semanticTickGuard); //for throttling
                    }
                }
            });
        svg.call(zoomBehaviour);
        ({ zoomIn, zoomOut, zoomReset } = makeZoomControls(svgElement, zoomBehaviour));

        mounted = true;
    });

    $: if (mounted && (renderKey !== lastRenderKey)) {
        lastRenderKey = renderKey;
        runHGraph();
    }
    $: if(mounted && isFullScreen !== undefined){
        requestAnimationFrame(() => {measureHeight(wrapperElement, svgElement); buildBaseHGraph(); rerenderGraph(); });
    } 
    $: showDepthBox = Object.keys(subgraphs ?? {}).length > 0;
    $: if (!showDepthBox) depthText = "";

    $: if (mounted) {
        if (!inputSequence || inputSequence.trim() === "") {
            fadeOutPathHighlight(g.select("g.path-highlight"), 600);
        } else {
            drawPathHighlightLocal();
        }
    }
</script> 

<div class="graphWrapper" bind:this={wrapperElement}>
    <svg bind:this={svgElement}></svg>

    <div class="zoomControls">
        <button type="button" class="zoomButton" title="{isFullScreen ? 'Exit fullscreen' : 'Expand'}" on:click={() => dispatch('toggleFullscreen')}>{isFullScreen ? '✕' : '⤢'}</button>
        <button type="button" class="zoomButton" on:click={zoomIn}>+</button>
        <button type="button" class="zoomButton" on:click={zoomOut}>-</button>
        <button type="button" class="zoomButton" on:click={zoomReset}>⟳</button>
    </div>
    {#if showDepthBox}
        <div class = "depthBox">{depthText}</div>
    {/if}
        <div>
        <button on:click={() => { clearBenchRows(); runBenchmarkPass(fsmStates.length); console.log(benchRows); }}>
            Run Benchmark
        </button>
        <button on:click={() => downloadBenchRowsAsCsv(`FSM_bench_${fsmStates.length}.csv`)}>
            Download Benchmark CSV
        </button>

        <div class="benchControls">
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

            <input type="number" min="1" bind:value={benchSeed} style="width:70px" />
            <input type="number" min="1" max="20" bind:value={trials} style="width:60px" />

            <button on:click={() => loadSyntheticDS(benchN, benchSeed)}>
                Load 5% graph
            </button>

            <button on:click={runFullSuite}>
                Run full suite (all n) + download
            </button>
            <button on:click={async () => { await runBenchmarkMedian(benchN, trials); console.log(benchRows); }}>
                Benchmark (median)
            </button>

            <button on:click={() => downloadBenchRowsAsCsv(`FSM_bench_3linearpercent_n${benchN}.csv`)}>
                Download CSV
            </button>
            {#if statusText}
                <span style="font-size:13px; color:#555; font-style:italic;">{statusText}</span>
            {/if}
            </div>

    </div>


</div>

<style>
    svg {
        background: snow;
        border: 1px solid #ccc;
        display: block;
    }

    .graphWrapper{
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 0;
    }

    .depthBox{
        position: absolute;
        top: 10px;
        left: 10px;
        padding: 4px 8px;
        border: 1px solid #ccc;
        background: rgba(255,255,255,0.85);
        border-radius: 8px;
        font-size: 14px;
        color: #333;
        user-select: none;
        pointer-events: none;
    }
</style>