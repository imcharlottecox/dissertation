export function makeAlgebraMarkov() {

    const endState = [
        'NUM OP NUM EQ NUM',
        'NUM OP NUM OP NUM EQ NUM',
        'NUM OP NUM OP NUM OP NUM EQ NUM',
        'NUM OP NUM OP NUM OP NUM OP NUM EQ NUM',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ NUM',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ NUM',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ NUM',
        'NUM OP VAR EQ NUM',
        'NUM OP NUM OP VAR EQ NUM',
        'NUM OP VAR OP VAR OP VAR EQ NUM',
        'NUM OP VAR OP NUM OP VAR OP NUM OP VAR EQ NUM',
        'VAR OP NUM OP VAR OP NUM OP VAR EQ NUM',
    ];
    const mStartingStates = [
        'START'
    ];
    const markovStates = [
        'START',
        'NUM',
        'NUM OP',
        'NUM OP NUM',

        'NUM OP NUM EQ',
        'NUM OP NUM EQ NUM', //FIRST
        
        'NUM OP NUM OP',
        'NUM OP NUM OP NUM',
        'NUM OP NUM OP NUM EQ',
        'NUM OP NUM OP NUM EQ NUM', //SEC

        'NUM OP NUM OP NUM OP',
        'NUM OP NUM OP NUM OP NUM',
        'NUM OP NUM OP NUM OP NUM EQ',
        'NUM OP NUM OP NUM OP NUM EQ NUM', //third

        'NUM OP NUM OP NUM OP NUM OP',
        'NUM OP NUM OP NUM OP NUM OP NUM',
        'NUM OP NUM OP NUM OP NUM OP NUM EQ',
        'NUM OP NUM OP NUM OP NUM OP NUM EQ NUM',

        'NUM OP NUM OP NUM OP NUM OP NUM OP',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ NUM', //fifth

        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ NUM',

        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ',
        'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ NUM', //last

        'NUM OP VAR',
        'NUM OP VAR EQ',
        'NUM OP VAR EQ NUM',

        'NUM OP NUM OP VAR',
        'NUM OP NUM OP VAR EQ',
        'NUM OP NUM OP VAR EQ NUM',

        'NUM OP VAR OP',
        'NUM OP VAR OP VAR',
        'NUM OP VAR OP VAR OP',
        'NUM OP VAR OP VAR OP VAR',
        'NUM OP VAR OP VAR OP VAR EQ',
        'NUM OP VAR OP VAR OP VAR EQ NUM',

        'NUM OP VAR OP NUM',
        'NUM OP VAR OP NUM OP',
        'NUM OP VAR OP NUM OP VAR',
        'NUM OP VAR OP NUM OP VAR OP',
        'NUM OP VAR OP NUM OP VAR OP NUM',
        'NUM OP VAR OP NUM OP VAR OP NUM OP',
        'NUM OP VAR OP NUM OP VAR OP NUM OP VAR',
        'NUM OP VAR OP NUM OP VAR OP NUM OP VAR EQ',
        'NUM OP VAR OP NUM OP VAR OP NUM OP VAR EQ NUM',

        'VAR',
        'VAR OP',
        'VAR OP NUM',
        'VAR OP NUM OP',
        'VAR OP NUM OP VAR',
        'VAR OP NUM OP VAR OP',
        'VAR OP NUM OP VAR OP NUM',
        'VAR OP NUM OP VAR OP NUM OP',
        'VAR OP NUM OP VAR OP NUM OP VAR',
        'VAR OP NUM OP VAR OP NUM OP VAR EQ',
        'VAR OP NUM OP VAR OP NUM OP VAR EQ NUM',
    ];

        const markovTransitions = [
        { from: 'START', to: 'NUM', probability: 0.917 },
        { from: 'START', to: 'VAR', probability: 0.083 },

        { from: 'NUM', to: 'NUM OP', probability: 1.0 },
        { from: 'NUM OP', to: 'NUM OP NUM', probability: 8/11 },
        { from: 'NUM OP', to: 'NUM OP VAR', probability: 3/11 },

        { from: 'NUM OP NUM', to: 'NUM OP NUM EQ', probability: 1/7 },
        { from: 'NUM OP NUM', to: 'NUM OP NUM OP', probability: 6/7 },

        { from: 'NUM OP NUM EQ', to: 'NUM OP NUM EQ NUM', probability: 1.0 },

        { from: 'NUM OP NUM OP', to: 'NUM OP NUM OP NUM', probability: 0.5 },
        { from: 'NUM OP NUM OP', to: 'NUM OP NUM OP VAR', probability: 0.5 },

        { from: 'NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM EQ', probability: 0.5 },
        { from: 'NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM OP', probability: 0.5 },

        { from: 'NUM OP NUM OP NUM EQ', to: 'NUM OP NUM OP NUM EQ NUM', probability: 1.0 },

        { from: 'NUM OP VAR', to: 'NUM OP VAR EQ', probability: 0.33 },
        { from: 'NUM OP VAR', to: 'NUM OP VAR OP', probability: 0.33 },
        { from: 'NUM OP VAR', to: 'NUM OP VAR OP NUM', probability: 0.34 },

        { from: 'NUM OP VAR EQ', to: 'NUM OP VAR EQ NUM', probability: 1.0 },

        { from: 'NUM OP VAR OP', to: 'NUM OP VAR OP VAR', probability: 0.5 },
        { from: 'NUM OP VAR OP', to: 'NUM OP VAR OP NUM', probability: 0.5 },

        { from: 'NUM OP VAR OP VAR', to: 'NUM OP VAR OP VAR OP', probability: 1.0 },
        { from: 'NUM OP VAR OP VAR OP', to: 'NUM OP VAR OP VAR OP VAR', probability: 1.0 },
        { from: 'NUM OP VAR OP VAR OP VAR', to: 'NUM OP VAR OP VAR OP VAR EQ', probability: 1.0 },
        { from: 'NUM OP VAR OP VAR OP VAR EQ', to: 'NUM OP VAR OP VAR OP VAR EQ NUM', probability: 1.0 },

        { from: 'NUM OP VAR OP NUM', to: 'NUM OP VAR OP NUM OP', probability: 1.0 },
        { from: 'NUM OP VAR OP NUM OP', to: 'NUM OP VAR OP NUM OP VAR', probability: 1.0 },
        { from: 'NUM OP VAR OP NUM OP VAR', to: 'NUM OP VAR OP NUM OP VAR OP', probability: 1.0 },
        { from: 'NUM OP VAR OP NUM OP VAR OP', to: 'NUM OP VAR OP NUM OP VAR OP NUM', probability: 1.0 },
        { from: 'NUM OP VAR OP NUM OP VAR OP NUM', to: 'NUM OP VAR OP NUM OP VAR OP NUM OP', probability: 1.0 },
        { from: 'NUM OP VAR OP NUM OP VAR OP NUM OP', to: 'NUM OP VAR OP NUM OP VAR OP NUM OP VAR', probability: 1.0 },
        { from: 'NUM OP VAR OP NUM OP VAR OP NUM OP VAR', to: 'NUM OP VAR OP NUM OP VAR OP NUM OP VAR EQ', probability: 1.0 },
        { from: 'NUM OP VAR OP NUM OP VAR OP NUM OP VAR EQ', to: 'NUM OP VAR OP NUM OP VAR OP NUM OP VAR EQ NUM', probability: 1.0 },

        { from: 'VAR', to: 'VAR OP', probability: 1.0 },
        { from: 'VAR OP', to: 'VAR OP NUM', probability: 1.0 },
        { from: 'VAR OP NUM', to: 'VAR OP NUM OP', probability: 1.0 },
        { from: 'VAR OP NUM OP', to: 'VAR OP NUM OP VAR', probability: 1.0 },
        { from: 'VAR OP NUM OP VAR', to: 'VAR OP NUM OP VAR OP', probability: 1.0 },
        { from: 'VAR OP NUM OP VAR OP', to: 'VAR OP NUM OP VAR OP NUM', probability: 1.0 },
        { from: 'VAR OP NUM OP VAR OP NUM', to: 'VAR OP NUM OP VAR OP NUM OP', probability: 1.0 },
        { from: 'VAR OP NUM OP VAR OP NUM OP', to: 'VAR OP NUM OP VAR OP NUM OP VAR', probability: 1.0 },
        { from: 'VAR OP NUM OP VAR OP NUM OP VAR', to: 'VAR OP NUM OP VAR OP NUM OP VAR EQ', probability: 1.0 },
        { from: 'VAR OP NUM OP VAR OP NUM OP VAR EQ', to: 'VAR OP NUM OP VAR OP NUM OP VAR EQ NUM', probability: 1.0 },

    ];

    
return { markovStates, markovTransitions, endState, mStartingStates };
}
