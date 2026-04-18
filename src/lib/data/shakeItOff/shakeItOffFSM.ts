import type { fTransition, Subgraph } from "$lib/graph/graphTypes";
import { buildKgramFSMfromLyrics, buildSubstringFSMfromLyrics } from "./buildShakeItOffFSM";
import lyrics from "$lib/data/shakeItOff/shakeItOff.txt?raw";

export function makeShakeItOffFSM(k=4){
    // const {viewer} = buildKgramFSMfromLyrics(lyrics, k, "k_only", true);

    const viewer = buildSubstringFSMfromLyrics(lyrics, k);

    const fsmTransitions: fTransition[] = viewer.fsmTransitions;
    const subgraphs: Record<string, Subgraph> = {}
    return {
        acceptingStates: viewer.acceptingStates,
        startingStates: viewer.startingStates,
        fsmStates: viewer.fsmStates,
        fsmTransitions,
        subgraphs
    };
}