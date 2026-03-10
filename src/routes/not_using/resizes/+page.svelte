<script lang="ts">
import { onMount } from 'svelte';
import * as d3 from 'd3';

type StateNode = { id: string; x: number; y: number };
type Transition = { from: string; to: string; label: string };

const acceptingStates = ['Cat', 'Car', 'Cart', 'Carton', 'Cats', 'Cars', 'Carts', 'Cartons', 'ACCEPT'];

const fsmStates = [
	'START',
	'C',
	'Ca',        
	'Cat',       
	'Cats',      
	'Car',       
	'Cars',      
	'Cart',      
	'Carts',     
	'Carto',     
	'Carton',    
	'Cartons'    
];

const fsmTransitions: Transition[] = [
	{ from: 'START', to: 'C', label: 'C' },
	{ from: 'C', to: 'Ca', label: 'a' },
	{ from: 'Ca', to: 'Cat', label: 't' },
	{ from: 'Ca', to: 'Car', label: 'r' },
	{ from: 'Cat', to: 'ACCEPT', label: 'END' },
	{ from: 'Cat', to: 'Cats', label: 's' },
	{ from: 'Cats', to: 'ACCEPT', label: 'END' },
	{ from: 'Car', to: 'ACCEPT', label: 'END' },
	{ from: 'Car', to: 'Cart', label: 't' },
	{ from: 'Car', to: 'Cars', label: 's' },
	{ from: 'Cars', to: 'ACCEPT', label: 'END' },
	{ from: 'Cart', to: 'ACCEPT', label: 'END' },
	{ from: 'Cart', to: 'Carts', label: 's' },
	{ from: 'Carts', to: 'ACCEPT', label: 'END' },
	{ from: 'Cart', to: 'Carto', label: 'o' },
	{ from: 'Carto', to: 'Carton', label: 'n' },
	{ from: 'Carton', to: 'ACCEPT', label: 'END' },
	{ from: 'Carton', to: 'Cartons', label: 's' },
	{ from: 'Cartons', to: 'ACCEPT', label: 'END' }
];

const graphHeight = 600;
const nodeRadius = 20;
const padding = 80;
let graphWidth = 1250;

let svgElement: SVGSVGElement;
let nodes: StateNode[] = [];
let transitions: Transition[] = fsmTransitions;

function calculateLayout() {
	const innerWidth = graphWidth - (2 * padding);
	const totalStates = fsmStates.length;

	nodes = fsmStates.map((state, i) => {
		const x = padding + (i / (totalStates - 1)) * innerWidth;
		let y =
			state === 'START' || state === 'C' || state === 'Ca' || state === 'Car' || state === 'Cart' || state.startsWith('Carto')
				? graphHeight * 0.5
				: state === 'Cat' || state === 'Cats'
				? graphHeight * 0.3
				: state === 'Cars' || state === 'Carts'
				? graphHeight * 0.7
				: graphHeight * 0.5;
		return { id: state, x, y };
	});
}

function drawGraph() {
	if (!svgElement) return;

	const svg = d3.select(svgElement);
	svg.selectAll('.content-group').remove();

	const nodeMap = new Map(nodes.map(n => [n.id, n]));
	const resolvedEdges = transitions
		.map(t => ({
			label: t.label,
			source: nodeMap.get(t.from),
			target: nodeMap.get(t.to)
		}))
		.filter(e => e.source && e.target);

	const g = svg.append('g').attr('class', 'content-group');

	// Zoom
	svg.call(d3.zoom<SVGSVGElement, unknown>().on('zoom', e => g.attr('transform', e.transform)) as any);

	// Draw
	const edge = g.append('g')
		.attr('stroke', '#999')
		.attr('stroke-opacity', 0.6)
		.selectAll('line')
		.data(resolvedEdges)
		.join('line')
		.attr('stroke-width', 1.5);

	const edgeLabel = g.append('g')
		.selectAll('text')
		.data(resolvedEdges)
		.join('text')
		.attr('font-size', 10)
		.attr('fill', '#555')
		.text(d => d.label);

	const node = g.append('g')
		.selectAll('g')
		.data(nodes, d => d.id)
		.join('g')
		.call(d3.drag<any, any>()
			.on('drag', (event, d: any) => {
				d.x = event.x;
				d.y = event.y;
				tick();
			}) as any);

	node.append('circle')
		.attr('r', nodeRadius)
		.attr('fill', d => acceptingStates.includes(d.id) ? 'lightgreen' : 'lightblue')
		.attr('stroke', '#333')
		.attr('stroke-width', d => acceptingStates.includes(d.id) ? 3 : 0.5);

	node.append('text')
		.attr('text-anchor', 'middle')
		.attr('dy', 4)
		.attr('font-size', 12)
		.text(d => d.id);

	function tick() {
		edge
			.attr('x1', (d: any) => d.source.x)
			.attr('y1', (d: any) => d.source.y)
			.attr('x2', (d: any) => d.target.x)
			.attr('y2', (d: any) => d.target.y);

		edgeLabel
			.attr('x', (d: any) => (d.source.x + d.target.x) / 2)
			.attr('y', (d: any) => (d.source.y + d.target.y) / 2);

		node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
	}

	tick();
}


$: if (graphWidth) {
	calculateLayout();
	drawGraph();
};

onMount(() => {
	graphWidth = svgElement.clientWidth;
	window.addEventListener('resize', () => {
		graphWidth = svgElement.clientWidth;
	});
});
</script>

<main>
	<h1>FSM Transitions (Interactive D3 Imperative)</h1>
	<svg bind:this={svgElement} />
</main>

<style>
svg {
	background-color: lightyellow;
	width: 100%;
	height: 600px;
	border: 1px solid #ccc;
}
</style>
