<script lang="ts">
    // import FsmViewer from "$lib/components/fsmView.svelte";
    // import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    import FsmHierarchicalViewer from "$lib/components/fsm/fsmediting.svelte";
    // import MarkovView from "$lib/components/markovHierarchicalViewer.svelte";
    import MarkovView from "$lib/components/HM.svelte";
    import { makeShakeItOffFSM } from '$lib/data/shakeItOff/shakeItOffFSM';
    import { makeShakeItOffMarkov } from "$lib/data/shakeItOff/shakeItOff_Markov";
    import {ComputeValidityFSM} from "$lib/components/compute/computeValidityFSM";
    import { ComputeProbabilityMarkov } from "$lib/components/compute/computeProbabilityMarkov";
    import PageIntro from "$lib/components/pageIntro.svelte";
    import Accordion from "$lib/components/Accordion.svelte";
    import rawLyrics from "$lib/data/shakeItOff/shakeItOff.txt?raw";
    import {subgraphedBigrams} from "$lib/components/compute/markovFilterHelpers";
    const { fsmStates, fsmTransitions, acceptingStates, startingStates } = makeShakeItOffFSM();
    const { markovStates, markovTransitions, mStartingStates, endState, wordChains, subgraphLines } = makeShakeItOffMarkov();
    

    let weighted = false;
    let showDirectionalColours = true;
    let showEdgeLabels =false;
    let weightedThickness = true;
    let showDepth = false;
    let sequence: string = "";
    let fsmResult: string | null = null;
    let markovResult: string | null = null;
    let fullScreenPane: 'fsm' | 'markov' | null = null;
    let selectedLine = "";
    let selectedSection = "";
    let markovFilter: [string, string][] = [];
    let expandSection = "";

    const lyricsSgs = Object.entries(subgraphLines ?? {}).map(([id, lines]) => ({id, lines}));

    function selectLine(line: string, subgraphId: string){
        if (selectedLine === line && selectedSection === subgraphId){
            selectedLine = "";
            selectedSection = "";
            markovFilter =[];
            expandSection = "";
            return;
        }
        selectedLine = line;
        selectedSection = subgraphId;
        markovFilter = subgraphedBigrams(line, subgraphId);
        expandSection = subgraphId;

    }
    $: fsmRenderKey = [
      fsmStates.length,
      fsmTransitions.length,
      acceptingStates.join('|'),
      startingStates.join('|'),
    ].join('::');
</script>

<main class="page">
    <PageIntro 
        title="Shake It Off"
        description="This Taylor Swift song's lyrics have beeen parsed into a Markov chain. At the top level, we can see the probability of transitions between different song sections, like Verse to Chorus. If you zoom in, we can see the transitions between words within this section. Click on a lyric to highlight its transitions in the graph."
    />
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
        {#each lyricsSgs as section}
            <div class="sectionBlock">
                <span class="sectionLabel">[{section.id}]</span>
                {#each section.lines as line}
                    <button class="lyricLine" 
                        class:active={selectedLine===line && selectedSection===section.id}
                        type="button" 
                        on:click={() => selectLine(line, section.id)}>
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
            {showDepth}
            renderKey = {fsmRenderKey}
            />
        </div> -->
        <div class="fsmPane" class:hidden={fullScreenPane === 'markov'} style="width: {fullScreenPane === 'fsm' ? '100%' : '50%'};">
          <div class="paneHeader"></div>
          <div class="fsmGraph">
            <FsmHierarchicalViewer 
                {fsmStates}
                {fsmTransitions}
                {acceptingStates}
                {startingStates}
                {weighted}      
                {showDepth}        
                renderKey = {fsmRenderKey}
                isFullScreen={fullScreenPane === 'fsm'}
                on:toggleFullscreen={() => fullScreenPane = fullScreenPane === 'fsm' ? null : 'fsm'}
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
                {wordChains}
                {showDirectionalColours}
                {showEdgeLabels}
                {weightedThickness}
                filterPairs={markovFilter}
                expandSectionId={expandSection}
                isFullScreen={fullScreenPane === 'markov'}
                on:toggleFullscreen={() => fullScreenPane = fullScreenPane === 'markov' ? null : 'markov'}
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
        min-height: 95dvh;
        overflow-y:auto;
    }
    .graphRow{
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        gap: 8px;
    }
    .sectionLabel {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #999;
        font-family: 'Courier New', monospace;
        padding: 2px 0;
    }
    .lyricLine {
        text-align: left;
        padding: 3px 6px;
        font-size: 13px;
        font-family: 'Courier New', monospace;
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
</style>
