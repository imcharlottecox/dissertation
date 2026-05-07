<script lang="ts">
	import FsmBenchmarkViewer from "$lib/components/benchmarking/fsmBenchmarkViewer.svelte";
	import MarkovBenchmarkViewer from "$lib/components/benchmarking/markovBenchmarkViewer.svelte";
</script>

<div style="display:flex; height:100vh; ">
	<div style="flex: 1; min-width: 0; min-height: 90vh;">
		<FsmBenchmarkViewer />
	</div>
	<div style="flex: 1; min-width: 0; min-height: 90vh;">
		<MarkovBenchmarkViewer />
	</div>
</div>