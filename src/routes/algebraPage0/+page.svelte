<script lang="ts">
    import { onMount } from 'svelte';
    import Accordion from '$lib/components/Accordion.svelte';
    import FsmViewer from "$lib/components/fsmView.svelte";
    import MarkovView from '$lib/components/markovView.svelte';
    import { makeAlgebraFSM } from '$lib/data/algebraFSM';
    import { makeAlgebraMarkov } from '$lib/data/algebraMarkov';
    import { algebraicArrayDataset } from '$lib/data/algebraicArrayDataset';
    import { getGraphDefaultsFSM } from '$lib/graph/graphDefaults';

    let graphConfig;

    onMount(() => {
        graphConfig = getGraphDefaultsFSM();
    });

    const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeAlgebraFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makeAlgebraMarkov();

    let weighted = true;
    let showPanel = true;
    let expandedPatterns: Record<string, boolean> = {};

</script>

<main>
    <Accordion title="Dataset" initiallyOpen={false}>
    {#each Object.entries(algebraicArrayDataset) as [pattern, examples]}
        <div class="pattern-block">
        <div class="pattern-title">{pattern}</div>
        <div class="expression-row">
            {#each examples.slice(0, 6) as expr}
            <span class="formula">{expr}</span>
            {/each}
  
        {#if examples.length > 6 && !expandedPatterns[pattern]}
          <button class="formula more" on:click={() => expandedPatterns[pattern] = true}>
            +{examples.length - 6} more
          </button>
        {/if}
      </div>

      {#if expandedPatterns[pattern]}
        <button class="hide-btn" on:click={() => expandedPatterns[pattern] = false}>Show Less</button>
        <div class="scroll-container">
            {#each examples.slice(6) as expr}
                <span class="formula">{expr}</span>
            {/each}
        </div>
      {/if}
    </div>
    {/each}
    </Accordion>
    <Accordion title="Accepting States" initiallyOpen={true}>
        {#each acceptingStates as word (word)}
            <span class="word">{word}</span>
        {/each}
    </Accordion>
    <div>
        <div style="width:100%; height:300px;">
            <FsmViewer 
            {fsmStates}
            {fsmTransitions}
            {acceptingStates}
            {startingStates}
            {weighted}
            />
        </div>
        <div style="width:40%; height:600px;">
            <MarkovView 
            {markovStates}
            {markovTransitions}
            {mStartingStates}
            {endState}
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
    border: 1px solid yellow;
    border-radius: 1px;
    padding: 4px 4px;
    font-size: 12px;
  }
    .formula {
    background-color: white;
    border: 1px solid lightblue;
    border-radius: 1px;
    padding: 4px 4px;
    font-size: 12px;
  }
.pattern-block {
  /* margin-bottom: 12px; */
  border: 1px solid lightgrey;
  padding: 4px;
  background-color: white;
  max-width: 300px;
}

.pattern-title {
  margin-bottom: 4px;
  font-size: 12px;
}

.expression-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.word {
  background-color: white;
  border: 1px solid #f3d421;
  border-radius: 2px;
  padding: 4px 6px;
  font-size: 12px;
  display: inline-block;
}

.formula.more {
  background-color: #e2f4fa;
  color: #555;
  font-style: italic;
}
.scroll-container {
  max-height: 120px;
  overflow-y: auto;
  border-left: 2px solid #eee;
  margin-top: 6px;
  padding-left: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.hide-btn {
  margin-top: 4px;
  margin-left: 4px;
  font-size: 12px;
  background: none;
  border: none;
  color: #007acc;
  cursor: pointer;
  text-decoration: underline;
}
</style>