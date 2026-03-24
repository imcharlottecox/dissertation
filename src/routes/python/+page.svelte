<script lang="ts">
    import Accordion from "$lib/components/Accordion.svelte";
    // import FsmViewer from "$lib/components/fsmView.svelte";
    import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    import { makeLetFSM } from '$lib/data/python_assignments/letFSM2';
    import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";
    // import MarkovView from "$lib/components/HM.svelte";

    // import { makePythonAssignmentMarkov } from "$lib/data/python_assignments/pythonMarkov";
    // import pythonAssignments from "$lib/data/python_assignments/python_assignments.txt?raw"; 
    import PageIntro from "$lib/components/pageIntro.svelte";
    import pythonAssignments from "$lib/data/python_assignments/real_dataset/real_python_assignments.txt?raw"; 
    import { makePythonAssignmentMarkov } from "$lib/data/python_assignments/real_dataset/real_pythonMarkov";
    import { computeMarkovCompletion } from "$lib/components/compute/computeCompletePredictedMarkov";
    import { ComputeValidityFSM } from '$lib/components/compute/computeValidityFSM';
    import { ComputeProbabilityMarkov } from '$lib/components/compute/computeProbabilityMarkov';
    import ChallengePanel from "$lib/components/compute/computeBox.svelte"
    import type { TaskQuestion, Evaluation } from "$lib/components/compute/computeBox.svelte";
    const { fsmStates, fsmTransitions, acceptingStates, startingStates, warps, subgraphs } = makeLetFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makePythonAssignmentMarkov();

    let weighted = false;
    let showPanel = true;
    let showDirectionalColours = true;
    let showEdgeLabels = false;
    let weightedThickness = true;
    let inputSequence = "";
    let fullScreenPane: 'fsm' | 'markov' | null = null;
    const assignmentDataset: string[] =
        pythonAssignments.split("\n").map(s => s.trim()).filter(Boolean);

    let markovFilter: [string,string][] = [];
    let selectedStatement = "";
    
    function extractCharacterPairs(statement: string): [string,string][] {
        const chars = Array.from(statement); 
        const pairs: [string,string][] = [];
        if (chars.length > 0) {
            pairs.push(["START", chars[0]]);
        }
        for (let i = 0; i < chars.length - 1; i++) {
            const a = chars[i];
            const b = chars[i+1];
            pairs.push([a, b]);
        }
        pairs.push([chars[chars.length - 1], "$"]);

        return pairs;
    }

    function selectStatement(stmt: string) {
        if (selectedStatement === stmt) {
            selectedStatement = "";
            markovFilter = [];
            return;
        }
        selectedStatement = stmt;
        markovFilter = extractCharacterPairs(stmt);
    }

   
    function evaluate(sequenceInput: string): Evaluation {
        const typedTokens = sequenceInput.split("");

        const completion = computeMarkovCompletion(
            typedTokens,
            markovStates,
            markovTransitions,
            endState,
        );

        const best = completion.best;

        const fsmInput = [...typedTokens, "\n"];
        const accepted = ComputeValidityFSM(
            fsmTransitions,
            fsmInput,
            acceptingStates,
            subgraphs,
            warps,
        );

        const predictedStr = best.predictedTokens.join("");
        const markovText = best.terminatedNaturally
            ? `Predicts: ${sequenceInput}[${predictedStr}]`
            : `Predicts: ${sequenceInput}[${predictedStr}] (no clean end)`;

        const fsmText = accepted ? "FSM: Accepted" : "FSM: Rejected";

        const typeProbability = ComputeProbabilityMarkov(markovTransitions, typedTokens);
        return {
            accepted,
            probability:       typeProbability,
            prefixProbability: completion.prefixProbability,
            confidenceLabel:   completion.confidenceLabel,
            fsmText,
            markovText,
            typedTokens,
            predictedTokens:   best.predictedTokens,
            allBeams:          completion.beams.map(b => ({
                predictedTokens:    b.predictedTokens,
                totalProbability:   b.totalProbability,
                terminatedNaturally: b.terminatedNaturally,
            })),
        };
    }
    const questions: TaskQuestion[] = [
        {
            id: "q1",
            prompt: "Type any Python variable assignment you want. Is the sequence that the Markov chain predicted what you wanted to type?",
            check: ({accepted}) => accepted,
        }
    ];


    $: fsmRenderKey = [
        fsmStates.length,
        fsmTransitions.length,
        acceptingStates.join('|'),
        startingStates.join('|'),
    ].join('::');

</script>

<main class="page">
    <PageIntro 
        title="Python Variable Assignments"
        description="Python has rules about what 'is' valid syntax. How does your computer know what these are? Below, we look at a FSM which accpets vairables assigned to Boolean, String, and Number values (including expressions). The top layer is abstracted to be easily understood but, as you zoom in, you will find more accurate letter-level string acceptance criteria. The markov chain looks at the transitions between letters over a mass of variable assignments in the dataset, so we can analyse what patterns are more likely to occur in writing assignments!"
     />
    <Accordion title="Python Assignments Dataset" initiallyOpen={false}>
        {#each assignmentDataset as stmt}
            <button
                class="lyricLine"
                class:active={selectedStatement === stmt ? 'active' : ''}
                on:click={() => selectStatement(stmt)}
                type="button">
                {stmt}
          </button>
        {/each}
    </Accordion> 
    <!-- <Accordion title="Accepting States" initiallyOpen={false}>
        {#each acceptingStates as word (word)}
            <span class="word">{word}</span>
        {/each}
    </Accordion> -->
    <div class="graphRow">
        <div class="fsmPane" class:hidden={fullScreenPane === 'markov'} style="width: {fullScreenPane === 'fsm' ? '100%' : '60%'};">
            <div class="paneHeader"></div>
            <div class="fsmGraph">
                <FsmHierarchicalViewer 
                    {fsmStates}
                    {fsmTransitions}
                    {acceptingStates}
                    {startingStates}
                    {subgraphs}
                    {warps}
                    {weighted}       
                    {inputSequence}       
                    renderKey = {fsmRenderKey}
                    isFullScreen={fullScreenPane === 'fsm'}
                    on:toggleFullscreen={() => fullScreenPane = fullScreenPane === 'fsm' ? null : 'fsm'}

                />
            </div>
        </div>
        <div class="markovPane" class:hidden={fullScreenPane === 'fsm'} style="width: {fullScreenPane === 'markov' ? '100%' : '40%'};">
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
                filterPairs={markovFilter}
                {showDirectionalColours}
                {showEdgeLabels}
                {weightedThickness}
                {inputSequence}
                renderKey = {fsmRenderKey}
                isFullScreen={fullScreenPane === 'markov'}
                on:toggleFullscreen={() => fullScreenPane = fullScreenPane === 'markov' ? null : 'markov'}
            />
        </div>
        </div>
    </div>  
    <div>
        <ChallengePanel {questions} {evaluate} on:sequenceChange={(e) => { inputSequence = e.detail; }}/>
    </div>
</main>


<style>
    .page{
        min-height: 100dvh;
    }
    .graphRow{
        min-height: 60dvh;
    }
    .lyricLine {
        text-align: left;
        padding: 3px 6px;
        font-size: 13px;
        font-family: 'Courier New', monospace;
        border: none;
        background: none;
        cursor: pointer;
        border-radius: 3px;
        color: #333;
        transition: background 0.1s;
    }
    .lyricLine:hover { background: #eef; }
    .lyricLine.active {
        background: #cde1ff;
        font-weight: 600;
        color: #1a4fa0;
    }
</style>

