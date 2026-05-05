import type { mTransition } from "$lib/graph/graphTypes";

export function ComputeProbabilityMarkov(transitions: mTransition[], sequence: string[]): {steps: Array<mTransition>; probability: number} {
    if (sequence.length === 0) return {steps: [], probability: 0};

    const path = ["START", ...sequence];
    const steps: Array<mTransition> = [];
    let logTotal = 0;

    for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];
        const edge = transitions.find(t => t.from === from && t.to === to);

        if (!edge || edge.probability === undefined) {
            steps.push({from, to, probability: 0})
            return {steps, probability: 0};
        }
        steps.push({ from, to, probability: edge.probability});
        logTotal += Math.log(edge.probability);
    }


    //reward seqs that end in an accepting state
    const lastState = path[path.length - 1];
    const endToken = transitions.some(t => t.to === "END") ? "END": transitions.some(t => t.to === "$") ? "$" : null;

    if (endToken) {
        const endEdge = transitions.find(t => t.from === lastState && t.to === endToken);
        if (endEdge) {
            logTotal += Math.log(endEdge.probability);
            steps.push({from: lastState, to: endToken, probability: endEdge.probability});
        }
    }

    return {steps, probability: Math.exp(logTotal)};
}