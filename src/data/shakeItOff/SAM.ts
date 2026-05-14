import type { fTransition, FSM } from "$lib/graph/graphTypes";

type SAMState = {
    id: string;
    next: Map<string, string>;
    suffixLink: string | null;
    longestMatch: number;
};

export function buildSuffixAutomatonFSM(tokens: string[], minLen: number): FSM {
    let nextID = 0;

    const makeState = (longestMatch:number): SAMState => ({
        id: `S${nextID++}`,
        next: new Map(),
        suffixLink:  null,
        longestMatch,
    });

    const states = new Map<string, SAMState>();
    const initial = makeState(0);
    states.set(initial.id, initial);

    let lastAdded = initial;
    for (const token of tokens ){
        const newState = makeState(lastAdded.longestMatch +1);
        states.set(newState.id, newState);

        let ancestor: SAMState|null = lastAdded;
        while (ancestor && !ancestor.next.has(token)){
            ancestor.next.set(token, newState.id);
            ancestor = ancestor.suffixLink ? states.get(ancestor.suffixLink)! : null;
        }

        if (!ancestor){
            //if got to root without a transition existing
            newState.suffixLink = initial.id;
        } else{
            const existingTarget = states.get(ancestor.next.get(token)!)!;

            if (existingTarget?.longestMatch === ancestor.longestMatch +1){
                newState.suffixLink = existingTarget?.id;
            } else{
                const cloned = makeState(ancestor.longestMatch +1);
                cloned.next = new Map(existingTarget.next);
                cloned.suffixLink = existingTarget?.suffixLink;
                states.set(cloned.id, cloned);

                let redirect: SAMState|null = ancestor;
                while (redirect && redirect.next.get(token) === existingTarget.id){
                    redirect.next.set(token, cloned.id);
                    redirect = redirect.suffixLink ? states.get(redirect.suffixLink)! : null;
                }

                existingTarget.suffixLink = cloned.id;
                newState.suffixLink = cloned.id;
            }
        }
        lastAdded = newState;

    }

    const acceptingStates = [...states.values()].filter(s => s.longestMatch >= minLen).map(s => s.id);

    const fsmTransitions: fTransition[] = [];
    for (const s of states.values()){
        for (const [label, to] of s.next.entries()){
            fsmTransitions.push({from:s.id, to, label});

        }
    }

    return {
        fsmStates: [...states.keys()],
        fsmTransitions,
        startingStates: [initial.id],
        acceptingStates

    };

}