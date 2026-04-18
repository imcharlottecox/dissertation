<script>
	import favicon from '$lib/assets/favicon.svg';
	import { base } from '$app/paths';
	import "$lib/styles/theme.css"
	
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="taskbar">
	<!-- <h1 style="font-size: 1.4rem; margin: 0; font-weight: 650;">Node To Joy</h1> -->
	<a class="logo" href={`${base}/`}>Node To Joy</a>
	<div class="links">
	<a href="{base}/cartons_letters">1: Letters!</a>
	<a href="{base}/python">2: Python Assignments</a>
	<a href="{base}/vending">3: Vending Machine</a>
	<a href="{base}/shakeItOff">4: Shake It Off</a>
	<a href="{base}/TED">5: TED</a>
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
		align-items: center;
		background: #1b365d;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		padding:0px 12px;
		gap: 12px;
		height: 38px;
	}
	.logo{
		font-size: 1.1rem; 
		margin: 0; 
		font-weight: 700;
		text-decoration: none;
		color: #d6d2c4;
		display: flex;
		align-items: center;
		transition: opacity 120ms;
		letter-spacing: 0.2em;

	}
	.logo:hover{
		opacity: 0.65;
	}

	.links {
		display: flex;
		gap: 6px;
	}

	.links a {
		display: inline-flex;
		align-items: center;
		font-size: 0.9rem;
		text-decoration: none;
		font-weight: 500;
		color: #d6d2c4;
		background: #d6d2c42e;
		border: 1px solid #d6d2c414;
		border-radius: 3px;
		padding: 0px 10px;
		height: 26px;

		transition: background 120ms, border-color 120ms;  
	}
	.links a:hover {
		background: #d6d2c42e;
		border-color: rgba(214, 210, 196, 0.38);
	}
	:global(.links a[aria-current="page"]) {
		background: rgba(214, 210, 196, 0.25);
		border-color: #d6d2c4;
		color: #ffffff;
	}
 
	:global(body) {
		font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
		margin: 0;
	}
</style>