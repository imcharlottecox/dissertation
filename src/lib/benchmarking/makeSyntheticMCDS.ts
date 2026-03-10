import type { mTransition } from "$lib/graph/graphTypes";

//this is Mulberry32, a standard 32bit PRNG (pseudorandom number generator) for Javascript to create a seeded random function
function createRandomSeed(seed: number) {
    return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}


export function makeSyntheticMCDS(context: {n: number; seed: number; noSelfLoops?: boolean;}){
    const {n, seed = 22, noSelfLoops = true,} = context;

    const rand = createRandomSeed(seed);
    const markovStates = Array.from({length: n}, (_,i) => `S${i}`);
    const maxPossible = noSelfLoops ? n*(n-1) : n*n;
    const targetEdges = Math.floor(0.2 * maxPossible);
    const edgesToFrom = new Map<string, string[]>();
    const seenEdges = new Set<string>();
    const startingStates = ["S0"];
    const acceptingStates = [`S${n-1}`];
    const markovTransitions: mTransition[] =[];

    //add random edges until target. sfety for infinite loop
    const maxAttempts = targetEdges * 20;
    let attempts = 0;

    while (seenEdges.size < targetEdges && attempts < maxAttempts) {
        attempts += 1;
        const i = Math.floor(rand() * n);
        const j = Math.floor(rand() * n);
        if (noSelfLoops && i===j ) continue;
        const from = `S${i}`
        const to = `S${j}`
        const id = `${from}-${to}`;
        if (seenEdges.has(id)) continue;

        seenEdges.add(id);

        if (!edgesToFrom.has(from)) edgesToFrom.set(from, []);
        edgesToFrom.get(from)!.push(to);
    }

    for (const [from, tos] of edgesToFrom.entries()) {
        const p = 1/tos.length;
        for (const to of tos){
            markovTransitions.push({from, to , probability:p});
        }
    }


    return {markovStates,startingStates,acceptingStates,markovTransitions};


}