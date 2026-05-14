<script lang="ts">
    import Accordion from "$lib/components/Accordion.svelte";
    // import FsmViewer from "$lib/components/FSMView.svelte";
    import FsmHierarchicalViewer from "$lib/components/FSM/fsmViewer.svelte";
    import { makeLetFSM } from '../../data/python_assignments/letFSM';
    // import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";
    import MarkovView from "$lib/components/MC/markovViewer.svelte";

    // import { makePythonAssignmentMarkov } from "../../data/python_assignments/pythonMarkov";
    // import pythonAssignments from "../../data/python_assignments/python_assignments.txt?raw"; 
    import PageIntro from "$lib/components/pageIntro.svelte";
    import pythonAssignments from "../../data/python_assignments/real_dataset/real_python_assignments.txt?raw"; 
    import { makePythonAssignmentMarkov } from "../../data/python_assignments/real_dataset/real_pythonMarkov";
    // import { ComputeValidityFSM } from '$lib/components/compute/computeAcceptance';
    import { computeMarkovPredicted } from "$lib/components/compute/computeCompletePredictedMarkov";
    import { computeLetValidity } from "../../data/python_assignments/letFSMCompute";
    import { ComputeProbabilityMarkov } from "$lib/components/compute/computeProbability";
    import ChallengePanel from "$lib/components/compute/computeBox.svelte"
    import type { Question, Evaluation } from "$lib/components/compute/computeBox.svelte";
    import { onMount } from "svelte";
    import { logEvent, seqLogger } from "$lib/supabase/logging";

    const { fsmStates, fsmTransitions, acceptingStates, startingStates, warps, subgraphs } = makeLetFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makePythonAssignmentMarkov();

    let weighted = false;
    let showPanel = true;
    let showDirectionalColours = true;
    let showEdgeLabels = false;
    let weightedThickness = true;
    let inputSequence = "";
    let fullScreenPane: 'fsm' | 'markov' | null = null;
    const PAGE = "Python";

    const assignmentDataset: string[] = pythonAssignments.split("\n").map(s => s.trim()).filter(Boolean);

    let markovFilter: [string,string][] = [];
    let selectedStatement = "";
    
    const sequenceLogger = seqLogger(PAGE);

    onMount(() => {
        logEvent('page_load', { page: PAGE });
    });
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
        logEvent('dataset_statement_select', { page: PAGE, statement: stmt });

    }

   
    function evaluate(sequenceInput: string):Evaluation{
        const typedTokens = sequenceInput.split("");
        const predicted = computeMarkovPredicted(typedTokens, markovStates, markovTransitions, endState);
        const best = predicted.best;
        const fsmInput = [...typedTokens, "\n"];
        const accepted = computeLetValidity(fsmInput);
        const predictedSeq = best.predictedTokens.join("");
        const markovText = best.terminatedNaturally ? `Predicts: ${sequenceInput}[${predictedSeq}]` : `Predicts: ${sequenceInput}[${predictedSeq}] (no clean end)`;

        const fsmText = accepted ? "FSM: Accepted" : "FSM: Rejected";

        const typedProbability = ComputeProbabilityMarkov(markovTransitions, typedTokens);

        sequenceLogger(sequenceInput, {accepted, probability: typedProbability.probability, questionId: "q1"});

        return { accepted, 
            probability: typedProbability.probability,
            typedProbability: predicted.typedProbability,
            confidenceLabel: predicted.confidenceLabel,
            fsmText, 
            markovText,
            typedTokens,
            predictedTokens: best.predictedTokens,
            allBeams: predicted.beams.map(b => ({
                predictedTokens: b.predictedTokens,
                predictedSeqProbability: b.predictedSeqProbability,
                terminatedNaturally: b.terminatedNaturally,
            })),
            probabilityBreakdown: typedProbability.steps,

        };

    }
    const questions: Question[] = [
        {
            id: "q0",
            question: 'Type a simple variable assignment, like x = 1 or name = "me". Is it accepted by the FSM? What does the Markov chain predict will come next?',
            check: ({ accepted }) => accepted,
        },
        {
            id: "q1",
            question: "Try typing only the start of an assignment, like x = or total=. What kind of ending does the predictor suggest? Is it accepted by the FSM?",
            check: ({ input }) => input.includes("="),
            hint: "The FSM should reject your statement because we made the rules to accept only valid Python syntax."
        },
        {
            id: "q11",
            question: "Open the Python Assignments Dataset and copy an assignment exactly. Do you notice whether this has a higher or lower probability than some other sequences you've tried out?",
            check: ({ input }) => input.includes("="),
            hint: "It should be higher! This is because our Markov chain was trained on this data and learned that this is a pattern it should recognsise! Does this remind you of how ChatGPT might work?"
        },
        {
            id: "q2",
            question: "Can you find an input that the predictor completes in a sensible way, even before you've finished typing it?",
            check: ()=> true,
            hint: "Often, the Markov chain might produce something silly. The dataset is trained on 1000 real Python statements, which is not very many in reality. This means that even if a statement seems common to you, if it's not in the dataset then the Markov chain won't recognise the pattern and will assign it a low probability."
        },
        {
            id: "q3",
            question: "Can you type something that is rejected by the FSM, but still gets a non-zero probability from the Markov chain?",
            check: ({ accepted, probability }) => !accepted && probability > 0,
        },
        {
            id: "q5",
            question: "Try two different variable names at the start of an assignment. Does the predictor seem to prefer some names or patterns over others?",
            check: () => true,
            hint: "Try x = 0 versus c = 0. 'c = 0' is in the training dataset 'Python Assignments Dataset', so the Markov chain has seen it before and assigns it a higher probability!"
        },
        {
            id: "q6",
            question: "What happens if you type a capital letter, a space, or unusual punctuation? How do the FSM and Markov chain respond differently?",
            check: () => true,
        },
        {
            id: "q7",
            question: "Can you make the predictor suggest something you did NOT intend to type? Why do you think it made that guess?",
            check: () => true,
        },
        {
            id: "q8",
            question: "Find a case where the FSM says your input is invalid, but the predictor still seems confident about what should come next.",
            check: () => true,
        },
        {
            id: "q9",
            question: "Which model seems more like an autocomplete tool: the FSM or the Markov chain? Why?",
            check: ()=> false,
            correctChoice: "MC",
            choices: [
                {id: "FSM", question: "The Finite State Machine"},
                {id: "MC", question: "The Markov Chain"},
            ],
            hint: "The Markov chain - because it guesses what you wanted to say based on probability!"
        },
        {
            id: "q10",
            question: "Can you find an assignment statement rejected by the FSM that you think should be accepted?",
            check: ()=>true
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
        description="Python has rules about what 'is' valid syntax. How does your computer know what these are? Below, we look at a FSM which accepts vairables assigned to Boolean, String, and Number values (including expressions). The top layer is abstracted to be easily understood but, as you zoom in, you will find more accurate letter-level string acceptance criteria. The markov chain looks at the transitions between letters over a mass of variable assignments in the dataset, so we can analyse what patterns are more likely to occur in writing assignments!"
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
            <div class="paneHeader"><span class="paneTitle">Finite State Machine</span></div>
            <div class="fsmGraph">
                <FsmHierarchicalViewer 
                    {fsmStates}
                    {fsmTransitions}
                    {acceptingStates}
                    {startingStates}
                    {subgraphs}
                    {warps}
                    {inputSequence}
                    renderKey = {fsmRenderKey}
                    isFullScreen={fullScreenPane === 'fsm'}
                    on:toggleFullscreen={() => { fullScreenPane = fullScreenPane === 'fsm' ? null : 'fsm'; logEvent('fullscreen_toggle', { page: PAGE, pane: 'fsm', open: fullScreenPane === 'fsm' }); }}

                />
            </div>
        </div>
        <div class="markovPane" class:hidden={fullScreenPane === 'fsm'} style="width: {fullScreenPane === 'markov' ? '100%' : '40%'};">
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
                filterPairs={markovFilter}
                {showDirectionalColours}
                {showEdgeLabels}
                {weightedThickness}
                {inputSequence}
                renderKey = {fsmRenderKey}
                isFullScreen={fullScreenPane === 'markov'}
                on:toggleFullscreen={() => { fullScreenPane = fullScreenPane === 'markov' ? null : 'markov'; logEvent('fullscreen_toggle', { page: PAGE, pane: 'markov', open: fullScreenPane === 'markov' }); }}
            />
        </div>
        </div>
    </div>  
    <div>
        <ChallengePanel {questions} {evaluate} page={PAGE} on:sequenceChange={(e) => { inputSequence = e.detail; }}/>
    </div>
</main>


<style>
    .page{
        min-height: 100dvh;
    }
    .graphRow{
        min-height: 80dvh;
    }

    .lyricLine {
        text-align: left;
        padding: 3px 6px;
        font-size: 13px;
        font-family: 'Courier New' ;
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

