<script lang="ts">
    import Accordion from "$lib/components/Accordion.svelte";
    // import FsmViewer from "$lib/components/fsmView.svelte";
    import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    import { makeLetFSM } from '$lib/data/python_assignments/letFSM2';
    import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";
    // import { makePythonAssignmentMarkov } from "$lib/data/python_assignments/pythonMarkov";
    // import pythonAssignments from "$lib/data/python_assignments/python_assignments.txt?raw"; 
    import PageIntro from "$lib/components/pageIntro.svelte";
    import pythonAssignments from "$lib/data/python_assignments/real_dataset/real_python_assignments.txt?raw"; 
    import { makePythonAssignmentMarkov } from "$lib/data/python_assignments/real_dataset/real_pythonMarkov";

    const { fsmStates, fsmTransitions, acceptingStates, startingStates, warps, subgraphs } = makeLetFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makePythonAssignmentMarkov();

    let weighted = false;
    let showPanel = true;
    let showDirectionalColours = true;
    let showEdgeLabels = false;
    let weightedThickness = true;

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

    $: fsmRenderKey = [
        fsmStates.length,
        fsmTransitions.length,
        acceptingStates.join('|'),
        startingStates.join('|'),
  ].join('::');
      $: console.log("fsmRenderKey", fsmRenderKey);

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
              renderKey = {fsmRenderKey}
          />
      </div>
    </div>
    </div>  
</main>


<style>
    .page{
        height: 95dvh;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 1rem;
        background: #fafafa;  
        box-sizing: border-box;
        overflow: hidden;
    }
    .graphRow{
        flex: 1 1 auto;
        min-height: 0;
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
