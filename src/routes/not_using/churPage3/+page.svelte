<!-- <script lang="ts">
    // import FsmViewer from "$lib/components/depreciated/fsmView.svelte";
    // import MarkovView from "$lib/components/depreciated/markovView.svelte";
    import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";
    import { makeChurchillFSM } from '$lib/data/churchill/churchillFSM';
    import { makeChurchillMarkov } from "$lib/data/churchill/churchillMarkov";
    
    const corpus = " 'We shall fight on the beaches we shall fight on the landing grounds we shall fight in the fields and in the streets we shall fight in the hills we shall never surrender' ";

    const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeChurchillFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makeChurchillMarkov();
    let weighted = true;

    $: fsmRenderKey = [
      fsmStates.length,
      fsmTransitions.length,
      acceptingStates.join('|'),
      startingStates.join('|'),
    ].join('::');
</script>

<main>
    <div class="box">
        <div>
            <h3>Accepting States</h3>
            <span>{corpus}</span>
        </div>        
        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            {#each acceptingStates as word (word)}
                <span class="word"                >
                    {word}
                </span>
            {/each}
        </div>
    </div>
    <div style="display: flex; gap: 16px; flex-direction:row;">
        <div style="width:50%; height:600px;">
            <FsmHierarchicalViewer 
            {fsmStates}
            {fsmTransitions}
            {acceptingStates}
            {startingStates}

            />
        </div>
        <div style="width:50%; height:1200px;">
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
    h3{
        margin: 0 0 4px 0; 
        font-size: 16px; 
    }
    .box {
        border: 1.5px solid lightgrey;
        border-radius: 4px;
        padding: 8px;
        margin: 8px;
        background-color: snow;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }
    .word {
        background-color: white;
        border: 1px solid #f3d421;
        border-radius: 1px;
        padding: 4px 4px;
        font-size: 14px;
    }
</style> -->
<script lang="ts">
    import Accordion from "$lib/components/Accordion.svelte";
    // import FsmViewer from "$lib/components/depreciated/fsmView.svelte";
    // import MarkovView from "$lib/components/depreciated/markovView.svelte";
    import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";

    import { makeChurchillFSM } from '$lib/data/churchill/churchillFSM';
    import { makeChurchillMarkov } from "$lib/data/churchill/churchillMarkov";
    
    const corpus = " 'We shall fight on the beaches we shall fight on the landing grounds we shall fight in the fields and in the streets we shall fight in the hills we shall never surrender' ";

    const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeChurchillFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makeChurchillMarkov();
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
