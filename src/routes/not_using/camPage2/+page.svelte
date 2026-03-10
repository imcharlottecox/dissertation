<script lang="ts">
    import Accordion from "$lib/components/Accordion.svelte";
    // import FsmViewer from "$lib/components/depreciated/fsmView.svelte";
    // import MarkovView from "$lib/components/depreciated/markovView.svelte";
    import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";

    import { makeCamFSM } from '$lib/data/cam_letters/camFSM';
    import { makeCamMarkov } from "$lib/data/cam_letters/camLetterMarkov";


    const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeCamFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makeCamMarkov();

    let weighted = false;
    let showDepth = false;
    let showPanel = true;

    $:fsmRenderKey = [
      fsmStates.length,
      fsmTransitions.length,
      acceptingStates.join('|'),
      startingStates.join('|'),
    ].join('::');
</script>

<main>
    <Accordion title="Accepting States" initiallyOpen={true}>
        {#each acceptingStates as word (word)}
            <span class="word">{word}</span>
        {/each}
    </Accordion>
    <div class="page" style="display: flex; gap: 4px; flex-direction:row;">
        <div class="pane" style="width:60%;;">
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
        <div class="pane"style="width:40%;;">
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
    border: 1px solid #f3d421;
    border-radius: 1px;
    padding: 4px 4px;
    font-size: 12px;
  }
      .page{
        min-height: 95dvh;
        height: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 1rem;
        background: #fafafa;  
        box-sizing: border-box;
        /* overflow: hidden; */
        overflow-y:auto;
    }

        .pane{
        display: flex;
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        flex-direction: column;
    }
</style>
