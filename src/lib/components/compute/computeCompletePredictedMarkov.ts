export interface mTransition {
    from: string;
    to: string;
    probability?: number;
}

export interface BeamCompletion {
    predictedTokens: string[];
    fullSequence: string[];
    totalProbability: number;
    prefixProbability: number;
    terminatedNaturally: boolean;
    endToken: string | null;
}

export interface CompletionResult {
    beams: BeamCompletion[];
    best: BeamCompletion;
    prefixProbability: number;
    confidenceLabel: "high" | "medium" | "low" | "unknown";
}


const BEAM_WIDTH = 3;   
const MAX_STEPS = 30;  
const MIN_STEP_PROB = 0.04; 
const MAX_VISITS = 2;    


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

    let startState = hasStartNode ? "START" : (markovStates[0] ?? "");
    let prefixProbability = 1;

    for (const token of tokens) {
        const tr = bestTransition(startState, token, markovTransitions);
        if (!tr) {
            return emptyResult(tokens, endToken, 0);
        }
        prefixProbability *= tr.probability ?? 1;
        startState = tr.to;
    }

    type Beam = {
        state: string;
        predicted: string[];
        logProb: number;          
        visitCounts: Map<string, number>;
        terminated: boolean;
    };

    const completedBeams: Array<Beam & { terminated: true }> = [];

    let activeBeams: Beam[] = [{
        state: startState,
        predicted: [],
        logProb: 0,               
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
            if (visits >= MAX_VISITS) continue; 

            const outgoing = markovTransitions
                .filter(t => t.from === beam.state && t.to !== "START")
                .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
                .slice(0, BEAM_WIDTH); 

            for (const t of outgoing) {
                const stepProb = t.probability ?? 1;

                if (stepProb < MIN_STEP_PROB) continue;

                if (endToken && t.to === endToken) {
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

        activeBeams = nextBeams
            .sort((a, b) => b.logProb - a.logProb)
            .slice(0, BEAM_WIDTH);
    }

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

function confidenceLabel(p: number): "high" | "medium" | "low" | "unknown" {
    if (p <= 0)     return "unknown";
    if (p >= 0.01)  return "high";
    if (p >= 0.001) return "medium";
    return "low";
}