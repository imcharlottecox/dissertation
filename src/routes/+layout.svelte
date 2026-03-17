<script>
	import favicon from '$lib/assets/favicon.svg';
	import { base } from '$app/paths';

	
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="taskbar">
	<!-- <h1 style="font-size: 1.4rem; margin: 0; font-weight: 650;">Node To Joy</h1> -->
	<a class="logo" href="{base}"> Node To Joy</a>
	<div class="links">
		<!-- <a href="/">Home</a>
    <a href="/svelteImperativeFSM">FSM</a>
	<a href="/resizes">Resizes</a>
	<a href="/myFSM">My FSM</a>
	<a href="/holdsShape">Holds Shape</a>
	<a href="/churchillFSM">My Churchill FSM</a>
	<a href="/cambridgeFsm">My Cam FSM</a> -->
	<!-- <a href="{base}/algebraPage0">Algebra: Example 0</a> -->
	<!-- <a href={`${base}/algebraPage0`}>Algebra: Example 0</a>
	<a href="{base}/camPage2">Cam: Example 2</a>
	<a href="{base}/churPage3">Churchill: Example 3</a> -->
	<a href="{base}/vending">1: Vending Machine</a>
	<a href="{base}/cartons_letters">2: Letters!</a>
	<a href="{base}/python">3: Python Assignments</a>
	<a href="{base}/shakeItOff">4: Shake It Off</a>
	<!-- <a href="{base}/benchmark">5: Benchmark</a>
	<a href="{base}/not_using/camPage2">Cam: Example 2</a>
	<a href="{base}/not_using/churPage3">Churchill: Example 3</a> -->




	<!-- <a href="/markov1">Markov</a> -->
	</div>
</div>



{@render children?.()}

<style>
	:global(body) {
		font-family: 'Inter Variable', sans-serif;
	}
	.taskbar{
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		background: rgba(255, 255, 255, 0.85);
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		padding:6px 6px
	}
	.logo{
		font-size: 1.4rem; 
		margin: 0; 
		font-weight: 650;
		text-decoration: none;
		color: inherit;
		display: flex;
		align-items: center;

	}
	.logo:hover{
		opacity: 0.65;
	}

	.links {
		display: flex;
		gap: 8px;
	}

	.links a {
		display: inline-flex;
		align-items: center;
		font-size: 1rem;
		text-decoration: none;
		font-weight: 500;
		color: rgb(0, 0, 0, 0.9);
		background: rgb(0, 0, 0, 0.025);
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-radius: 2px;
		padding: 0px 12px;

		transition: background 120ms ease, border-color 120ms ease;  
	}
	.links a:hover {
		background: rgb(0, 0, 0, 0.05);
		border-color: rgba(0, 0, 0, 0.12);
	}

</style>