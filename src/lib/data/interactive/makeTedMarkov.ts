import tedData from './TED_Talk.json';
import type { mTransition } from '$lib/graph/graphTypes';

export interface TedTalk {
    talk__name: string;
    duration: number;
    tokens: string[];
    markovStates: string[];
    mStartingStates: string[];
    endState: string[];
    markovTransitions: mTransition[];
}

const talks = tedData as TedTalk[];

//for the drop down list
export function getTedTalkList(): {talk__name:string; duration: number}[]{
    return talks.map(t => ({talk__name: t.talk__name, duration: t.duration}));
}

export function getTedTalkByTitle(name: string): TedTalk|null{
        return talks.find(t => t.talk__name === name) ?? null;

}

export function getDefaultTedTalk(): TedTalk{
    return talks[0];
}
