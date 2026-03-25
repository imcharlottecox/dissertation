<script lang="ts">
    import { onMount, createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import * as d3 from "d3";
    import type { StateNode, mTransition } from '$lib/graph/graphTypes';
    import { getGraphDefaultsMarkov } from '$lib/graph/graphDefaults';
    import { createDragNoSim, createZoom, computeEdgePoints, computeCurvedPath, computeSelfLoopPath } from '$lib/graph/graphBehaviours';
    import {NODE_COLOURS, NODE_STROKES} from '$lib/graph/nodeColours';

    export let markovStates: string[] = [];
    export let markovTransitions: mTransition[] = [];
    export let mStartingStates: string[] = [];
    export let endState: string[] = [];
    export let filterPairs: [string,string][] = [];
    export let showDirectionalColours: boolean = false;
    export let showEdgeLabels: boolean = true;
    export let weightedThickness: boolean = true;
    export let renderKey: string = "";
    export let isFullScreen: boolean = false;

    let zoomBehaviour: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;

    let focusClckdNodeId: string | null = null;
    let focusClckNodeIds = new Set<string>();
    let focusClckEdgeIds = new Set<string>();
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

    let levels: Map<string, number>;
    let maxLevel = 0;
    let nodeRadius = 15;
    let currentTransform = d3.zoomIdentity;
    let ready = false;
    // let pDisplayText: d3.Selection<SVGTextElement, unknown, null, undefined>;
    let pStrokeThreshold = 0.05; //sldier start
    const minstrokewidth = 0.01;

    function edgeStrokeWidth(p: number){
        if (!weightedThickness) return 1;
        if (p < pStrokeThreshold) return minstrokewidth;
        return 2*Math.sqrt(p);
    }
    function isInView(node: StateNode, transform: d3.ZoomTransform) {
        const x = node.x * transform.k + transform.x;
        const y = node.y * transform.k + transform.y;
        return (x >= 0 && x <= graphWidth && y >= 0 && y <= graphHeight);
    }
    
    function computeFocusClckSets(id: string|null){
        focusClckdNodeId = id;
        focusClckNodeIds = new Set();
        focusClckEdgeIds = new Set();

        if (!id) return;

        focusClckNodeIds.add(id);

        for (const e of visibleEdgesCopy){
            if (e.source.id === id || e.target.id === id) {
                focusClckEdgeIds.add(`${e.source.id}->${e.target.id}`);
                focusClckNodeIds.add(e.target.id);
                focusClckNodeIds.add(e.source.id);
            }
        }
    }

    function handleNodeClick(id: string){
        if (focusClckdNodeId === id) {
            computeFocusClckSets(null);
        } else {
            computeFocusClckSets(id);
        }
        drawNodes();
        drawEdges();

    }
    function calculatePositionLayout() {
        const innerW = graphWidth - 2*padding;
        const innerH = graphHeight - 2*padding;
        const centerx = padding + innerW / 2;
        const centery = padding + innerH / 2;

        const adjacency = new Map<string, string[]>();
    
        markovTransitions.forEach(t => {
            if (!adjacency.has(t.from)) adjacency.set(t.from, []);
            adjacency.get(t.from)!.push(t.to);
        });

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
            maxLevel = Math.max(...levels.values());
            //start of special edits for python assignments

            if (levels.get("=") === 3|| levels.get(" ") === 2) {
                levels.set("=", 1.5);
                levels.set(" ", 1.5);
            }
            
            const letters = "abcdefghijklmnopqrstuvwxyz";
            const digits = new Set("0123456789".split(""));
            const row1 = new Set(letters.slice(0, 14).split(""));
            const row2 = new Set(letters.slice(14).split(""));
            if (renderKey === "5::7::S4:END::S0:START"){
                for (const [id, lvl] of levels.entries()) {
                // if (lvl !== 1) continue;
                if (digits.has(id)) {
                    levels.set(id, 2.5);
                    continue;
                }
                const base = id.toLowerCase();
                if (row1.has(base)) levels.set(id, 0.6);
                else if (row2.has(base)) levels.set(id, 1.1);
            }
            // for (const id of row1) {
            //     if (levels.get(id) === 1) levels.set(id, 0.6);
            // }
            // for (const id of row2) {
            //     if (levels.get(id) === 1) levels.set(id, 1.1);
            // }
            if (levels.get("_") === 1) levels.set("_", 1.1);
            //end of edits for python assignments
            }

            
            //
            // Step 2: spread out nodes horizonatally within their vertical spacing BFS levels
            //
            const groupedByLevel = new Map<number, string[]>();
            markovStates.forEach(s => {
                const lvl = levels.get(s) ?? maxLevel;
                if (!groupedByLevel.has(lvl)) groupedByLevel.set(lvl, []);
                groupedByLevel.get(lvl)!.push(s);
            });

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
        } else {
            // if no starting state, spread nodes in a polygon or circle
            const angleStep = (2 * Math.PI) / markovStates.length;
            graphNodes = markovStates.map((s, i) => {
                const angle = i * angleStep;
                const x = centerx + (innerW / 2 - nodeRadius - 10) * Math.cos(angle);
                const y = centery + (innerH / 2 - nodeRadius - 10) * Math.sin(angle);
                return { id: s, x, y };
            });
            maxLevel = 0;
        }

            
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
        // stores a copy for restoring after if filtering
        visibleEdgesCopy = visibleEdges.slice();
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
    }

    function drawNodes() {
        const dragHandler = createDragNoSim(() => drawEdges());

        nodeLayer = g.select(".nodes")
            .selectAll<SVGGElement, StateNode>("g.node")
            .data(graphNodes, (n: any) => n.id)
            .join(enter => {
                const n = enter.append("g")
                    .attr("class", "node")
                    .attr("transform", d => `translate(${d.x},${d.y})`)
                    .call(dragHandler as any)
                    .on("click", (_, d) => handleNodeClick(d.id));
                    // .on("click", (event, d) => {
                    //     if (event.defaultPrevented) return; 
                    //     handleNodeClick(d.id);
                    // });
                n.append("circle")
                    .attr("r", nodeRadius)
                    .attr("fill", d => endState.includes(d.id) ? NODE_COLOURS.accepting : mStartingStates.includes(d.id) ? NODE_COLOURS.starting : NODE_COLOURS.regular)
                    .attr("stroke", d => endState.includes(d.id) ? NODE_STROKES.accepting : mStartingStates.includes(d.id) ? NODE_STROKES.starting : NODE_STROKES.regular)
                    .attr("stroke-width", d => (endState.includes(d.id) ? 2.5 : 1.5))
                n.append("text")
                    .attr("text-anchor", "middle")
                    .attr("dy", 4)
                    .attr("font-size", 9)
                    .attr("pointer-events", "none")
                    .text((d: StateNode) => d.id);

                return n;
            });

        nodeLayer.attr("transform", (d:StateNode) => `translate(${d.x},${d.y})`);
        // nodeLayer
        //     .select("circle")
        //     .attr("opacity", d => {
        //         if (activeNodeIds.size === 0) return 1;
        //         return activeNodeIds.has(d.id) ? 1 : 0.2;
        //     });

        //this works for both dataset and individual clicks
        nodeLayer
            .attr("opacity", (d: StateNode) => {
                if (focusClckdNodeId) return focusClckNodeIds.has(d.id) ? 1 : 0.2;
                if (activeNodeIds.size === 0) return 1;
                return activeNodeIds.has(d.id) ? 1 : 0.2;
            });
    }

    function drawEdges() {
        const zoomedEdges = visibleEdgesCopy.filter(e =>
            isInView(e.source, currentTransform) &&
            isInView(e.target, currentTransform)
        );
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
            .attr("class", "edge")
            .attr("fill", "none")
			.attr('stroke', d => {
                if (!showDirectionalColours) return 'black';
                return (d.target.y >= d.source.y ? 'black' : 'lightpink');
            })
            // .attr("stroke-width", d => 
            //     edgeStrokeWidth(d.probability))
            .attr("stroke-width", d => {
                if (!weightedThickness) return 1;
                // let thickness = 2*Math.sqrt(d.probability);
                let thickness =d.probability*2;
                if (d.probability < 0.036) thickness = 0.01;
                return thickness;
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
        edgeLayer.select("title").remove(); // avoid duplicates
        edgeLayer.append("title").text(
            (d: { source: StateNode; target: StateNode; probability: number }) => `${d.source.id} -> ${d.target.id}\nP = ${d.probability}`);

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

        edgeLayer.attr("opacity", (d: EdgeDatum) => {
            if (focusClckdNodeId) {
                return focusClckEdgeIds.has(`${d.source.id}->${d.target.id}`) ? 1 : 0.1;
            }
            if (activeNodeIds.size === 0) return 1;
            return (activeNodeIds.has(d.source.id) && activeNodeIds.has(d.target.id)) ? 1 : 0.05;
        });


        edgeLabelLayer = g.select(".edge-labels")
            .selectAll<SVGTextElement, EdgeDatum>("text.edge-label")
            .data(showEdgeLabels ? zoomedEdges : [],  d => `${d.source.id}->${d.target.id}`)
            .join(
                enter => enter.append("text").attr("class", "edge-label"),
                update => update,
                exit => exit.remove()
            )
            .attr("font-size", 9)
            .attr("text-anchor", "middle")
            .attr("dy", d => -4 + ((d.curvature ?? 0) === 0 ? 0 : 12 * labelBumpCurved(d)))
            .attr("x", d => (d.source.x + d.target.x) / 2)
            .attr("y", d => (d.source.y + d.target.y) / 2)
            .text(d => d.probability.toFixed(2))
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
        graphHeight = Math.max(10, Math.floor(r.height));

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
        zoomBehaviour = zoom;
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
        computeFocusClckSets(null);
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
    pStrokeThreshold;
    drawEdges();    
}

$: if (ready && isFullScreen !== undefined) {
    // Reset SVG to 1px so it stops inflating its own container before we remeasure.
    // Without this, on collapse getBoundingClientRect reads the old wide size back.
    d3.select(svgElement).attr("width", 1).attr("height", 1);
    requestAnimationFrame(() => requestAnimationFrame(() => {
        measureHeight();
        calculatePositionLayout();
        drawNodes();
        drawEdges();
    }));
}

function zoomIn() {
    if (!zoomBehaviour) return;
    d3.select(svgElement).transition().duration(150).call(zoomBehaviour.scaleBy as any, 1.2);
}
function zoomOut() {
    if (!zoomBehaviour) return;
    d3.select(svgElement).transition().duration(150).call(zoomBehaviour.scaleBy as any, 1 / 1.2);
}
function zoomReset() {
    if (!zoomBehaviour) return;
    d3.select(svgElement).transition().duration(150).call(zoomBehaviour.transform as any, d3.zoomIdentity);
}

</script>

<!-- <svg bind:this={svgElement} width="100%" height="600"></svg> -->
<div style="flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
<div class="controls">
    <!-- <label>
        Visibility threshold p ≥ {pStrokeThreshold.toFixed(3)}
        <input
            type="range"
            min="0"
            max="1"
            step="0.005"
            bind:value={pStrokeThreshold}
        />
    </label> -->
</div>
<div class="graphWrapper" bind:this={wrapperElement}>
    <svg bind:this={svgElement}></svg>
    <div class="zoomControls">
        <button type="button" class="zoomButton" title="{isFullScreen ? 'Exit fullscreen' : 'Expand'}" on:click={() => dispatch('toggleFullscreen')}>{isFullScreen ? '✕' : '⤢'}</button>
        <button type="button" class="zoomButton" on:click={zoomIn}>+</button>
        <button type="button" class="zoomButton" on:click={zoomOut}>−</button>
        <button type="button" class="zoomButton" on:click={zoomReset}>⟳</button>
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
    .zoomControls {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        flex-direction: column;
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