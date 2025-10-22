<script lang="ts">
import { onMount, tick } from 'svelte';
import * as d3 from 'd3';

type StateNode = {
	id: string;
	x: number;
	y: number;
	fx?: number | null;
	fy?: number | null;
};

type Transition = { from: string; to: string; label: string };

const acceptingStates = [
	'Cat', 'Car', 'Cart', 'Carton',
	'Cats', 'Cars', 'Carts', 'Cartons',
	'ACCEPT'
];

const fsmStates = [
	'START',
	'C',
	'Ca',        // Central axis (Index 2)
	'Cat',       // Top branch 1
	'Cats',      // Top branch 2 (plurals)
	'Car',       // Middle/Top path
	'Cars',      // Bottom branch 3 (plurals)
	'Cart',      // Middle/Top path
	'Carts',     // Bottom branch 4 (plurals)
	'Carto',     // Middle/Top path
	'Carton',    // Middle/Top path
	'Cartons'    // Middle/Top path (plurals)
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
let transitions: Transition[] = fsmTransitions.map(t => ({ ...t }));

console.log('nodes:', nodes, 'transitions:', transitions);

function calculateLayout() {
	const innerWidth = graphWidth - (2 * padding);
	const totalStates = fsmStates.length;
	const newNodes: StateNode[] = [];

	fsmStates.forEach((state, i) => {
		const x = padding + (i / (totalStates - 1)) * innerWidth;
		let y;

		if (state === 'START' || state === 'C' || state === 'Ca' || state === 'Car' || state === 'Cart' || state.startsWith('Carto')) {
			y = graphHeight * 0.5;
		} else if (state === 'Cat' || state === 'Cats') {
			y = graphHeight * 0.3;
		} else if (state === 'Cars' || state === 'Carts') {
			y = graphHeight * 0.7;
		} else {
			y = graphHeight * 0.5;
		}

		const existingNode = nodes.find(n => n.id === state);

		newNodes.push({
			id: state,
			x: existingNode?.fx ?? x,
			y: existingNode?.fy ?? y,
			fx: existingNode?.fx ?? x,
			fy: existingNode?.fy ?? y
		});
	});

	nodes = newNodes;
}


function drawGraph() {
	if (!svgElement) return;

	const svg = d3.select(svgElement);
	svg.selectAll('.content-group').remove();

	const currentNodes = nodes.map(node => ({ ...node }));
	const currentEdges = transitions.map(t => ({ ...t }));
	const nodeMap = new Map(currentNodes.map(n => [n.id, n]));

	const resolvedEdges = currentEdges
		.map(t => ({
			label: t.label,
			source: nodeMap.get(t.from),
			target: nodeMap.get(t.to)
		}))
		.filter(e => e.source && e.target);

	const g = svg.append('g').attr('class', 'content-group');

	// Zoom
	const zoom = d3.zoom<SVGSVGElement, unknown>().on('zoom', event => {
		g.attr('transform', event.transform);
	});
	svg.call(zoom as any);

	// Drag handler
	const tickFn = () => {
		edge
			.attr('x1', (d: any) => d.source.x)
			.attr('y1', (d: any) => d.source.y)
			.attr('x2', (d: any) => d.target.x)
			.attr('y2', (d: any) => d.target.y);

		edgeLabel
			.attr('x', (d: any) => (d.source.x + d.target.x) / 2)
			.attr('y', (d: any) => (d.source.y + d.target.y) / 2);

		node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
	};

	const dragHandler = d3.drag<any, any>()
		.on('start', (event, d: any) => {
			d.fx = d.x;
			d.fy = d.y;
		})
		.on('drag', (event, d: any) => {
			d.fx = d.x = event.x;
			d.fy = d.y = event.y;
			tickFn();
		})
		.on('end', (event, d: any) => {
			const index = nodes.findIndex(n => n.id === d.id);
			if (index !== -1) {
				nodes[index].fx = d.x;
				nodes[index].fy = d.y;
			}
		});

	// Edges
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

	// Nodes
	const node = g.append('g')
		.selectAll('g')
		.data(currentNodes, d => d.id)
		.join('g')
		.call(dragHandler as any);

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

	tickFn();
}

$: if (graphWidth) {
	calculateLayout();
	drawGraph();
}

onMount(() => {
	graphWidth = svgElement.clientWidth;

	const resizeHandler = () => {
		graphWidth = svgElement.clientWidth;
	};
	window.addEventListener('resize', resizeHandler);
	return () => window.removeEventListener('resize', resizeHandler);
});
</script>

<main>
	<h1>FSM Transitions (Interactive D3 Imperative)</h1>
	<svg bind:this={svgElement} style="height: {graphHeight}px;" />
</main>

<style>
svg {
	background-color: lightyellow;
	width: 100%;
	border: 1px solid #ccc;
}
</style>
