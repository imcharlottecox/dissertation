import type { mTransition } from "$lib/graph/graphTypes";

type Beam ={
    state: string;
    predicted: string[];
    logProb: number;
    visits: Record<string, number>;
    terminated: boolean;
}

const MAX_STEPS = 50;
const MAX_VISITS = 2;
const BEAM_WIDTH = 3;
const MIN_STEP_PROBABILITY = 0.001;

export function computeMarkovPredicted(inputTokens: string[], markovStates: string[], markovTransitions: mTransition[], endState: string[]=[]){
    let endToken;
    if(endState.length>0){
        endToken = endState[0];
    } else if (markovTransitions.some(tran => tran.to ==="END"))
    { 
        endToken = "END";
    } else if(markovTransitions.some(tran => tran.to ==="$")){
        endToken = "$";
    } else{
        endToken = null;
    }

    const typedStates = markovStates.filter(state => state!== "START" && state !== "END" && state !== "$");
    const isCharLevel = typedStates.length>0 && typedStates.every(state => state.length ===1);
    const tokens = isCharLevel ? inputTokens.join("").split("") : inputTokens;

    const hasStartNode = markovTransitions.some(tran => tran.from === "START");
    let currentState = hasStartNode ? "START" : (markovStates[0]??"");
    let typedProbability = 1;

    for (const token of tokens){
        const t = markovTransitions.find(t => t.from === currentState && t.to === token);
        if (!t){
            const empty = {predictedTokens: [], fullSequence: [...tokens], typedProbability: 0, predictedSeqProbability: 0, terminatedNaturally: false};
            return {beams: [empty], best: empty, typedProbability:0 , confidenceLabel:"unknown"};
        }
        typedProbability *= t.probability ?? 1;
        currentState = t.to;
    }


    let activeBeams: Beam[] = [{
        state: currentState,
        predicted: [],
        logProb: 0,
        visits: {},
        terminated: false
    }];
    const completedBeams:Beam[] = [];

    for (let i=0; i< MAX_STEPS && activeBeams.length>0; i++ ){
        const nextBeams: Beam[] = [];

        for (const beam of activeBeams){
            //if beams reached the end token
            if (endToken && beam.state === endToken){
                completedBeams.push({...beam, terminated: true});
                continue;
            }
            //infinite loop guard if already visited here
            const timesVisited = beam.visits[beam.state] ?? 0;
            if (timesVisited >= MAX_VISITS)continue;

            //take top k transitions
            const outgoingTrans = markovTransitions.filter(t => t.from === beam.state && t.to !== "START").sort((a,b) => (b.probability ?? 0) - (a.probability ?? 0))
                .slice(0, BEAM_WIDTH);
            for (const t of outgoingTrans){
                const tranProbability = t.probability ?? 0;
                if (tranProbability < MIN_STEP_PROBABILITY) continue;
                
                const newProb = beam.logProb + Math.log(tranProbability);
                const newVisits = {...beam.visits, [beam.state]: timesVisited+1};

                if (endToken && t.to === endToken){
                    completedBeams.push({ state: endToken, predicted: beam.predicted, logProb: newProb, visits: newVisits, terminated: true});

                } else{
                    nextBeams.push({ state: t.to, predicted: [...beam.predicted, t.to], logProb: newProb, visits: newVisits, terminated: false});
                }

            }

        }

        activeBeams = nextBeams.sort((a,b) => b.logProb - a.logProb).slice(0, BEAM_WIDTH);
    }   

    const allBeams = [...completedBeams, ...activeBeams].sort((a,b) => b.logProb - a.logProb);

    if(allBeams.length === 0){
        const empty = { predictedTokens: [], fullSequence: [...tokens], typedProbability, predictedSeqProbability:typedProbability, terminatedNaturally:false};
        return {beams: [empty], best:empty, typedProbability, confidenceLabel: confidenceLabel(typedProbability)};
    }
    const beamResults = allBeams.map(b => ({
        predictedTokens: b.predicted,
        fullSequence: [...tokens, ...b.predicted],
        typedProbability,
        predictedSeqProbability: typedProbability* Math.exp(b.logProb),
        terminatedNaturally: b.terminated,
    }));

    return { beams: beamResults, best: beamResults[0], typedProbability, confidenceLabel: confidenceLabel(typedProbability)};

}

function confidenceLabel(p: number): "confident" | "uncertain" |"low confidence" | "unknown"{
    if (p<= 0) return "unknown";
    if ( p >= 0.01) return "confident";
    if (p >= 0.001) return "uncertain";
    return "low confidence";
}
