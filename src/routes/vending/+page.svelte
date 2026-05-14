<script lang="ts">
    import Accordion from "$lib/components/Accordion.svelte";
    // import FsmViewer from "$lib/components/FSMView.svelte";
    import type { fTransition} from "$lib/graph/graphTypes";
    import FsmHierarchicalViewer from "$lib/components/FSM/fsmViewer.svelte";
    // import FsmHierarchicalViewer from "$lib/benchmarking/fsmViewerBenchmarking.svelte";//TODO make button change work on editing not just benchmark
    import MarkovView from "$lib/components/MC/markovViewer.svelte";

	import { makeVending5pFSM } from '../../data/vending/vending5pFSM';
    import { makeVending40pFSM } from '../../data/vending/vending40pFSM';
    import { makeVending40pMarkov } from "../../data/vending/vending40pMarkov";
    // import pythonAssignments from "../../data/python_assignments.txt?raw"; 
    import PageIntro from "$lib/components/pageIntro.svelte";
    import { onMount } from "svelte";
    import { logEvent } from "$lib/supabase/logging";
    const { markovStates, markovTransitions, mStartingStates, endState } = makeVending40pMarkov();
    // const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeVending40pFSM();
    let weighted = false;
    let showPanel = true;
    let markovFilter: [string, string][] = [];
    let showDirectionalColours = false;
    let showEdgeLabels = true;
    let weightedThickness = false;
    let showDepthBox = false;
    let include5p = false;
    let showMarkov = false;
    const PAGE = "Vending";
    let fsmStates: string[] = [];
    let fsmTransitions: fTransition[] = [];
    let acceptingStates: string[] = [];
    let startingStates: string[] = [];
    
    onMount(() => {
    	logEvent('page_load', { page: PAGE });
    });
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
		description="Finite State Machines and Markov chains don't just have to be used for language; they can model any scenario. For example, a businessman has a vending machine that only accepts 10p and 20p coins. All of his prices are 30p. He wants to understand how the vending machine accepts coins, and whether he should introduce more allowed coins to potentially increase his prices. Do you notice how much more complicated the Finite State Machine gets from just one small change when you add 5p?"
  />
  <div class="topControls" style="display: flex; gap: 4px; flex-direction:row;">
      	<button
			type="button"
			class="toggle"
			on:click={() => { showMarkov = !showMarkov; logEvent('checkbox_toggle', { page: PAGE, name: 'showMarkov', value: showMarkov }); }}>
			{showMarkov ? 'Hide the Markov Chain' : 'What would a Markov Chain look like?'}
      	</button>
  </div>
 
  <div class="graphRow">
    {#if !showMarkov}
          	<div class="fsmPane" style="width:60%;">
				<div class="paneHeader">
				<span class="paneTitle">Finite State Machine</span>
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
					{showDepthBox}        
					renderKey = {fsmRenderKey}

					/>
				</div>
          	</div>
    {:else}
        <div class="graphRow">
			<div class="fsmPane" style="width:60%;">
				<div class="paneHeader">
				<span class="paneTitle">Finite State Machine</span>
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
						{showDepthBox}        
						renderKey = {fsmRenderKey}

					/>
				</div>
			</div>
        <div class="markovPane" style="width:40%;">
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
	}
    .graphRow{
        flex: 1 1 auto;
        min-height: 80dvh;
        display: flex;
        gap: 8px;
    }

</style>



