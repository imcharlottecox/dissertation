export type Transition = { from: string; to: string; label: string };

export function makeCaMarkov() {
   
   const markovStates = [
        'START',
        'C',
        'Ca', // Central axis
        
        'Cat',  // Top branch
        'Cats', // Top branch 
        
        'Car',  // Middle path 
        'Cars', // Bottom branch (plurals)

        'Cart',  // Middle/Top path 
        'Carts', // Bottom branch (plurals)

        'Carto', // Middle path 
        'Carton', // Middle path
        'Cartons', // Middle path 
        '$'
    ];

    const mStartingStates = [
        'START'
    ];
    const endState = ['$']

    const markovTransitions = [
        { from: 'START', to: 'C', probability: 1.0 },

        { from: 'C', to: 'Ca', probability: 1.0 },

        { from: 'Ca', to: 'Cat', probability: 0.5 },
        { from: 'Ca', to: 'Car', probability: 0.5 },

        { from: 'Cat', to: 'Cats', probability: 0.5 },
        { from: 'Cat', to: '$', probability: 0.5 },

        { from: 'Cats', to: '$', probability: 1.0 },

        { from: 'Car', to: 'Cart', probability: 0.33 },
        { from: 'Car', to: 'Cars', probability: 0.33 },
        { from: 'Car', to: '$', probability: 0.33 },

        { from: 'Cars', to: '$', probability: 1.0 },

        { from: 'Cart', to: 'Carts', probability: 0.33 },
        { from: 'Cart', to: 'Carto', probability: 0.33 },
        { from: 'Cart', to: '$', probability: 0.33 },

        { from: 'Carts', to: '$', probability: 1.0 },

        { from: 'Carto', to: 'Carton', probability: 1.0 },

        { from: 'Carton', to: 'Cartons', probability: 0.5 },
        { from: 'Carton', to: '$', probability: 0.5 },

        { from: 'Cartons', to: '$', probability: 1.0 },

        { from: '$', to: '$', probability: 1.0 }
    ];


  return { markovStates, markovTransitions, mStartingStates, endState };
}
