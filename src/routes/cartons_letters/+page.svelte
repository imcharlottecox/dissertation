<script lang="ts">
    // import FsmViewer from "$lib/components/fsmView.svelte";
    // import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    import FsmHierarchicalViewer from "$lib/components/fsm/fsmViewer.svelte";
    // import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";
    import MarkovView from "$lib/components/MC/HM.svelte";

    import { makeCaFSM } from '$lib/data/ca_letters/caFSM';
    // import { makeCaMarkov } from "$lib/data/ca_letters/caLetterMarkov";
    import { makeCaMarkov } from "$lib/data/ca_letters/ca_markov";
    import {ComputeFlatValidityFSM} from "$lib/components/compute/computeValidityFSM";
    import { ComputeProbabilityMarkov, ComputeProbabilityMarkovDetailed } from '$lib/components/compute/computeProbabilityMarkov';
    import PageIntro from "$lib/components/pageIntro.svelte";
    const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeCaFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makeCaMarkov();
    import Accordion from "$lib/components/Accordion.svelte";
    import ChallengePanel, {type TaskQuestion, type Evaluation} from "$lib/components/compute/computeBox.svelte"
    import { onMount } from "svelte";
    import { logEvent, seqLogger } from "$lib/supabase/logging";

    let weighted = false;
    let showDirectionalColours = false;
    let showEdgeLabels =true;
    let weightedThickness = true;

    let inputSequence: string = "";
    let fsmResult: string | null = null;
    let markovResult: string | null = null;
    let fullScreenPane: 'fsm' | 'markov' | null = null;
    const PAGE = "Cartons";

    const sequenceLogger = seqLogger(PAGE);

    onMount(() => {
        logEvent('page_load', { page: PAGE });
    });



    function testinputSequence(){
        const fsmInput = inputSequence?.trim().split("");
        const markovInput = inputSequence?.trim().split("");

        const isAccepted = ComputeFlatValidityFSM(fsmTransitions, fsmInput, acceptingStates, startingStates);
        fsmResult = isAccepted ? "FSM: Accepted" : "FSM: Rejected";

        const prob = ComputeProbabilityMarkov(markovTransitions, markovInput);
        markovResult = `P(${markovInput}) = ${prob.toFixed(3)}`;
    }
    let showDepth = false;



    const questions: TaskQuestion[] = [
        {
            id: 'Q0',
            prompt: "Try typing 'Cat'. What happens?",
            check: ({input}) => input === "Cat",
            hint: "Notice how the FSM moves through the states Start-> C -> Ca -> Cat on each letter input, whereas the Markov chain just goes to the next letter input with a certain probability. HINT: pay attention at to which letters in the dataset need to be capital letters. This is important as the systems are based COMPLETELY on the dataset, which uses a capital C at the start of every word! ",
        },
        {
            id: 'Q00',
            prompt: "Try typing 'Cas'. It's rejected by the Finite State Machine and assigned a 0 probability! Why? Can you figure out where it breaks?",
            check: ({input}) => input === "Cas",
            hint: "Cas is not in our dataset - there are no transitions either model can take from 'a' to 's', so it rejected and the probability is assigned a 0!",
        },
        {
            id: "Q2",
            prompt: "Can you find a four-letter word accepted by the FSM with probability of exactly 0.12525?",
            check: ({accepted, probability, input}) => accepted && probability == 0.12525 && input.length === 4
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
            id: "Q1",
            prompt: "Can you find a word rejected by the Finite State Machine that the Markov Chain still assigns a probability to? What is the lowest probability you can find for such a word?",
            check: ({accepted, probability}) => !accepted && probability>0,
            hint: "The lowest probability I've found is 0.04163"
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
            id: "Q-concept1",
            prompt: "Which statement best describes the difference between the two models?",
            check: ()=> false,
            correctChoice: "difference",
            choices: [
                {id: "same", label: "Both models decide whether a word is correct or not"},
                {id: "difference", label: "The FSM checks if a word follows rules, while the Markov chain measures how likely it is"},
                {id: "markovOnly", label: "The Markov chain decides if a word is valid, the FSM gives probabilities"},
            ]
        },
        {
            id: "Q6",
            prompt: "Compare with your friends - what is the highest and lowest probability sequences you can find?",
            check: ()=> true,
        },
    ];

    function evaluate(sequence: string): Evaluation{
        console.log("Evaluating sequence:", sequence, "length:", sequence.length);
        const fsmInput = sequence?.trim().split("");
        const markovInput = sequence?.trim().split("");

        const accepted = ComputeFlatValidityFSM(fsmTransitions, fsmInput, acceptingStates, startingStates);
        const probability = ComputeProbabilityMarkov(markovTransitions, markovInput);
        const breakdown = ComputeProbabilityMarkovDetailed(markovTransitions, markovInput);

        const rounded_p = probability.toFixed(5);
        sequenceLogger(sequence, { accepted, probability: parseFloat(rounded_p), questionId: questions[0]?.id ?? "Q0" });

        return{
            accepted,
            probability: parseFloat(rounded_p),
            sequence,
            fsmText: accepted ? "FSM: Accepted" : "FSM: Rejected",
            markovText: `P(${markovInput}) = ${rounded_p}`,
            typedTokens: markovInput,
            probabilityBreakdown: breakdown.steps,
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
        <div class="fsmPane" class:hidden={fullScreenPane === 'markov'} style="width: {fullScreenPane === 'fsm' ? '100%' : '50%'};">
          <div class="paneHeader"><span class="paneTitle">Finite State Machine</span></div>
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
                isFullScreen={fullScreenPane === 'fsm'}
                on:toggleFullscreen={() => { fullScreenPane = fullScreenPane === 'fsm' ? null : 'fsm'; logEvent('fullscreen_toggle', { page: PAGE, pane: 'fsm', open: fullScreenPane === 'fsm' }); }}
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
        <div class="markovPane" class:hidden={fullScreenPane === 'fsm'} style="width: {fullScreenPane === 'markov' ? '100%' : '50%'};">
          <div class="paneHeader">
          <span class="paneTitle">Markov Chain</span>
            <label class="check" title="Edges are coloured black if they are directed downwards to a node, or pink if directed upwards. This helps with clarity in busy graphs!">
            <input
                type="checkbox"
                bind:checked={showDirectionalColours}
                on:change={(e) => logEvent('checkbox_toggle', { page: PAGE, name: 'showDirectionalColours', value: e.currentTarget.checked })}
              />
            Directional Colours
            </label>
            <label class="check" title="Displays edge probabilities">
              <input
                type="checkbox"
                bind:checked={showEdgeLabels}
                on:change={(e) => logEvent('checkbox_toggle', { page: PAGE, name: 'showEdgeLabels', value: e.currentTarget.checked })}
              />
            Edge Labels
            </label>
            <label class="check" title="Edge thickness corresponds to the probability of the edge">
              <input
                type="checkbox"
                bind:checked={weightedThickness}
                on:change={(e) => logEvent('checkbox_toggle', { page: PAGE, name: 'weightedThickness', value: e.currentTarget.checked })}
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
                isFullScreen={fullScreenPane === 'markov'}
                on:toggleFullscreen={() => { fullScreenPane = fullScreenPane === 'markov' ? null : 'markov'; logEvent('fullscreen_toggle', { page: PAGE, pane: 'markov', open: fullScreenPane === 'markov' }); }}
            
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
        <ChallengePanel {questions} {evaluate} page={PAGE} showPrediction={false} on:sequenceChange={(e) => { inputSequence = e.detail; }}/>
    </div>
</main>


<style>
    .page{
        min-height: 100dvh;
        overflow: hidden;
    }
    .graphRow{
        min-height: 80dvh;
    }

    .paneHeader{
        /* display: flex;
        flex: 0 0 20px;
        background: whitesmoke;
        border-bottom: 1px solid #ddd;
        gap: 12px;
        align-items: center; */
    }
   
</style>