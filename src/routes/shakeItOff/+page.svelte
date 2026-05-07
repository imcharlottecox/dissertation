<script lang="ts">
	import { logEvent } from '$lib/supabase/logging';
    // import FsmViewer from "$lib/components/FSMView.svelte";
    // import FsmHierarchicalViewer from "$lib/components/FSM/fsmediting.svelte";
    import FsmHierarchicalViewer from "$lib/components/FSM/fsmViewer.svelte";
    // import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";
    import MarkovView from "$lib/components/MC/markovViewer.svelte";
    import { makeShakeItOffFSM } from '$lib/data/shakeItOff/shakeItOffFSM';
    import { makeShakeItOffMarkov } from "$lib/data/shakeItOff/shakeItOff_Markov";
    import {ComputeValidityFSM} from "$lib/components/compute/computeAcceptance";
    import { ComputeProbabilityMarkov } from "$lib/components/compute/computeProbability";
    import PageIntro from "$lib/components/pageIntro.svelte";
    import Accordion from "$lib/components/Accordion.svelte";
    import rawLyrics from "$lib/data/shakeItOff/shakeItOff.txt?raw";
    import {subgraphedBigrams} from "$lib/components/compute/markovFilterHelpers";
    import { onMount } from 'svelte';
    const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeShakeItOffFSM();
    const { markovStates, markovTransitions, mStartingStates, endState, fineChains, subgraphLines } = makeShakeItOffMarkov();
    

    let weighted = false;
    let showDirectionalColours = true;
    let showEdgeLabels =true;
    let weightedThickness = false;
    let showDepthBox = false;
    let sequence: string = "";
    let fsmResult: string | null = null;
    let markovResult: string | null = null;
    let fullScreenPane: 'fsm' | 'markov' | null = null;
    let selectedLine = "";
    let selectedsubgraph = "";
    let markovFilter: [string, string][] = [];
    let expandsubgraph = "";
    const PAGE = "ShakeItOff";

    const lyricsSgs = Object.entries(subgraphLines ?? {}).map(([id, lines]) => ({id, lines}));

    onMount(() => {
        logEvent('page_load', { page: PAGE });
    });

    function selectLine(line: string, subgraphId: string){
        if (selectedLine === line && selectedsubgraph === subgraphId){
            selectedLine = "";
            selectedsubgraph = "";
            markovFilter =[];
            expandsubgraph = "";
            return;
        }
        selectedLine = line;
        selectedsubgraph = subgraphId;
        markovFilter = subgraphedBigrams(line, subgraphId);
        expandsubgraph = subgraphId;
        logEvent('dataset_statement_select', { page: PAGE, statement: line, subgraph: subgraphId });

    }
    
    $: fsmRenderKey = [
      fsmStates.length,
      fsmTransitions.length,
      acceptingStates.join('|'),
      startingStates.join('|'),
    ].join('::');
</script>

<main class="page">
<PageIntro title="Shake It Off" description="Taylor Swift song's lyrics have been parsed into a Markov chain and FSM. As you can see, the FSM for a song is very complicated... Make the Markov chain full screen and investigate these questions! At the top level, we can see the probability of transitions between different song subgraphs, like Verse to Chorus. If you zoom in, we can see the transitions between words within this subgraph. Click on a lyric to highlight its transitions in the graph." />
<div class="introText">
    <ul>
        <li>Thinking about FSMs as a validator of a sequence, why is using a FSM not appropriate for modelling a song?</li>
        <li>What words in the song have the highest probability transitions?</li>
        <li>What do you notice about the probability of transitions between different subgraphs of the song - does this line up with what you know about music?</li>
    </ul>
    <p class="copyright">Lyrics from "Shake It Off" by Taylor Swift (2014). Used for non-commerical educational purposes under UK CPDA 1988.</p>            
</div>
    <!-- <div class="box">
        <h3>Accepting States</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            {#each acceptingStates as word (word)}
                <span class="word"                >
                    {word}
                </span>
            {/each}
            </div>
    </div> -->

    <Accordion title="Song Lyrics" initiallyOpen={false}>
        {#each lyricsSgs as subgraph}
            <div>
                <span class="subgraphLabel">[{subgraph.id}]</span>
                {#each subgraph.lines as line}
                    <button class="lyricLine" 
                        class:active={selectedLine===line && selectedsubgraph===subgraph.id}
                        type="button" 
                        on:click={() => selectLine(line, subgraph.id)}>
                        {line}
                    </button>   
                {/each}
            </div>
        {/each}
    </Accordion>

    <div class="graphRow">
        <!-- <div style="width:50%;">
            <FsmHierarchicalViewer 
            {fsmStates}
            {fsmTransitions}
            {acceptingStates}
            {startingStates}
            {weighted}
            {showDepthBox}
            renderKey = {fsmRenderKey}
            />
        </div> -->
        <div class="fsmPane" class:hidden={fullScreenPane === 'markov'} style="width: {fullScreenPane === 'fsm' ? '100%' : '50%'};">
          <div class="paneHeader"><span class="paneTitle">Finite State Machine</span></div>
          <div class="fsmGraph">
            <FsmHierarchicalViewer 
                {fsmStates}
                {fsmTransitions}
                {acceptingStates}
                {startingStates}
                {showDepthBox}        
                renderKey = {fsmRenderKey}
                isFullScreen={fullScreenPane === 'fsm'}
                on:toggleFullscreen={() => { fullScreenPane = fullScreenPane === 'fsm' ? null : 'fsm'; logEvent('fullscreen_toggle', { page: PAGE, pane: 'fsm', open: fullScreenPane === 'fsm' }); }}
              />
          </div>
        </div>
        <!-- <div style="width:50%;">
            <MarkovView 
            {markovStates}
            {markovTransitions}
            {mStartingStates}
            {endState}
            />
        </div> -->
        <div class="markovPane" class:hidden={fullScreenPane === 'fsm'} style="width: {fullScreenPane === 'markov' ? '100%' : '50%'};">
          <div class="paneHeader">
          <span class="paneTitle">Markov Chain</span>
            <label class="check" title="Edges are coloured black if they are directed downwards to a node, or pink if directed upwards. This helps with clarity in busy graphs!">
              <input
                type="checkbox"
                bind:checked={showDirectionalColours}
                on:change={(e) => logEvent('checkbox_toggle', { page: PAGE, name: 'showDirectionalColours', value: e.currentTarget.checked })}
              />
              Show Directional Colours
            </label>
            <label class="check" title="Displays edge probabilities">
              <input
                type="checkbox"
                bind:checked={showEdgeLabels}
                on:change={(e) => logEvent('checkbox_toggle', { page: PAGE, name: 'showEdgeLabels', value: e.currentTarget.checked })}
              />
              Show Edge Labels
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
                {fineChains}
                {showDirectionalColours}
                {showEdgeLabels}
                {weightedThickness}
                filterPairs={markovFilter}
                isFullScreen={fullScreenPane === 'markov'}
                on:toggleFullscreen={() => { fullScreenPane = fullScreenPane === 'markov' ? null : 'markov'; logEvent('fullscreen_toggle', { page: PAGE, pane: 'markov', open: fullScreenPane === 'markov' }); }}
            />
          </div>
        </div>
    </div>  
    <!-- <div>
        <p>Can you find a word rejected by the FSM that the Markov Chain still assigns a probability to? </p>
        <label for="sequenceInput">Input Sequence:</label>
        <input
            type = "text"
            id = "sequenceInput"
            placeholder= "Enter a sequence to test here"
            bind:value={sequence}
            on:input={testSequence}
        />
        <div>
            {fsmResult}
        </div>            
            {markovResult}

    </div> -->
</main>


<style>
    .page{
        min-height: 100dvh;
    }
    .graphRow{
        min-height: 80dvh;
    }
    .subgraphLabel {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #999;
        font-family: 'Courier New';
        padding: 2px 0;
    }
    .lyricLine {
        text-align: left;
        padding: 3px 6px;
        font-size: 13px;
        font-family: 'Courier New';
        border: none;
        background: none;
        cursor: pointer;
        border-radius: 3px;
        color: #333;
        transition: background 0.1s;
    }
    .lyricLine:hover { background: #eef; }
    .lyricLine.active {
        background: #cde1ff;
        font-weight: 600;
        color: #1a4fa0;
    }
    .copyright{
        text-align: right;
        font-size: 12px;
        padding: 0;
        margin: 0;
        align-items: flex-end;
        font-style: italic;
    }
</style>
