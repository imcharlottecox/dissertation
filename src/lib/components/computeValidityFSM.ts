import type { fTransition } from '$lib/graph/graphTypes';

export function ComputeValidityFSM(fsmTransitions: fTransition[], input: string[], acceptingStates: string[]): boolean {
    let currentState = "START";
    if (input.length === 0) return false;

    for (const token of input){
        const nextState = fsmTransitions.find(transition => transition.from === currentState && transition.label === token);
        if (nextState){
            currentState = nextState.to;
        } else {
            return false;
        }
    }
    return acceptingStates.includes(currentState);
}