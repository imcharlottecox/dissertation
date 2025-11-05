<script lang="ts">
    import { onMount } from 'svelte';
    import * as d3 from 'd3';
    import { a } from 'motion/react-client';
    
    type StateNode = { id: string; x: number; y: number; fx?: number | null; fy?: number | null;};
    type Transition = { from: string; to: string; label: string };

    const acceptingStates = [
        'Cat', 'Car', 'Cart', 'Carton', 'Cats', 'Cars', 'Carts', 'Cartons', 'ACCEPT'
    ];
    
    const fsmStates = [
        'START',
        'C',
        'Ca', // Central axis
        
        'Cat',  // Top branch
        'Cats', // Top branch 
        
        'Car',  // Middle path 
        'Cars', // Bottom branch (plurals)

        'Cart',  // Middle/Top path 
        'Carts', // Bottom branch (plurals)

        'Carto', // Middle path 
        'Carton', // Middle path
        'Cartons', // Middle path 

    ];

    const fsmTransitions: Transition[] = [
        { from: 'START', to: 'C', label: 'C' },
        { from: 'C', to: 'Ca', label: 'a' },
        { from: 'Ca', to: 'Cat', label: 't' },
        { from: 'Ca', to: 'Car', label: 'r' },
        { from: 'Cat', to: 'ACCEPT', label: 'END' },
        { from: 'Cat', to: 'Cats', label: 's' },
        { from: 'Cats', to: 'ACCEPT', label: 'END' },
        { from: 'Car', to: 'ACCEPT', label: 'END' },
        { from: 'Car', to: 'Cart', label: 't' },
        { from: 'Car', to: 'Cars', label: 's' },
        { from: 'Cars', to: 'ACCEPT', label: 'END' },
        { from: 'Cart', to: 'ACCEPT', label: 'END' },
        { from: 'Cart', to: 'Carts', label: 's' },
        { from: 'Carts', to: 'ACCEPT', label: 'END' },
        { from: 'Cart', to: 'Carto', label: 'o' },
        { from: 'Carto', to: 'Carton', label: 'n' },
        { from: 'Carton', to: 'ACCEPT', label: 'END' },
        { from: 'Carton', to: 'Cartons', label: 's' },
        { from: 'Cartons', to: 'ACCEPT', label: 'END' }
    ];
    

    const graphHeight = 600;
    const nodeRadius = 20;
    const padding = 120; 
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
                fx: hasDragged ? existing!.fx! : defaultX,
                fy: hasDragged ? existing!.fy! : defaultY
            };
        });
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
        })).filter(e => e.source && e.target); //drop the edges where source or target is undefined in fsmStates
        console.log('nodeMap, resolvedEdges:', nodeMap, resolvedEdges);

        const g = svg.append('g').attr('class', 'content-group');

        //zoom
        const zoom = d3.zoom().on('zoom', event => {
            g.attr('transform', event.transform);
        });
        svg.call(zoom as any);

        //drag handler: remembers and saves positions of node drags, to persist state across window resizes
        const dragHandler = d3.drag<any, any>()
            .on('start', (event, d: any) => {
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
                if (index !== -1) {
                    graphNodes[index].fx = d.x;
                    graphNodes[index].fy = d.y;
                }
		});
        

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
            .attr('fill', (d: StateNode) => acceptingStates.includes(d.id) ? 'lightgreen' : 'lightblue')
            .attr('stroke', 'black')
            .attr('stroke-width', (d: StateNode) => acceptingStates.includes(d.id) ? 3 : 0.5);

        node.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 5)
            .attr('font-size', 10)
            .text((d: StateNode) => d.id);

            
        function tick() {
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
                .attr('stroke', (d: any) => (d.target.x >= d.source.x) ? 'grey' : 'blue')


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
        background-color: lightyellow;
        width: 100%;
        height: 600px;
        border: 1px solid #ccc;
    }
</style>