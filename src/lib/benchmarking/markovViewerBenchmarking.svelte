<script lang="ts">
    import { onMount } from "svelte";
    import * as d3 from "d3";
    import type { StateNode, mTransition } from '$lib/graph/graphTypes';
    import { getGraphDefaultsMarkov } from '$lib/graph/graphDefaults';
    import { createDragHandler, createZoom, computeEdgePoints, computeCurvedPath, computeSelfLoopPath } from '$lib/graph/graphBehaviours';
    import { tick } from "svelte";
    import { makeSyntheticMCDS } from "$lib/benchmarking/makeSyntheticMCDS";
    import { benchRows, downloadBenchRowsAsCsv, measure, clearBenchRows } from "$lib/benchmarking/profiler";

    export let markovStates: string[] = [];
    export let markovTransitions: mTransition[] = [];
    export let mStartingStates: string[] = [];
    export let endState: string[] = [];
    export let filterPairs: [string,string][] = [];
    export let showDirectionalColours: boolean = false;
    export let showEdgeLabels: boolean = true;
    export let weightedThickness: boolean = true;

    let { graphHeight, padding } = getGraphDefaultsMarkov();
    let graphWidth = 800;
    let svgElement: SVGSVGElement;
    type EdgeDatum = {
        source: StateNode;
        target: StateNode;
        probability: number;
        curvature?: number;
    };
    let graphNodes: StateNode[] = [];
    let visibleEdges: EdgeDatum[] = [];
    let visibleEdgesCopy: EdgeDatum[] = []; //mutable
    let g: d3.Selection<SVGGElement, unknown, null, undefined>;
    let nodeLayer: any;
    let edgeLayer: any;
    let edgeLabelLayer: any;
    let activeNodeIds = new Set<string>();
    let wrapperElement: HTMLDivElement;

    let benchN = 100;
    let benchSeed = 22;
    let trials = 5;
    let benchMode = false;
    type BenchReport = (name: string, ms: number) => void;

    let levels: Map<string, number>;
    let maxLevel = 0;
    let nodeRadius = 15;
    let currentTransform = d3.zoomIdentity;
    let ready = false;
    // let pDisplayText: d3.Selection<SVGTextElement, unknown, null, undefined>;


    function loadSyntheticDS(n: number, seed: number){
        const data = makeSyntheticMCDS({n, seed});
        markovStates = data.markovStates;
        markovTransitions = data.markovTransitions;
        endState = data.acceptingStates;
        mStartingStates = data.startingStates;

        calculatePositionLayout();
        drawNodes();
        drawEdges();
        // renderKey = `bench:${n}:${seed}:${Date.now()}`;
    }
    function median(xs: number[]){
        const sorted = [...xs].sort((a,b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0){
            return (sorted[mid -1] + sorted [mid]) / 2;
        } else {
            return sorted[mid];
        }
    }
    async function runBenchmarkMedian(n: number, trials: number){
        // if (!mounted) return;
        benchMode = true;
        await tick();
        clearBenchRows();
        runBenchmark(n);

        const timeScore = new Map<string, number[]>();

        for (let i = 0; i < trials; i++){
            clearBenchRows();
            runBenchmark(n);

            for (const row of benchRows){
                if (!timeScore.has(row.name)){
                    timeScore.set(row.name, []);
                }
                timeScore.get(row.name)?.push(row.ms);
            }
        }

        clearBenchRows();
        for (const [name, times] of timeScore.entries()){
            const med = median(times);
            benchRows.push({ name, n, ms: med });
        }

        benchMode = false;
    }

    const benchmarkReport: BenchReport = (name, ms) => {
        if (!benchMode) return;
        const n = markovStates.length;
        benchRows.push({ name: `mc:${name}`, n, ms });
    }
    function rerenderMarkovGraph(){
        if (!ready || !g) return;

        drawNodes();
        drawEdges();
    }

    function runBenchmark(n: number){
        measure("mc:calculatePositionLayout",n, () => calculatePositionLayout());
        measure("mc:drawNodes", n, () => drawNodes());
        measure("mc:drawEdges", n, () => drawEdges());
        // measure("mc:totalRender", n, () => rerenderMarkovGraph());
    }

    function isInView(node: StateNode, transform: d3.ZoomTransform) {
        const x = node.x * transform.k + transform.x;
        const y = node.y * transform.k + transform.y;
        return (x >= 0 && x <= graphWidth && y >= 0 && y <= graphHeight);
    }
    
    function calculatePositionLayout() {
        let t = performance.now();
        
        const innerW = graphWidth - 2*padding;
        const innerH = graphHeight - 2*padding;
        const centrex = padding + innerW / 2;
        const centrey = padding + innerH / 2;

        const adjacency = new Map<string, string[]>();
    
        markovTransitions.forEach(t => {
            if (!adjacency.has(t.from)) adjacency.set(t.from, []);
            adjacency.get(t.from)!.push(t.to);
        });
        benchmarkReport("layout:adjacency", performance.now() - t);
        t = performance.now();
        //
        // Step 1: identify BFS levels for each node from start, if there is a starting state.
        //
        levels = new Map<string,number>();
        const hasStartingState = mStartingStates.length > 0;

        if (hasStartingState) {
            const queue: string[] = [];
            for (const s of mStartingStates) {
                levels.set(s, 0);
                queue.push(s);
            }

            while (queue.length > 0) {
                const current = queue.shift()!;
                for (const next of adjacency.get(current) ?? []) {
                    if (!levels.has(next)) {
                        levels.set(next, (levels.get(current) ?? 0) + 1);
                        queue.push(next);
                    }
                }
            }

        benchmarkReport("layout:bfs_levels", performance.now() - t);
        t = performance.now();
            //start of special edits for python assignments
            maxLevel = Math.max(...levels.values());
            if (levels.get("=") === 3 || levels.get(" ") === 3) {
                levels.set("=", 1.5);
                levels.set(" ", 1.5);
            }
            
            const letters = "abcdefghijklmnopqrstuvwxyz".split("");
            const row1 = letters.slice(0, 14);
            const row2 = letters.slice(14);

            for (const id of row1) {
                if (levels.get(id) === 1) levels.set(id, 0.8);
            }
            for (const id of row2) {
                if (levels.get(id) === 1) levels.set(id, 1.1);
            }
            if (levels.get("_") === 1) levels.set("_", 1.1);
            //end of edits for python assignments
            benchmarkReport("layout:specific_node_layout", performance.now() - t);
            t = performance.now();    
            //
            // Step 2: spread out nodes horizonatally within their vertical spacing BFS levels
            //
            const groupedByLevel = new Map<number, string[]>();
            markovStates.forEach(s => {
                const lvl = levels.get(s) ?? maxLevel;
                if (!groupedByLevel.has(lvl)) groupedByLevel.set(lvl, []);
                groupedByLevel.get(lvl)!.push(s);
            });
            benchmarkReport("layout:levels_grouping", performance.now() - t);
            t = performance.now();
            graphNodes = markovStates.map(s => {
                const level = levels.get(s) ?? maxLevel;
                const siblings = groupedByLevel.get(level) ?? [];
                const idx = siblings.indexOf(s);

                // const y = padding + (level / (maxLevel + 0.5)) * innerH;
                const levelGap = innerH / (maxLevel + 1);
                const y = padding + level * levelGap;
                const xSpacing = innerW / (siblings.length + 1);
                const x = padding + xSpacing * (idx + 1);

                return { id: s, x, y };
            });

            benchmarkReport("layout:node_positioning", performance.now() - t);
            t = performance.now();
            //
            // Step 3: pin start and end nodes to top and bottom for easier readability
            //
            graphNodes.forEach((n) => {
                if (mStartingStates.includes(n.id)) {
                    n.x = graphWidth / 2;
                    n.y = nodeRadius * 2;
                } else if (endState.includes(n.id)) {
                    n.x = graphWidth / 2;
                    n.y = graphHeight - nodeRadius * 2;
                } 
            });
            benchmarkReport("layout:pin_start_end_nodes", performance.now() - t);
            t = performance.now();
        } else {
            // if no starting state, spread nodes in a polygon or circle
            const angleStep = (2 * Math.PI) / markovStates.length;
            graphNodes = markovStates.map((s, i) => {
                const angle = i * angleStep;
                const x = centrex + (innerW / 2 - nodeRadius - 10) * Math.cos(angle);
                const y = centrey + (innerH / 2 - nodeRadius - 10) * Math.sin(angle);
                return { id: s, x, y };
            });
            maxLevel = 0;
        }
        t = performance.now();
        // const used = new Set<string>();
        // meant to stop overlapping nodes, but maybe not neded anymore 
        // graphNodes.forEach(n => {
        //     let key = `${Math.round(n.x)}|${Math.round(n.y)}`;
        //     while (used.has(key)) {
        //         n.x += 15;
        //         n.y += 15;
        //         key = `${Math.round(n.x)}|${Math.round(n.y)}`;
        //     }
        //     used.add(key);
        // });

        // Step 4: build the edges 
        const nodeMap = new Map(graphNodes.map(n => [n.id, n]));
        benchmarkReport("layout:build_node_map", performance.now() - t);
        t = performance.now();
        visibleEdges = markovTransitions
            .filter(t => (t.probability ?? 0) > 0)
            .map(t => {
                const source = nodeMap.get(t.from);
                const target = nodeMap.get(t.to);
                if (!source || !target) return null;
                return {
                    source,
                    target,
                    probability: t.probability,
                    curvature: 0
                } as EdgeDatum;
            })
            .filter((e): e is EdgeDatum => !!e);
        benchmarkReport("layout:build_edges", performance.now() - t);
        t = performance.now();
        // stores a copy for restoring after if filtering
        visibleEdgesCopy = visibleEdges.slice();
        benchmarkReport("layout:copy_edges", performance.now() - t);
        t = performance.now();
        //for sequence highlighting
        if (filterPairs && filterPairs.length > 0) {
            const pairSet = new Set(filterPairs.map(([a,b]) => `${a}|${b}`));
            visibleEdges = visibleEdges.filter(e => pairSet.has(`${e.source.id}|${e.target.id}`) );
        }
        // Step 5: add curvature for bidirectional edges and loops to self
        const edgePair = new Map<string, EdgeDatum>();
        visibleEdges.forEach(e => {
            const forward = `${e.source.id}|${e.target.id}`;
            const backward = `${e.target.id}|${e.source.id}`;

            // store the edge itself
            edgePair.set(forward, e);

            if (edgePair.has(backward)) {
                edgePair.get(forward)!.curvature = +1;
                edgePair.get(backward)!.curvature = +1;
            }
        });
  
        edgePair.forEach((edge) => {
            if (edge) edge.curvature = (edge.curvature ?? 0) * 2;
        });
        benchmarkReport("layout:edge_curvature_pairs", performance.now() - t);
        t = performance.now();
    }

    function drawNodes() {
        const dragHandler = createDragHandler(() => drawEdges());

        nodeLayer = g.select(".nodes")
            .selectAll<SVGGElement, StateNode>("g.node")
            .data(graphNodes, (n: any) => n.id)
            .join(enter => {
                const n = enter.append("g")
                    .attr("class", "node")
                    .attr("transform", d => `translate(${d.x},${d.y})`)
                    .call(dragHandler as any);

                n.append("circle")
                    .attr("r", nodeRadius)
                    .attr("stroke", "black")
                    .attr("stroke-width", d => (endState.includes(d.id) ? 3 : 0.5))
                    .attr("fill", d => endState.includes(d.id) ? "lightgreen" : mStartingStates.includes(d.id) ? "lightgrey" :"lightblue")

                n.append("text")
                    .attr("text-anchor", "middle")
                    .attr("dy", 4)
                    .attr("font-size", 9)
                    .text((d: StateNode) => d.id);

                return n;
            });

        nodeLayer.attr("transform", (d:StateNode) => `translate(${d.x},${d.y})`);
        nodeLayer
    .select("circle")
    .attr("opacity", d => {
        if (activeNodeIds.size === 0) return 1;
        return activeNodeIds.has(d.id) ? 1 : 0.2;
    });
    }

    function drawEdges() {
        let t = performance.now();
        const zoomedEdges = visibleEdgesCopy.filter(e =>
            isInView(e.source, currentTransform) &&
            isInView(e.target, currentTransform)
        );

        benchmarkReport("edgeRender:zoomed_edges", performance.now() - t);
        t = performance.now();
        edgeLayer = g.select(".edges")
            .selectAll<SVGPathElement, EdgeDatum>("path.edge")
            // .data(visibleEdges)
            // .join("path")
            // .data(visibleEdges, d => `${d.source.id}->${d.target.id}`)
            .data(zoomedEdges, d => `${d.source.id}->${d.target.id}`)
            .join(
                enter => enter.append("path").attr("class", "edge"),
                update => update,
                exit => exit.remove()
            )
        benchmarkReport("edgeRender:join", performance.now() - t);
        t = performance.now();
        edgeLayer.attr("class", "edge")
            .attr("fill", "none")
			.attr('stroke', d => {
                if (!showDirectionalColours) return 'black';
                return (d.target.y >= d.source.y ? 'black' : 'lightpink');
            })
            .attr("stroke-width", d => {
                if (!weightedThickness) return 1;
                return 2* Math.sqrt(d.probability);
                })
            // .attr("stroke-width", d => d.probability *2)
            // .attr("opacity", d => (d.probability > 0.049 || d.source.id === "START") ? 1 : 0.05)
            // .attr("opacity", d => d.probability < 0.5 ? 0.1 : 1)
            .attr('marker-end', d => {
                   if (!showDirectionalColours) return 'url(#arrow-black)';
                   return d.target.y >= d.source.y ? 'url(#arrow-black)' : 'url(#arrow-pink)';
                })
            .attr("d", d => {
                const curved = (d as any).curvature;
                if (d.source === d.target) {
                    return computeSelfLoopPath(d.source, nodeRadius);
                }

                if (curved === 0) {
                    const { x1, y1, x2, y2 } = computeEdgePoints(d.source, d.target, nodeRadius);
                    if (Math.hypot(x2 - x1, y2 - y1) < 0.0001) {
                        return `M ${x1},${y1} L ${x1 + 0.1},${y1 + 0.1}`;
                    }
                    return `M ${x1},${y1} L ${x2},${y2}`;
                }
                return computeCurvedPath(d.source, d.target, nodeRadius, curved);

                }
            )
            // .attr("opacity", d => {
            //     if (activeNodeIds.size === 0) return 1;
            //     return activeNodeIds.has(d.source.id && d.target.id) ? 1 : 0.05;
            // });
        //hover probability tooltip
        benchmarkReport("edgeRender:edges_attrs", performance.now() - t);
        t = performance.now();
        edgeLayer.select("title").remove(); // avoid duplicates
        edgeLayer.append("title").text(
            (d: { source: StateNode; target: StateNode; probability: number }) => `${d.source.id} -> ${d.target.id}\nP = ${d.probability}`);
        benchmarkReport("edgeRender:edges_titles", performance.now() - t);
                
        
        function labelBumpCurved(d: EdgeDatum) {
            if (d.source.id === d.target.id) {
                return -3.5;
            }
            // else return (d.source.id < d.target.id) ? -1: 2;
            else if (d.source.id < d.target.id && d.source.x < d.target.x) return 2;
            else if (d.source.id > d.target.id && d.source.x < d.target.x) return 2;
            else if (d.source.id < d.target.id && d.source.x > d.target.x) return -1;
            else if (d.source.id > d.target.id && d.source.x > d.target.x) return -1;
        }

        // edgeLabelLayer = g.select(".edge-labels")
        //     .selectAll<SVGTextElement, EdgeDatum>("text.edge-label")
        //     .data(showEdgeLabels ? zoomedEdges : [],  d => `${d.source.id}->${d.target.id}`)
        //     .join(
        //         enter => enter.append("text").attr("class", "edge-label"),
        //         update => update,
        //         exit => exit.remove()
        //     )
        //     .attr("font-size", 9)
        //     .attr("text-anchor", "middle")
        //     .attr("dy", d => -4 + ((d.curvature ?? 0) === 0 ? 0 : 12 * labelBumpCurved(d)))
        //     .attr("x", d => (d.source.x + d.target.x) / 2)
        //     .attr("y", d => (d.source.y + d.target.y) / 2)
        //     .text(d => d.probability.toFixed(2))
    }

    // function updateEdgeVisibility() {
    //     if (activeNodeIds.size !== 0) return;
    //     const DETAIL_ZOOM = 1.5;
    //     const DETAIL_ZOOM2 = 2.4;
    //     const DETAIL_ZOOM3 = 2.8;

    //     const k = currentTransform.k;
    //     const edges = g.selectAll<SVGPathElement, EdgeDatum>(".edge");

    //     let threshold = 0; 

    //     if (k < DETAIL_ZOOM) {
    //         threshold = 0.4;
    //         edges.attr("opacity", d =>
    //             (d.probability > threshold || d.source.id === "START") ? 1 : 0.05
    //         );
    //     }
    //     else if (k < DETAIL_ZOOM2) {
    //         threshold = 0.2;
    //         edges.attr("opacity", d =>
    //             (d.probability > threshold || d.source.id === "START") ? 1 : 0.05
    //         );
    //     }
    //     else if (k < DETAIL_ZOOM3) {
    //         threshold = 0.1;
    //         edges.attr("opacity", d =>
    //             (d.probability > threshold || d.source.id === "START") ? 1 : 0.1
    //         );
    //     }
    //     else {
    //         threshold = 0.0;
    //         edges.attr("opacity", d => {
    //             const inView =
    //                 isInView(d.source, currentTransform) &&
    //                 isInView(d.target, currentTransform);
    //             return inView ? 1 : 0.05;
    //         });
    //     }

    //     if (pDisplayText) {
    //         pDisplayText.text(`Showing edges with probability p > ${threshold}`);
    //     }
    // }

    function measureHeight() {
        const r = wrapperElement.getBoundingClientRect();
        graphWidth = Math.max(1, Math.floor(r.width));
        graphHeight = Math.max(1, Math.floor(r.height));

        d3.select(svgElement).attr("width", graphWidth).attr("height", graphHeight);

    }

    onMount(() => {
        graphWidth = svgElement.clientWidth;
        measureHeight();
        calculatePositionLayout();


        const svg = d3.select(svgElement);
        // const pDisplay = svg.append("g")
        //     .attr("class", "pDisplay");

        // pDisplay.append("rect")
        //     .attr("x", 10)
        //     .attr("y", 10)
        //     .attr("width", 190)
        //     .attr("height", 20)
        //     .attr("rx", 6)
        //     .attr("ry", 6)
        //     .attr("fill", "white")
        //     .attr("stroke", "#aaa")
        //     .attr("opacity", 0.8);

        //     pDisplayText = pDisplay.append("text")
        //     .attr("x", 20)
        //     .attr("y", 24)
        //     .attr("font-size", 10)
        //     .attr("fill", "#333")
        //     .text("Showing edges with probability p > 0");
        g = svg.append("g").attr("class", "content-group");
        g.append("g").attr("class", "edges");
        g.append("g").attr("class", "edge-labels");
        g.append("g").attr("class", "nodes");
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .on("zoom", (event) => {
                currentTransform = event.transform;
                g.attr("transform", currentTransform);
                drawEdges();
            });
        svg.call(zoom);
        svg.call(zoom);


        // arrowhead
       svg.append("svg:defs")
        const defs = svg.append("defs");
        [
            { id: "arrow-black", color: "black" },
            { id: "arrow-pink", color: "lightpink" }
        ].forEach(({ id, color }) => {
            defs.append("marker")
                .attr("id", id)
                .attr("viewBox", [0, 0, 10, 10])
                .attr("refX", 7)
                .attr("refY", 5)
                .attr("markerUnits", "strokeWidth")
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("orient", "auto")
                .append("path")
                .attr("d", "M 0 0 L 10 5 L 0 10 z")
                .attr("fill", color);
        });
        drawNodes();
        drawEdges();
        ready = true;

        const handleResize = () => {
            graphWidth = svgElement.clientWidth;
        };
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    });

$: if (ready && filterPairs) {

    if (filterPairs.length === 0) {
        // restore full list including curvature
        visibleEdgesCopy = visibleEdges.slice();
        activeNodeIds = new Set();
        } else {
            const pairSet = new Set(filterPairs.map(([a,b]) => `${a}|${b}`));
            visibleEdgesCopy = visibleEdges.filter(e =>
                pairSet.has(`${e.source.id}|${e.target.id}`)
            );
            activeNodeIds = new Set<string>();
            visibleEdgesCopy.forEach(e => {
                activeNodeIds.add(e.source.id);
                activeNodeIds.add(e.target.id);
            });
        }
        
    drawNodes();
    drawEdges();
    // updateEdgeVisibility();
}

$: if (ready){
    showDirectionalColours;
    showEdgeLabels;
    weightedThickness;
    drawEdges();    
}

</script>

<!-- <svg bind:this={svgElement} width="100%" height="600"></svg> -->
<div class="graphWrapper" bind:this={wrapperElement}>
    <svg bind:this={svgElement}></svg>
</div>
<div class="benchControls">
            <select bind:value={benchN}>
                <option value={10}>10</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={750}>750</option>
                <option value={850}>850</option>
                <option value={900}>900</option>
                <option value={1000}>1000</option>
            </select>

            <input type="number" min="1" bind:value={benchSeed} style="width:70px" />
            <input type="number" min="1" max="20" bind:value={trials} style="width:60px" />

            <button on:click={() => loadSyntheticDS(benchN, benchSeed)}>
                Load 20% graph
            </button>

            <button on:click={async () => { await runBenchmarkMedian(benchN, trials); console.log(benchRows); }}>
                Benchmark (median)
            </button>

            <button on:click={() => downloadBenchRowsAsCsv(`MC_bench_20pct_n${benchN}.csv`)}>
                Download CSV
            </button>
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

</style>
