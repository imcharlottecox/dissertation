<script lang="ts">
    import { onMount } from 'svelte';
    import * as d3 from 'd3';
    
    type StateNode = { id: string; x: number; y: number; fx?: number | null; fy?: number | null;};
    type Transition = { from: string; to: string; label: string };

    const acceptingStates = [
        'surrender', 'ACCEPT'
    ];
    const startingStates = [
        'START'
    ];
    const fsmStates = [
        'START', 'we', 'shall', 'fight', 'on', 'the',
        'beaches', 'landing', 'grounds', 'in', 'fields',
        'and', 'streets', 'hills', 'never', 'surrender', 'ACCEPT'
    ];
    const fsmTransitions = [
        { from: 'START', to: 'we', label: 'we' },
        { from: 'we', to: 'shall', label: 'shall' },
        { from: 'shall', to: 'fight', label: 'fight' },
        { from: 'fight', to: 'on', label: 'on' },
        { from: 'on', to: 'the', label: 'the' },
        { from: 'the', to: 'beaches', label: 'beaches' },
        { from: 'beaches', to: 'we', label: 'we' },
        { from: 'the', to: 'landing', label: 'landing' },
        { from: 'landing', to: 'grounds', label: 'grounds' },
        { from: 'grounds', to: 'we', label: 'we' },
        { from: 'fight', to: 'in', label: 'in' },
        { from: 'in', to: 'the', label: 'the' },
        { from: 'the', to: 'fields', label: 'fields' },
        { from: 'fields', to: 'and', label: 'and' },
        { from: 'and', to: 'in', label: 'in' },
        { from: 'the', to: 'streets', label: 'streets' },
        { from: 'streets', to: 'we', label: 'we' },
        { from: 'the', to: 'hills', label: 'hills' },
        { from: 'hills', to: 'we', label: 'we' },
        { from: 'shall', to: 'never', label: 'never' },
        { from: 'never', to: 'surrender', label: 'surrender' },
        { from: 'surrender', to: 'ACCEPT', label: 'END' }
    ];

    const graphHeight = 600;
    const nodeRadius = 20;
    const padding = 20; 
    const markerBoxWidth = 10;
    const markerBoxHeight = 10;
    let graphWidth = 100;
    let svgElement: SVGSVGElement;
    
    //d3 data arrays
    let graphNodes: StateNode[] = [];
    let graphEdges: Transition[] = fsmTransitions; //TODO: whats the difference between this and fsmTransitions.map(t => ({ ...t }));

    function calculatePositionLayout() {
        const innerWidth = graphWidth - 2 * padding;
        const totalStates = fsmStates.length;

        graphNodes = fsmStates.map((state, i) => {
            const defaultX = padding + (i / (totalStates - 1)) * innerWidth;
            let defaultY;

            if (['START', 'C', 'Ca', 'Car', 'Cart'].includes(state) || state.startsWith('Carto')) {
                defaultY = graphHeight * 0.5;
            } else if (['Cat', 'Cats'].includes(state)) {
                defaultY = graphHeight * 0.7;
            } else if (['Cars', 'Carts'].includes(state)) {
                defaultY = graphHeight * 0.3;
            } else {
                defaultY = graphHeight * 0.5;
            }

            const existing = graphNodes.find(n => n.id === state);

            // Keep dragged position if user moved it, otherwise use resized layout
            const hasDragged = existing && (existing.fx !== defaultX || existing.fy !== defaultY);

            return {
                id: state,
                x: hasDragged ? existing!.fx! : defaultX,
                y: hasDragged ? existing!.fy! : defaultY,
                // fx: hasDragged ? existing!.fx! : defaultX,
                // fy: hasDragged ? existing!.fy! : defaultY
            };
        });
    }

    function computeLevels(edges: Transition[]) {
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
                    levels.set(n, levels.get(current)! + 1);
                    queue.push(n);
                }
            }
        }
        return levels;
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

        const levels = computeLevels(fsmTransitions);

        const g = svg.append('g').attr('class', 'content-group');

        //zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        svg.call(zoom);
        svg.call(zoom.transform, d3.zoomIdentity);

        // drag handler: remembers and saves positions of node drags, to persist state across window resizes
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

        const maxLevel = Math.max(...levels.values());
        const simulation = d3.forceSimulation(graphNodes)
            .force("link", d3.forceLink(resolvedEdges)
                .id((d: any) => d.id)
                .distance(75)
            )
            .force("charge", d3.forceManyBody().strength(-1000))
            .force("collide", d3.forceCollide().radius(22))
            .force("center", d3.forceCenter((graphWidth/2)+2*padding, 300.00))
            // no center force!
            .force("xLevel", d3.forceX((d: any) => {
                const level = levels.get(d.id) ?? 0;
                if (acceptingStates.includes(d.id)) return graphWidth * 0.975;
                if (startingStates.includes(d.id)) return graphWidth * 0.025;
                return padding + (level / maxLevel) * (graphWidth - 2 * padding);
            }).strength(1))
            .force("ySpread", d3.forceY(graphHeight / 2))
            .alphaDecay(0.05)
            .on("tick", tick);
        //issue: origin x is offset into yellow box, so everything is shifted right - nodes wont spread evenly thru the box


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
            .attr('font-size', 10)
            .text(d => d.label)

        const node = g.append('g')
            .selectAll('g')
            .data(graphNodes, (n:any) => n.id)
            .join('g')
            .call(dragHandler as any)


        node.append('circle')
            .attr('r', nodeRadius)
            .attr('fill', d => acceptingStates.includes(d.id) ? 'lightgreen' : 'lightblue')
            .attr('stroke', 'black')
            .attr('stroke-width', d => acceptingStates.includes(d.id) ? 3 : 0.5);

        node.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 5)
            .attr('font-size', 10)
            .text(d => d.id);

        svg.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 100)
            .attr("y2", 0)
            .attr("stroke", "red");

        svg.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", 100)
            .attr("stroke", "blue");
            
          
        // const simulation = d3.forceSimulation(graphNodes)
        //     .force("link", d3.forceLink(resolvedEdges).id((d: any) => d.id))
        //     .force("charge", d3.forceManyBody().strength(-1000))
        //     .force("center", d3.forceCenter(graphWidth / 2, graphHeight / 2))
            // .force("acceptY", d3.forceY((d: any) =>
            //         acceptingStates.includes(d.id) || startingStates.includes(d.id) ? graphHeight * 0.5 : graphHeight / 2
            //     ).strength(0.6))
        //     .force("startX", d3.forceX((d: any) =>
        //             startingStates.includes(d.id) ? graphWidth * 0.1 : graphWidth / 2
        //         ).strength(0.9))
        // .force("acceptX", d3.forceX((d: any) =>
        //         acceptingStates.includes(d.id) ? graphWidth * 0.9 : graphWidth / 2
        //     ).strength(0.9))
        //     .on("tick", tick);


              
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
                    // Total difference in x and y from source to target
                    const differenceX = d.target.x - d.source.x;
                    const differenceY = d.target.y - d.source.y;

                    // Length of path from center of source node to center of target node
                    const edgeLength = Math.sqrt((differenceX * differenceX) + (differenceY * differenceY));

                    // x and y distances from center to outside edge of target node
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

    // $: if (graphWidth) {
    //     calculatePositionLayout();
    //     drawGraph();
    // }

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
	<h1>My Finite State Machine!</h1>
    <svg bind:this={svgElement} />
</main>

<style>
    svg {
        background-color: snow;
        width: 100%;
        height: 600px;
        border: 1px solid #ccc;
    }
</style>