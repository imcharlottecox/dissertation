<script lang="ts">
	import { makeSyntheticFsmDS } from '$lib/components/benchmarking/makeSyntheticFsmDS';
    import type { fTransition } from '$lib/graph/graphTypes';
    import FsmViewer from "../FSM/fsmViewer.svelte";
    import BenchmarkHarness from "./benchmarkHarness.svelte";

    let viewer: FsmViewer;
    let fsmStates: string[] = [];
    let fsmTransitions: fTransition[] =[];
    let acceptingStates: string[] = [];
    let startingStates: string[] = [];
    let renderKey = "";

    function loadDS(n: number, seed: number){
        const ds = makeSyntheticFsmDS({n, seed, noSelfLoops: true, noDupeEdges: true});
        fsmStates= ds.fsmStates;
        fsmTransitions = ds.fsmTransitions;
        acceptingStates = ds.acceptingStates;
        startingStates = ds.startingStates;
        renderKey = `bench:${n}:${seed}:${Date.now()}`;
    }
</script>

<div style="display:flex; flex-direction:column;height:100%;">
    <div style="flex:1;min-height:0;">
        <FsmViewer
            bind:this={viewer}
            {fsmStates}
            {fsmTransitions}
            {acceptingStates}
            {startingStates}
            {renderKey}
        ></FsmViewer>
    </div>

    <BenchmarkHarness 
        runPass={(n)=> viewer.runBenchmarkPass(n)}
        {loadDS}
        allN={[10,100,500,1000]}
        csvPrefix="FSM_bench_3linearpercent"
    />
</div>