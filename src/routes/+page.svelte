<script>
    import * as d3 from 'd3';
    import { onMount } from 'svelte';
    import { thisStudent, studentLogin, restoreSession } from '../lib/supabase/auth';

    let graphWidth = $state(800);
    let graphHeight = $state(600);


    let username = $state('');
    let error = $state(false);
    let ready = $state(false);
    const margin = {
        top: 20,
        bottom: 20,
        left: 20,
        right: 20
    }
    let innerGraphWidth = $derived(graphWidth - margin.left - margin.right);
    let innerGraphHeight = $derived(graphHeight - margin.top - margin.bottom);

    onMount(async () => {
        await restoreSession();
        ready = true;
    });
    async function loginHandler(){
        error = false;
        const okay = await studentLogin(username);
        if (!okay) error = true;
    }

</script>

<div>
    <!-- <svg width={graphWidth} height={graphHeight}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
            <rect fill="red" width={innerGraphWidth} height={innerGraphHeight}/>
        </g>
    </svg> -->
    {#if !ready}
        <p>Loading...</p>
    {:else if $thisStudent}
            <p>Welcome, {$thisStudent.username}!</p>
    {:else}
        <div class="login">
            <h2>Enter your animal username to begin!</h2>
            <input bind:value={username} placeholder="E.g. rhinoceros"/>
            <button onclick={loginHandler}>Login</button>
            {#if error}
                <p>Animal name not recognised - ask the teacher for help.</p>
            {/if}
        </div>
    {/if}
</div>

<style>
</style>
