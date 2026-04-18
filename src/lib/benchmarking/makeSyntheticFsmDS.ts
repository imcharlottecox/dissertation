import type { fTransition } from "$lib/graph/graphTypes";

//this is Mulberry32, a standard 32bit PRNG (pseudorandom number generator) for Javascript to create a seeded random function
export function createRandomSeed(seed: number) {
    return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}


export function makeSyntheticFsmDS(context: {n: number; seed: number; includeBackbone?: boolean; noSelfLoops: boolean; noDupeEdges: boolean;}){
    const {n, seed = 22, includeBackbone = true, noSelfLoops = true, noDupeEdges = true} = context;

    const rand = createRandomSeed(seed);
    const fsmStates = Array.from({length: n}, (_,i) => `S${i}`);
    const startingStates = ["S0"];
    const acceptingStates = [`S${n-1}`];
    const fsmTransitions: fTransition[] =[];

    const seen = noDupeEdges ? new Set<string>() : null;
    const add = (from: string, to: string, label: string) => {
        if(noSelfLoops && from === to) return;
        if (seen){
            const key = `${from}|${to}|${label}`;
            if (seen.has(key)) return false;
            seen.add(key);
        }
        fsmTransitions.push({from, to, label});
        return true;
    }

    if (includeBackbone){
        for (let i = 0; i < n - 1; i++) {
            add(`S${i}`, `S${i+1}`, "next");
        }
    }

    const macPossible = noSelfLoops ? n*(n-1) : n*n;
    const targetEdges = Math.floor(0.2 * macPossible);

    //add random edges until target. sfety for infinite loop
    const maxAttempts = targetEdges * 20;
    let attempts = 0;

    while (fsmTransitions.length < targetEdges && attempts < maxAttempts) {
        attempts += 1;
        const i = Math.floor(rand() * n);
        const j = Math.floor(rand() * n);
        add(`S${i}`, `S${j}`, "x");
    }

    return {fsmStates,startingStates,acceptingStates,fsmTransitions};


}