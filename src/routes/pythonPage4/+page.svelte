<script lang="ts">
    import Accordion from "$lib/components/Accordion.svelte";
    // import FsmViewer from "$lib/components/fsmView.svelte";
    import FsmHierarchicalViewer from "$lib/components/fsmHierarchicalViewer.svelte";
    import { makeLetFSM } from '$lib/data/letFSM';
    import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";
    import { makePythonAssignmentMarkov } from "$lib/data/pythonMarkov";
    import pythonAssignments from "$lib/data/python_assignments.txt?raw"; 
    
    const { fsmStates, fsmTransitions, acceptingStates, startingStates, warps, subgraphs } = makeLetFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makePythonAssignmentMarkov();

    let weighted = false;
    let showPanel = true;

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
</script>

<main>
  <Accordion title="Python Assignment Dataset" initiallyOpen={false}>
      {#each assignmentDataset as stmt}
          <!-- <div class="stmt" on:click={() => selectStatement(stmt)}>
              {stmt}
          </div> -->
          <button
            class="stmt {selectedStatement === stmt ? 'active' : ''}"
            on:click={() => selectStatement(stmt)}
            type="button">
            {stmt}
        </button>
      {/each}
  </Accordion> 
  <Accordion title="Accepting States" initiallyOpen={true}>
        {#each acceptingStates as word (word)}
            <span class="word">{word}</span>
        {/each}
    </Accordion>
    <div style="display: flex; gap: 4px; flex-direction:row;">
        <div style="width:60%; height:600px;">
            <FsmHierarchicalViewer 
              {fsmStates}
              {fsmTransitions}
              {acceptingStates}
              {startingStates}
              {subgraphs}
              {warps}
              {weighted}
            />
        </div>
        <div style="width:40%; height:600px;">
            <MarkovView 
            {markovStates}
            {markovTransitions}
            {mStartingStates}
            {endState}
            filterPairs={markovFilter}

            />
        </div>
    </div>  
</main>


<style>
  main {
    padding: 1rem;
    background: #fafafa;
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
</style>
