<script lang="ts">
    import Accordion from "$lib/components/Accordion.svelte";
    // import FsmViewer from "$lib/components/fsmView.svelte";
    import FsmHierarchicalViewer from "$lib/components/fsmHierarchicalViewer.svelte";
    import { makeLetFSM } from '$lib/data/letFSM';


    const { fsmStates, fsmTransitions, acceptingStates, startingStates, warps, subgraphs } = makeLetFSM();

    let weighted = false;
    let showPanel = true;
</script>

<main>
    <Accordion title="Accepting States" initiallyOpen={true}>
        {#each acceptingStates as word (word)}
            <span class="word">{word}</span>
        {/each}
    </Accordion>
    <div style="display: flex; gap: 4px; flex-direction:row;">
        <div style="width:100%; height:600px;">
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
</style>
