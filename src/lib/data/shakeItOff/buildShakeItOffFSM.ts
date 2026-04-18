import type { fTransition } from "$lib/graph/graphTypes";
import { hopcroftMinimiseDFA } from "./EDIT_hopcrofts";
import { buildSuffixAutomatonFSM } from "./EDIT_shakeitoffSAM";
export type builtFSM = { 
    fsmStates: string[];
    fsmTransitions: fTransition[];
    startingStates: string[];
    acceptingStates: string[];
}

export type DFA = {
    start: string;
    states: string[];
    alphabet: string[];
    accepting: Set<string>;
    transitions: Map<string, Map<string, string>>;
    dead: string;
}

export function parseLines(lyrics: string): string[][] {
    return lyrics
        .split('\n')
        .map(line => line.trim().toLowerCase())
        .filter(line => line.length > 0)
        .map(line => 
            line
            .replace(/[^a-z0-9\s'-]+/g, "")
            .split(/\s+/g)
            .filter(Boolean)
        );
}

export function getKgrams(lines: string[][], k: number): string[][]{
    if (k<1) return [];
    const kgrams: string[][] = [];
    
    for (const line of lines) {
        const tokens: string[] = [];
        tokens.push(...line);
        if (tokens.length < k) continue;
        for (let i = 0; i + k <= tokens.length; i++) {
            const kgram = tokens.slice(i, i + k);
            kgrams.push(kgram);
        }
    }
    return kgrams;
}

// export function getKgrams(lines: string[][], k: number): string[][]{
//     if (k<1) return [];
//     const kgrams: string[][] = [];
//     const stream: string[] = [];
//     for (const line of lines) stream.push(...line);
//     if (stream.length < k) return kgrams;
    
    
//     for (let i = 0; i + k <= stream.length; i++) {
//         const kgram = stream.slice(i, i + k);
//         kgrams.push(kgram);
//     }
//     return kgrams;
// }

export function buildSubstringFSMfromLyrics(lyrics: string, k: number):  builtFSM{
    const lines = parseLines(lyrics);
    const tokens: string[] = [];
    for (const line of lines) tokens.push(...line);
    return buildSuffixAutomatonFSM(tokens, k);
}
function makeStates(prefix= "S"){
    let i = 0;
    return () => `${prefix}${i++}`;
}

function checkMap<K,V>(map: Map<K,V>, key: K, make: () => V): V {
    let val = map.get(key);
    if (!val) {
        val = make();
        map.set(key, val);
    }
    return val;
}

export function buildPrefixTreefromKgrams(kgrams: string[][]): {start: string; states: Set<string>; accepting: Set<string>; transitions: Map<string, Map<string, string>>; alphabet: Set<string>}{
    const newState = makeStates();
    const start = newState();
    const states = new Set<string>([start]);
    const accepting = new Set<string>();
    const transitions = new Map<string, Map<string, string>>();
    const alphabet = new Set<string>();

    for (const kgram of kgrams) {
        let currentState = start;
        for (const word of kgram){
            alphabet.add(word);
            const row = checkMap(transitions, currentState, () => new Map<string, string>());
            let next = row.get(word);
            if (!next) {
                next = newState();
                states.add(next);
                row.set(word, next);
            }
            currentState = next;    
        }
        accepting.add(currentState);
    }
    return {start, states, accepting, transitions, alphabet};
}

//with a dead state for Hopcrofts
export function buildTotalDFAfromPrefixTree(prefixTree: {start: string; states: Set<string>; accepting: Set<string>; transitions: Map<string, Map<string, string>>; alphabet: Set<string>}, deadId: string = "S_Dead"): DFA {
    const states = Array.from(prefixTree.states);
    const alphabet = Array.from(prefixTree.alphabet);
    const newTransitions = new Map<string, Map<string, string>>();
    
    
    for (const state of states) {
        const rowOld = prefixTree.transitions.get(state);
        const rowNew = new Map<string, string>();   
        if (rowOld) {
            for (const [a, toState] of rowOld.entries()) {
                rowNew.set(a, toState);
            }   
        }
        newTransitions.set(state, rowNew);
    }
    if (!newTransitions.has(deadId)) newTransitions.set(deadId, new Map());
    if (!states.includes(deadId)) states.push(deadId);

    //deadstate loops to itself for all inputs
    for (const a of alphabet){
        newTransitions.get(deadId)!.set(a, deadId);
    }

    //fill in the missing transitiosns to dead state
    for (const s of states){
        const row = checkMap(newTransitions, s, () => new Map<string, string>());
        for (const a of alphabet){
            if (!row.has(a)){
                row.set(a, deadId);
            }
        }
    }

    const accepting = new Set(prefixTree.accepting);
    accepting.delete(deadId);

    return {
        start: prefixTree.start,
        states,
        alphabet,
        accepting,
        transitions: newTransitions,
        dead: deadId
    };

}

export function buildFsmForViewer (dfa: DFA, acceptMode: "k_only"|"valid_so_far" = "k_only", hideDeadState?: boolean): builtFSM {
    const acceptingStates = acceptMode == "valid_so_far" ? dfa.states.filter(s => s !== dfa.dead) : Array.from(dfa.accepting);
    const fsmTransitions: fTransition[] = [];
    for (const from of dfa.states){
        const row = dfa.transitions.get(from);
        if (!row) continue;
        for (const [label, to] of row.entries()){
            if (to === dfa.dead) continue;
            if (hideDeadState && (from === dfa.dead || to === dfa.dead)) continue;
            fsmTransitions.push({from, to, label} );
        }
    }

    const fsmStates = hideDeadState ? dfa.states.filter(s => s !== dfa.dead) : dfa.states;

    return {
        fsmStates,
        fsmTransitions,
        startingStates: [dfa.start],
        acceptingStates: hideDeadState ? acceptingStates.filter(s => s !== dfa.dead) : acceptingStates
    };

}
export function buildKgramFSMfromLyrics(lyrics: string, k: number, acceptMode?: "k_only"|"valid_so_far", hideDeadState?: boolean): {dfa: DFA; viewer: builtFSM}{
    const lines = parseLines(lyrics);
    const kgrams = getKgrams(lines, k);
    const prefixTree = buildPrefixTreefromKgrams(kgrams);
    const dfa = buildTotalDFAfromPrefixTree(prefixTree, "S_Dead");
    const minDfa = hopcroftMinimiseDFA(dfa);
    const viewer = buildFsmForViewer(minDfa, acceptMode, hideDeadState);
    return {dfa: minDfa, viewer};
}