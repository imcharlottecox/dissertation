export function makeCamMarkov() {
       const mStartingStates = [
        'START'
    ];
    const markovStates = [
        'START',  
        'C', 'A', 'T', 'R', 'S', 'E', 'L', 'O', 'N',
        'M', 'B', 'I', 'D', 'G', 'W', 'H',
        '$'
    ];  

    const endState = ['$']

    const fracMarkovTransitions = [
        { from: 'START', to: 'C', probability: 1.0 },


        { from: 'C', to: 'A', probability: 1.0 },


        { from: 'A', to: 'T', probability: 2/11 },  
        { from: 'A', to: 'R', probability: 5/11 },  
        { from: 'A', to: 'M', probability: 1/11 },  
        { from: 'A', to: 'B', probability: 1/11 },  
        { from: 'A', to: 'E', probability: 1/11 },  
        { from: 'A', to: 'C', probability: 1/11 },  



        { from: 'T', to: 'S', probability: 2/9 },   
        { from: 'T', to: 'L', probability: 1/9 },   
        { from: 'T', to: 'O', probability: 1/9 },   
        { from: 'T', to: 'W', probability: 1/9 },   
        { from: 'T', to: 'R', probability: 4/9 },   



        { from: 'R', to: 'S', probability: 1/6 },   
        { from: 'R', to: 'A', probability: 2/6 },   
        { from: 'R', to: 'T', probability: 2/6 },   
        { from: 'R', to: 'I', probability: 1/6 },   

        { from: 'S', to: 'E', probability: 0.5 },   
        { from: 'S', to: '$', probability: 0.5 }, 


        { from: 'E', to: 'L', probability: 0.5 },   
        { from: 'E', to: 'S', probability: 0.5 },   


        { from: 'L', to: 'E', probability: 0.5 },   
        { from: 'L', to: '$', probability: 0.5 }, 


        { from: 'O', to: 'N', probability: 0.5 },   
        { from: 'O', to: 'N', probability: 0.5 },   


        { from: 'N', to: 'S', probability: 0.5 },   
        { from: 'N', to: '$', probability: 0.5 }, 


        { from: 'M', to: 'B', probability: 0.5 },   
        { from: 'M', to: 'E', probability: 0.5 },   


        { from: 'B', to: 'R', probability: 1.0 },   

        { from: 'I', to: 'D', probability: 1.0 },   

        { from: 'D', to: 'G', probability: 1.0 },   

        { from: 'G', to: 'E', probability: 1.0 },   

        { from: 'W', to: 'H', probability: 1.0 },   

        { from: 'H', to: 'E', probability: 1.0 },   

        { from: 'E', to: 'S', probability: 0.5 },   
        { from: 'S', to: 'E', probability: 0.5 },
        { from: 'E', to: 'S', probability: 0.5 },

        { from: '$', to: '$', probability: 1.0 }
    ];
    const round2 = (n: number) => Number(n.toFixed(2));

    const markovTransitions = fracMarkovTransitions.map(t => ({
        ...t,
        probability: round2(t.probability)
    }));
  return { markovStates, markovTransitions, mStartingStates, endState };
}
