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
        /** Cumulative probability of the full predicted sequence */
        probability: number;
        /** Probability of the typed prefix alone — for confidence display */
        prefixProbability: number;
        /** "high" | "medium" | "low" | "unknown" derived from prefixProbability */
        confidenceLabel: "high" | "medium" | "low" | "unknown";
        fsmText: string;
        markovText: string;
        /** The typed prefix characters */
        typedTokens: string[];
        /** Best beam predicted continuation */
        predictedTokens: string[];
        /** All beam completions ranked best-first */
        allBeams: Array<{ predictedTokens: string[]; totalProbability: number; terminatedNaturally: boolean }>;
    };

    export let questions: TaskQuestion[] = [];
    export let evaluate: (sequenceInput: string) => Evaluation;

    const dispatch = createEventDispatcher<{ sequenceChange: string }>();

    let sequenceInput = "";
    let fsmResult: string | null = null;
    let markovResult: string | null = null;
    let isCorrect: boolean | null = null;
    let currentQIndex = 0;
    let maxUnlockedQ = 0;
    let selectedChoice: string | null = null;

    // Completion preview state
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

    // Build the display string for the completion box
    // Shows typed portion normally, predicted portion styled differently via spans
    $: typedDisplay = typedTokens.map(renderToken).join("");
    $: predictedDisplay = predictedTokens.map(renderToken).join("");

    function renderToken(t: string): string {
        if (t === "\n") return "↵";
        if (t === " ")  return "\u00A0"; // non-breaking space to preserve spacing
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

                <!-- Divider arrow -->
                <div class="arrow" aria-hidden="true">→</div>

                <!-- Right: Markov completion preview (read-only) -->
                <div class="inputWrap">
                    <div class="completionLabelRow">
                        <label class="boxLabel" for="completionBox">Markov prediction</label>
                        {#if typedTokens.length > 0}
                            <span class="confidencePill confidence-{confidenceLabel}">
                                {confidenceLabel === "high"    ? "confident"
                                : confidenceLabel === "medium" ? "uncertain"
                                : confidenceLabel === "low"    ? "low confidence"
                                :                                "—"}
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
                            <!-- Typed portion -->
                            <span class="typed">{typedDisplay}</span>
                            <!-- Best beam predicted continuation -->
                            {#if predictedTokens.length > 0}
                                <span class="predicted">{predictedDisplay}</span>
                            {/if}
                        {/if}
                    </div>

                    <!-- Alternate beams (collapsed by default) -->
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
            </div>

            <!-- Result pills -->
            <div class="resultsRow">
                <div
                    class="resultElement"
                    class:accepted={fsmResult?.includes("✅")}
                    class:rejected={fsmResult?.includes("❌")}
                >
                    {fsmResult ?? "FSM: —"}
                </div>
                <div class="resultElement">
                    {markovResult ?? "Markov: —"}
                </div>
                {#if prefixProbability > 0}
                    <div class="resultElement prefixProb">
                        P(prefix) = {prefixProbability.toExponential(2)}
                    </div>
                {/if}
            </div>
        {/if}

        <div class="progressRow">
            {#if isCorrect}
                <span class="status correct">✓ Correct!</span>
            {:else if sequenceInput.trim().length === 0}
                <div></div>
            {:else}
                <span class="status trying">Keep trying…</span>
            {/if}
        </div>
    </div>
{/if}


<style>
    .panel {
        background-color: #fefefe;
        padding: 10px 14px;
        border: 1.5px solid #e0e0e0;
        width: 100%;
        box-sizing: border-box;
        font-family: 'Georgia', serif;
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 6px;
    }

    .titleRow {
        display: flex;
        align-items: baseline;
        gap: 8px;
    }

    h3 {
        margin: 0;
        padding: 0;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #333;
    }

    .meta {
        font-size: 11px;
        color: #999;
        font-family: 'Courier New', monospace;
    }

    .nav {
        display: flex;
        gap: 6px;
    }

    .btn {
        border: 1px solid #ddd;
        background: #f8f8f8;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        color: #444;
        transition: background 0.1s, border-color 0.1s;
    }

    .btn:hover:not(:disabled) {
        background: #eef;
        border-color: #aac4f0;
    }

    .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .prompt {
        margin: 0 0 10px 0;
        font-size: 13px;
        color: #222;
        line-height: 1.5;
    }

    /* ── Side-by-side input row ── */
    .inputRow {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        margin-bottom: 8px;
    }

    .inputWrap {
        display: flex;
        flex-direction: column;
        gap: 3px;
        flex: 1 1 0;
        min-width: 0;
    }

    .boxLabel {
        font-size: 10px;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: #999;
        font-family: 'Courier New', monospace;
    }

    input[type="text"] {
        width: 100%;
        box-sizing: border-box;
        padding: 7px 10px;
        font-size: 13px;
        font-family: 'Courier New', monospace;
        border: 1.5px solid #ddd;
        border-radius: 4px;
        background: #fff;
        color: #111;
        outline: none;
        transition: border-color 0.15s;
    }

    input[type="text"]:focus {
        border-color: #7aabf0;
    }

    /* The read-only completion box — mirrors input height/padding exactly */
    .completionBox {
        width: 100%;
        box-sizing: border-box;
        padding: 7px 10px;
        font-size: 13px;
        font-family: 'Courier New', monospace;
        border: 1.5px solid #e8e8e8;
        border-radius: 4px;
        background: #f9f9fb;
        min-height: 34px;
        white-space: pre-wrap;
        word-break: break-all;
        color: #111;
        line-height: 1.4;
    }

    .placeholder {
        color: #bbb;
        font-style: italic;
        font-size: 12px;
    }

    /* Typed portion — normal weight, slightly muted */
    .typed {
        color: #333;
    }

    /* Predicted portion — visually distinct: blue, slightly lighter */
    .predicted {
        color: #4a7fd4;
        background: #eef4ff;
        border-radius: 2px;
        padding: 0 1px;
        font-style: italic;
    }

    /* Arrow between boxes */
    .arrow {
        font-size: 16px;
        color: #ccc;
        padding-bottom: 7px; /* align with input baseline */
        flex: 0 0 auto;
        user-select: none;
    }

    /* ── Result pills ── */
    .resultsRow {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 4px;
    }

    .resultElement {
        border: 1px solid #e0e0e0;
        background: #f8f8f8;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-family: 'Courier New', monospace;
        color: #555;
        transition: background 0.2s, border-color 0.2s;
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

    /* ── Progress row ── */
    .progressRow {
        min-height: 18px;
    }

    .status {
        font-size: 11px;
        font-family: 'Courier New', monospace;
    }

    .status.correct {
        color: #2a7a28;
    }

    .status.trying {
        color: #999;
    }

    /* ── Completion label row (label + confidence pill) ── */
    .completionLabelRow {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .confidencePill {
        font-size: 9px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-family: 'Courier New', monospace;
        padding: 1px 6px;
        border-radius: 999px;
        border: 1px solid #ddd;
        background: #f4f4f4;
        color: #888;
    }
    .confidence-high   { border-color: #6abf69; background: #edfaed; color: #2a7a28; }
    .confidence-medium { border-color: #e0c060; background: #fdf9e0; color: #7a6010; }
    .confidence-low    { border-color: #e07070; background: #fdeaea; color: #922; }

    /* ── Alternate beams ── */
    .beamToggle {
        margin-top: 4px;
        background: none;
        border: none;
        font-size: 10px;
        color: #7aabf0;
        cursor: pointer;
        padding: 0;
        font-family: 'Courier New', monospace;
        letter-spacing: 0.04em;
        text-align: left;
    }
    .beamToggle:hover { color: #4a7fd4; }

    .beamList {
        margin-top: 4px;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .beamRow {
        display: flex;
        align-items: baseline;
        gap: 6px;
        padding: 4px 8px;
        background: #f5f7fc;
        border: 1px solid #e4eaf6;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
    }

    .beamRank {
        font-size: 9px;
        color: #aaa;
        flex: 0 0 auto;
    }

    .beamText {
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .beamProb {
        font-size: 9px;
        color: #aaa;
        flex: 0 0 auto;
    }

    /* ── Prefix probability pill ── */
    .prefixProb {
        font-style: italic;
        color: #7a7a9a;
    }


    .choiceList {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 8px 0;
    }

    .choice {
        text-align: left;
        padding: 8px 12px;
        border: 1.5px solid #ddd;
        border-radius: 6px;
        background: #f8f8f8;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
        font-family: 'Courier New', monospace;
    }

    .choice:hover {
        background: #eef4ff;
        border-color: #aac4f0;
    }

    .choice.selected  { border-color: #aac4f0; background: #e8f0fd; }
    .choice.correct   { border-color: #6abf69; background: #edfaed; }
    .choice.wrong     { border-color: #e07070; background: #fdeaea; }
</style>