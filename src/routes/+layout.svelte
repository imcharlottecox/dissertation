<script>
	import favicon from '$lib/assets/favicon.svg';
	import { base } from '$app/paths';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="taskbar">
	<h1 style="font-size: 1.4rem; margin: 0; font-weight: 650;">Node To Joy</h1>
	<div>
		<!-- <a href="/">Home</a>
    <a href="/svelteImperativeFSM">FSM</a>
	<a href="/resizes">Resizes</a>
	<a href="/myFSM">My FSM</a>
	<a href="/holdsShape">Holds Shape</a>
	<a href="/churchillFSM">My Churchill FSM</a>
	<a href="/cambridgeFsm">My Cam FSM</a> -->
	<!-- <a href="{base}/algebraPage0">Algebra: Example 0</a> -->
	<a href={`${base}/algebraPage0`}>Algebra: Example 0</a>
	<a href="{base}/caPage1">Ca: Example 1</a>
	<a href={base + '/caPage1'}>Ca: Example 222</a>
	<a href="{base}/camPage2">Cam: Example 2</a>
	<a href="{base}/churPage3">Churchill: Example 3</a>

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
  }
</style>