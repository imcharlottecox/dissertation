<script lang="ts">
    import MarkovView from "$lib/components/HM.svelte";
    import PageIntro from "$lib/components/pageIntro.svelte";
    import Accordion from "$lib/components/Accordion.svelte";
    import ChallengePanel, {type TaskQuestion, type Evaluation} from "$lib/components/compute/computeBox.svelte";
    import { ComputeProbabilityMarkov } from "$lib/components/compute/computeProbabilityMarkov";
    import {getTedTalkList, getDefaultTedTalk, getTedTalkByTitle} from "$lib/data/interactive/makeTedMarkov";
	import { wordBigrams } from '$lib/components/compute/markovFilterHelpers';


    const talkList = getTedTalkList();
    let selectedTitle = talkList[0]?.talk__name ?? "";
    let selectedSentence: string = "";
    let markovFilter: [string, string][] = [];
    let showDirectionalColours = true;
    let showEdgeLabels =false;
    let weightedThickness = true;
    let fullscreenPane: "markov"|null = null;
    let inputSequence = "";

    $: selectedTalk = getTedTalkByTitle(selectedTitle)?? getDefaultTedTalk();
    $: markovStates = selectedTalk.markovStates;
    $: markovTransitions = selectedTalk.markovTransitions;
    $: mStartingStates = selectedTalk.mStartingStates;
    $: endState = selectedTalk.endState;
    $: renderKey = selectedTitle;
    $: transcriptSentences = parseSentences(selectedTalk);
    $: if (selectedTitle){
        selectedSentence= "";
        markovFilter = [];
    }

    function parseSentences(talk: typeof selectedTalk): string[]{
        const tokens = talk.tokens ?? [];
        if (tokens.length === 0) return [];
        const SENTENCE_LENGTH = 12;
        const sentences: string[] = [];
        for (let i=0; i<tokens.length; i+=SENTENCE_LENGTH){
            const chunk = tokens.slice(i, i+SENTENCE_LENGTH).join(" ");
            if (chunk.trim()) sentences.push(chunk);
        }
        return sentences;
    }

    function selectSentence(sentence: string){
        if (selectedSentence === sentence){
            selectedSentence = "";
            markovFilter = [];
            return;
        }
        selectedSentence = sentence;
        markovFilter = wordBigrams(sentence);
    }

    function formatTime(seconds: number){
        const m = Math.floor(seconds/60);
        const s = seconds % 60;
        return `${m}m ${s.toString().padStart(2, "0")}s`;
    }


    function evaluate(sequence: string): Evaluation{
        const markovInput = sequence?.trim().split(/\s+/).filter(Boolean);
        const probability = ComputeProbabilityMarkov(markovTransitions, markovInput);
        const rounded_p = probability.toFixed(4);
        return{
            probability: parseFloat(rounded_p),
            sequence,
            markovText: `P(${markovInput}) = ${rounded_p}`
        };
    }
   </script>


<main class="page">
    <PageIntro 
        title="TED Talks Markov Explorer"
        description="Here is a list of 50 TED talks. Each has its own Markov chain built from the speaker's talk. Select a talk and explore the Markov chain- can you notice any interesting patterns? Any words with a transition probability = 1, such that they only occur together- why could that be? What about common words that appear in the introduction between talks? Do any different patterns occur between longer and shorter talks? Investigate, and you tell me!"
    />
   <div class="selectorRow">
        <label class="selectorLabel" for="talkSelect">
            Choose a talk!
        </label>
        <select id="talkSelect" bind:value={selectedTitle}>
            {#each talkList as talk}
                <option value={talk.talk__name}>
                    {talk.talk__name} ({formatTime(talk.duration)})
                </option>
            {/each}
        </select>
        <span class="meta">
            {selectedTalk.markovStates.length} unique words,
            {selectedTalk.markovTransitions.length} transitions
        </span>
   </div>

    <Accordion title="Talk Transcript" initiallyOpen={false}>
        {#each transcriptSentences as sentence}
            <button class="lyricLine" 
                class:active={selectedSentence===sentence}
                type="button" 
                on:click={() => selectSentence(sentence)}>
                {sentence}
            </button>   
        {/each}

    </Accordion>

    <div class="graphRow">
        <div class="markovPane" class:hidden={fullscreenPane !== null && fullscreenPane!== "markov"}>
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
            {#if selectedSentence}
                <span class="selectionHint">
                    <em>{selectedSentence}</em>
                    <button class="clearBtn" on:click={() => selectSentence(selectedSentence)}>x</button>
                </span>
            {/if}

          </div>
          <div class="markovGraph">
            <MarkovView 
                {markovStates}
                {markovTransitions}
                {mStartingStates}
                {endState}
                {showDirectionalColours}
                {showEdgeLabels}
                {weightedThickness}
                {inputSequence}
                {renderKey}
                filterPairs={markovFilter}

                isFullScreen={fullscreenPane === 'markov'}
                on:toggleFullscreen={() => fullscreenPane = fullscreenPane === 'markov' ? null : 'markov'}
            />
          </div>
        </div>
    </div>  
</main>


<style>
    .page{
        height: auto;
        min-height: 1100px;
        overflow-y:auto;
    }
    .graphRow{
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        gap: 8px;
    }
     .selectorRow {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 10px;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        flex-wrap: wrap;
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
