<script>
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<h1 style="font-size: 1.4rem; margin: 0; font-weight: 650;">Node To Joy</h1>
	<a href="/">Home</a>
    <a href="/page2">FSM</a>
	<a href="/resizes">Resizes</a>
	<a href="/myFSM">My FSM</a>
	<a href="/holdsShape">Holds Shape</a>



{@render children?.()}

<style>
  :global(body) {
    font-family: 'Inter Variable', sans-serif;
  }
</style>