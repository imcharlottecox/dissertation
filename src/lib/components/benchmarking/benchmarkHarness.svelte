<script lang="ts">
	import { benchRows, downloadBenchRowsAsCsv, clearBenchRows } from '$lib/components/benchmarking/profiler';
    import {tick} from "svelte";

    export let runPass: (n: number) => void;
    export let loadDS: (n: number, seed: number)=> void;
    export let allN = [10,100,500,1000];
    export let csvPrefix ="bench";


    let trials = 5;
    let benchN = 100;
    let benchSeed = 22;
    let statusText ="";

    const NS = [10,100,500,800,900,1000,1200,1400,1600,1800,2000,2250,2500,3000,3500,4000,4500,5000,5500,6000,6500,7000,7500,8000,8500,9000,9500,10000,10500,11000,11500];

    function median(xs: number[]){
        const sorted = [...xs].sort((a,b) => a-b);
        const mid = Math.floor(sorted.length /2);
        return sorted.length % 2 === 0 ? (sorted[mid -1] + sorted[mid])/ 2 : sorted[mid];
    }

    export async function runBenchmarkMedian(n: number, trialCount: number){
        statusText = `Running n=${n}`;
        await tick();
        await new Promise<void>(R => setTimeout(R, 50));

        runPass(n);
        clearBenchRows();
        
        const timeScore = new Map<string, number[]>();
        for (let i=0; i<trialCount; i++){
            clearBenchRows();
            runPass(n);
            for (const row of benchRows){
                if (!timeScore.has(row.name)) timeScore.set(row.name, []);
                timeScore.get(row.name)!.push(row.ms);
            }
        }

        clearBenchRows();
        for (const [name, times] of timeScore.entries()){
            benchRows.push({name, n,ms: median(times)});
        }
        statusText = `Done n=${n}`;

    }

    async function runAllTests(){
        clearBenchRows();
        for (const n of allN){
            loadDS(n, benchSeed);
            await tick();
            await new Promise<void>(r => setTimeout(r, 100));
            await runBenchmarkMedian(n, trials);
            downloadBenchRowsAsCsv(`${csvPrefix}_n${n}.csv`);
            clearBenchRows();
            await new Promise<void>(r => setTimeout(r, 100));
        }
        statusText = "All tests ran";
    }
</script>

<div>
    <select bind:value={benchN}>
        {#each NS as n}
            <option value={n}>{n}</option>
        {/each}
    </select>

    <label>
        Seed: <input type="number" min="1" bind:value={benchSeed}/>
    </label>
    <label>
        Trials: <input type="number" min="1" max="20" bind:value={trials}/>
    </label>

    <button on:click={() => loadDS(benchN, benchSeed)}>Load graph</button>
    <button on:click={async () => {await runBenchmarkMedian(benchN, trials);}}>Benchmark median</button>
    <button on:click={runAllTests}>Run full suite and download</button>
    <button on:click={() => downloadBenchRowsAsCsv(`${csvPrefix}_n${benchN}.csv`)}>Download csv</button>

    {#if statusText}
        <span>{statusText}</span>
    {/if}

</div>