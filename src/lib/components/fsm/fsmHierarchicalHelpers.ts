import type { fTransition } from "$lib/graph/graphTypes";

export function splitWarp(target?: string) {
    if (!target) return { warpParent: "", warpEntryExit: "" };
    const parts = target.split(".");
    return {
        warpParent: parts.slice(0, -1).join("."),
        warpEntryExit: parts[parts.length - 1]
    };
}

export function computeLevelsMap(edges: fTransition[], root: string, allStates: string[], benchmarkReport?: (phase: string, ms: number)=> void): Map<string, number> {
    let t = performance.now()
    
    const adjacency = new Map<string, string[]>();
        edges.forEach(({ from, to }) => {
            if (!adjacency.has(from)) adjacency.set(from, []);
            adjacency.get(from)!.push(to);
        });
    
    benchmarkReport?.("adjacency_build", performance.now() - t);
    t = performance.now(); 

    const statesSet = new Set(allStates);
    statesSet.add(root);

    const levels = new Map<string, number>();
    const queue: string[] = [];
    levels.set(root, 0);
    queue.push(root);

    benchmarkReport?.("bfs_levels_init", performance.now() - t);
    t = performance.now();

    while (queue.length) {
        const current = queue.shift()!; //TODO BENCHMARK EDIT?
        const neighbours = adjacency.get(current) ?? [];
        neighbours.forEach(target => {
            if (!levels.has(target)) {
                levels.set(target, (levels.get(current) ?? 0) + 1);
                queue.push(target);
            }
        });
    }
    benchmarkReport?.("bfs_levels_compute", performance.now() - t);
    t = performance.now();


    //give unreachable states a band at the end
    const maxLevel = levels.size ? Math.max(...levels.values()) : 0;
    statesSet.forEach(state => {
        if (!levels.has(state)) {
            levels.set(state, maxLevel + 1);
        }
    });

    benchmarkReport?.("compute_unreachable_nodes", performance.now() - t);

    return levels;
}



export function computeNodePositions(levels: Map<string, number>, layoutWidth: number, layoutHeight: number, paddingOverride: number): Map<string, { x: number; y: number }> {
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

export function computeNodePositionsWithBackbone(levels: Map<string, number>, layoutWidth: number, layoutHeight: number, paddingOverride: number, acceptingStates: string[], edges: fTransition[], root: string, benchmarkReport?: (phase: string, ms: number)=> void): Map<string, { x: number; y: number }> {
    let t = performance.now()

    const grouped = new Map<number, string[]>();
    for (const [node, lvl] of levels.entries()) {
        if (!grouped.has(lvl)) grouped.set(lvl, []);
            grouped.get(lvl)!.push(node);
    };

    benchmarkReport?.("group_nodes_by_level", performance.now() - t);
    t = performance.now();
    const levelKeys = Array.from(grouped.keys());
    //this way uses full graph width rather than being weirdly left offset like in fsmviewer
    const maxLevel = levelKeys.length ? Math.max(...levelKeys) : 0;
    const innerWidth = Math.max(layoutWidth - 2 * paddingOverride, 1);
    const innerHeight = Math.max(layoutHeight - 2 * paddingOverride, 1);
    const columnCount = Math.max(maxLevel, 1);
    const levelColumnSpacing = innerWidth / columnCount;

    const acceptingSet = new Set(acceptingStates);
    const straighPath = findStraightPath(edges, levels, root, acceptingSet);

    benchmarkReport?.("find_straight_path", performance.now() - t);
    t = performance.now();
    const yCenter = paddingOverride + innerHeight/2;
    const nodePositions = new Map<string, { x: number; y: number }>();

    for (const [lvl, nodes] of grouped.entries())  {
        const ySpacing = innerHeight / (nodes.length + 1);
        const x = paddingOverride + lvl * levelColumnSpacing;

        const straightpathNode = nodes.find(state => straighPath.includes(state));
        if (straightpathNode) nodePositions.set(straightpathNode, {x, y: yCenter});
        const rest = nodes.filter(state => state !== straightpathNode);
        rest.sort();

        const gap = layoutHeight/(Math.ceil(rest.length *2.2));
        rest.forEach((state, i) => {
            const k = Math.floor(i/2)+1;
            const direction = (i%2 === 0)? -1 : 1;
            nodePositions.set(state, {x, y: yCenter + direction*k*gap})
        })
        
    };

    benchmarkReport?.("node_positioning_loop", performance.now() - t);


    return nodePositions;
}


//acceptingStates is a set to avoid the O(L) time lookup of .includes, so we use .has instead
function findStraightPath(edges: fTransition[], levels: Map<string, number>, root: string, acceptingStates: Set<string>): string[] {
    //only want to look at paths increasing in level values. add it to a map
    const forward = new Map<string, string[]>();
    for (const {from, to} of edges){
        const source = levels.get(from);
        const sink = levels.get(to);
        if (source == null || sink ==null) continue;
        if (sink > source){
            //create list of forward neighbours for from, and push 'to' to it
            let forwNeighbList = forward.get(from);
            if (forwNeighbList == null){
                forwNeighbList = [];
                forward.set(from, forwNeighbList);
            }
            forwNeighbList.push(to);
        }
    }

    const ascLevelEntries = [...levels.entries()];
    ascLevelEntries.sort((u,v) => u[1] - v[1]); //if neg, u should be left of v
    const stateNamesOrdered = ascLevelEntries.map(nlPair => nlPair[0]);

    const score = new Map<string, number>();
    const previous = new Map<string, string | null>();
    score.set(root, 0)
    previous.set(root, null);
    
    for(const stateU of stateNamesOrdered){
        const scoreU = score.get(stateU);
        if (scoreU == null) continue; //start at route

        const levU = levels.get(stateU)!;
        for (const stateV of forward.get(stateU) ?? []){
            const levV = levels.get(stateV);

            const neighbourBonus = (levV == levU +1) ? 20 : 0;
            const updScore = scoreU + 10 - neighbourBonus;
            const scoreV = score.get(stateV);
            if (scoreV == null || updScore < scoreV){
                score.set(stateV, updScore);
                previous.set(stateV, stateU); //pointer for reconstructuion
            }
        }
    }

    let end = root;
    let best = Infinity;

    for (const [stateName, s] of score.entries()){
        const final = s - (acceptingStates.has(stateName)? 100 : 0);
        if (final < best){
            best = final;
            end = stateName;
        }
    }

    //path reconstruction
    const path: string[] = [];
    let currentState: string | null = end;
    while (currentState != null){
        path.push(currentState);
        const prevState = previous.get(currentState);
        if (prevState == null) break;
        currentState = prevState;

    }
    path.reverse();
    return path;
}