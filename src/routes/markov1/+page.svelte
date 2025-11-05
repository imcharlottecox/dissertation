<script lang="ts">
	import { onMount } from 'svelte';
    import * as d3 from 'd3';
    import { makeCaMarkov } from '$lib/data/caMarkov';
    import type { StateNode, mTransition } from '$lib/graph/graphTypes';

    const { markovStates, markovTransitions, startingStates } = makeCaMarkov();

    const graphHeight = 600;
    const nodeRadius = 20;
    const padding = 20; 
    const markerBoxWidth = 10;
    const markerBoxHeight = 10;
    let graphWidth = 100;
    let svgElement: SVGSVGElement;

    let graphNodes: StateNode[] = [];
    let graphEdges: mTransition[] = markovTransitions; 

    // function calculatePositionLayout() {
    //     const innerWidth = graphWidth - 2 * padding;
    //     const totalStates = markovStates.length;

    //     graphNodes = markovStates.map((state, i) => ({
    //         id: state,
    //         x: graphWidth / 2,
    //         y: padding + (i / (totalStates - 1)) * innerHeight
    //     }));    
    // }
function calculatePositionLayout() {
    const innerWidth = graphWidth - 2 * padding;
    const innerHeight = graphHeight - 2 * padding;

    // Build adjacency
    const adjacency = new Map<string, string[]>();
    markovTransitions.forEach(t => {
        if (!adjacency.has(t.from)) adjacency.set(t.from, []);
        adjacency.get(t.from)!.push(t.to);
    });

    // BFS to compute levels
    const levels = new Map<string, number>();
    const queue: string[] = ['START'];
    levels.set('START', 0);

    while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbours = adjacency.get(current) || [];
        for (const n of neighbours) {
            if (!levels.has(n)) {
                levels.set(n, (levels.get(current) ?? 0) + 1);
                queue.push(n);
            }
        }
    }

    const maxLevel = Math.max(...levels.values());

    // group states by level (depth)
    const groupedByLevel = new Map<number, string[]>();
    markovStates.forEach(s => {
        const lvl = levels.get(s) ?? maxLevel;
        if (!groupedByLevel.has(lvl)) groupedByLevel.set(lvl, []);
        groupedByLevel.get(lvl)!.push(s);
    });

    // layout nodes
    graphNodes = markovStates.map((state) => {
        const level = levels.get(state) ?? maxLevel;
        const siblings = groupedByLevel.get(level) || [];
        const index = siblings.indexOf(state);

        // vertical spacing = level depth
        const y = padding + (level / maxLevel) * innerHeight;

        // horizontal spacing = spread siblings outward
        const siblingSpacing = innerWidth / (siblings.length + 10);
        const x = padding + (index + 1) * siblingSpacing;

        // add some contextual horizontal offset for readability
        let offset = 0;
        if (state.endsWith('s')) offset = 60;
        else if (state.includes('Carto')) offset = -80;
        else if (state.includes('Cat')) offset = -40;
        else if (state.includes('Car')) offset = 40;

        return { id: state, x: x + offset, y };
    });
}




    function drawGraph(){
        if (!svgElement) return;

        const svg = d3.select(svgElement);
        svg.selectAll('.content-group').remove();
        
        const nodeMap = new Map(graphNodes.map(n => [n.id, n]));
        //resolves the from:'C' to 'Ca' label 'a' into transitions between StateNodes for use by d3
        const resolvedEdges = graphEdges.map(t => ({
            label: t.probability,
            source: nodeMap.get(t.from),
            target: nodeMap.get(t.to)
        })).filter((e): e is { label: number; source: StateNode; target: StateNode } => !!(e.source && e.target)); //drop the edges where source or target is undefined in markovStates
        console.log('nodeMap, resolvedEdges:', nodeMap, resolvedEdges);

        const g = svg.append('g').attr('class', 'content-group');
        //zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        svg.call(zoom);
        svg.call(zoom.transform, d3.zoomIdentity);

        //drag handler: remembers and saves positions of node drags, to persist state across window resizes
        const dragHandler = d3.drag<any, any>()
            .on('start', (event, d: any) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d: any) => {
                d.fx = d.x = event.x;
                d.fy = d.y = event.y;
                tick();
            })
            .on('end', (event, d: any) => {
                const index = graphNodes.findIndex(n => n.id === d.id);
                if (!event.active) simulation.alphaTarget(0);
                if (index !== -1) {
                    graphNodes[index].fx = d.x;
                    graphNodes[index].fy = d.y;
                }
		});
        
        const simulation = d3.forceSimulation(graphNodes)
            .force('link', d3.forceLink(resolvedEdges).id((d: any) => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-50))
            .force('center', d3.forceCenter(graphWidth / 2, graphHeight / 2))
            .force("collide", d3.forceCollide().radius(30))
            .on('tick', tick);

         //draw edges
        
        //defs are reusable definitions
        svg.append("svg:defs")
            .append("svg:marker")
            .attr("id", "arrowhead")
            .attr("viewBox", [0, 0, markerBoxWidth, markerBoxHeight])
            .attr("refX", 42)
            .attr("refY", 5)
            .attr("markerUnits", "strokeWidth")
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("svg:path")
            .attr("d", "M 0 0 L 10 5 L 0 10 z"); //M 0 0 move to top, L 10 5 means draw line to middle right, L 0 10 line to bottom, z closes path

        const edge = g.append('g')
            .attr('stroke', 'black' )
            .selectAll('line')
            .data(resolvedEdges)
            .join('line')
            .attr('marker-end', 'url(#arrowhead)')
            .attr('stroke', 'grey');

        const edgeLabel = g.append('g')
            .selectAll('text')
            .data(resolvedEdges)
            .join('text')
            .attr('font-size', 10)
            .text(d => d.label);

        const node = g.append('g')
            .selectAll<SVGGElement, StateNode>('g')
            .data(graphNodes, (n: StateNode) => n.id)
            .join('g')
            .call(dragHandler as any)


        node.append('circle')
            .attr('r', nodeRadius)
            .attr('stroke', 'black')
            .attr('fill', 'lightblue')
            // .attr('fill', (d: StateNode) => acceptingStates.includes(d.id) ? 'lightgreen' : 'lightblue')
            // .attr('stroke-width', (d: StateNode) => acceptingStates.includes(d.id) ? 3 : 0.5);

        node.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 5)
            .attr('font-size', 10)
            .text((d: StateNode) => d.id);

    function tick() {
            graphNodes.forEach((d) => {
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
                    const edgeLength = Math.sqrt((differenceX * differenceX) + (differenceY * differenceY));
                    // distance of x and y from the centre to the outside of the target node
                    const offsetX = (differenceX * d.target.radius) / edgeLength;
                    const offsetY = (differenceY * d.target.radius) / edgeLength;

                    return 'M' + d.source.x + ',' + d.source.y + 'L' + (d.target.x - offsetX) + ',' + (d.target.y - offsetY);
                })
                .attr('stroke', (d: any) => (d.target.y >= d.source.y) ? 'grey' : 'blue')


            edgeLabel
                .attr('x', (d: any) => (d.source.x + d.target.x) / 2.01)
                .attr('y', (d: any) => (d.source.y + d.target.y) / 2.02);

            
            node.attr('transform', (d) => `translate(${d.x},${d.y})`);
        }

        tick();
    }

    onMount(() => {
        graphWidth = svgElement.clientWidth;
        calculatePositionLayout();
        drawGraph(); // only draw once

        const handleResize = () => {
            graphWidth = svgElement.clientWidth;
        };

        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    });

</script>

<main>
    <h1>Markov Model Visualization</h1>
    <svg bind:this={svgElement} />

</main> 

<style>
    main {
        padding: 1rem;
    }
    svg {
        background-color: snow;
        width: 100%;
        height: 600px;
        border: 1px solid #ccc;
    }
</style>