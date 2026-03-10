// import markovData from "$lib/data/shakeItOff/shakeItOff_2gram_markov.json";

// import markovData from "$lib/data/shakeItOff/shakeItOff_v2_2gram_markov.json";
import markovData from "$lib/data/shakeItOff/shakeItOff_hierarchical_markov.json";

export function makeShakeItOffMarkov() {
    return markovData; 
}