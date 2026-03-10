<script lang="ts">
    import Accordion from "$lib/components/Accordion.svelte";
    // import FsmViewer from "$lib/components/fsmView.svelte";
    import type { fTransition} from "$lib/graph/graphTypes";
    // import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    import FsmHierarchicalViewer from "$lib/benchmarking/fsmViewerBenchmarking.svelte";//TODO make button change work on editing not just benchmark
    import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";
    import { makeVending5pFSM } from '$lib/data/vending/vending5pFSM';
    import { makeVending40pFSM } from '$lib/data/vending/vendingFSM';
    import { makeVending40pMarkov } from "$lib/data/vending/vending40pMarkov";
    // import pythonAssignments from "$lib/data/python_assignments.txt?raw"; 
    import PageIntro from "$lib/components/pageIntro.svelte";
    import Page from "../+page.svelte";
    const { markovStates, markovTransitions, mStartingStates, endState } = makeVending40pMarkov();
    // const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeVending40pFSM();

    let weighted = false;
    let showPanel = true;
    let markovFilter: [string, string][] = [];
    let showDirectionalColours = false;
    let showEdgeLabels = true;
    let weightedThickness = false;
    let showDepth = false;
    let include5p = false;
    let showMarkov = false;

    let fsmStates: string[] = [];
    let fsmTransitions: fTransition[] = [];
    let acceptingStates: string[] = [];
    let startingStates: string[] = [];
    
    $: {
         const currentFSM = include5p ? makeVending5pFSM() : makeVending40pFSM();
         ({ fsmStates, fsmTransitions, acceptingStates, startingStates } = currentFSM);
    }
    $: fsmRenderKey = [
      include5p ? 'with5p' : 'without5p',
      fsmStates.length,
      fsmTransitions.length,
      acceptingStates.join('|'),
      startingStates.join('|'),
  ].join('::');

</script>

<main class="page">

  <PageIntro 
    title="Vending Machine"
    description="A businessman has a vending machine that only accepts 10p and 20p coins. All of his prices are 30p. He wants to understand how the vending machine accepts coins, and whether he should introduce more allowed coins to potentially increase his prices."
  />
  <div class="topControls" style="display: flex; gap: 4px; flex-direction:row;">
      <button
        type="button"
        class="toggle"
        on:click={() => (showMarkov = !showMarkov)}>
          {showMarkov ? 'Hide the Markov Chain' : 'What would a Markov Chain look like?'}
      </button>
  </div>
 
  <div class="graphRow">
    {#if !showMarkov}
          <div class="fsmPane" style="width:60%;">
            <div class="paneHeader">
              <button
                type="button"
                class="toggle"
                on:click={() => (include5p = !include5p)}>
                  {include5p ? 'Look without 5ps' : 'What does adding 5ps do to the FSM?'}
              </button>
            </div>
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
    {:else}
        <div class="graphRow">
          <div class="fsmPane" style="width:60%;">
            <div class="paneHeader">
              <button
                type="button"
                class="toggle"
                on:click={() => (include5p = !include5p)}>
                  {include5p ? 'Look without 5ps' : 'What does adding 5ps do to the FSM?'}
              </button>
            </div>
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
        <div class="markovPane" style="width:40%;">
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
            />
          </div>
        </div>
    </div>  
    {/if}
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

  .topControls{
    flex: 0 0 auto;
  }



  .pane{
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    display: flex;
  }

	.toggle {
		gap: 8px;
		display: inline-flex;
		align-items: center;
		font-size: 0.85rem;
		text-decoration: none;
		color: rgb(0, 0, 0, 0.9);
		background: rgb(0, 0, 0, 0.0);
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 2px;
		padding: 0px 12px;
    height: 20px;

		transition: background 120ms ease, border-color 120ms ease;  
	}
	.toggle:hover {
		background: rgb(0, 0, 0, 0.05);
		border-color: rgba(0, 0, 0, 0.12);
	}
</style>



