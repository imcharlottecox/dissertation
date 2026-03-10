import type { fTransition } from "$lib/graph/graphTypes";

export type builtFSM = {
    fsmStates: string[];
    fsmTransitions: fTransition[];
    startingStates: string[];
    acceptingStates: string[];
};

type SAMState = {
    id: string;
    next: Map<string, string>;
    link: string | null;
    len: number; 
};

export function buildSuffixAutomatonFSM(
    tokens: string[],
    minLen: number
): builtFSM {
    let stateId = 0;
    const newState = (len: number): SAMState => ({
        id: `S${stateId++}`,
        next: new Map(),
        link: null,
        len
    });

    const states = new Map<string, SAMState>();
    const start = newState(0);
    states.set(start.id, start);

    let last = start;

    for (const word of tokens) {
        let cur = newState(last.len + 1);
        states.set(cur.id, cur);

        let p: SAMState | null = last;
        while (p && !p.next.has(word)) {
            p.next.set(word, cur.id);
            p = p.link ? states.get(p.link)! : null;
        }

        if (!p) {
            cur.link = start.id;
        } else {
            const q = states.get(p.next.get(word)!)!;
            if (q.len === p.len + 1) {
                cur.link = q.id;
            } else {
                const clone = newState(p.len + 1);
                clone.next = new Map(q.next);
                clone.link = q.link;
                states.set(clone.id, clone);

                while (p && p.next.get(word) === q.id) {
                    p.next.set(word, clone.id);
                    p = p.link ? states.get(p.link)! : null;
                }

                q.link = cur.link = clone.id;
            }
        }

        last = cur;
    }

    const acceptingStates: string[] = [];
    for (const s of states.values()) {
        if (s.len >= minLen) acceptingStates.push(s.id);
    }

    const fsmTransitions: fTransition[] = [];
    for (const s of states.values()) {
        for (const [label, to] of s.next.entries()) {
            fsmTransitions.push({
                from: s.id,
                to,
                label
            });
        }
    }

  return {
        fsmStates: Array.from(states.keys()),
        fsmTransitions,
        startingStates: [start.id],
        acceptingStates
    };
}
