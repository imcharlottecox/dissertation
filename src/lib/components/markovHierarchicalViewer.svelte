<script lang="ts">
    import { onMount } from "svelte";
    import * as d3 from "d3";
    import type { StateNode, mTransition } from '$lib/graph/graphTypes';
    import { getGraphDefaultsMarkov } from '$lib/graph/graphDefaults';
    import { createDragNoSim, createZoom, computeEdgePoints, computeCurvedPath, computeSelfLoopPath } from '$lib/graph/graphBehaviours';

    export let markovStates: string[] = [];
    export let markovTransitions: mTransition[] = [];
    export let mStartingStates: string[] = [];
    export let endState: string[] = [];
    export let filterPairs: [string,string][] = [];

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
    let activeNodeIds = new Set<string>();

    let levels: Map<string, number>;
    let maxLevel = 0;
    let nodeRadius = 15;
    let currentTransform = d3.zoomIdentity;
    let ready = false;

    function isInView(node: StateNode, transform: d3.ZoomTransform) {
        const x = node.x * transform.k + transform.x;
        const y = node.y * transform.k + transform.y;

        return (x >= 0 && x <= graphWidth && y >= 0 && y <= graphHeight);
    }
    
    function calculatePositionLayout() {
        const innerW = graphWidth - 2*padding;
        const innerH = graphHeight - 2*padding;

        const adjacency = new Map<string, string[]>();
        markovTransitions.forEach(t => {
            if (!adjacency.has(t.from)) adjacency.set(t.from, []);
            adjacency.get(t.from)!.push(t.to);
        });

        levels = new Map();
        const queue: string[] = ["START"];
        levels.set("START", 0);

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

            const y = padding + (level / (maxLevel + 0.5)) * innerH;
            const xSpacing = innerW / (siblings.length + 1);
            const x = padding + xSpacing * (idx + 1);

            return { id: s, x, y };
        });
            
        graphNodes.forEach((n) => {
            if (mStartingStates.includes(n.id)) {
                //Pin start near the top 
                n.x = graphWidth / 2;
                n.y = nodeRadius * 2;
            } else if (endState.includes(n.id)) {
                //Pin $ near the bottom 
                n.x = graphWidth / 2;
                n.y = graphHeight - nodeRadius * 2;
            } 
        });
        const used = new Set<string>();
        graphNodes.forEach(n => {
            let key = `${Math.round(n.x)}|${Math.round(n.y)}`;
            while (used.has(key)) {
                n.x += 15;
                n.y += 15;
                key = `${Math.round(n.x)}|${Math.round(n.y)}`;
            }
            used.add(key);
        });
        const nodeMap = new Map(graphNodes.map(n => [n.id, n]));
        visibleEdges = markovTransitions
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
        visibleEdgesCopy = visibleEdges.slice();
        if (filterPairs && filterPairs.length > 0) {
            const pairSet = new Set(filterPairs.map(([a,b]) => `${a}|${b}`));
            visibleEdges = visibleEdges.filter(e =>
                pairSet.has(`${e.source.id}|${e.target.id}`)
            );
        }
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
  
        edgePair.forEach(({ e, curvature }) => {
            if (e) e.curvature = curvature*2;
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
			.attr('stroke', d => (d.target.y >= d.source.y ? 'black' : 'lightpink'))
            .attr("stroke-width", d => 2* Math.sqrt(d.probability))
            // .attr("stroke-width", d => d.probability *2)
            .attr('marker-end', d =>
                    d.target.y >= d.source.y ? 'url(#arrow-black)' : 'url(#arrow-pink)'
                )
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

            })
        //hover probability tooltip
        edgeLayer.select("title").remove(); // avoid duplicates
        // edgeLayer.append("title").text((d: any) => `P = ${d.probability}`);    
        edgeLayer.append("title").text(
    (d: { source: StateNode; target: StateNode; probability: number }) =>
        `${d.source.id} → ${d.target.id}\nP = ${d.probability}`
);

    }

    onMount(() => {
        graphWidth = svgElement.clientWidth;
        calculatePositionLayout();

        const svg = d3.select(svgElement);
        g = svg.append("g").attr("class", "content-group");
        g.append("g").attr("class", "edges");
        g.append("g").attr("class", "nodes");
        
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .on("zoom", (event) => {
                currentTransform = event.transform;
                g.attr("transform", currentTransform);
                drawEdges();
            });
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
    console.log("Reactive → filterPairs:", filterPairs);

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
}


</script>

<svg bind:this={svgElement} width="100%" height="600"></svg>

<style>
svg {
    background: snow;
    border: 1px solid #ccc;
}
</style>
