import type { fTransition } from '$lib/graph/graphTypes';

export function ComputeFlatValidityFSM(fsmTransitions: fTransition[], input: string[], acceptingStates: string[], startingStates: string[]): boolean {
    if (input.length === 0) return false;
    let currentStates = new Set(startingStates);

    for (const token of input){
        const nextState = new Set<string>();
        for (const state of currentStates){
            for (const t of fsmTransitions){
                if (t.from === state && t.label === token){
                    nextState.add(t.to);
                }
            }
        }
        if (nextState.size == 0) return false;
        currentStates = nextState;
    }
    for (const s of currentStates){
        if (acceptingStates.includes(s)) return true;
    }
    return false;
}

