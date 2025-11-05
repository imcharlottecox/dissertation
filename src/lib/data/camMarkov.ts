export type Transition = { from: string; to: string; label: string };

export function makeCamMarkov() {
       const mStartingStates = [
        'START'
    ];
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

    ];

    //     const acceptingStates = [
    //     'Cat', 'Car', 'Cart', 'Carton', 'Cats', 'Cars', 'Carts', 'Cartons', 'ACCEPT'
    // ];
    const endState = ['$']


    const fracMarkovTransitions = [
        { from: 'START', to: 'C', probability: 1.0 },

        { from: 'C', to: 'Ca', probability: 1.0 },

        { from: 'Ca', to: 'Cat', probability: 1/3 },
        { from: 'Ca', to: 'Car', probability: 1/3 },
        { from: 'Ca', to: 'Cam', probability: 1/3 },

        { from: 'Cat', to: 'Cats', probability: 0.5 },
        { from: 'Cat', to: 'Catt', probability: 0.5 },

        { from: 'Cats', to: '$', probability: 1.0 },

        { from: 'Catt', to: 'Cattl', probability: 1.0 },
        { from: 'Cattl', to: 'Cattle', probability: 1.0 },
        { from: 'Cattle', to: '$', probability: 1.0 },

        { from: 'Car', to: 'Cart', probability: 0.25 },
        { from: 'Car', to: 'Cars', probability: 0.25 },
        { from: 'Car', to: 'Cara', probability: 0.25 },
        { from: 'Car', to: 'Care', probability: 0.25 },

        { from: 'Cars', to: '$', probability: 1.0 },

        { from: 'Cara', to: 'Caram', probability: 1.0 },
        { from: 'Caram', to: 'Carame', probability: 1.0 },
        { from: 'Carame', to: 'Caramel', probability: 1.0 },
        { from: 'Caramel', to: '$', probability: 1.0 },

        { from: 'Care', to: 'Cares', probability: 1.0 },
        { from: 'Cares', to: 'Caress', probability: 1.0 },

        { from: 'Caress', to: '$', probability: 0.5 },
        { from: 'Caress', to: 'Caresse', probability: 0.5 },

        { from: 'Caresse', to: 'Caresses', probability: 1.0 },
        { from: 'Caresses', to: '$', probability: 1.0 },

        { from: 'Cart', to: 'Carts', probability: 1/3 },
        { from: 'Cart', to: 'Carto', probability: 1/3 },
        { from: 'Cart', to: 'Cartw', probability: 1/3 },

        { from: 'Carts', to: '$', probability: 1.0 },

        { from: 'Carto', to: 'Carton', probability: 1.0 },

        { from: 'Carton', to: '$', probability: 0.5 },
        { from: 'Carton', to: 'Cartons', probability: 0.5 },

        { from: 'Cartons', to: '$', probability: 1.0 },

        { from: 'Cartw', to: 'Cartwh', probability: 1.0 },
        { from: 'Cartwh', to: 'Cartwhe', probability: 1.0 },
        { from: 'Cartwhe', to: 'Cartwhee', probability: 1.0 },
        { from: 'Cartwhee', to: 'Cartwheel', probability: 1.0 },
        { from: 'Cartwheel', to: '$', probability: 1.0 },

        { from: 'Cam', to: 'Camb', probability: 1.0 },
        { from: 'Camb', to: 'Cambr', probability: 1.0 },
        { from: 'Cambr', to: 'Cambri', probability: 1.0 },
        { from: 'Cambri', to: 'Cambrid', probability: 1.0 },
        { from: 'Cambrid', to: 'Cambridg', probability: 1.0 },
        { from: 'Cambridg', to: 'Cambridge', probability: 1.0 },
        { from: 'Cambridge', to: '$', probability: 1.0 },

        // { from: '$', to: '$', probability: 1.0 }
    ];

    const round2 = (n: number) => Number(n.toFixed(2));

    const markovTransitions = fracMarkovTransitions.map(t => ({
        ...t,
        probability: round2(t.probability)
    }));
  return { markovStates, markovTransitions, mStartingStates, endState };
}
