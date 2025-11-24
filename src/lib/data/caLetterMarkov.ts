export function makeCaMarkov() {
   
    const markovStates = [
    'START', 'C', 'A', 'T', 'R', 'S', 'O', 'N', '$'
    ];

    const mStartingStates = [
        'START'
    ];
    const endState = ['$']
    const markovTransitions = [
    { from: 'START', to: 'C', probability: 1.0 },

    { from: 'C', to: 'A', probability: 1.0 },

    { from: 'A', to: 'T', probability: 0.5 }, 
    { from: 'A', to: 'R', probability: 0.5 }, 

    { from: 'T', to: 'S', probability: 0.25 }, 
    { from: 'T', to: 'R', probability: 0.5 },  
    { from: 'T', to: 'O', probability: 0.25 }, 

    { from: 'R', to: 'T', probability: 0.75 }, 
    { from: 'R', to: 'S', probability: 0.25 },
    { from: 'O', to: 'N', probability: 1.0 }, 


    { from: 'N', to: 'S', probability: 0.5 }, 
    { from: 'N', to: '$', probability: 0.5 }, 
    { from: 'S', to: '$', probability: 1.0 }, 

    { from: 'T', to: '$', probability: 0.25 }, 
    { from: '$', to: '$', probability: 1.0 }
    ];


  return { markovStates, markovTransitions, mStartingStates, endState };
}
