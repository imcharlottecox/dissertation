<script lang="ts">
    import { onMount } from 'svelte';
    import * as d3 from 'd3';
    
    type StateNode = { id: string; x: number; y: number; fx?: number | null; fy?: number | null;};
    type Transition = { from: string; to: string; label: string };

    export const startingStates: string[] = ['START'];

    export const acceptingStates: string[] = [
    'Cat','Car','Caress','Cattle','Cambridge','Carton','Cart','Carts','Cats',
    'Cars','Caresses','Cartons','Cartwheel','Caramel','ACCEPT'
    ];

    export const fsmStates: string[] = [
    'START','C','Ca',

    'Cat','Cats','Catt','Cattl','Cattle',

    'Car','Cars',
    'Cara','Caram','Carame','Caramel',
    'Care','Cares','Caress','Caresse','Caresses',

    'Cart','Carts','Carto','Carton','Cartons',
    'Cartw','Cartwh','Cartwhe','Cartwhee','Cartwheel',

    'Cam','Camb','Cambr','Cambri','Cambrid','Cambridg','Cambridge',

    //   'ACCEPT'
    ];

    export const fsmTransitions: Transition[] = [
    { from: 'START', to: 'C', label: 'C' },
    { from: 'C', to: 'Ca', label: 'a' },

    { from: 'Ca', to: 'Cat', label: 't' },
    { from: 'Cat', to: 'ACCEPT', label: 'END' },
    { from: 'Cat', to: 'Cats', label: 's' },
    { from: 'Cats', to: 'ACCEPT', label: 'END' },

    { from: 'Cat', to: 'Catt', label: 't' },
    { from: 'Catt', to: 'Cattl', label: 'l' },
    { from: 'Cattl', to: 'Cattle', label: 'e' },
    { from: 'Cattle', to: 'ACCEPT', label: 'END' },

    { from: 'Ca', to: 'Car', label: 'r' },
    { from: 'Car', to: 'ACCEPT', label: 'END' },

    { from: 'Car', to: 'Cars', label: 's' },
    { from: 'Cars', to: 'ACCEPT', label: 'END' },

    { from: 'Car', to: 'Cara', label: 'a' },
    { from: 'Cara', to: 'Caram', label: 'm' },
    { from: 'Caram', to: 'Carame', label: 'e' },
    { from: 'Carame', to: 'Caramel', label: 'l' },
    { from: 'Caramel', to: 'ACCEPT', label: 'END' },

    { from: 'Car', to: 'Care', label: 'e' },
    { from: 'Care', to: 'Cares', label: 's' },
    { from: 'Cares', to: 'Caress', label: 's' },
    { from: 'Caress', to: 'ACCEPT', label: 'END' },
    { from: 'Caress', to: 'Caresse', label: 'e' },
    { from: 'Caresse', to: 'Caresses', label: 's' },
    { from: 'Caresses', to: 'ACCEPT', label: 'END' },

    { from: 'Car', to: 'Cart', label: 't' },
    { from: 'Cart', to: 'ACCEPT', label: 'END' },
    { from: 'Cart', to: 'Carts', label: 's' },
    { from: 'Carts', to: 'ACCEPT', label: 'END' },

    { from: 'Cart', to: 'Carto', label: 'o' },
    { from: 'Carto', to: 'Carton', label: 'n' },
    { from: 'Carton', to: 'ACCEPT', label: 'END' },
    { from: 'Carton', to: 'Cartons', label: 's' },
    { from: 'Cartons', to: 'ACCEPT', label: 'END' },

    { from: 'Cart', to: 'Cartw', label: 'w' },
    { from: 'Cartw', to: 'Cartwh', label: 'h' },
    { from: 'Cartwh', to: 'Cartwhe', label: 'e' },
    { from: 'Cartwhe', to: 'Cartwhee', label: 'e' },
    { from: 'Cartwhee', to: 'Cartwheel', label: 'l' },
    { from: 'Cartwheel', to: 'ACCEPT', label: 'END' },

    { from: 'Ca', to: 'Cam', label: 'm' },
    { from: 'Cam', to: 'Camb', label: 'b' },
    { from: 'Camb', to: 'Cambr', label: 'r' },
    { from: 'Cambr', to: 'Cambri', label: 'i' },
    { from: 'Cambri', to: 'Cambrid', label: 'd' },
    { from: 'Cambrid', to: 'Cambridg', label: 'g' },
    { from: 'Cambridg', to: 'Cambridge', label: 'e' },
    { from: 'Cambridge', to: 'ACCEPT', label: 'END' },
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
        const levels = computeLevels(fsmTransitions);
        const maxLevel = Math.max(...levels.values());
        const simulation = d3.forceSimulation(graphNodes)
            .force("link", d3.forceLink(resolvedEdges)
                .id((d: any) => d.id)
                .distance(75)
            )
            .force("charge", d3.forceManyBody().strength(-1000))
            // .force("collide", d3.forceCollide().radius(10))
            .force("center", d3.forceCenter((graphWidth/2)+2*padding, 300.00))
            .force("xLevel", d3.forceX((d: any) => {
                const level = levels.get(d.id) ?? 0;
                // if (acceptingStates.includes(d.id)) return graphWidth * 0.975;
                if (startingStates.includes(d.id)) return graphWidth * 0.025;
                return padding + (level / maxLevel) * (graphWidth - 2 * padding);
            }).strength(1))
            .force("ySpread", d3.forceY(graphHeight / 2))
            .alphaDecay(0.09)
            .on("tick", tick);


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
const corpus: string[] = acceptingStates.filter(s => s !== 'ACCEPT');
</script>

<main>
    <div class="box">
        <h3>Corpus</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            {#each corpus as word (word)}
                <span class="word"                >
                {word}
                </span>
            {/each}
            </div>
    </div>
    <svg bind:this={svgElement} />
</main>


<style>
    svg {
        background-color: snow;
        width: 100%;
        height: 600px;
        border: 1px solid #ccc;
    }
    h3{
        margin: 0 0 4px 0; 
        font-size: 16px; 
    }
    .box {
        border: 1.5px solid lightgrey;
        border-radius: 4px;
        padding: 8px;
        margin: 8px;
        background-color: snow;
    }
    .word {
        background-color: white;
        border: 1px solid #f3d421;
        border-radius: 1px;
        padding: 4px 4px;
        font-size: 14px;
    }
</style>