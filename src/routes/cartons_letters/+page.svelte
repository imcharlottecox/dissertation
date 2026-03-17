<script lang="ts">
    // import FsmViewer from "$lib/components/fsmView.svelte";
    // import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    // import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";
    import MarkovView from "$lib/components/HM.svelte";

    import { makeCaFSM } from '$lib/data/ca_letters/caFSM';
    import { makeCaMarkov } from "$lib/data/ca_letters/caLetterMarkov";
    // import { makeCaMarkov } from "$lib/data/ca_letters/ca_markov";
    import {ComputeSimpleValidityFSM} from "$lib/components/compute/computeValidityFSM";
    import { computePrefixProbabilityMarkov } from "$lib/components/compute/computeProbabilityMarkov";
    import PageIntro from "$lib/components/pageIntro.svelte";
    const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeCaFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makeCaMarkov();
    import Accordion from "$lib/components/Accordion.svelte";
    import ChallengePanel, {type TaskQuestion, type Evaluation} from "$lib/components/compute/computeBox.svelte"
    let weighted = false;
    let showDirectionalColours = false;
    let showEdgeLabels =true;
    let weightedThickness = true;

    let inputSequence: string = "";
    let fsmResult: string | null = null;
    let markovResult: string | null = null;


    function testinputSequence(){
        const fsmInput = inputSequence?.trim().split("");
        const markovInput = inputSequence?.trim().split("");

        const isAccepted = ComputeSimpleValidityFSM(fsmTransitions, fsmInput, acceptingStates);
        fsmResult = isAccepted ? "FSM: Accepted" : "FSM: Rejected";

        const prob = computePrefixProbabilityMarkov(markovTransitions, markovInput);
        markovResult = `P(${markovInput}) = ${prob.toFixed(5)}`;
    }
    let showDepth = false;



    const questions: TaskQuestion[] = [
        {
            id: "Q1",
            prompt: "Can you find a word rejected by the Finite State Machine that the Markov Chain still assigns a probability to? What is the lowest probability you can find for such a word?",
            check: ({accepted, probability}) => !accepted && probability>0
        },
        {
            id: "Q2",
            prompt: "Can you find a four-letter word accepted by the FSM with probability of exactly 0.125?",
            check: ({accepted, probability, input}) => accepted && probability === 0.125 && input.length === 4
        },
        {
            id: "Q3",
            prompt: "'Cacao' is a valid anagram of the letters starting with Ca, but it isn't accepted by the FSM. Can you explain why this is the case?",
            check: ()=> false,
            correctChoice: "dataset",
            choices: [
                {id: "MarkovLink", label: "The Markov chain assigns 'Cacao' a probability of 0, so the Finite State Machine has to reject it"},
                {id: "length", label: "The word is too long for the FSM to accept it"},
                {id: "dataset", label: "The FSM was designed to only accept the words in our 'accepting dataset' and 'Cacao' isn't in that dataset"},
                {id: "trick", label: "The question is wrong! 'Cacao' is accepted by the FSM because it is a valid anagram of the letters the FSM accepts"},
            ]
        },
        {
            id: "Q4",
            prompt: "What is the longest word assigned a probability by the Markov chain?",
            check: ({input}) => input === "Cartons"
            
        },
        {
        id: "Q5",
            prompt: "How do you calculate the probability of a sequence in the Markov chain?",
            check: ()=> false,
            correctChoice: "multiply",
            choices: [
                {id: "MarkovLink", label: "You add each transition's probability in the sequence together"},
                {id: "length", label: "It is just what the final transition edge's probability is"},
                {id: "multiply", label: "You multiply the probabilities of each transition in the sequence"},
            ]
        },
        {
            id: "Q6",
            prompt: "Compare with your friends - what is the highest and lowest probability sequences you can find?",
            check: ()=> true,
        },
    ];

    // function evaluate(sequence: string): Evaluation{
    //     console.log("Evaluating sequence:", sequence, "length:", sequence.length);
    //     const fsmInput = sequence?.trim().split("");
    //     const markovInput = sequence?.trim().split("");

    //     const accepted = ComputeValidityFSM(fsmTransitions, fsmInput, acceptingStates);
    //     const probability = ComputeProbabilityMarkov(markovTransitions, markovInput);

    //     return{
    //         accepted,
    //         probability,
    //         sequence,
    //         fsmText: accepted ? "FSM: Accepted" : "FSM: Rejected",
    //         markovText: `P(${markovInput}) = ${probability.toFixed(5)}`
    //     };
    // }
function evaluate(sequenceInput: string): Evaluation {
    const raw = sequenceInput.trim();
    const charTokens = raw.split("");                          // for FSM (case-sensitive)
    const markovTokens = raw.toUpperCase().split("");          // for Markov (uppercase states)

    const accepted = ComputeSimpleValidityFSM(fsmTransitions, charTokens, acceptingStates);
    const probability = computePrefixProbabilityMarkov(markovTransitions, markovTokens);

    return {
        accepted,
        probability,
        sequence: sequenceInput,
        fsmText:    accepted ? "FSM:   Accepted" : "FSM:   Rejected",
        markovText: `P = ${probability.toFixed(5)}`,
    };
}
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
        description="Below, we've used a dataset of the letters 'C,a,r,t,o,n,s'. The accepting states are a handful of anagrams you can make from these letters, starting with the letter C. The Markov chain shows us the likeliness of transitioning between letters based on these words in the dictionary."
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

      <Accordion title="Accepting States" initiallyOpen={true}>
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
                {inputSequence}
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
              {showDirectionalColours}
              {showEdgeLabels}
              {weightedThickness}
              {inputSequence}
            />
          </div>
        </div>
    </div>  
    <div>
        <!-- <p>Can you find a word rejected by the FSM that the Markov Chain still assigns a probability to? </p>
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
            {markovResult} -->
        <ChallengePanel {questions} {evaluate} on:sequenceChange={(e) => { inputSequence = e.detail; }}/>
    </div>
</main>


<style>
    .page{
        min-height: 100dvh;
        height: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 1rem;
        background: #fafafa;  
        box-sizing: border-box;
        /* overflow: hidden; */
        /* overflow-y:auto; */
    }
    .graphRow{
        flex: 1 1 0;
        min-height: 60dvh;
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
