<script lang="ts">
	import { logEvent } from '$lib/supabase/logging';
    export let title: string;
    export let initiallyOpen: boolean = false;
    export let page: string = "unknown";

  let showPanel = initiallyOpen;
</script>

<main>
    <div class="box">
    <button class="accordion" on:click={() => {showPanel = !showPanel; if (showPanel) logEvent('accordion_open', {page});}} class:active={showPanel}>
        <h3>{title}</h3>
    </button>
    <div class="panel" class:open={showPanel}>
        <slot />
    </div>
    </div>
</main>


<style>
    h3 {
        padding: 0;
        margin: 0;
        line-height: 1;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
    }
    .box {
        border: 1px solid var(--border-light);
        border-radius: var(--radius);
        margin-bottom: 6px;
        width: 100%;
        overflow: hidden;
    }
    .accordion {
        padding: 7px 10px;
        background: var(--bg-header);
        color: var(--text-primary);
        cursor: pointer;
        width: 100%;
        border: none;
        transition: background 100ms;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }
    .accordion:hover,
    .active {
        background: var(--bg-hover);
    }
    .accordion::after {
        content: '+';
        font-size: 14px;
        font-weight: 400;
        color: var(--text-muted);
        flex-shrink: 0;
    }
    .active::after {
        content: '-';
    }
    .panel {
        display: none;
        background: var(--bg-panel);
        padding: 10px 12px;
    }
    .panel.open {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: flex-start;
        max-height: 200px;
        overflow-y: auto;
    }
</style>