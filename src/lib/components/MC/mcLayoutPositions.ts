import type { mTransition } from "$lib/graph/graphTypes";
import { view } from "motion/react-client";
type ViewerRows = {nodes: string[]; level: number; xOffset?: number};

export function computePositionLayout(markovTransitions: {from: string; to: string;}[], nodeRadius: number, renderKey: string, markovStates: string[], mStartingStates: string[], graphWidth: number, graphHeight: number, padding: number, anchor?:{x:number, y:number}) {
    const pad = 60;

    if (mStartingStates.length == 0){
        const innerW = graphWidth - 2*padding;
        const innerH = graphHeight - 2*padding;
        const centrex = padding + innerW / 2;
        const centrey = padding + innerH / 2;
        const angleStep = (2 * Math.PI) / markovStates.length;
        const positions = new Map<string, {x: number, y: number}>();


         markovStates.forEach((s, i) => {
            const angle = i * angleStep;
            const x = centrex + (innerW / 2 - nodeRadius - 10) * Math.cos(angle);
            const y = centrey + (innerH / 2 - nodeRadius - 10) * Math.sin(angle);
            positions.set(s, {x,y});
        });
        return positions;
    }

    // const adjacency = new Map<string, string[]>();
    // for (const t of markovTransitions){
    //     if (!adjacency.has(t.from)) adjacency.set(t.from, []);
    //     adjacency.get(t.from)?.push(t.to);
    // }

    //step 1: identify BFS levels for each node from start, if there is a starting state.
    const levels = computeBFSLevels(markovStates, markovTransitions, mStartingStates);
    if (renderKey === "5::7::S4:END::S0:START") applyDatasetSpecificOverride(levels, renderKey);
const distinctLevels = Array.from(new Set(levels.values())).sort((a, b) => a - b);
const levelRemap = new Map(distinctLevels.map((l, i) => [l, i]));
for (const [s, l] of levels) levels.set(s, levelRemap.get(l)!);

const maxLevel = distinctLevels.length - 1;
    //
    // Step 2: spread out nodes horizonatally within their vertical spacing BFS levels
    //
    const groupedByLevel = new Map<number, string[]>();
    for ( const [s,lvl] of levels){
        if (!groupedByLevel.has(lvl)) groupedByLevel.set(lvl, []);
        groupedByLevel.get(lvl)?.push(s);
    }

    const COLUMN_WIDTH = 56;
    const ROW_HEIGHT = 46;
    const LEVEL_GAP = 60;
    const maxNodesPerRow = Math.max(2, Math.floor((graphWidth -2*pad) / COLUMN_WIDTH) );
    const allSingletons = Array.from(groupedByLevel.values()).every(array => array.length ===1);
    const viewerRows: ViewerRows[] = [];
    const positions = new Map<string, {x: number, y: number}>();
    const ZIG = 55;
    const evenLevelSpacing = (graphHeight - 2*pad) / maxLevel;
    const rowsPerLevel = Array.from(groupedByLevel.values()).map(nodes => Math.ceil(nodes.length / maxNodesPerRow));
    const largestNumRowsPerLevel = Math.max(...rowsPerLevel);
    const fits = evenLevelSpacing >= (largestNumRowsPerLevel * ROW_HEIGHT *1.15); //for margin


    for (const lvl of Array.from(groupedByLevel.keys()).sort((a,b) => a-b)){
        const nodes: string[] = groupedByLevel.get(lvl) ?? [];
        if(allSingletons){
            viewerRows.push({nodes, level:lvl, xOffset: lvl % 2 === 1 ?  ZIG : -ZIG * 0.55});
        }else if (nodes.length <= maxNodesPerRow){
            viewerRows.push({nodes, level:lvl, xOffset: 0});
        } else {
            const ordered = intraLevelOrder(nodes, markovTransitions);
            for (let i = 0 ; i< ordered.length ; i+=maxNodesPerRow){
                viewerRows.push({nodes: ordered.slice(i, i+maxNodesPerRow), level: lvl, xOffset: 0});
            }
        }
    }
    
    if (anchor){
        const totalH = Math.max(viewerRows.length * ROW_HEIGHT, 80);
        const topY = anchor.y - totalH/2;
        viewerRows.forEach((row, rowi) => {
            const y = topY + rowi * ROW_HEIGHT + ROW_HEIGHT/2;
            const totalRowW = (row.nodes.length -1) * COLUMN_WIDTH;
            row.nodes.forEach((id, i) => {
                positions.set(id, {
                    x: anchor.x  + (row.xOffset ?? 0) +(row.nodes.length === 1 ? 0 : -totalRowW /2 + i*COLUMN_WIDTH),
                    y,
                });
            });
        });
    } else if(fits) {
            const innerH = graphHeight - 2 * pad;
            const levelSpacing = innerH / Math.max(maxLevel, 1);
            const levelRows = new Map<number, ViewerRows[]>();
            for (const row of viewerRows) {
                if (!levelRows.has(row.level)) levelRows.set(row.level, []);
                levelRows.get(row.level)!.push(row);
            }
            for (const [lvl, rows] of levelRows) {
                const levelCentreY = pad + lvl * levelSpacing;
                const totalRowsH   = (rows.length - 1) * ROW_HEIGHT;
                rows.forEach((row, ri) => {
                    const y = levelCentreY - totalRowsH / 2 + ri * ROW_HEIGHT;
                    const innerW = graphWidth - 2 * pad;
                    const colSpacing = innerW / (row.nodes.length + 1);
                    row.nodes.forEach((id, i) => {
                        positions.set(id, {
                            x: pad + (row.xOffset ?? 0) + colSpacing * (i + 1),
                            y,
                        });
                    });
                });
            }


    } else {
        let currentY = pad;
        let lastLevel = -1;
        viewerRows.forEach(row =>{
            if (lastLevel !== -1 && row.level !== lastLevel) currentY += LEVEL_GAP;
            lastLevel = row.level;
            const rowW = (row.nodes.length -1) * COLUMN_WIDTH;
            row.nodes.forEach((id, i) => {
                positions.set(id, {
                    x: graphWidth/2 +(row.nodes.length === 1 ? 0 : -rowW /2 + i*COLUMN_WIDTH) +(row.xOffset ?? 0),
                    y: currentY
                });
            });
            currentY += ROW_HEIGHT;
        });
    }

    return positions;
}



function intraLevelOrder(levelNodes: string[], transitions: mTransition[]){
    const nodes = new Set(levelNodes);
    const intraAdj = new Map<string, string[]>();
    const intraDegree = new Map<string, number>();
    
    for (const n of levelNodes){
        intraAdj.set(n, []);
        intraDegree.set(n, 0);
    }

    for (const t of transitions){
        if (nodes.has(t.from) && nodes.has(t.to)){
            intraAdj.get(t.from)?.push(t.to);
            intraAdj.get(t.to)?.push(t.from);
            intraDegree.set(t.from, (intraDegree.get(t.from) ?? 0) + 1);
            intraDegree.set(t.to, (intraDegree.get(t.to) ?? 0) + 1);
        }
    }

    const sortedOrder = [...levelNodes].sort((a, b) => (intraDegree.get(b) ?? 0) - (intraDegree.get(a) ?? 0));
    const visited = new Set<string>();
    const ordered: string[] = [];
    const queue: string[] = [];

    for (const s of sortedOrder){
        if (visited.has(s)) continue;
        queue.push(s);
        visited.add(s);
        while(queue.length>0){
            const current = queue.shift()!;
            ordered.push(current);
            const neighbours = (intraAdj.get(current) ?? []).filter(n => !visited.has(n)).sort((a,b) => (intraDegree.get(b) ?? 0) - (intraDegree.get(a) ?? 0));
            for (const n of neighbours){
                visited.add(n);
                queue.push(n);
            }
        }
    }
    return ordered;
}
function computeBFSLevels(markovStates: string[], markovTransitions: mTransition[], mStartingStates: string[]){
    const adjacency = new Map<string, string[]>();
    for (const t of markovTransitions){
        if (!adjacency.has(t.from)) adjacency.set(t.from, []);
        adjacency.get(t.from)?.push(t.to);
    }

    //step 1: identify BFS levels for each node from start, if there is a starting state.
    const levels = new Map<string,number>();
    // const queue: string[];
    // for (const s of mStartingStates) {
    //     levels.set(s, 0);
    //     queue.push(s);
    //         console.log("queue:", queue, "mStartingStates:", mStartingStates, "s", s );

    // }
    const start = mStartingStates[0] ?? markovStates[0];
    levels.set(start, 0);
    const queue = [start];


    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const next of adjacency.get(current) ?? []) {
            if (!levels.has(next)) {
                levels.set(next, (levels.get(current) ?? 0) + 1);
                queue.push(next);
            }
        }
    }
    const maxLevel = Math.max(...levels.values());
    for (const state of markovStates) if (!levels.has(state)) levels.set(state, maxLevel+1); //singletons

    return levels;
}

function applyDatasetSpecificOverride(levels: Map<string, number>, renderKey: string){
    if (levels.get("=") === 3|| levels.get(" ") === 2) {
        levels.set("=", 1.5);
        levels.set(" ", 1.5);
    }
    if (renderKey === "5::7::S4:END::S0:START"){
        const letters = "abcdefghijklmnopqrstuvwxyz";
        const digits = new Set("0123456789".split(""));
        const row1 = new Set(letters.slice(0, 14).split(""));
        const row2 = new Set(letters.slice(14).split(""));
        for (const [id, lvl] of levels.entries()) {
        if (digits.has(id)) {
            levels.set(id, 2.5);
            continue;
        }
        const base = id.toLowerCase();
        if (row1.has(base)) levels.set(id, 0.6);
        else if (row2.has(base)) levels.set(id, 1.1);
        }
        if (levels.get("_") === 1) levels.set("_", 1.1);
    }

}


// function computeWordChainLayout(
//     sectionId: string,
//     anchorX: number,
//     anchorY: number,
// ): Map<string, { x: number; y: number }> {
//     const chain = wordChains[sectionId];
//     if (!chain) return new Map();
//     const { markovStates: words, markovTransitions: trans, mStartingStates: starts } = chain;

//     const adj = new Map<string, string[]>();
//     for (const t of trans) {
//         if (!adj.has(t.from)) adj.set(t.from, []);
//         adj.get(t.from)!.push(t.to);
//     }

//     const levels = new Map<string, number>();
//     const startWord = starts[0] ?? words[0];
//     const queue = [startWord];
//     levels.set(startWord, 0);
//     while (queue.length) {
//         const cur = queue.shift()!;
//         for (const nb of adj.get(cur) ?? []) {
//             if (!levels.has(nb)) {
//                 levels.set(nb, (levels.get(cur) ?? 0) + 1);
//                 queue.push(nb);
//             }
//         }
//     }
//     const maxLvl = levels.size ? Math.max(...levels.values()) : 0;
//     for (const w of words) if (!levels.has(w)) levels.set(w, maxLvl + 1);

//     const byLevel = new Map<number, string[]>();
//     for (const [w, l] of levels) {
//         if (!byLevel.has(l)) byLevel.set(l, []);
//         byLevel.get(l)!.push(w);
//     }
// // Layout constants
//     const COL_W         = 52;
//     const ROW_H         = 42;
//     const SQUEEZE_PX    = 260;
//     const MAX_ROW_NODES = Math.max(2, Math.floor(SQUEEZE_PX / COL_W));
//     const ZIG           = 40;

//     const allSingletons = Array.from(byLevel.values()).every(arr => arr.length === 1);

//     function intraLevelOrder(levelNodes: string[]): string[] {
//         const nodeSet = new Set(levelNodes);

//         const intraAdj = new Map<string, string[]>();
//         const intraDeg = new Map<string, number>();
//         for (const n of levelNodes) { intraAdj.set(n, []); intraDeg.set(n, 0); }

//         for (const t of trans) {
//             if (nodeSet.has(t.from) && nodeSet.has(t.to)) {
//                 intraAdj.get(t.from)!.push(t.to);
//                 intraAdj.get(t.to)!.push(t.from); // undirected so BFS spreads both ways
//                 intraDeg.set(t.from, (intraDeg.get(t.from) ?? 0) + 1);
//                 intraDeg.set(t.to,   (intraDeg.get(t.to)   ?? 0) + 1);
//             }
//         }

//         const sorted = [...levelNodes].sort((a, b) => (intraDeg.get(b) ?? 0) - (intraDeg.get(a) ?? 0));
//         const visited = new Set<string>();
//         const ordered: string[] = [];
//         const bfsQ: string[] = [];

//         for (const seed of sorted) {
//             if (visited.has(seed)) continue;
//             bfsQ.push(seed);
//             visited.add(seed);
//             while (bfsQ.length) {
//                 const cur = bfsQ.shift()!;
//                 ordered.push(cur);
//                 const neighbours = (intraAdj.get(cur) ?? [])
//                     .filter(n => !visited.has(n))
//                     .sort((a, b) => (intraDeg.get(b) ?? 0) - (intraDeg.get(a) ?? 0));
//                 for (const nb of neighbours) { visited.add(nb); bfsQ.push(nb); }
//             }
//         }

//         return ordered;
//     }

//     type PhysRow = { nodes: string[]; xOffset: number };
//     const physRows: PhysRow[] = [];

//     for (const lvl of Array.from(byLevel.keys()).sort((a, b) => a - b)) {
//         const nodes = byLevel.get(lvl)!;

//         if (allSingletons) {
//             physRows.push({ nodes, xOffset: lvl % 2 === 1 ? ZIG : -ZIG * 0.35 });
//         } else if (nodes.length * COL_W > SQUEEZE_PX && nodes.length > MAX_ROW_NODES) {
//             const ordered = intraLevelOrder(nodes);
//             for (let i = 0; i < ordered.length; i += MAX_ROW_NODES)
//                 physRows.push({ nodes: ordered.slice(i, i + MAX_ROW_NODES), xOffset: 0 });
//         } else {
//             physRows.push({ nodes, xOffset: 0 });
//         }
//     }

//     const totalH = Math.max(physRows.length * ROW_H, 80);
//     const topY   = anchorY - totalH / 2;
//     const positions = new Map<string, { x: number; y: number }>();

//     physRows.forEach((row, rowIdx) => {
//         const y = topY + rowIdx * ROW_H + ROW_H / 2;
//         const totalRowW = (row.nodes.length - 1) * COL_W;
//         row.nodes.forEach((id, i) => {
//             positions.set(id, {
//                 x: anchorX + row.xOffset + (row.nodes.length === 1 ? 0 : -totalRowW / 2 + i * COL_W),
//                 y,
//             });
//         });
//     });
    
//     return positions;
// }