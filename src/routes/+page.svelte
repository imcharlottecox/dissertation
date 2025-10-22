<script>
    import * as d3 from 'd3';
    import { onMount } from 'svelte';

    let graphWidth = $state(800);
    let graphHeight = $state(600);

    const margin = {
        top: 20,
        bottom: 20,
        left: 20,
        right: 20
    }

    let innerGraphWidth = $derived(graphWidth - margin.left - margin.right);
    let innerGraphHeight = $derived(graphHeight - margin.top - margin.bottom);
</script>

<div>
    <h1>A Finite State Machine</h1> 
    <svg width={graphWidth} height={graphHeight}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
            <rect fill="red" width={innerGraphWidth} height={innerGraphHeight}/>
        </g>
    </svg>
</div>

<style>
    svg {
        background-color: whitesmoke;
    }
</style>
