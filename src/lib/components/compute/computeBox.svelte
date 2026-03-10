<script lang="ts">
    export type MCQChoice = {
        id: string;
        label: string;
    };
    export type TaskQuestion = {
        id: string;
        prompt: string;
        check: (context: { accepted: boolean; probability: number; input: string}) => boolean;
        choices?: MCQChoice[];       // if present, renders as MCQ instead of text input
        correctChoice?: string;      // id of the correct MCQChoice
    };
    export type Evaluation = {
        accepted: boolean;
        probability: number;
        fsmText: string;
        markovText: string;
    };
    export let questions: TaskQuestion[] = [];

    export let evaluate: (sequenceInput: string) => Evaluation;

    let sequenceInput = "";
    let fsmResult: string | null = null;
    let markovResult: string | null = null;
    let isCorrect: boolean | null = null;
    let currentQIndex = 0;
    let maxUnlockedQ = 0;
    let selectedChoice: string | null = null;

    $: isMCQ = !!(currentQuestion?.choices?.length);

    $: currentQuestion = questions[currentQIndex];
    $: canGoBack = currentQIndex >0;
    $: canGoNext = currentQIndex < questions.length-1 && currentQIndex < maxUnlockedQ;

    function resetInput(){
        sequenceInput = "";
        fsmResult = null;
        markovResult = null;
        isCorrect = null;
        selectedChoice = null;
    }

    function prevQ(){
        if (!canGoBack) return;
        currentQIndex -= 1;
        resetInput();
    }

    function nextQ(){
        if (!canGoNext) return;
        currentQIndex += 1;
        resetInput();
    }

    function onInput(){
        let trimmedSeq = sequenceInput.trim();
        const output = evaluate(trimmedSeq);
        fsmResult = output.fsmText;
        markovResult = output.markovText;

        const accepted = currentQuestion?.check({
            accepted: output.accepted,
            probability: output.probability,
            input: trimmedSeq
        });

        isCorrect = accepted ?? null;

        if (accepted) {
            maxUnlockedQ = Math.max(maxUnlockedQ, currentQIndex+1)
        }
    }

    function onChoiceSelect(choiceId: string){
        selectedChoice = choiceId;
        const correct = choiceId === currentQuestion?.correctChoice;
        isCorrect = correct;
        if (correct) {
            maxUnlockedQ = Math.max(maxUnlockedQ, currentQIndex+1);
        }
    }
</script>

{#if !questions || questions.length === 0}
    <div></div>
{:else}
    <div class="panel">
        <div class="header">
            <div class="titleRow">
                <h3> Challenges </h3>
                <span class="meta">{currentQIndex+1}/{questions.length}</span>
            </div>

            <div class="nav">
                <button class="btn" on:click={prevQ} disabled={!canGoBack}>
                    Back
                </button>
                <button class="btn" on:click={nextQ} disabled={!canGoNext}>
                    Next
                </button>
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
            <input 
                id="sequenceInput"
                type="text"
                placeholder="Enter a sequence to test"
                bind:value={sequenceInput}
                on:input={onInput}
                autocomplete="off"
                spellcheck="false"
            />
            <div class="resultsRow">
                <div class="resultElement">{fsmResult ?? "FSM: -"}</div>
                <div class="resultElement">{markovResult ?? "Markov: -"}</div>
            </div> 
        {/if}

        <div class="progressRow">
            {#if isCorrect}
                <span class="status">Correct!</span>
            {:else if sequenceInput.trim().length === 0}
                <div></div>
            {:else}
                <span class="status">Keep trying!</span>
            {/if}
        </div>
    </div>
{/if}


<style>
    .panel{
        background-color: snow;
        padding: 8px 12px;
        border: 1.5px solid lightgrey;
        width: 100%;
        box-sizing: border-box;

    }
    .header{
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap:12px;
    }
    .titleRow{
        margin: 0;
        font-size: 16px;
        line-height:1;
        font-weight: 200;
    }
    h3{
        padding: 0;
        margin:0;
        line-height: 1;
        font-weight: 200;
    }
    .meta{
        font-size: 12px;
        padding: 6px 0 8px 0;
         margin: 6px 0 8px 0;
    }
    .nav{
        display:flex;
        gap: 8px;
    }
    .btn{
        border: 1px solid #ddd;
        background: #f8f8f8;
        padding: 6px 10px;
        border-radius: 8px;
        cursor: pointer;

    }
    .btn:disabled{
        opacity: 0.5;
        cursor: not-allowed;
    }
    .prompt{
        margin: 0;
        font-size: 14px;
    }
    .resultsRow{
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    .resultElement{
        border: 1px solid #ddd;
        background: #f8f8f8;
        padding: 6px 10px;
        border-radius: 888px;
        font-size: 12px;
    }
    .progressRow{
        min-height: 20px;
    }
    .status{
        font-size:12px;
        color: #666;
    }
    input[type="text"]{
        width: 50%;
        box-sizing: border-box;
        padding: 8px 10px;
        font-size: 14px;
        border: 1px solid #ddd;
        margin: 6px 0 8px 0;
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
        border: 1.5px solid #ddd;
        border-radius: 8px;
        background: #f8f8f8;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
    }
    .choice:hover{
        background: #eef4ff;
        border-color: #aac4f0;
    }
    .choice.selected{
        border-color: #aac4f0;
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