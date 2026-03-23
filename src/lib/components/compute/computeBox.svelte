<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export type MCQChoice = {
        id: string;
        label: string;
    };
    export type TaskQuestion = {
        id: string;
        prompt: string;
        check: (context: { accepted: boolean; probability: number; input: string }) => boolean;
        choices?: MCQChoice[];
        correctChoice?: string;
    };
    export type Evaluation = {
        accepted: boolean;
        probability: number;
        prefixProbability: number;
        confidenceLabel: "high" | "medium" | "low" | "unknown";
        fsmText: string;
        markovText: string;
        typedTokens: string[];
        predictedTokens: string[];
        allBeams: Array<{ predictedTokens: string[]; totalProbability: number; terminatedNaturally: boolean }>;
    };

    export let questions: TaskQuestion[] = [];
    export let evaluate: (sequenceInput: string) => Evaluation;
    export let showPrediction: boolean = true;

    const dispatch = createEventDispatcher<{ sequenceChange: string }>();

    let sequenceInput = "";
    let fsmResult: string | null = null;
    let markovResult: string | null = null;
    let isCorrect: boolean | null = null;
    let currentQIndex = 0;
    let maxUnlockedQ = 0;
    let selectedChoice: string | null = null;

    let typedTokens: string[] = [];
    let predictedTokens: string[] = [];
    let allBeams: Evaluation["allBeams"] = [];
    let prefixProbability = 0;
    let confidenceLabel: Evaluation["confidenceLabel"] = "unknown";
    let showAllBeams = false;

    $: isMCQ = !!(currentQuestion?.choices?.length);
    $: currentQuestion = questions[currentQIndex];
    $: canGoBack = currentQIndex > 0;
    $: canGoNext = currentQIndex < questions.length - 1 && currentQIndex < maxUnlockedQ;

    $: typedDisplay = typedTokens.map(renderToken).join("");
    $: predictedDisplay = predictedTokens.map(renderToken).join("");

    function renderToken(t: string): string {
        if (t === "\n") return "↵";
        if (t === " ")  return "\u00A0"; 
        return t;
    }

    function resetInput() {
        sequenceInput = "";
        fsmResult = null;
        markovResult = null;
        isCorrect = null;
        selectedChoice = null;
        typedTokens = [];
        predictedTokens = [];
        allBeams = [];
        prefixProbability = 0;
        confidenceLabel = "unknown";
        showAllBeams = false;
        dispatch("sequenceChange", "");
    }

    function prevQ() {
        if (!canGoBack) return;
        currentQIndex -= 1;
        resetInput();
    }

    function nextQ() {
        if (!canGoNext) return;
        currentQIndex += 1;
        resetInput();
    }

    function onInput() {
        const raw = sequenceInput;
        const trimmedSeq = sequenceInput.trim();
        dispatch("sequenceChange", raw);
        const output = evaluate(raw);

        fsmResult    = output.fsmText;
        markovResult = output.markovText;
        typedTokens      = output.typedTokens    ?? [];
        predictedTokens  = output.predictedTokens ?? [];
        allBeams         = output.allBeams        ?? [];
        prefixProbability = output.prefixProbability ?? 0;
        confidenceLabel  = output.confidenceLabel ?? "unknown";

        const accepted = currentQuestion?.check({
            accepted: output.accepted,
            probability: output.probability,
            input: trimmedSeq,
        });

        isCorrect = accepted ?? null;
        if (accepted) {
            maxUnlockedQ = Math.max(maxUnlockedQ, currentQIndex + 1);
        }
    }

    function onChoiceSelect(choiceId: string) {
        selectedChoice = choiceId;
        const correct = choiceId === currentQuestion?.correctChoice;
        isCorrect = correct;
        if (correct) {
            maxUnlockedQ = Math.max(maxUnlockedQ, currentQIndex + 1);
        }
    }
</script>

{#if !questions || questions.length === 0}
    <div></div>
{:else}
    <div class="panel">
        <div class="header">
            <div class="titleRow">
                <h3>Challenges</h3>
                <span class="meta">{currentQIndex + 1} / {questions.length}</span>
            </div>
            <div class="nav">
                <button class="btn" on:click={prevQ} disabled={!canGoBack}>Back</button>
                <button class="btn" on:click={nextQ} disabled={!canGoNext}>Next</button>
            </div>
        </div>

        <p class="prompt">{currentQuestion.prompt}</p>

        {#if isMCQ}
            <div class="choiceList">
                {#each currentQuestion.choices! as choice}
                    <button
                        class="choice"
                        class:selected={selectedChoice === choice.id}
                        class:correct={selectedChoice === choice.id && isCorrect}
                        class:wrong={selectedChoice === choice.id && isCorrect === false}
                        on:click={() => onChoiceSelect(choice.id)}
                    >
                        {choice.label}
                    </button>
                {/each}
            </div>
        {:else}
            <div class="inputRow">
                <!-- Left: student types here -->
                <div class="inputWrap">
                    <label class="boxLabel" for="sequenceInput">Your input</label>
                    <input
                        id="sequenceInput"
                        type="text"
                        placeholder="e.g. x = 5"
                        bind:value={sequenceInput}
                        on:input={onInput}
                        autocomplete="off"
                        spellcheck="false"
                    />
                </div>

                {#if showPrediction}
                <div class="arrow" aria-hidden="true">-></div>

                <div class="inputWrap">
                    <div class="completionLabelRow">
                        <label class="boxLabel" for="completionBox">Markov prediction</label>
                        {#if typedTokens.length > 0}
                            <span class="confidencePill confidence-{confidenceLabel}">
                                {confidenceLabel === "high"    ? "confident"
                                : confidenceLabel === "medium" ? "uncertain"
                                : confidenceLabel === "low"    ? "low confidence"
                                :                                "-"}
                            </span>
                        {/if}
                    </div>
                    <div
                        id="completionBox"
                        class="completionBox"
                        aria-readonly="true"
                        aria-label="Markov predicted completion"
                    >
                        {#if typedTokens.length === 0}
                            <span class="placeholder">prediction will appear here</span>
                        {:else}
                            <span class="typed">{typedDisplay}</span>
                            {#if predictedTokens.length > 0}
                                <span class="predicted">{predictedDisplay}</span>
                            {/if}
                        {/if}
                    </div>

                    {#if allBeams.length > 1}
                        <button
                            class="beamToggle"
                            on:click={() => showAllBeams = !showAllBeams}
                        >
                            {showAllBeams ? "▲ hide" : `▼ ${allBeams.length - 1} other prediction${allBeams.length > 2 ? "s" : ""}`}
                        </button>

                        {#if showAllBeams}
                            <div class="beamList">
                                {#each allBeams.slice(1) as beam, i}
                                    <div class="beamRow">
                                        <span class="beamRank">#{i + 2}</span>
                                        <span class="beamText">
                                            <span class="typed">{typedDisplay}</span>
                                            <span class="predicted">{beam.predictedTokens.map(renderToken).join("")}</span>
                                        </span>
                                        <span class="beamProb">{(beam.totalProbability * 100).toExponential(1)}%</span>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    {/if}
                </div>
                {/if}
            </div>

            <!-- Result pills -->
            <div class="resultsRow">
                <div
                    class="resultElement"
                    class:accepted={fsmResult?.includes("Accepted")}
                    class:rejected={fsmResult?.includes("Rejected")}
                >
                    {fsmResult ?? "FSM: -"}
                </div>
                <div class="resultElement">
                    {markovResult ?? "Markov: -"}
                </div>
                {#if prefixProbability > 0}
                    <div class="resultElement prefixProb">
                        P(prefix) = {prefixProbability}
                    </div>
                {/if}
            </div>
        {/if}

        <div class="progressRow">
            {#if isCorrect}
                <span class="status correct">Correct!</span>
            {:else if sequenceInput.trim().length === 0}
                <div></div>
            {:else}
                <span class="status trying">Keep trying…</span>
            {/if}
        </div>
    </div>
{/if}


    <style>
    .panel{
        background-color: var(--bg-panel);
        padding: 8px 12px;
        border: 1px solid var(--border-light);
        width: 100%;
        box-sizing: border-box;
    }

    .header{
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .titleRow{
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 16px;
        line-height: 1;
        font-weight: 200;
    }

    h3{
        padding: 0;
        margin: 0;
        line-height: 1;
        font-weight: 200;
        font-size: 16px;
    }

    .meta{
        font-size: 12px;
        padding: 6px 0 8px 0;
        margin: 6px 0 8px 0;
        color: #666;
    }

    .nav{
        display: flex;
        gap: 8px;
    }

    .btn{
        border: 1px solid var(--border);
        background: var(--bg-header);
        padding: 6px 10px;
        border-radius: var(--radius);
        cursor: pointer;
        font-size: 13px;
    }

    .btn:hover:not(:disabled){
        background: var(--navy-light);
        border-color: var(--accent-mid);
    }

    .btn:disabled{
        opacity: 0.5;
        cursor: not-allowed;
    }

    .prompt{
        margin: 0 0 8px 0;
        font-size: 14px;
    }

    .inputRow{
        display: flex;
        align-items: flex-end;
        gap: 10px;
        margin: 6px 0 8px 0;
        flex-wrap: wrap;
    }

    .inputWrap{
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1 1 0;
        min-width: 0;
    }

    .boxLabel{
        font-size: 12px;
        color: #666;
        margin: 0;
    }

    .completionLabelRow{
        display: flex;
        align-items: center;
        gap: 6px;
    }

    input[type="text"]{
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        font-size: 14px;
        border: 1px solid var(--border);
        margin: 0;
        border-radius: 0;
        background: white;
    }

    input[type="text"]:focus{
        outline: none;
        border-color: var(--accent-mid);
    }

    .completionBox{
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        font-size: 14px;
        border: 1px solid var(--border);
        background: var(--bg-header);
        min-height: 38px;
        white-space: pre-wrap;
        word-break: break-word;
        color: var(--text-primary);
    }

    .placeholder{
        color: var(--text-muted);
        font-size: 12px;
    }

    .typed{
        color: inherit;
    }

    .predicted{
        color: var(--navy);
        background: var(--navy-light);
        border-radius: 3px;
        padding: 0 2px;
    }

    .arrow{
        font-size: 16px;
        color: var(--text-muted);
        padding-bottom: 8px;
        flex: 0 0 auto;
        user-select: none;
    }

    .resultsRow{
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .resultElement{
        border: 1px solid var(--border);
        background: var(--bg-header);
        padding: 6px 10px;
        border-radius: 888px;
        font-size: 12px;
    }

    .resultElement.accepted {
        border-color: #6abf69;
        background: #edfaed;
        color: #2a7a28;
    }

    .resultElement.rejected {
        border-color: #e07070;
        background: #fdeaea;
        color: #922;
    }

    .progressRow{
        min-height: 20px;
    }

    .status{
        font-size: 12px;
        color: #666;
    }

    .status.correct{
        color: #2a7a28;
    }

    .status.trying{
        color: #666;
    }

    .confidencePill{
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 888px;
        border: 1px solid var(--border);
        background: var(--bg-header);
        color: #666;
    }

    .confidence-high{
        border-color: #6abf69;
        background: #edfaed;
        color: #2a7a28;
    }

    .confidence-medium{
        border-color: #e0c060;
        background: #fdf9e0;
        color: #7a6010;
    }

    .confidence-low{
        border-color: #e07070;
        background: #fdeaea;
        color: #922;
    }

    .beamToggle{
        margin-top: 4px;
        background: none;
        border: none;
        font-size: 12px;
        color: var(--navy);
        cursor: pointer;
        padding: 0;
        text-align: left;
    }

    .beamToggle:hover{
        color: #2f66c7;
    }

    .beamList{
        margin-top: 6px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .beamRow{
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 6px 10px;
        background: var(--bg-header);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        font-size: 12px;
    }

    .beamRank{
        font-size: 11px;
        color: #888;
        flex: 0 0 auto;
    }

    .beamText{
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .beamProb{
        font-size: 11px;
        color: #888;
        flex: 0 0 auto;
    }

    .prefixProb{
        color: #666;
        font-size: 12px;
    }

    .choiceList{
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 8px 0;
    }

    .choice{
        text-align: left;
        padding: 8px 12px;
        border: 1.5px solid var(--border);
        border-radius: var(--radius);
        background: var(--bg-header);
        font-size: 13px;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
    }

    .choice:hover{
        background: var(--navy-light);
        border-color: var(--accent-mid);
    }

    .choice.selected{
        border-color: var(--accent-mid);
        background: #e8f0fd;
    }

    .choice.correct{
        border-color: #6abf69;
        background: #edfaed;
    }

    .choice.wrong{
        border-color: #e07070;
        background: #fdeaea;
    }

</style>