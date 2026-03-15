// computeCompletionMarkov.ts
// Beam-search completion from a partial input sequence.
//
// Improvements over greedy:
//   1. Beam search (width BEAM_WIDTH) — explores top-K branches in parallel,
//      returning multiple ranked completions instead of one greedy guess.
//   2. Confidence threshold — a branch is pruned when any single transition
//      probability drops below MIN_STEP_PROB, preventing low-confidence tails.
//   3. Prefix probability — the cumulative probability of the typed prefix is
//      returned alongside predictions, so the panel can show a confidence score.

export interface mTransition {
    from: string;
    to: string;
    probability?: number;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BeamCompletion {
    /** The predicted tokens (not including the typed prefix) */
    predictedTokens: string[];
    /** Full sequence: prefix + predicted tokens */
    fullSequence: string[];
    /** Cumulative probability of prefix + predicted portion combined */
    totalProbability: number;
    /** Probability of the typed prefix alone (same for all beams) */
    prefixProbability: number;
    /** true = walk reached terminal state; false = stopped early (cycle/threshold/steps) */
    terminatedNaturally: boolean;
    /** The terminal token used ("$", "END", or null) */
    endToken: string | null;
}

export interface CompletionResult {
    /** All beam completions, sorted best-first by totalProbability */
    beams: BeamCompletion[];
    /** The single best completion (beams[0]) — drop-in replacement for old greedy result */
    best: BeamCompletion;
    /** Probability of the typed prefix alone — use for confidence score display */
    prefixProbability: number;
    /** Human-readable confidence label derived from prefixProbability */
    confidenceLabel: "high" | "medium" | "low" | "unknown";
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BEAM_WIDTH      = 3;    // number of parallel completions to track
const MAX_STEPS       = 30;   // max predicted tokens per beam
const MIN_STEP_PROB   = 0.04; // prune branch if any single step prob < this
const MAX_VISITS      = 2;    // max times a state can appear in one beam (cycle guard)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function computeMarkovCompletion(
    inputTokens: string[],
    markovStates: string[],
    markovTransitions: mTransition[],
    endState: string[] = [],
): CompletionResult {

    const endToken: string | null =
        endState.length > 0                               ? endState[0]
        : markovTransitions.some(t => t.to === "END")    ? "END"
        : markovTransitions.some(t => t.to === "$")      ? "$"
        : null;

    const hasStartNode = markovTransitions.some(t => t.from === "START");

    const typedStates = markovStates.filter(
        s => s !== "START" && s !== "END" && s !== "$"
    );
    const isCharLevel =
        typedStates.length > 0 && typedStates.every(s => s.length === 1);

    const tokens: string[] = isCharLevel
        ? inputTokens.join("").split("")
        : inputTokens;

    // --- Walk the typed prefix to find the starting state ---
    let startState = hasStartNode ? "START" : (markovStates[0] ?? "");
    let prefixProbability = 1;

    for (const token of tokens) {
        const tr = bestTransition(startState, token, markovTransitions);
        if (!tr) {
            // Prefix dead-ends — return empty result with zero confidence
            return emptyResult(tokens, endToken, 0);
        }
        prefixProbability *= tr.probability ?? 1;
        startState = tr.to;
    }

    // --- Beam search from startState ---
    type Beam = {
        state: string;
        predicted: string[];
        logProb: number;          // log of cumulative predicted probability
        visitCounts: Map<string, number>;
        terminated: boolean;
    };

    const completedBeams: Array<Beam & { terminated: true }> = [];

    let activeBeams: Beam[] = [{
        state: startState,
        predicted: [],
        logProb: 0,               // log(1) = 0
        visitCounts: new Map(),
        terminated: false,
    }];

    for (let step = 0; step < MAX_STEPS && activeBeams.length > 0; step++) {
        const nextBeams: Beam[] = [];

        for (const beam of activeBeams) {
            if (endToken && beam.state === endToken) {
                completedBeams.push({ ...beam, terminated: true });
                continue;
            }

            const visits = beam.visitCounts.get(beam.state) ?? 0;
            if (visits >= MAX_VISITS) continue; // cycle — prune this branch

            const outgoing = markovTransitions
                .filter(t => t.from === beam.state && t.to !== "START")
                .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
                .slice(0, BEAM_WIDTH); // only expand top-K to control explosion

            for (const t of outgoing) {
                const stepProb = t.probability ?? 1;

                // Confidence threshold: prune low-probability steps
                if (stepProb < MIN_STEP_PROB) continue;

                if (endToken && t.to === endToken) {
                    // This beam reached the terminal — mark complete
                    completedBeams.push({
                        state: endToken,
                        predicted: beam.predicted,
                        logProb: beam.logProb + Math.log(stepProb),
                        visitCounts: beam.visitCounts,
                        terminated: true,
                    });
                    continue;
                }

                const newVisits = new Map(beam.visitCounts);
                newVisits.set(beam.state, visits + 1);

                nextBeams.push({
                    state: t.to,
                    predicted: [...beam.predicted, t.to],
                    logProb: beam.logProb + Math.log(stepProb),
                    visitCounts: newVisits,
                    terminated: false,
                });
            }
        }

        // Keep top BEAM_WIDTH active beams by logProb
        activeBeams = nextBeams
            .sort((a, b) => b.logProb - a.logProb)
            .slice(0, BEAM_WIDTH);
    }

    // Remaining active beams that didn't reach terminal — include as partial completions
    const allBeams = [
        ...completedBeams,
        ...activeBeams.map(b => ({ ...b, terminated: false as const })),
    ].sort((a, b) => b.logProb - a.logProb);

    if (allBeams.length === 0) {
        return emptyResult(tokens, endToken, prefixProbability);
    }

    const beamResults: BeamCompletion[] = allBeams.map(b => ({
        predictedTokens: b.predicted,
        fullSequence: [...tokens, ...b.predicted],
        totalProbability: prefixProbability * Math.exp(b.logProb),
        prefixProbability,
        terminatedNaturally: b.terminated,
        endToken,
    }));

    return {
        beams: beamResults,
        best: beamResults[0],
        prefixProbability,
        confidenceLabel: confidenceLabel(prefixProbability),
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyResult(
    tokens: string[],
    endToken: string | null,
    prefixProbability: number,
): CompletionResult {
    const empty: BeamCompletion = {
        predictedTokens: [],
        fullSequence: [...tokens],
        totalProbability: prefixProbability,
        prefixProbability,
        terminatedNaturally: false,
        endToken,
    };
    return {
        beams: [empty],
        best: empty,
        prefixProbability,
        confidenceLabel: confidenceLabel(prefixProbability),
    };
}

/**
 * Find the best matching transition for a given token from a given state.
 * Exact match first, then highest-probability prefix match (word-level fallback).
 */
function bestTransition(
    from: string,
    token: string,
    transitions: mTransition[],
): mTransition | null {
    const exact = transitions.find(t => t.from === from && t.to === token);
    if (exact) return exact;

    const prefixMatches = transitions
        .filter(t => t.from === from && t.to.startsWith(token))
        .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));

    return prefixMatches[0] ?? null;
}

/**
 * Human-readable confidence label for the prefix probability.
 * Thresholds are calibrated for char-level datasets where individual
 * transition probabilities are typically 0.05–0.5.
 */
function confidenceLabel(p: number): "high" | "medium" | "low" | "unknown" {
    if (p <= 0)     return "unknown";
    if (p >= 0.01)  return "high";
    if (p >= 0.001) return "medium";
    return "low";
}