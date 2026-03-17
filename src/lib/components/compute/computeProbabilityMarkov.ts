import type { mTransition } from '$lib/graph/graphTypes';

export function ComputeProbabilityMarkov(transitions: mTransition[], sequence: string[]): number {
    if (sequence.length === 0) return 0;
    let probability = 1;
    
    const path = ["START", ...sequence, "END"];

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

export function computePrefixProbabilityMarkov(
  transitions: { from: string; to: string; probability?: number }[],
  inputTokens: string[],
  startState = "START"
): number {
  if (inputTokens.length === 0) return 0;

  let currentState = startState;
  let probability = 1;

  for (const token of inputTokens) {
    const exact = transitions.find(
      t => t.from === currentState && t.to === token
    );

    const next =
      exact ??
      transitions
        .filter(t => t.from === currentState && t.to.startsWith(token))
        .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))[0];

    if (!next || next.probability === undefined) return 0;

    probability *= next.probability;
    currentState = next.to;
  }

  return probability;
}