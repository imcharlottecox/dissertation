import type {fTransition, Subgraph, Warp} from "$lib/graph/graphTypes";

type SimulationState = { 
    currentState: string;
    returnStack: string[]; //where to exit to ( a state name) once the subgraph call returns
}

//for broadcast/PDA-like edges of form "Call ___": we need a sense of a stack to simulate due to hierarchical calling, despite not being a CFG
type SubgraphCallEdge = {
    callerState: string;
    calleeEntryState: string;
    returnState: string; //where execution should return after the called subgraph reaches exit state
}

//relies on subgraph keys not containing ||| or ,,,: triple of each makes this unlikely
function simulationStateKey(s: SimulationState){
    return s.currentState + "|||" + s.returnStack.join(",,,");
}

export function computeValidityFSM(
    topLevelTransitions: fTransition[],
    input: string[],
    acceptingStates: string[],
    subgraphs: Record<string, Subgraph> = {},
    datasetWarps: Warp[] = [],
    startingStates: string[],
    subgraphOverrides: Record<string, fTransition[]> = {},
    engineOnlyWarps: Array<[string, string]> = [],
): boolean{
    if (input.length === 0) return false;
    const { flatTransitions, epsilonTargets, subgraphCallEdges, subgraphExitStates, } = buildFlatGraph(topLevelTransitions, subgraphs, datasetWarps, subgraphOverrides, engineOnlyWarps);
    
    let activeSimulationStates: Map<string, SimulationState> = new Map();
    for (const startState of startingStates){
        const reachable = epsilonClosure({currentState: startState, returnStack: []}, epsilonTargets, subgraphCallEdges);
        for (const s of reachable) activeSimulationStates.set(simulationStateKey(s), s);
    }

    for (const char of input){
        const nextSimulationStates = new Map<string, SimulationState>();

        for (const simulationState of activeSimulationStates.values()){
            if (char === ")"){
                if (simulationState.returnStack.length === 0) continue;
                
                const returnAddress = simulationState.returnStack[simulationState.returnStack.length -1];
                const poppedStack = simulationState.returnStack.slice(0,-1);

                const transitionsFromReturnAddress = flatTransitions.filter(t => t.from === returnAddress && labelMatchesChar(t.label, char));
                for (const t of transitionsFromReturnAddress){
                    const afterReturn: SimulationState = {currentState: t.to, returnStack:poppedStack};
                    const reachable = epsilonClosure(afterReturn, epsilonTargets, subgraphCallEdges);
                    for (const s of reachable){
                        if (!nextSimulationStates.has(simulationStateKey(s))) nextSimulationStates.set(simulationStateKey(s), s);

                    }
                }
                continue;
            }
            const outgoingTransitions = flatTransitions.filter(t => t.from === simulationState.currentState && labelMatchesChar(t.label, char));
            for (const t of outgoingTransitions){
                const afterTransition: SimulationState = {
                    currentState: t.to,
                    returnStack:simulationState.returnStack
                };
                const reachable = epsilonClosure(afterTransition, epsilonTargets, subgraphCallEdges);
                for (const s of reachable ){
                    const key = simulationStateKey(s);
                    if (!nextSimulationStates.has(key)) nextSimulationStates.set(key, s);
                }
            }
        }
        if (nextSimulationStates.size === 0) return false;
        activeSimulationStates = nextSimulationStates;
    }

    return [...activeSimulationStates.values()].some(s => acceptingStates.includes(s.currentState) && s.returnStack.length === 0);
}

function buildFlatGraph(
    topLevelTransitions: fTransition[],
    subgraphs: Record<string, Subgraph>,
    datasetWarps: Warp[],
    subgraphOverrides: Record<string, fTransition[]>,
    engineOnlyWarps: Array<[string, string]>,
):{
    flatTransitions: fTransition[]; 
    epsilonTargets: Map<string, Set<string>>; subgraphCallEdges: SubgraphCallEdge[]; subgraphExitStates: Set<string>;
}{
    //if overrides, apply
    const resolvedSubgraphs: Record<string, Subgraph>= {};
    for (const [sgKey, sg] of Object.entries(subgraphs)){
        resolvedSubgraphs[sgKey] = subgraphOverrides[sgKey] ? {...sg, transitions: subgraphOverrides[sgKey]}: sg;
    }
    const flatTransitions: fTransition[] = [...topLevelTransitions];
    const epsilonTargets = new Map<string, Set<string>>(); //reachable states from a given in null moves
    const subgraphCallEdges: SubgraphCallEdge[] = [];
    const subgraphExitStates = new Set<string>();

    const subgraphEntries: Record<string, string>= {};
    for (const [sgKey, sg] of Object.entries(resolvedSubgraphs)){ //relies on states being unique per subgraph
        subgraphEntries[sgKey] = `${sgKey}.${sg.entry}`;
        subgraphExitStates.add(`${sgKey}.${sg.exit}`);
    }

    //if there are intrasg calls
    for (const [sgKey, sg] of Object.entries(resolvedSubgraphs)){
        for (const t of sg.transitions){
            const callMatch = t.label.match(/^call\s+(\S+)/i);
            if (callMatch){
                const calledSgKey = callMatch[1];
                const calleeEntry = subgraphEntries[calledSgKey];
                const returnAddress = `${sgKey}.${t.to}`;
                if (calleeEntry){
                    subgraphCallEdges.push({
                        callerState: `${sgKey}.${t.from}`,
                        calleeEntryState: calleeEntry,
                        returnState: returnAddress,
                    });
                }
                continue;
            }
            flatTransitions.push({
                from: `${sgKey}.${t.from}`,
                to: `${sgKey}.${t.to}`,
                label: t.label,
            });
        }
    }

    //make sure the dataset warp transitions declared in datast (not engine specific) are identified as epsilon edges
    for (const w of datasetWarps){
        if (w.into) addEpsilonEdge(epsilonTargets, w.from, w.into);
        if (w.backto) addEpsilonEdge(epsilonTargets, w.from, w.backto);
    }
    //add engine only warps
    for (const [from, to] of engineOnlyWarps) addEpsilonEdge(epsilonTargets, from, to);


    return {flatTransitions, epsilonTargets, subgraphCallEdges, subgraphExitStates};
}
function addEpsilonEdge(epsilonTargets: Map<string, Set<string>>, from: string, to: string){
    if(!epsilonTargets.has(from)) epsilonTargets.set(from, new Set());
    epsilonTargets.get(from)?.add(to);
}

function epsilonClosure(startSimulationState: SimulationState, epsilonTargets:Map<string, Set<string>>, subgraphCallEdges: SubgraphCallEdge[]): SimulationState[]{
    const visited = new Map<string, SimulationState>();
    const worklist: SimulationState[] = [startSimulationState];

    while (worklist.length > 0){
        const simulationState = worklist.pop()!;
        const key = simulationStateKey(simulationState);
        if (visited.has(key)) continue;
        visited.set(key, simulationState);

        //where the epsilon warp edges go
        const warpTargets = epsilonTargets.get(simulationState.currentState);

        if (warpTargets){
            for (const targetState of warpTargets){
                const warped: SimulationState = {currentState: targetState, returnStack:simulationState.returnStack};
                if (!visited.has(simulationStateKey(warped))) worklist.push(warped);
            }
        }

        for (const callEdge of subgraphCallEdges){
            if (callEdge.callerState === simulationState.currentState){
                const afterCall: SimulationState = {
                    currentState: callEdge.calleeEntryState,
                    returnStack: [...simulationState.returnStack, callEdge.returnState]
                };
                if (!visited.has(simulationStateKey(afterCall))) worklist.push(afterCall);
            }
        }
    }

    return [...visited.values()];
}
function labelMatchesChar(label: string, char:string): boolean {
    return label.split(" | ").map(p => p.trim()).some(p => matchesPart(p, char));
}
function matchesPart(part: string, char: string): boolean {
    switch(part.toLowerCase()){
        case "space": return char === " " || char === "\t";
        case "newline": return char === "\n" || char === "\r";
        case "new line": return char === "\n" || char === "\r";
        case "null": return false;
        case "operator": return "+-*/%<>=!&|^~".includes(char);
        case "variable name": return /^[A-Za-z_]$/.test(char);
        case "variable value": return /^[0-9"TtFf]$/.test(char);
        case "whole number": return /^[0-9]$/.test(char);
        case "decimal number": return /^[0-9.]$/.test(char);
        case "complex number": return /^[0-9.]$/.test(char);
        case "numerical expression": return /^[0-9.(+\-]$/.test(char);
        case '"text"': return char === '"';
        case "true": return char === "T";
        case "false": return char === "F";
    }
    const classMatch = part.match(/^\[([^\]]+)\]$/);
    if (classMatch) return matchesCharClass(classMatch[1], char);
    if (part.length === 1) return char === part;
    return false;
}

//strips brackets of class, checks whether a char falls within the range, eg A-Z
function matchesCharClass(classBody: string, char: string): boolean {
    let i = 0;
    while (i< classBody.length){
        if (i+2 <classBody.length && classBody[i+1] === "-"){
            if (char >= classBody[i] && char <= classBody[i+2]) return true;
            i+=3;
        } else{
            if (char === classBody[i]) return true;
            i++
        }
    }
    return false;
}