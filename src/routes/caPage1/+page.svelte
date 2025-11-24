<script lang="ts">
    import FsmViewer from "$lib/components/fsmView.svelte";
    import MarkovView from "$lib/components/markovView.svelte";
    import { makeCaFSM } from '$lib/data/caFSM';
    import { makeCaMarkov } from "$lib/data/caLetterMarkov";
    import {ComputeValidityFSM} from "$lib/components/computeValidityFSM";
    import { ComputeProbabilityMarkov } from "$lib/components/computeProbabilityMarkov";

    const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeCaFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makeCaMarkov();
    let weighted = false;


    let sequence: string = "";
    let fsmResult: string | null = null;
    let markovResult: string | null = null;


    function testSequence(){
        const fsmInput = sequence?.trim().split("");
        const markovInput = sequence?.toUpperCase().trim().split("");

        const isAccepted = ComputeValidityFSM(fsmTransitions, fsmInput, acceptingStates);
        fsmResult = isAccepted ? "Accepted" : "Rejected";

        const prob = ComputeProbabilityMarkov(markovTransitions, markovInput);
        markovResult = `P(${markovInput}) = ${prob.toFixed(5)}`;
    }
</script>

<main>
    <div class="box">
        <h3>Accepting States</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            {#each acceptingStates as word (word)}
                <span class="word"                >
                    {word}
                </span>
            {/each}
            </div>
    </div>
    <div style="display: flex; gap: 4px; flex-direction:row;">
        <div style="width:50%; height:600px;">
            <FsmViewer 
            {fsmStates}
            {fsmTransitions}
            {acceptingStates}
            {startingStates}
            {weighted}
            />
        </div>
        <div style="width:50%; height:600px;">
            <MarkovView 
            {markovStates}
            {markovTransitions}
            {mStartingStates}
            {endState}
            />
        </div>
    </div>  
    <div>
        <label for="sequenceInput">Input Sequence:</label>
        <input
            type = "text"
            id = "sequenceInput"
            placeholder= "Enter a sequence to test here"
            bind:value={sequence}
            on:input={testSequence}
        />
        <div>
            {fsmResult}
        </div>            
            {markovResult}

    </div>
</main>


<style>
  main {
    padding: 1rem;
    background: snow;
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
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }
    .word {
        background-color: white;
        border: 1px solid #f3d421;
        border-radius: 1px;
        padding: 4px 4px;
        font-size: 14px;
    }
</style>
