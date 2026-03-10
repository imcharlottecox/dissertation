<script lang="ts">
    // import FsmViewer from "$lib/components/fsmView.svelte";
    // import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    // import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";
    import MarkovView from "$lib/components/HM.svelte";
    import { makeShakeItOffFSM } from '$lib/data/shakeItOff/shakeItOffFSM';
    import { makeShakeItOffMarkov } from "$lib/data/shakeItOff/shakeItOff_Markov";
    import {ComputeValidityFSM} from "$lib/components/compute/computeValidityFSM";
    import { ComputeProbabilityMarkov } from "$lib/components/compute/computeProbabilityMarkov";
    import PageIntro from "$lib/components/pageIntro.svelte";
    const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeShakeItOffFSM();
    const { markovStates, markovTransitions, mStartingStates, endState, wordChains } = makeShakeItOffMarkov();
    import Accordion from "$lib/components/Accordion.svelte";

    let weighted = false;
    let showDirectionalColours = true;
    let showEdgeLabels =false;
    let weightedThickness = true;

    let sequence: string = "";
    let fsmResult: string | null = null;
    let markovResult: string | null = null;


    function testSequence(){
        const fsmInput = sequence?.trim().split("");
        const markovInput = sequence?.toUpperCase().trim().split("");

        const isAccepted = ComputeValidityFSM(fsmTransitions, fsmInput, acceptingStates);
        fsmResult = isAccepted ? "FSM: Accepted" : "FSM: Rejected";

        const prob = ComputeProbabilityMarkov(markovTransitions, markovInput);
        markovResult = `P(${markovInput}) = ${prob.toFixed(5)}`;
    }
    let showDepth = false;
    $: fsmRenderKey = [
      fsmStates.length,
      fsmTransitions.length,
      acceptingStates.join('|'),
      startingStates.join('|'),
    ].join('::');
</script>

<main class="page">
    <PageIntro 
        title="Letter Scramble"
        description="Below, we've used a dataset of the letters 'C,a,r,t,o,n,s'. The accepting states are all of the words in the Cambridge English dictionary that you can make as an anagram of these letters, starting with the letter C. The Markov chain shows us the likeliness of transitioning between letters based on these words in the dictionary."
    />
    <!-- <div class="box">
        <h3>Accepting States</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            {#each acceptingStates as word (word)}
                <span class="word"                >
                    {word}
                </span>
            {/each}
            </div>
    </div> -->
      <Accordion title="Accepting States" initiallyOpen={false}>
        {#each acceptingStates as word (word)}
            <span class="word">{word}</span>
        {/each}
    </Accordion>
    <div class="graphRow">
        <!-- <div style="width:50%;">
            <FsmHierarchicalViewer 
            {fsmStates}
            {fsmTransitions}
            {acceptingStates}
            {startingStates}
            {weighted}
            {showDepth}
            renderKey = {fsmRenderKey}
            />
        </div> -->
        <div class="fsmPane" style="width:50%;">
          <div class="paneHeader"></div>
          <div class="fsmGraph">
            <FsmHierarchicalViewer 
                {fsmStates}
                {fsmTransitions}
                {acceptingStates}
                {startingStates}
                {weighted}      
                {showDepth}        
                renderKey = {fsmRenderKey}
              />
          </div>
        </div>
        <!-- <div style="width:50%;">
            <MarkovView 
            {markovStates}
            {markovTransitions}
            {mStartingStates}
            {endState}
            />
        </div> -->
        <div class="markovPane"style="width:50%;">
          <div class="paneHeader">
            <label class="check" title="Edges are coloured black if they are directed downwards to a node, or pink if directed upwards. This helps with clarity in busy graphs!">
              <input
                type="checkbox"
                bind:checked={showDirectionalColours}
              />
              Show Directional Colours
            </label>
            <label class="check" title="Displays edge probabilities">
              <input
                type="checkbox"
                bind:checked={showEdgeLabels}
              />
              Show Edge Labels
            </label>
            <label class="check" title="Edge thickness corresponds to the probability of the edge">
              <input
                type="checkbox"
                bind:checked={weightedThickness}
              />
              Weighted Thickness
            </label>

          </div>
          <div class="markovGraph">
            <MarkovView 
              {markovStates}
              {markovTransitions}
              {mStartingStates}
              {endState}
              {wordChains}
              {showDirectionalColours}
              {showEdgeLabels}
              {weightedThickness}
            />
          </div>
        </div>
    </div>  
    <div>
        <p>Can you find a word rejected by the FSM that the Markov Chain still assigns a probability to? </p>
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
    .page{
        min-height: 95dvh;
        height: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 1rem;
        background: #fafafa;  
        box-sizing: border-box;
        /* overflow: hidden; */
        overflow-y:auto;
    }
    .graphRow{
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        gap: 8px;
    }
    .fsmPane, .markovPane{
        display: flex;
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        flex-direction: column;
    }
    .paneHeader{
        display: flex;

        flex: 0 0 20px;
        background: whitesmoke;
        border-bottom: 1px solid #ddd;
        gap: 12px;
        align-items: center;
    }
    .fsmGraph, .markovGraph{
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
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
