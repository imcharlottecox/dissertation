<script lang="ts">
  export let title: string;
  export let initiallyOpen: boolean = false;

  let showPanel = initiallyOpen;
</script>

<main>
    <div class="box">
    <button class="accordion" on:click={() => showPanel = !showPanel} class:active={showPanel}>
        <h3>{title}</h3>
    </button>
    <div class="panel" class:open={showPanel}>
        <slot />
    </div>
    </div>
</main>


<style>
    h3{
        padding: 0;
        margin:0;
        line-height: 1;
    }
    .box {
        border: 1.5px solid lightgrey;
        border-radius: 0px;
        margin-bottom: 4px;
        background-color: snow;
        width:100%;
    }
    .accordion {
        padding: 10px 6px;
        background-color: snow;
        color: #444;
        cursor: pointer;
        width: 100%;
        border: none;
        transition: 0.3s;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .accordion:hover,
    .active {
        background-color: #eee;
    }

    .accordion:after {
        content: '\02795'; /* plus */
    }

    .active:after {
        content: '\2796'; /* minus*/
    }
    .panel {
        display: none;
        background-color: snow;
        padding: 8px 12px;
    }
    .panel.open {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: flex-start;
        max-height: 100px; 
        overflow-y: auto; 
    }
</style>