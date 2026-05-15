<script context="module" lang="ts">
	import { createEventDispatcher } from 'svelte';
    import type { mTransition } from "$lib/graph/graphTypes";
    import { logEvent } from '$lib/supabase/logging';
    import { input } from 'motion/react-client';
    
    export type MCQChoice = {
        id: string;
        question: string;
    }
    export type Question = {
        id: string;
        question: string;
        check: (context: {
            accepted: boolean;
            probability: number;
            input: string;
        }) => boolean;
        choices?: MCQChoice[];
        correctChoice?: string; //todo remove?
        hint?: string;
    }

    export type Evaluation = {
        accepted: boolean;
        probability: number;
        typedProbability?: number;
        confidenceLabel?: "confident" | "uncertain" | "low confidence" | "unknown";
        fsmText: string;
        markovText: string;
        typedTokens: string[];
        predictedTokens?: string[];
        allBeams?: Array<{
            predictedTokens: string[];
            predictedSeqProbability: number;
            terminatedNaturally: boolean; 
        }>;
        probabilityBreakdown?: Array<mTransition>;
    }
</script>
<script lang="ts">
    export let questions: Question[] = [];
    export let evaluate: (sequenceInput: string) => Evaluation;
    export let page: string = "unknown";
    export let showPrediction:boolean = true; //for dropdown

    const dispatch = createEventDispatcher<{sequenceChange: string}>();

    let sequenceInput = "";
    let fsmResult: string | null = null;
    let markovResult: string |null = null;
    let typedTokens: string[] = [];
    let predictedTokens: string[] = [];
    let allBeams: Evaluation["allBeams"] = [];
    let typedProbability: number = 0;
    let predictedSeqProbability = 0;
    let confidenceLabel: Evaluation["confidenceLabel"] = "unknown";
    let probabilityBreakdown: Evaluation["probabilityBreakdown"] = [];
    let evaluatedProbability = 0;
    let showAllBeams = false;
    
    let currentQIndex = 0;
    let maxQUnlocked = 0;
    let isCorrect: boolean|null = null;
    let selectedChoice: string | null = null;

    $: currentQuestion = questions[currentQIndex];
    $: canGoNext = currentQIndex< questions.length - 1 && currentQIndex< maxQUnlocked;
    $: canGoBack = currentQIndex > 0;
    $: isMCQ = !!(currentQuestion?.choices?.length);
    $: typedDisplay = typedTokens.map(renderToken).join("");
    $: predictedDisplay = predictedTokens.map(renderToken).join("");

    function renderToken(token: string):string{
        if (token === "\n") return "\u21B5";
        if (token === " ") return "\u00A0";
        return token;
    }
    function onInput(){
        dispatch("sequenceChange", sequenceInput); //for path highlighting
        const output = evaluate(sequenceInput); //evaluation in page unpacked here for display

        fsmResult = output.fsmText;
        markovResult = output.markovText;
        typedTokens = output.typedTokens;
        predictedTokens = output.predictedTokens;
        allBeams = output.allBeams;
        typedProbability = output.typedProbability;
        predictedSeqProbability = output.allBeams[0]?.predictedSeqProbability?? 0;
        confidenceLabel = output.confidenceLabel;
        probabilityBreakdown = output.probabilityBreakdown;
        evaluatedProbability = output.probability;

        const raw = sequenceInput;
        const accepted = currentQuestion?.check({
            accepted: output.accepted,
            probability: output.probability,
            input: raw.trim(),
        });
        console.log("oninput:", canGoNext, input, accepted, );
        isCorrect = accepted ?? null;
        if (accepted){
            maxQUnlocked = Math.max(maxQUnlocked, currentQIndex+1); //so progress is preserved
            logEvent("question_correct", {page, question_id: currentQuestion.id, sequence: sequenceInput});
        }
    }

    function onChoiceSelect(choiceId: string){
        selectedChoice = choiceId;
        const correct = choiceId === currentQuestion.correctChoice;
        isCorrect = correct;
        if (correct) maxQUnlocked = Math.max(maxQUnlocked, currentQIndex+1);
    }

    function nextQ(){
        if (!canGoNext) {console.log(canGoNext, input, ); return;}
        currentQIndex += 1;
        logEvent('next_question', {page, from:currentQIndex});
        resetInput()
    }

    function backQ(){
        if (!canGoBack) return;
        currentQIndex -= 1;
        logEvent('back_question', {page, from: currentQIndex});
        resetInput()
    }

    function resetInput(){
        sequenceInput ="";
        fsmResult = null;
        markovResult = null;
        typedTokens = [];
        predictedTokens = [];
        allBeams = [];
        typedProbability = 0;
        predictedSeqProbability = 0;
        confidenceLabel = "unknown";
        probabilityBreakdown = [];
        evaluatedProbability = 0;
        isCorrect = null;
        selectedChoice = null;
        dispatch("sequenceChange", "");
    }
    function formatProb(n: number): string{
        if (n === 0 ) return "0";
        if (n >= 0.0001) return n.toFixed(10).replace(/\.?0+$/, "");
        return n.toFixed(Math.min(Math.ceil(-Math.log10(n))+1, 20)).replace(/\.?0+$/, "")
    }
</script>


{#if questions.length > 0}
    <div class = "panel">
        <div class = "header">
            <h3>Challenges 
                <span class = "metadata">
                    {currentQIndex+1} / {questions.length}
                </span>
            </h3>
            <div class="nav">
                <button class = "toggle" on:click={backQ} disabled={!canGoBack}>Back</button>
                <button class = "toggle" on:click={nextQ} disabled={!canGoNext}>Next</button>
            </div>
        </div>

        <p class="prompt">{currentQuestion.question}</p>

        {#if isMCQ}
            <div class="choiceList">
                {#each currentQuestion.choices as choice}
                    <button class="sentenceBtn" class:ok={selectedChoice === choice.id && isCorrect}
                    class:err={selectedChoice === choice.id && !isCorrect}
                    on:click={() => onChoiceSelect(choice.id)}>{choice.question}</button>
                {/each}
            </div>

        <!-- text input -->
        {:else}
            <div class="inputRow">
                <div class="inputWrap">
                    <div class="inputLabelRow">
                        <label class="boxLabel" for="sequenceInput">Your input</label>
                    </div>
                    <input
                        id="sequenceInput"
                        type="text"
                        placeholder="e.g. x= 5"
                        bind:value={sequenceInput}
                        on:input={onInput}
                        autocomplete="off"
                        spellcheck="false"
                    />
                </div>
                {#if showPrediction}
                    <div class="arrow">&rarr;</div>

                    <div class="inputWrap">
                        <div class="completionLabelRow">
                            <label class="boxLabel" for="completionBox">Markov prediction</label>
                            {#if typedTokens.length > 0}
                            <span class="pill" 
                                class:ok={confidenceLabel === "confident"}
                                class:warn={confidenceLabel === "uncertain"}
                                class:err={confidenceLabel === "low confidence"}
                            >
                                {confidenceLabel === "unknown" ? "-" : confidenceLabel}
                            </span>
                            {/if}
                        </div>

                        <div id="completionBox" class="completionBox">
                            {#if typedTokens.length === 0}
                                <span class="muted">Prediction will appear here</span>
                            {:else}
                                <span>{typedDisplay}</span>
                                {#if predictedTokens.length > 0}
                                    <span class="predicted">{predictedDisplay}</span>
                                {/if}
                            {/if}
                        </div>

                        {#if allBeams.length > 1}
                            <button class="beamToggle" on:click={() => {
                                showAllBeams = !showAllBeams;
                                if (showAllBeams) logEvent('beam_predictions_expanded', {page, sequence:sequenceInput});
                                }}>
                                {showAllBeams ? `\u25B2 hide`: `\u25BC ${allBeams.length-1} other predictions`}
                            </button>

                            {#if showAllBeams}
                                <div class="beamList">
                                    {#each allBeams.slice(1) as beam, i}
                                        <div class="beamRow">
                                            <span class="muted">#{i+2}</span>
                                            <span class="beamText">
                                                <span>{typedDisplay}</span>
                                                <span class="predicted">{beam.predictedTokens.map(renderToken).join("")}</span>
                                            </span>
                                            <span class="muted">{formatProb(beam.predictedSeqProbability)}</span>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="resultsRow">
                <span class="pill" class:ok={fsmResult?.includes("Accepted")} class:err={fsmResult?.includes("Rejected")}>
                    {fsmResult ?? "FSM: -"}
                </span>
                <span class="pill">{markovResult ?? "Markov: -"}</span>
                {#if predictedSeqProbability>0}
                    <span class="pill muted">P(predicted) = {formatProb(predictedSeqProbability)}</span>
                {/if}
            </div>

            {#if probabilityBreakdown && probabilityBreakdown.length > 0}
                <div class="probBreakdown">
                    <span class="navy bold">P({typedTokens.map(renderToken).join("")})</span>
                    <span class="muted">=</span>
                    {#each probabilityBreakdown as step, i}
                        <span class="probStep" title="{step.from} \u2192 {step.to}">{parseFloat(step.probability.toFixed(10))}</span>
                        {#if i < probabilityBreakdown.length - 1}
                            <span class="muted">x</span>
                        {/if}
                    {/each}
                    <span class="muted">=</span>
                    <span class="navy bold">{formatProb(evaluatedProbability)}</span>
                </div>
            {/if}
        {/if}

        <div class="progressRow">
            {#if isCorrect}
                <span class="oktext">Correct!</span>
                {#if currentQuestion?.hint}
                    <p class="hint">{currentQuestion.hint}</p>
                {/if}

            {:else if !isCorrect && isCorrect !== null}
                <span class="muted">Keep trying...</span>
            {/if}
        </div>


    </div>
{/if}


<style>
    .panel{
        background: var(--bg-panel);
        border: 1px solid var(--border-light);
        padding: 8px 12px;
    }
    .header{
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .nav{
        display:flex;
        gap: 8px;
    }
    .prompt{
        margin: 8px 0;
        font-size: 14px;
    }
    h3{
        margin:0;
        font-size: 16px;
        font-weight: 300;
        line-height: 1;
    }
    .inputRow{
        display: flex;
        align-items: flex-start;
        justify-content: center;
        gap: 10px;
        margin: 6px 0 8px;
        flex-wrap: wrap;
    }
    .inputWrap{
        display: flex;
        flex-direction:column;
        gap: 4px;
        flex: 1 1 0;
        min-width: 0;
    }
    .inputLabelRow, .completionLabelRow{
        height: 22px;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    input[type="text"]{
        width: 100%;
        padding: 8px 10px;
        font-size: 14px;
        border: 1px solid var(--border);
        background:white;
    }
    input[type="text"]:focus{
        outline: none;
        border-color: var(--active-border);
    }

    .metadata{
        color: var(--text-muted);
    }

    .ok {
        border-color: #6cc26a !important;
        color: #6cc26a !important;
        background: #fbfff9 !important;
    }
    .oktext{
        font-size: 12px;
        color: darkgreen;
    }
    .warn {
        border-color: #e4ba61 !important;
        color: #e4ba61 !important;
        background: #fffdf9 !important;
    }
    .err {
        border-color: #cd4947 !important;
        color: #cd4947 !important;
        background: #fffafa !important;
    }

    .navy {
        color: var(--navy);
    }
    .bold{ font-weight: 700;}

    .muted {
        font-size: 11px;
        color: var(--text-muted);
    }

    .choiceList{
        display:flex;
        flex-direction: column;
        gap: 6px;
        margin: 8px 0px;
    }

    .boxLabel{
        color: var(--text-muted);
    }

    .completionBox{
        width:100%;
        border: 1px solid var(--border);
        background: var(--bg-header);
        padding: 6px 10px;
        min-height: 35px;
        white-space: pre-wrap;
    }
    .resultsRow{
        display: flex;
        gap:8px;
        flex-wrap: wrap;
        margin-bottom: 4px;

    }
    .progressRow{
        min-height: 20px;
        margin-top: 4px;
    }

    .beamList{
        margin-top: 6px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .predicted{
        color: var(--navy);
        background: #e7edf5;
    }
    .arrow{
        color:var(--text-muted);
        padding-top: 33px;
    }
    .pill{
        border: 1px solid var(--border);
        background: var(--bg-header);
        border-radius: 888px;
        font-size: 12px;
        padding: 4px 10px;
        margin: 4px;
    }

    .probBreakdown{
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
        padding: 6px 10px;
        background: var(--bg-header);
        border: 1px solid var(--border);
        border-radius: 5px;
        font-size: 12px;
        font-family: "Courier New";
        margin-top: 6px;
    }
    .probStep{
        border-bottom: 1px dotted #c4bfb0;
    }
    
    .beamRow {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 6px 10px;
        background: var(--bg-header);
        border: 1px solid var(--border);
        border-radius: 5px;
    }
    .beamText{
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
    }
    .beamToggle{
        font-family: system-ui, sans-serif;
        margin-top: 4px;
        background: none;
        border: none;
        font-size: 12px;
        cursor: pointer;
        color: var(--navy);
        text-align: left;
        padding: 0;
    }
    .hint{
        margin: 6px 0 0;
        padding: 8px 10px;
        color: darkgreen;
        background: #f4fcf0;
        border-left: 3px solid #32d280;
        border-radius: 0 5px 5px 0;
        font-size: 13px;
    }
    .sentenceBtn{
        border: 1px solid var(--border-light);
        border-radius: 5px;
        padding: 5px;
        

    }
</style>