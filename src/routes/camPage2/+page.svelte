<script lang="ts">
    import Accordion from "$lib/components/Accordion.svelte";
    import FsmViewer from "$lib/components/fsmView.svelte";
    import MarkovView from "$lib/components/markovView.svelte";
    import { makeCamFSM } from '$lib/data/camFSM';
    import { makeCamMarkov } from "$lib/data/camLetterMarkov";


    const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeCamFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makeCamMarkov();

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
        <div style="width:60%; height:600px;">
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
    border: 1px solid #f3d421;
    border-radius: 1px;
    padding: 4px 4px;
    font-size: 12px;
  }
</style>
