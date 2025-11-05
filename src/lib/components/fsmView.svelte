<script lang="ts">
    import { onMount } from "svelte";
    import * as d3 from "d3";
    import type { StateNode, fTransition } from '$lib/graph/graphTypes';
    // import { GRAPH_DEFAULTS_FSM } from '$lib/graph/graphDefaults';
    import { getGraphDefaultsFSM } from '$lib/graph/graphDefaults';
    import { createZoom, createDrag } from '$lib/graph/graphBehaviours';

    export let fsmStates: string[] = [];
    export let fsmTransitions: fTransition[] = [];
    export let acceptingStates: string[] = [];
    export let startingStates: string[] = [];
    export let weighted: boolean;

    // const { graphHeight, nodeRadius, padding, markerBoxWidth, markerBoxHeight } = GRAPH_DEFAULTS_FSM;
    let graphConfig = getGraphDefaultsFSM();
    let { graphHeight, nodeRadius, padding, markerBoxWidth, markerBoxHeight } = graphConfig;
    const ENABLE_SIMULATION = false; 
    let graphWidth = 700;
    let svgElement: SVGSVGElement;

    let graphNodes: StateNode[] = [];
    let graphEdges: fTransition[] = [];

    // Computes BFS numeric levels (depths)
    function computeLevelsMap(edges: fTransition[]): Map<string, number> {
        const adjacency = new Map<string, string[]>();
        edges.forEach(e => {
            if (!adjacency.has(e.from)) adjacency.set(e.from, []);
            adjacency.get(e.from)!.push(e.to);
        });

        const levels = new Map<string, number>();
        const queue: string[] = ["START"];
        levels.set("START", 0);

        while (queue.length > 0) {
            const current = queue.shift()!;
            const neighbours = adjacency.get(current) || [];
            for (const n of neighbours) {
            if (!levels.has(n)) {
                levels.set(n, (levels.get(current)! + 1));
                queue.push(n);
            }
            }
        }
        return levels;
    }

    // Converts those levels to actual coordinates
    function computeNodePositions(levels: Map<string, number>): Map<string, { x: number; y: number }> {
        const grouped = new Map<number, string[]>();
        for (const [node, lvl] of levels.entries()) {
            if (!grouped.has(lvl)) grouped.set(lvl, []);
            grouped.get(lvl)!.push(node);
        }

        const maxLevel = Math.max(...levels.values());
        const innerWidth = graphWidth - 2 * padding;
        const innerHeight = graphHeight - 2 * padding;
        const levelSpacing = innerWidth / (maxLevel + 1);

        const nodePositions = new Map<string, { x: number; y: number }>();
        for (const [lvl, nodes] of grouped.entries()) {
            const ySpacing = innerHeight / (nodes.length + 1);
            const x = padding + lvl * levelSpacing;
            nodes.forEach((n, i) => {
            const y = padding + (i + 1) * ySpacing;
            nodePositions.set(n, { x, y });
            });
        }
        return nodePositions;
    }

    function drawGraph(){
        if (!svgElement) return;

        const svg = d3.select(svgElement);
        svg.selectAll('.content-group').remove();
        
        const nodeMap = new Map(graphNodes.map(n => [n.id, n]));
        //resolves the from:'C' to 'Ca' label 'a' into transitions between StateNodes for use by d3
        const resolvedEdges = graphEdges.map(t => ({
            label: t.label,
            source: nodeMap.get(t.from),
            target: nodeMap.get(t.to)
        })).filter((e): e is { label: string; source: StateNode; target: StateNode } => !!(e.source && e.target)); //drop the edges where source or target is undefined in fsmStates
        console.log('nodeMap, resolvedEdges:', nodeMap, resolvedEdges);

        const levels = computeLevelsMap(fsmTransitions);

        const g = svg.append('g').attr('class', 'content-group');

        const maxLevel = Math.max(...levels.values());
        const simulation = d3.forceSimulation(graphNodes)
            // .force("link", d3.forceLink(resolvedEdges)
            //     .id((d: any) => d.id)
            //     .distance(75)
            // )
            // .force("charge", d3.forceManyBody().strength(-1500))
            // .force("collide", d3.forceCollide().radius(25))
            // .force("center", d3.forceCenter((graphWidth/2)+2*padding, 300.00))
            // .force("xLevel", d3.forceX((d: any) => {
            //     const level = levels.get(d.id) ?? 0;
            //     if (weighted && (acceptingStates.includes(d.id))) return graphWidth * 0.975;
            //     if (startingStates.includes(d.id)) return graphWidth * 0.025;
            //     return  padding + (graphWidth - 2* padding) * (level / maxLevel);
            // }).strength(1))
            // .force("ySpread", d3.forceY(graphHeight / 2))
            // .alphaDecay(0.1)
            .on("tick", tick);
        //issue: origin x is offset into yellow box, so everything is shifted right - nodes wont spread evenly thru the box
    
        // zoom + drag
        svg.call(createZoom(g));
        const dragHandler = createDrag(simulation, tick, graphNodes);
        
        //defs are reusable definitions
        svg.append("svg:defs")
            .append("svg:marker")
            .attr("id", "arrowhead")
            .attr("viewBox", [0, 0, markerBoxWidth, markerBoxHeight])
            .attr("refX", 34)
            .attr("refY", 5)
            .attr("markerUnits", "strokeWidth")
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("svg:path")
            .attr("d", "M 0 0 L 10 5 L 0 10 z"); //M 0 0 move to top, L 10 5 means draw line to middle right, L 0 10 line to bottom, z closes path

        //draw edges
        const edge = g.append('g')
            .attr('stroke', 'black' )
            .selectAll('line')
            .data(resolvedEdges)
            .join('line')
            .attr('stroke', 'grey')
            .attr('marker-end', 'url(#arrowhead)');

        const edgeLabel = g.append('g')
            .selectAll('text')
            .data(resolvedEdges)
            .join('text')
            .attr('font-size', 9)
            .text(d => d.label)

        const node = g.append('g')
            .selectAll('g')
            .data(graphNodes, (n:any) => n.id)
            .join('g')
            .call(dragHandler as any)

        node.append('circle')
            .attr('r', nodeRadius)
            .attr('fill', d => acceptingStates.includes(d.id) ? 'lightgreen' : startingStates.includes(d.id) ? 'lightgrey' : 'lightblue')
            .attr('stroke', 'black')
            .attr('stroke-width', d => acceptingStates.includes(d.id) ? 3 : 0.5);

        node.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 5)
            .attr('font-size', 9)
            .text(d => d.id);
            
        function tick() {
            graphNodes.forEach((d:any) => {
                const minX = nodeRadius + padding;
                const maxX = graphWidth - nodeRadius - padding;
                const minY = nodeRadius + padding;
                const maxY = graphHeight - nodeRadius - padding;
                d.x = Math.max(minX, Math.min(maxX, d.x));
                d.y = Math.max(minY, Math.min(maxY, d.y));
            });
            edge
                .attr('x1', (d: any) => d.source.x)
                .attr('y1', (d: any) => d.source.y)
                .attr('x2', (d: any) => d.target.x)
                .attr('y2', (d: any) => d.target.y)
                .attr("d", function(d: any) {
                    const differenceX = d.target.x - d.source.x;
                    const differenceY = d.target.y - d.source.y;
                    const edgeLength = Math.sqrt((differenceX * differenceX) + (differenceY * differenceY)); //hypoteneuse
                    const offsetX = (differenceX * d.target.radius) / edgeLength;
                    const offsetY = (differenceY * d.target.radius) / edgeLength;
                    return 'M' + d.source.x + ',' + d.source.y + 'L' + (d.target.x - offsetX) + ',' + (d.target.y - offsetY);
                })
                .attr('stroke', (d: any) => (d.target.x >= d.source.x) ? 'black' : 'lightgrey')

            edgeLabel
                .attr('x', (d: any) => (d.source.x + d.target.x) / 2.01)
                .attr('y', (d: any) => (d.source.y + d.target.y) / 2.02);

            node.attr('transform', (d) => `translate(${d.x},${d.y})`);
        }

        tick();
    }

    onMount(() => {
        graphWidth = svgElement.clientWidth;
        const levels = computeLevelsMap(fsmTransitions);
        const nodePositions = computeNodePositions(levels);
        graphNodes = fsmStates.map(id => {
            const pos = nodePositions.get(id) || { x: graphWidth / 2, y: graphHeight / 2 };
            return { id, x: pos.x, y: pos.y };
        });        
        graphEdges = fsmTransitions;
        drawGraph(); // only draw once

        const handleResize = () => {
            graphWidth = svgElement.clientWidth;
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    });

</script>

<svg bind:this={svgElement}></svg>

<style>
  svg {
    background-color: snow;
    width: 100%;
    height: 100%;
    border: 1px solid #ccc;
  }
</style>
