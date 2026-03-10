<script lang="ts"> 
    import { onMount } from 'svelte';
    import * as d3 from 'd3';

    type Transition = { from: string; to: string; label: string };
    const acceptingStates = ['Cat', 'Car', 'Cart', 'Carton', 'Cats', 'Cars', 'Carts', 'Cartons', 'ACCEPT'];
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

    let graphWidth = 1250;
    let lastPositionUpdate = 0;
    let statePositions = new Map<string, { x: number; y: number }>();
    let svgElement: SVGSVGElement; 

    //state position calculation
    $: if (graphWidth) {
        const innerWidth = graphWidth - (2 * padding);
        const totalStates = fsmStates.length;
        
        fsmStates.forEach((state, i) => {
            const x = padding + (i / (totalStates - 1)) * innerWidth;
            let y;
            if (state === 'START' || state === 'C' || state === 'Ca' || state === 'Car' || state === 'Cart' || state.startsWith('Carto')) {
                // Middle branch
                y = graphHeight * 0.5; 
            } else if (state === 'Cat' || state === 'Cats') {
                // Top branch
                y = graphHeight * 0.3; 
            } else if (state === 'Cars' || state === 'Carts') {
                // Bottom branches
                y = graphHeight * 0.7; 
            } else {
                y = graphHeight * 0.5; // Default to center
            }
            statePositions.set(state, { x, y });
        });        
        //need svelete to realise the map has changed with graph resize
        lastPositionUpdate = Date.now();
    }     
    
    onMount(() => {
        graphWidth = window.innerWidth * 0.9; 
        const zoom = d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
            d3.select(svgElement)
                .select('g.content')
                .attr('transform', event.transform);
        });
        d3.select(svgElement).call(zoom as any);
        const resizeHandler = () => {
            graphWidth = window.innerWidth * 0.9;
        };
        window.addEventListener('resize', resizeHandler);
        return () => window.removeEventListener('resize', resizeHandler);
    });

    function getPosition(state: string) {
        const pos = statePositions.get(state);
        return pos;
    }

</script>

<main>
    <h1>FSM Transitions</h1>
    <svg width={graphWidth} height="600" bind:this={svgElement}>
        <g class="content">
            {#key lastPositionUpdate}
                {#each fsmTransitions as t}
                    {@const posFrom = getPosition(t.from)}
                    {@const posTo = getPosition(t.to)}
                    {#if posFrom && posTo}
                        {@const midX = (posFrom.x + posTo.x) / 2}
                        {@const midY = (posFrom.y + posTo.y) / 2 - 8}
                        <line
                            x1={posFrom.x}
                            y1={posFrom.y}
                            x2={posTo.x}
                            y2={posTo.y}
                            stroke="black"
                        />
                        <text x={midX} y={midY} text-anchor="middle" font-size="10" fill="black">{t.label}</text>
                    {/if}
                {/each}

                {#each fsmStates as state}
                    {@const pos = getPosition(state)}
                    {@const isAccepting = acceptingStates.includes(state)}
                    {#if pos}
                        <circle 
                            cx={pos.x} 
                            cy={pos.y} 
                            r={nodeRadius} 
                            fill={isAccepting ? 'lightgreen' : 'lightblue'} 
                            stroke={'black'} 
                            stroke-width={isAccepting ? 3 : 0.5} 
                        />
                        <text x={pos.x} y={pos.y + 4} text-anchor="middle" font-size="10">{state}</text>
                    {/if} 
                {/each}
            {/key}
        </g>
    </svg>
</main>

<style> 
    svg {
        background-color: lightyellow;
    }
</style>