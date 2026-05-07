<script lang="ts">
	import MarkovViewer from './../MC/markovViewer.svelte';
	import { makeSyntheticMCDS } from './makeSyntheticMCDS';
    import type { mTransition } from '$lib/graph/graphTypes';
    import BenchmarkHarness from "./benchmarkHarness.svelte";

    let viewer: MarkovViewer;
    let markovStates: string[] = [];
    let markovTransitions: mTransition[] =[];
    let endState: string[] = [];
    let mStartingStates: string[] = [];
    let renderKey = "";

    function loadDS(n: number, seed: number){
        const ds = makeSyntheticMCDS({n, seed, noSelfLoops: true});
        markovStates= ds.markovStates;
        markovTransitions = ds.markovTransitions;
        endState = ds.acceptingStates;
        mStartingStates = ds.startingStates;
        renderKey = `bench:${n}:${seed}:${Date.now()}`;
    }
</script>

<div style="display:flex; flex-direction:column;height:100%;">
    <div style="flex:1;min-height:0;">
        <MarkovViewer
            bind:this={viewer}
            {markovStates}
            {markovTransitions}
            {endState}
            {mStartingStates}
            {renderKey}
            fineChains={{}}
        ></MarkovViewer>
    </div>

    <BenchmarkHarness 
        runPass={(n)=> viewer.runBenchmarkPass(n)}
        {loadDS}
        allN={[10,100,500,1000]}
        csvPrefix="MC_bench_3linearpercent"
    />
</div>