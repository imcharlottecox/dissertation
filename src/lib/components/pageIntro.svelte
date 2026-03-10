<script lang="ts">
    export let title: string;
    export let description: string | null = null;
</script>

<section class="pageIntro">
    <h1>{title}</h1>
    {#if description}
        <p>{description}</p>
    {/if}
</section>

<style>
    .pageIntro{
        flex: 0 0 auto;
        padding: 0.5rem 0.75rem;
        border: 1px solid #e0e0e0;
    }
    .pageIntro h1{
        margin: 0;
        font-size: 1.3rem;
        font-weight: 200;
    }
    .pageIntro p{
        margin: 0.5rem 0 0 0;
        font-size: 1rem;
        color: #333;
    }
</style>