import type { mTransition } from '$lib/graph/graphTypes';

export function ComputeProbabilityMarkov(transitions: mTransition[], sequence: string[]): number {
    if (sequence.length === 0) return 0;
    let probability = 1;
    
    const path = ["START", ...sequence, "$"];

    for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];
        const edge = transitions.find(t => t.from === from && t.to === to);

        if (!edge || edge.probability === undefined) {
            return 0; 
        }
        probability *= edge.probability;
    }
    return probability;
}