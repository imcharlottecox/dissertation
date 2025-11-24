<script lang="ts">
    import { onMount } from "svelte";
    import * as d3 from "d3";
    import { createDragNoSim, createDragSubgraph } from "$lib/graph/graphBehaviours";
    import type { fTransition, Subgraph, Warp, EdgeRenderDatum, StateNode } from "$lib/graph/graphTypes";
    import { getGraphDefaultsFSM } from "$lib/graph/graphDefaults";

    export let fsmStates: string[] = [];
    export let fsmTransitions: fTransition[] = [];
    export let acceptingStates: string[] = [];
    export let startingStates: string[] = [];
    export let subgraphs: Record<string, Subgraph> = {};
    export let warps: Warp[] = [];

    const { graphHeight, nodeRadius, padding } = getGraphDefaultsFSM();
    let graphWidth = 720;
    let svgElement: SVGSVGElement;
    const LABEL_OFFSET = 6;
    const LOOP_RADIUS = Math.max(nodeRadius + 12, 24);
    const cleanId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "_");

    let hiddenNodes = new Set<string>();

    let graphNodes: StateNode[] = [];
    let baseEdges: fTransition[] = [];
    let visibleEdges: fTransition[] = [];
    let graphState = {
        activeRoot: "0: START",
        expanded: new Set<string>(), //node w opened subgraphs
        nodes: [],
        edges: [],
    }
    let g: d3.Selection<SVGGElement, unknown, null, undefined>;
    let nodeRender: d3.Selection<SVGGElement, StateNode, SVGGElement, unknown>;
    let edgeRender: d3.Selection<SVGPathElement, EdgeRenderDatum, SVGGElement, unknown>;
    let labelRender: d3.Selection<SVGTextElement, EdgeRenderDatum, SVGGElement, unknown>;
    // let activeSubgraph: string | null = null;
    let activeSubgraphs: Set<string> = new Set();
    let subNodePositions: Record<string, { id: string; x: number; y: number, parent: string }> = {};

    function lookupNode(id: string): {id: string, x: number, y: number} | undefined {
        return graphNodes.find(n => n.id === id) || subNodePositions[id];
    }
    function showNode(id: string) {
        hiddenNodes.delete(id);
        nodeRender.filter(d => d.id === id).style("display", null);
        g.selectAll("g.subnode")
            .filter((d: any) => d.id === id)
            .style("display", null);
    }

    function hideNode(id: string) {
        hiddenNodes.add(id);
        nodeRender.filter(d => d.id === id).style("display", "none");
        g.selectAll("g.subnode").filter((d: any) => d.id === id).style("display", "none");
    }
    function handleNodeClick(id: string) {
        if (!subgraphs[id]) return; //if not a subgraph, ignore
        // if (activeSubgraph === id) { // todo logic doesnt work anymore bc parent node disappears when sub displayed
        //     removeSubgraph(id);
        // }
        // else drawSubgraph(id);
    }
    function isNodeInViewport(x: number, y: number, transform: any) {
        const sx = x * transform.k + transform.x;
        const sy = y * transform.k + transform.y;
        return sx >= 0 && sx <= graphWidth && sy >= 0 && sy <= graphHeight;
    }
    function splitWarp(target?: string) {
        if (!target) return { warpParent: "", warpEntryExit: "" };
        const parts = target.split(".");
        return {
            warpParent: parts.slice(0, -1).join("."),
            warpEntryExit: parts[parts.length - 1]
        };
    }


    function computeLevelsMap(edges: fTransition[], root: string, allStates: string[]): Map<string, number> {
        const adjacency = new Map<string, string[]>();
            edges.forEach(({ from, to }) => {
            if (!adjacency.has(from)) adjacency.set(from, []);
            adjacency.get(from)!.push(to);
        });

        const statesSet = new Set(allStates);
        statesSet.add(root);

        const levels = new Map<string, number>();
        const queue: string[] = [];
        levels.set(root, 0);
        queue.push(root);

        while (queue.length) {
            const current = queue.shift()!;
            const neighbours = adjacency.get(current) ?? [];
            neighbours.forEach(target => {
                if (!levels.has(target)) {
                    levels.set(target, (levels.get(current) ?? 0) + 1);
                    queue.push(target);
                }
            });
        }

        //give unreachable states a band at the end
        const maxLevel = levels.size ? Math.max(...levels.values()) : 0;
        statesSet.forEach(state => {
            if (!levels.has(state)) {
                levels.set(state, maxLevel + 1);
            }
        });

        return levels;
    }

    function computeNodePositions(levels: Map<string, number>, layoutWidth = graphWidth, layoutHeight = graphHeight, paddingOverride = padding): Map<string, { x: number; y: number }> {
        const grouped = new Map<number, string[]>();
        for (const [node, lvl] of levels.entries()) {
            if (!grouped.has(lvl)) grouped.set(lvl, []);
                grouped.get(lvl)!.push(node);
        };

        const levelKeys = Array.from(grouped.keys());
        //this way uses full graph width rather than being weirdly left offset like in fsmviewer
        const maxLevel = levelKeys.length ? Math.max(...levelKeys) : 0;
        const innerWidth = Math.max(layoutWidth - 2 * paddingOverride, 1);
        const innerHeight = Math.max(layoutHeight - 2 * paddingOverride, 1);
        const columnCount = Math.max(maxLevel, 1);
        const levelColumnSpacing = innerWidth / columnCount;

        const nodePositions = new Map<string, { x: number; y: number }>();
        for (const [lvl, nodes] of grouped.entries())  {
            const ySpacing = innerHeight / (nodes.length + 1);
            nodes.forEach((nodeId, index) => {
                nodePositions.set(nodeId, {
                    x: paddingOverride + lvl * levelColumnSpacing,
                    y: paddingOverride + (index + 1) * ySpacing
                });
            }); 
        };

        return nodePositions;
    }

    //hides the edges to/from a subgraph node 
    function applyWarpsFor() {

        //removes parent node edges
        console.log("active subg", activeSubgraphs);
        console.log("general subgraphs:", subgraphs);
        let edges: fTransition[] = [...baseEdges];

        for (const parentId of activeSubgraphs){
            const subgraph = subgraphs[parentId];
            if (!subgraph) {continue};
            // edges = edges.filter(e => e.from !== parentId && e.to !== parentId);
            edges = edges.filter(e => !hiddenNodes.has(e.from) && !hiddenNodes.has(e.to));

            const entryWarp = warps.find(w => {
                const { warpParent, warpEntryExit } = splitWarp(w.into);
                return warpParent === parentId && warpEntryExit === subgraph.entry;
            });
            //add edges entry warp to subgraph nodes
            if (entryWarp) {
                subgraph.transitions
                    .filter(t => t.from === subgraph.entry)
                    .forEach(t => {
                        if (t.to !== subgraph.exit) {
                            edges.push({
                                from: entryWarp.from,
                                to: t.to,
                                label: t.label
                            });
                        }
                    });
            }

            //add internal edges exclusing etry exit
            edges.push(...subgraph.transitions.filter(t => 
                t.from !== subgraph.entry && 
                t.to !== subgraph.exit &&
                t.from !== subgraph.exit &&
                t.to !== subgraph.entry
            ));

            const exitWarp = warps.find(w => {
                if (!w.from || !w.backto) return false;
                const { warpParent, warpEntryExit } = splitWarp(w.from);
                return warpParent === parentId && warpEntryExit === subgraph.exit;
            });
            if (exitWarp) {
                subgraph.transitions
                    .filter(t => t.to === subgraph.exit)
                    .forEach(t => {
                        edges.push({
                            from: t.from,
                            to: exitWarp.backto ?? "",
                            label: t.label
                        });
                    });
            }
        }

        visibleEdges = edges;
    }

    function drawEdges() {
        const coord = new Map();
        graphNodes.forEach(n => coord.set(n.id, { x: n.x, y: n.y }));
        Object.entries(subNodePositions).forEach(([id, p]) =>
            coord.set(id, { x: p.x, y: p.y })
        );

        const data: EdgeRenderDatum[] = visibleEdges
            .map(t => {
                const source = coord.get(t.from);
                const target = coord.get(t.to);
                if (!source || !target) return null;
                const isLoop = t.from === t.to;
                const labelX = (source.x + target.x) / 2;
                const labelY = (source.y + target.y) / 2 - LABEL_OFFSET;
                const path = isLoop
                    ? `M ${source.x} ${source.y}
                    C ${source.x - LOOP_RADIUS}, ${source.y - LOOP_RADIUS * 2},
                        ${source.x + LOOP_RADIUS}, ${source.y - LOOP_RADIUS * 2},
                        ${target.x +3}, ${target.y}`
                    : `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
                return {
                    key: `${t.from}-${t.to}-${t.label}`,
                    label: t.label,
                    fromId: t.from,
                    toId: t.to,
                    source,
                    target,
                    path,
                    labelX,
                    labelY: isLoop? labelY -40 : labelY,
                    isLoop
                };
            })
            .filter(Boolean) as EdgeRenderDatum[];

        edgeRender = g
            .select<SVGGElement>(".edges")
            .selectAll<SVGPathElement, EdgeRenderDatum>("path")
            .data(data, d => d.key)
            .join(
                // "path"
                enter => enter.append("path"),
                update => update,
                exit => exit.remove() 
            )
            .attr("fill", "none")
            .attr("stroke", "grey")
            .attr("marker-end", d =>
                d.isLoop ? "url(#arrowhead-loop)" : "url(#arrowhead-straight)"
            )
            .attr("d", (d: EdgeRenderDatum) => d.path);

        labelRender = g
            .select<SVGGElement>(".labels")
            .selectAll<SVGTextElement, EdgeRenderDatum>("text")
            .data(data, d => d.key)
            .join(
                enter => enter.append("text"),
                update => update,
                exit => exit.remove() 
            )
            .attr("font-size", 9)
            .attr("text-anchor", "middle")
            .attr("x", d => d.labelX)
            .attr("y", d => d.labelY)
            .text(d => d.label ?? "");
    }

    function drawNodes() {
        const drag = createDragNoSim(drawEdges);

        nodeRender = g
            .select<SVGGElement>(".nodes")
            .selectAll<SVGGElement, StateNode>("g")
            .data(graphNodes)
            .join(enter => {
                const n = enter
                    .append("g")
                    .attr("transform", d => `translate(${d.x},${d.y})`)
                    .call(drag)
                    .on("click", (_, d: StateNode) => handleNodeClick(d.id));
                n.append("circle")
                .attr("r", nodeRadius)
                .attr("fill", d =>
                    acceptingStates.includes(d.id)
                    ? "lightgreen"
                    : startingStates.includes(d.id)
                    ? "lightgrey"
                    : "lightblue"
                )
                .attr("stroke", "black")
                .attr("stroke-width", d => (acceptingStates.includes(d.id) ? 3 : 0.5));

                n.append("text")
                .attr("text-anchor", "middle")
                .attr("dy", 4)
                .attr("font-size", 9)
                .text(d => d.id);

                return n;
            });

        nodeRender.attr("transform", d => `translate(${d.x},${d.y})`);
    }

    function drawSubgraph(parentId: string) {
        const subgraph = subgraphs[parentId];
        if (!subgraph) return;
        if (activeSubgraphs.has(parentId)) return;
        let parentNode = lookupNode(parentId);
        if (!parentNode) {
            const sg = subgraphs[parentId];
            if (sg?.parentState) {
                parentNode = lookupNode(sg.parentState);
            }
        }

        if (!parentNode) {
            console.warn("No parentNode found for", parentId);
            return;
        }

        const entryWarp = warps.find(w => {
            const { warpParent, warpEntryExit } = splitWarp(w.into);
            return warpParent === parentId && warpEntryExit === subgraph.entry;
        });
        const exitWarp = warps.find(w => {
            const { warpParent, warpEntryExit } = splitWarp(w.from);
            return warpParent === parentId && warpEntryExit === subgraph.exit;
        });

        const entryNode = entryWarp ? lookupNode(entryWarp.from) : parentNode;
        const exitNode = lookupNode(exitWarp?.backto ?? "") ?? parentNode;

        //only draw within parent's graph bounds todo: maybe implement layoutheight for y as well in case of busier graphs
        const minX = Math.min(entryNode?.x ?? 0, exitNode?.x ?? graphWidth);
        const maxX = Math.max(entryNode?.x ?? graphWidth, exitNode?.x ?? graphWidth);
        const layoutWidth = maxX - minX;
        const layoutHeight = 120; 
        const centerY = parentNode.y;
        const minY = centerY - layoutHeight / 2;

        const yBase = subgraph.level > 1 ? (centerY - layoutHeight / 2) : entryNode!.y;   

        const insideStates = subgraph.states.filter(s => s !== subgraph.entry && s !== subgraph.exit);
        const levels = computeLevelsMap(subgraph.transitions, subgraph.entry, subgraph.states);
        const allPositions = computeNodePositions(levels, layoutWidth, layoutHeight , 10); //subgraph relative xy positions

        const entryPortPos = allPositions.get(subgraph.entry);
        const entryX = entryPortPos?.x ?? padding;
        const entryY = entryPortPos?.y ?? padding;
                
        const pos = new Map();
        insideStates.forEach(id => {
            // If computeLevelsMap didn't assign a position, create one manually
            if (!allPositions.has(id)) {
                allPositions.set(id, {
                    x: entryX + Math.random() * 40,  // fallback layout
                    y: entryY + Math.random() * 40
                });
            }
            pos.set(id, allPositions.get(id)!);
        });

        const rename = `subgraph-${cleanId(parentId)}`;
        if (subgraph.parentState) {
            hideNode(subgraph.parentState);
        } else {
            hideNode(parentId);
        }

        const group = g.append("g").attr("class", rename).attr("opacity", 0);
        group.append("g").attr("class", "edges");
        group.append("g").attr("class", "labels");

        //transform x y into parent relative global positions
        const subNodes = insideStates.map(id => {
            const nodePos = pos.get(id);
            const xOffset = nodePos.x - entryX;
            const yOffset = nodePos.y - entryY;
            return {
                id,
                x: minX + xOffset,           
                y: yBase + yOffset,  
                starting: subgraph.startingStates.includes(id),
                accepting: subgraph.acceptingStates.includes(id)
            };
        });

        // subNodePositions = {};
        for (const id of Object.keys(subNodePositions)) {
            if (subNodePositions[id].parent === parentId) {
                delete subNodePositions[id];
            }
        }
        subNodes.forEach(n => (subNodePositions[n.id] = { x: n.x, y: n.y, parent: parentId })); //global nodestates needed for sub edge drawing
        
        console.log("Positions computed:", allPositions);
        console.log("Final subNodes:", subNodes);
        
        const drag = createDragSubgraph(drawEdges, subNodePositions);
        const xs = subNodes.map(n => n.x);
        const ys = subNodes.map(n => n.y);

        const paddingHalo = 30; // softness margin

        const haloX = d3.min(xs)! - paddingHalo;
        const haloY = d3.min(ys)! - paddingHalo;
        const haloW = (d3.max(xs)! - haloX) + paddingHalo;
        const haloH = (d3.max(ys)! - haloY) + paddingHalo;
        const HALO_COLOURS = {
            1: "rgba(230,230,230,0.35)", 
            2: "rgba(210,210,255,0.25)", 
            3: "rgba(200,255,200,0.20)",
        };

        group.insert("rect", ":first-child")
            .attr("class", "halo-rect")
            .attr("x", haloX)
            .attr("y", haloY)
            .attr("width", haloW)
            .attr("height", haloH)
            .attr("rx", 10)
            .attr("fill", HALO_COLOURS[subgraph.level] || "rgba(220,220,220,0.3)")
            .attr("stroke", "rgba(120,120,120,0.5)")
            .attr("stroke-width", 1)
            .style("opacity", 0)
            .transition()
            .duration(200)
            .style("opacity", 1);
        
        group.selectAll("g.subnode")
            .data(subNodes)
            .join(enter => {
                const sn = enter
                    .append("g")
                    .attr("class", "subnode")
                    .attr("transform", d => `translate(${d.x},${d.y})`)
                    .call(drag);

                sn.append("circle")
                    .attr("r", 12)
                    .attr("stroke", "black")
                    .attr("stroke-width", d => (d.accepting ? 2 : 1))
                    .attr("fill", d => d.accepting ? "lightgreen" : d.starting ? "lightgrey" : "lightblue");

                sn.append("text")
                    .attr("text-anchor", "middle")
                    .attr("dy", 4)
                    .attr("font-size", 9)
                    .text(d => d.id);
    


        group.append("text")
            .attr("class", "halo-label")
            .attr("x", haloX + haloW/12)
            .attr("y", haloY + 8)
            .attr("font-size", 6)
            .attr("fill", "grey")
            .text(`from: ${parentId}`);
                return sn;
            });

        activeSubgraphs.add(parentId);
        applyWarpsFor();
        drawEdges();
        labelRender.raise();
        group.raise().transition().duration(200).attr("opacity", 1);
    }

    function removeSubgraph(parentId: string) {
        const className = `.subgraph-${cleanId(parentId)}`;
        // const className = `subgraph-${cleanId(parentId)}`;

        g.selectAll(className).transition().duration(150).attr("opacity", 0).remove();
        const sg = subgraphs[parentId];
        // reshow parent nodes 
        if (sg?.parentState) {
            showNode(sg.parentState);
        } else {
            showNode(parentId);
        }
        for (const id of Object.keys(subNodePositions)) {
            if (subNodePositions[id].parent === parentId) {
                delete subNodePositions[id];
            }
        }
        
        activeSubgraphs.delete(parentId);
        visibleEdges = [...baseEdges];
        applyWarpsFor();
        drawEdges();
    }

    function handleSemanticZoom(k: number, transform: any) {
        const width = graphWidth; //curent viewport size - may change
        const height = graphHeight;
        const threshold1 = 1.0;  
        const threshold2 = 2.0;  
        const threshold3 = 3.0; 

        for (const parentId of Object.keys(subgraphs)) {
            const sg = subgraphs[parentId];
            let parentNode = lookupNode(parentId);

            if (!parentNode && sg.parentState) {
                parentNode = lookupNode(sg.parentState);
            }

            if (!parentNode) {
                //cant draw this subgraph yet but will keep scanning
                console.warn("Skipping, parentNode missing for", parentId);
                continue;
            }

            const level = sg.level ?? 1;
            if (!isNodeInViewport(parentNode.x, parentNode.y, transform)) continue;

            let shouldExpand =
                (level <= 1 && k >= threshold1) ||
                (level <= 2 && k >= threshold2) ||
                (level <= 3 && k >= threshold3);

            if (shouldExpand) {
                //expand only if not already expanded
                if (!activeSubgraphs.has(parentId)) {
                    drawSubgraph(parentId);
                    applyWarpsFor();
                    drawEdges();
                    labelRender.raise();
                }
            } else {
                if (activeSubgraphs.has(parentId)) {
                    removeSubgraph(parentId); //collapse if now below threshold
                    applyWarpsFor();
                    drawEdges();
                    labelRender.raise();
                }
            }
            for (const sgId of Object.keys(subgraphs)) {
                const pos = subNodePositions[sgId];
                if (!pos) continue; // not drawn at this level

                if (isNodeInViewport(pos.x, pos.y, transform)) {
                    if (!activeSubgraphs.has(sgId)) {
                        drawSubgraph(sgId);
                        applyWarpsFor();
                        drawEdges();
                    }
                }
}           
        }
    }

    
    onMount(() => {
        graphWidth = svgElement.clientWidth;
        const levels = computeLevelsMap(fsmTransitions, "0:START", fsmStates);
        const pos = computeNodePositions(levels);
        graphNodes = fsmStates.map(id => ({
            id,
            x: pos.get(id)?.x ?? graphWidth / 2,
            y: pos.get(id)?.y ?? graphHeight / 2
        }));

        baseEdges = fsmTransitions;
        visibleEdges = [...baseEdges];

        const svg = d3.select(svgElement);
        g = svg.append("g").attr("class", "content-group");
        g.append("g").attr("class", "edges");
        g.append("g").attr("class", "labels");
        g.append("g").attr("class", "nodes");
        
        let zoomLevel = 1;
        let zoomNeedsEval = false;
        let evaluating = false;
        let lastTransform = null;

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .on('zoom', (event) => {
                zoomLevel = event.transform.k;
                g.attr('transform', event.transform);
                // handleSemanticZoom(zoomLevel, event.transform);

                lastTransform = event.transform;
                zoomNeedsEval = true;
                requestAnimationFrame(semanticTickGuard);
            });
        svg.call(zoom);
        
        function semanticTickGuard() {
            if (evaluating || !zoomNeedsEval) return;
            evaluating = true;
            zoomNeedsEval = false;
            handleSemanticZoom(lastTransform.k, lastTransform);
            evaluating = false;
        }


        const defs = svg.append("defs");
        defs.append("defs")
            .append("marker")
            .attr("id", "arrowhead-straight")
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("refX", 20)
            .attr("refY", 3)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M 0 0 L 6 3 L 0 6 z");

        defs.append("defs")
            .append("marker")
            .attr("id", "arrowhead-loop")
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("refX", 19)
            .attr("refY", 2)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M 0 0 L 6 3 L 0 6 z");
        
        defs.append("filter")
            .attr("id", "halo-glow")
            .attr("x", "-50%")
            .attr("y", "-50%")
            .attr("width", "200%")
            .attr("height", "200%")
            .html(`
                <filter id="halo-glow">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur"/>
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.3"/>
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <filter id="halo-blur">
                    <feGaussianBlur stdDeviation="6" result="blur"/>
                </filter>
            `);

        drawNodes();
        drawEdges();
   });

</script>

 <svg bind:this={svgElement} width="100%" height="600"></svg>

<style>
    svg {
        background: snow;
        border: 1px solid #ccc;
        display: block;
    }
</style>