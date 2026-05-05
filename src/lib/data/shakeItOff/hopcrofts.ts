import type { DFA } from "$lib/graph/graphTypes";

export function minimiseDFA(dfa: DFA): DFA {
    checkTotal(dfa);
    const accepting = new Set(dfa.accepting);
    const nonAccepting = new Set(dfa.states.filter(s => !accepting.has(s)));

    let partition: Set<string>[] = [];
    if (accepting.size > 0) partition.push(accepting);
    if (nonAccepting.size > 0) partition.push(nonAccepting);

    const workList: Set<string>[] = [];

    if (accepting.size > 0 && nonAccepting.size>0){
        workList.push(accepting.size <= nonAccepting.size ? accepting : nonAccepting);
    } else {
        workList.push(accepting.size > 0 ? accepting : nonAccepting);
    }

    const reverseIndex = buildReverseIndex(dfa);

    while(workList.length > 0){
        const split = workList.pop()!;

        for (const symbol of dfa.alphabet){
            const reachSplitter = statesWithTransitionInto(reverseIndex, symbol, split);
            if (reachSplitter.size === 0) continue;

            //split blocks partially in and out reachsplitter
            const refined : Set<string>[] = [];
            for (const block of partition){
                const inside = setIntersection(block, reachSplitter);
                if (inside.size === 0 || inside.size === block.size){
                    refined.push(block);
                    continue;
                }
                const outside = setDifference(block, reachSplitter);

                refined.push(inside);
                refined.push(outside);

                const index = workList.indexOf(block);

                if (index !== -1){
                    workList.splice(index, 1, inside, outside);
                } else {
                    workList.push(inside.size <= outside.size ? inside : outside);
                }
            }
            partition = refined;
        }
    }

    const blockName = (block:Set<string>) => [...block].sort()[0] ?? "s_min";
    const blockNames = partition.map(blockName)

    const stateToBlock = new Map<string, number>();
    partition.forEach((block, i) => {
        for (const s of block){
            stateToBlock.set(s, i);
        }
    });

    const newStart = blockNames[stateToBlock.get(dfa.start)!];
    const newdead = blockNames[stateToBlock.get(dfa.dead)!];

    const newAccepting = new Set<string>();
    partition.forEach((block, i) => {
        for (const s of block){
            if (dfa.accepting.has(s)){
                newAccepting.add(blockNames[i]);
                break;
            }
        }
    });

    const newTransitions = new Map<string, Map<string, string>>();
    partition.forEach((block, i) => {
        const rep = block.values().next().value as string;
        const row = new Map<string, string>();
        for (const symbol of dfa.alphabet){
            const oldTarget = dfa.transitions.get(rep)!.get(symbol)!;        
            row.set(symbol, blockNames[stateToBlock.get(oldTarget)!]);
        }
        newTransitions.set(blockNames[i], row);
    });

    return {
        start: newStart,
        states: blockNames.slice(),
        alphabet: dfa.alphabet.slice(),
        accepting: newAccepting,
        transitions: newTransitions,
        dead: newdead,
    };


}

function checkTotal(dfa: DFA){
    for (const s of dfa.states){
        const row = dfa.transitions.get(s);
        if (!row) throw new Error("missing transitions from this state");
        for (const a of dfa.alphabet){
            if (!row.has(a)) throw new Error("missing transition");
        }
    }
}

function buildReverseIndex(dfa: DFA): Map<string, Map<string, Set<string>>>{
    const rev = new Map<string, Map<string, Set<string>>>();

    for (const symbol of dfa.alphabet) rev.set(symbol, new Map());

    for (const from of dfa.states){
        const row = dfa.transitions.get(from)!;
        for (const symbol of dfa.alphabet){
            const to = row.get(symbol)!;
            const byTo = rev.get(symbol);
            if (!byTo?.has(to)) byTo?.set(to, new Set());
            byTo?.get(to)!.add(from);
        }
    }
    return rev;
}

function statesWithTransitionInto(rev:  Map<string, Map<string, Set<string>>>, symbol: string, targets: Set<string>): Set<string>{
    const result = new Set<string>();
    const byTo = rev.get(symbol);
    if (!byTo) return result;
    for (const to of targets){
        const preds = byTo.get(to);
        if (preds) for (const p of preds) result.add(p);
    }
    return result;

}

function setIntersection(a: Set<string>, b: Set<string>): Set<string>{
    const result = new Set<string>();
    for (const x of a){
        if (b.has(x)){
            result.add(x);
        }
    }
    return result;
}
function setDifference(a: Set<string>, b: Set<string>): Set<string>{
    const result = new Set<string>();
    for (const x of a){
        if (!b.has(x)){
            result.add(x);
        }
    }
    return result;
}