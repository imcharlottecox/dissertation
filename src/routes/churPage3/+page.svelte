<script lang="ts">
    import FsmViewer from "$lib/components/fsmView.svelte";
    import MarkovView from "$lib/components/markovView.svelte";
    import { makeChurchillFSM } from '$lib/data/churchillFSM';
    import { makeChurchillMarkov } from "$lib/data/churchillMarkov";
    
    const corpus = " 'We shall fight on the beaches we shall fight on the landing grounds we shall fight in the fields and in the streets we shall fight in the hills we shall never surrender' ";

    const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeChurchillFSM();
    const { markovStates, markovTransitions, mStartingStates, endState } = makeChurchillMarkov();
    let weighted = true;

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
            <FsmViewer 
            {fsmStates}
            {fsmTransitions}
            {acceptingStates}
            {startingStates}
            {weighted}
            />
        </div>
        <div style="width:50%; height:600px;">
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
</style>
