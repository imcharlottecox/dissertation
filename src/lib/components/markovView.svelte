<script lang="ts">
	import { createZoom, createDrag } from '$lib/graph/graphBehaviours';
    import { onMount } from "svelte";
    import * as d3 from "d3";
    import type { StateNode, mTransition } from '$lib/graph/graphTypes';
    // import { GRAPH_DEFAULTS_MARKOV } from '$lib/graph/graphDefaults';
    import { getGraphDefaultsMarkov } from '$lib/graph/graphDefaults';

    export let markovStates: string[] = [];
    export let markovTransitions: mTransition[] = [];
    export let mStartingStates: string[] = [];
    export let endState: string[] = [];

    // const { graphHeight, padding, markerBoxWidth, markerBoxHeight } = GRAPH_DEFAULTS_MARKOV;
    let graphConfig = getGraphDefaultsMarkov();
    let { graphHeight, padding, markerBoxWidth, markerBoxHeight } = graphConfig;
    let graphWidth = 100;
    let svgElement: SVGSVGElement;
	
    let nodeRadius = 15;
	let chargeStrength = -200;
	let linkDistance = 60;
    let collisionRadius = 22;
    let graphNodes: StateNode[] = [];
    let graphEdges: mTransition[] = markovTransitions; 
    let simulation: d3.Simulation<StateNode, undefined>;
    // let simulation;
    let levels: Map<string, number>;
    let maxLevel: number;

    //function calculatePositionLayout() {
    //    const innerWidth = graphWidth - 2 * padding;
    //    const totalStates = markovStates.length;

    //    graphNodes = markovStates.map((state, i) => ({
    //        id: state,
    //        x: graphWidth / 2,
    //        y: padding + (i / (totalStates - 1)) * innerHeight
    //    }));    
    //}
    
    function calculatePositionLayout() {
        const innerWidth = graphWidth - 2 * padding;
        const innerHeight = graphHeight - 2 * padding;

        //for each word, values are the next words 
        const adjacency = new Map<string, string[]>();
        markovTransitions.forEach(t => {
            if (!adjacency.has(t.from)) adjacency.set(t.from, []);
            adjacency.get(t.from)!.push(t.to);
        });

        //levels are min num transitions from start to node
        levels = new Map<string, number>();
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
        console.log("lev:",levels);

        maxLevel = Math.max(...levels.values());

        //group states by level (depth)
        const groupedByLevel = new Map<number, string[]>();
        markovStates.forEach(s => {
            const lvl = levels.get(s) ?? maxLevel;
            if (!groupedByLevel.has(lvl)) groupedByLevel.set(lvl, []);
            groupedByLevel.get(lvl)!.push(s);
        });
        console.log("grp", groupedByLevel)
        //layout nodes
        graphNodes = markovStates.map((state) => {
            const level = levels.get(state) ?? maxLevel;
            const siblings = groupedByLevel.get(level) || [];
            const index = siblings.indexOf(state);

            //vertical spacing by level depth
            const y = (level / (maxLevel+0.5)) * innerHeight;

            //horizontal spacing to spread siblings outward
            const siblingSpacing = innerWidth / (siblings.length + 1);
            const x = (index + 1) * siblingSpacing + padding;

            return { id: state, x: x, y };
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
        //Fix START and end nodes
        graphNodes.forEach((n) => {
            if (mStartingStates.includes(n.id)) {
                //Pin start near the top 
                n.fx = graphWidth / 2;
                n.fy = nodeRadius * 2;
            } else if (endState.includes(n.id)) {
                //Pin $ near the bottom 
                n.fx = graphWidth / 2;
                n.fy = graphHeight - nodeRadius * 2;
            } else {
                //Allow others to move
                n.fx = null;
                n.fy = null;
            }
        });

        simulation = d3.forceSimulation(graphNodes)
            // .force('link', d3.forceLink(resolvedEdges).id((d: any) => d.id).distance(linkDistance))
            // .force('charge', d3.forceManyBody().strength(chargeStrength))
            // .force('center', d3.forceCenter(graphWidth / 2, graphHeight / 2).strength(0.2)) //TODO: see if i can change the height to be more evenly spread throughout
            // .force("collide", d3.forceCollide().radius(collisionRadius))
            .on('tick', tick);

        // // simulation = d3.forceSimulation(graphNodes)
        // //     .force('link', d3.forceLink(resolvedEdges)
        // //         .id((d: any) => d.id)
        // //         .distance((d: any) => {
        // //             let base = linkDistance;
        // //             if (d.target.y && d.source.y && d.target.y < d.source.y) base *= 2;
        // //             return base;
        // //         })
        // //     )
        // //     .force('charge', d3.forceManyBody().strength(chargeStrength))
        // //     .force('xCenter', d3.forceX(graphWidth / 2).strength(0.1))
        // //     .force('yLevel', d3.forceY((d: any) => {
        // //         const level = levels.get(d.id) ?? 0;
        // //         return padding + (graphHeight - 2 * padding) * (level / maxLevel);
        // //     }).strength(0.3))
        // //     .force('collide', d3.forceCollide().radius(nodeRadius + collisionRadius))
        // //     // .force("gravityDown", d3.forceY(graphHeight * 0.5).strength(0.05))
        // //     .on('tick', tick);

        //zoom + drag
        svg.call(createZoom(g));
        const dragHandler = createDrag(simulation, tick, graphNodes);
        
        //draw edges
        svg.append("svg:defs")
        const defs = svg.append("defs");
        [
            { id: "arrow-black", color: "black" },
            { id: "arrow-blue", color: "lightgrey" }
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


        const edge = g.append('g')
            .attr('stroke', 'black')
            .selectAll('line')
            .data(resolvedEdges)
            .join('line')
            .attr('stroke', 'grey')
            .attr('stroke-width', e => e.label * 2)

        const edgeLabel = g.append('g')
            .selectAll('text')
            .data(resolvedEdges)
            .join('text')
            .attr('font-size', 9)
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
            .attr('fill', d => endState.includes(d.id) ? 'lightgreen' : mStartingStates.includes(d.id) ? 'lightgrey' : 'lightblue')
            //.attr('stroke-width', (d: StateNode) => acceptingStates.includes(d.id) ? 3 : 0.5);

        node.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 5)
            .attr('font-size', 9)
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
				.attr('x1', d => {
					const dx = d.target.x - d.source.x;
					const dy = d.target.y - d.source.y;
					const dist = Math.hypot(dx, dy);
					return d.source.x + (dx * nodeRadius) / dist;
				})
				.attr('y1', d => {
					const dx = d.target.x - d.source.x;
					const dy = d.target.y - d.source.y;
					const dist = Math.hypot(dx, dy);
					return d.source.y + (dy * nodeRadius) / dist;
				})
				.attr('x2', d => {
					const dx = d.target.x - d.source.x;
					const dy = d.target.y - d.source.y;
					const dist = Math.hypot(dx, dy);
					return d.target.x - (dx * nodeRadius) / dist;
				})
				.attr('y2', d => {
					const dx = d.target.x - d.source.x;
					const dy = d.target.y - d.source.y;
					const dist = Math.hypot(dx, dy);
					return d.target.y - (dy * nodeRadius) / dist;
				})
				.attr('stroke', d => (d.target.y >= d.source.y ? 'black' : 'lightpink'))
                .attr('marker-end', d =>
                    d.target.y >= d.source.y ? 'url(#arrow-black)' : 'url(#arrow-blue)'
                );

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
        drawGraph(); //only draw once

        const handleResize = () => {
            graphWidth = svgElement.clientWidth;
        };
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    });

    $: if (simulation) {
        simulation
            // .force('charge', d3.forceManyBody().strength(chargeStrength))
            // .force('link', (simulation.force('link') as any).distance(linkDistance))
            // .force('collide', d3.forceCollide().radius(collisionRadius));
        simulation.alpha(0).restart();
    }
    $: if (svgElement) {
        const svg = d3.select(svgElement);
        svg.selectAll('circle').attr('r', nodeRadius);
    }


</script>

<div class="controls">
	<label>
		Node Radius: {nodeRadius}
		<input type="range" min="5" max="60" bind:value={nodeRadius} />
	</label>
	<label>
		Charge Strength: {chargeStrength}
		<input type="range" min="-3000" max="0" step="10" bind:value={chargeStrength} />
	</label>
	<label>
		Link Distance: {linkDistance}
		<input type="range" min="2" max="200" bind:value={linkDistance} />
	</label>
    <label>
		Node Collide: {collisionRadius}
		<input type="range" min="1" max="100" bind:value={collisionRadius} />
	</label>
</div>
<svg bind:this={svgElement}></svg>

<style>
  svg {
    background-color: snow;
    width: 100%;
    height: 100%;
    border: 1px solid #ccc;
  }
</style>
