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

    // function evaluate(sequenceInput: string):Evaluation{
    //     const inputTokens = sequenceInput.split("");
    //     const completionPrediction = computeMarkovCompletion(inputTokens, markovStates, markovTransitions, mStartingStates, endState);

    //     const probability = ComputeProbabilityMarkov(markovTransitions, inputTokens);
    //     const fsmInput = completionPrediction.fullSequence;
    //     const accepted = ComputeValidityFSM(fsmTransitions, fsmInput, acceptingStates);
    //     const predictedStr = completionPrediction.predictedTokens.join("");
    //     const markovText = completionPrediction.terminatedNaturally ? `Markov predicts "${sequenceInput}[${predictedStr}]"` :` Markov predicts "${sequenceInput}[${predictedStr}]" - incomplete seqeunce`;
    //     const fsmText = accepted ? "FSM accepted the predicted seqeunce" : "FSM rejected the predicted seqeunce";
    //     return {accepted, probability, fsmText, markovText};
    // }

    // ---------------------------------------------------------------------------
    // evaluate — passed to ComputeBox
    // Auto-appends \n so the FSM can reach its accepting state via "new line"
    // transitions without the student needing to press Enter.
    // ---------------------------------------------------------------------------

    // function evaluate(sequenceInput: string): Evaluation {
    //     // Split into individual characters (this dataset is char-level)
    //     const typedTokens = sequenceInput.split("");

    //     // Auto-append \n so "new line" / "newline" transitions can fire
    //     const tokensForFSM = [...typedTokens, "\n"];

    //     // 1. Markov: greedily complete from the typed prefix
    //     //    Pass typedTokens (without \n) — the Markov model doesn't know about \n
    //     const completion = computeMarkovCompletion(
    //         typedTokens,
    //         markovStates,
    //         markovTransitions,
    //         endState,
    //     );

    //     // Build the full sequence the FSM will validate:
    //     // typed + Markov-predicted + \n
    //     const fsmInput = [...typedTokens, ...completion.predictedTokens, "\n"];

    //     // 2. FSM: validate the completed + newline-terminated sequence
    //     const accepted = ComputeValidityFSM(
    //         fsmTransitions,
    //         fsmInput,
    //         acceptingStates,
    //         subgraphs,
    //         warps,
    //     );

    //     // 3. Markov probability of the typed prefix alone
    //     const probability = ComputeProbabilityMarkov(markovTransitions, typedTokens);

    //     // 4. Human-readable result strings
    //     const predictedStr = completion.predictedTokens.join("");
    //     const markovText = completion.terminatedNaturally
    //         ? `Predicts: "${sequenceInput}[${predictedStr}]"`
    //         : `Predicts: "${sequenceInput}[${predictedStr}]" (no clean end)`;

    //     const fsmText = accepted
    //         ? `FSM:  Valid`
    //         : `FSM:   Invalid`;

    //     return {
    //         accepted,
    //         probability,
    //         fsmText,
    //         markovText,
    //         typedTokens,
    //         predictedTokens: completion.predictedTokens,
    //     };
    // }

    // ---------------------------------------------------------------------------
    // evaluate — passed to ComputeBox
    // Auto-appends \n so the FSM can reach its accepting state via "new line"
    // transitions without the student needing to press Enter.
    // ---------------------------------------------------------------------------

    function evaluate(sequenceInput: string): Evaluation {
        // Split into individual characters (this dataset is char-level)
        const typedTokens = sequenceInput.split("");

        // 1. Beam-search Markov completion from the typed prefix
        const completion = computeMarkovCompletion(
            typedTokens,
            markovStates,
            markovTransitions,
            endState,
        );

        const best = completion.best;

        // 2. FSM: validate typed + best-beam prediction + \n
        // const fsmInput = [...typedTokens, ...best.predictedTokens, "\n"];
        const fsmInput = [...typedTokens, "\n"];
        const accepted = ComputeValidityFSM(
            fsmTransitions,
            fsmInput,
            acceptingStates,
            subgraphs,
            warps,
        );

        // 3. Human-readable result strings
        const predictedStr = best.predictedTokens.join("");
        const markovText = best.terminatedNaturally
            ? `Predicts: "${sequenceInput}[${predictedStr}]"`
            : `Predicts: "${sequenceInput}[${predictedStr}]" (no clean end)`;

        const fsmText = accepted ? `FSM:  Valid` : `FSM:   Invalid`;

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
            prompt: "Type",
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
                class="stmt {selectedStatement === stmt ? 'active' : ''}"
                on:click={() => selectStatement(stmt)}
                type="button">
                {stmt}
          </button>
        {/each}
    </Accordion> 
    <Accordion title="Accepting States" initiallyOpen={false}>
        {#each acceptingStates as word (word)}
            <span class="word">{word}</span>
        {/each}
    </Accordion>
    <div class="graphRow">
        <div class="fsmPane" style="width:60%;">
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

                />
            </div>
        </div>
        <div class="markovPane"style="width:40%;">
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


    .word {
        background-color: white;
        border: 1px solid #f3d421;
        border-radius: 1px;
        padding: 4px 4px;
        font-size: 12px;
    }
    .stmt {
        padding: 4px 6px;
        cursor: pointer;
        border-radius: 4px;
        margin-bottom: 2px;
    }
    .stmt:hover {
          background: #eef;
    }
    .stmt.active {
        background: #cde1ff; 
        border: 1px solid #6aa0ff;
        font-weight: 600;
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
</style>
