export type Transition = { from: string; to: string; label: string };

export function makeAlgebraFSM() {

    const acceptingStates = [
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
    const startingStates = [
        'START'
    ];
    const fsmStates = [
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

  const fsmTransitions: Transition[] = [
        { from: 'START', to: 'NUM', label: 'NUM' },
        { from: 'NUM', to: 'NUM OP', label: 'OP' },
        { from: 'NUM OP', to: 'NUM OP NUM', label: 'NUM' },
        { from: 'NUM OP NUM', to: 'NUM OP NUM EQ', label: 'EQ' },
        { from: 'NUM OP NUM EQ', to: 'NUM OP NUM EQ NUM', label: 'NUM' },

        { from: 'NUM OP NUM', to: 'NUM OP NUM OP', label: 'OP' },
        { from: 'NUM OP NUM OP', to: 'NUM OP NUM OP NUM', label: 'NUM' },
        { from: 'NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM EQ', label: 'EQ' },
        { from: 'NUM OP NUM OP NUM EQ', to: 'NUM OP NUM OP NUM EQ NUM', label: 'NUM' },

        { from: 'NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM OP', label: 'OP' },
        { from: 'NUM OP NUM OP NUM OP', to: 'NUM OP NUM OP NUM OP NUM', label: 'NUM' },
        { from: 'NUM OP NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM OP NUM EQ', label: 'EQ' },
        { from: 'NUM OP NUM OP NUM OP NUM EQ', to: 'NUM OP NUM OP NUM OP NUM EQ NUM', label: 'NUM' },

        { from: 'NUM OP NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM OP NUM OP', label: 'OP' },
        { from: 'NUM OP NUM OP NUM OP NUM OP', to: 'NUM OP NUM OP NUM OP NUM OP NUM', label: 'NUM' },
        { from: 'NUM OP NUM OP NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM OP NUM OP NUM EQ', label: 'EQ' },
        { from: 'NUM OP NUM OP NUM OP NUM OP NUM EQ', to: 'NUM OP NUM OP NUM OP NUM OP NUM EQ NUM', label: 'NUM' },

        { from: 'NUM OP NUM OP NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP', label: 'OP' },
        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM', label: 'NUM' },
        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ', label: 'EQ' },
        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ NUM', label: 'NUM' },

        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP', label: 'OP' },
        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM', label: 'NUM' },
        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ', label: 'EQ' },
        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ NUM', label: 'NUM' },

        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP', label: 'OP'},
        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM', label: 'NUM'},
        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP', label: 'OP' },

        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM', label: 'NUM' },
        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ', label: 'EQ' },
        { from: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ', to: 'NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM OP NUM EQ NUM', label: 'NUM' },



        { from: 'NUM OP', to: 'NUM OP VAR', label: 'VAR' },
        { from: 'NUM OP VAR', to: 'NUM OP VAR EQ', label: 'EQ' },
        { from: 'NUM OP VAR EQ', to: 'NUM OP VAR EQ NUM', label: 'NUM' },

        { from: 'NUM OP NUM OP', to: 'NUM OP NUM OP VAR', label: 'VAR' },
        { from: 'NUM OP NUM OP VAR', to: 'NUM OP NUM OP VAR EQ', label: 'EQ' },
        { from: 'NUM OP NUM OP VAR EQ', to: 'NUM OP NUM OP VAR EQ NUM', label: 'NUM' },

        { from: 'NUM OP VAR', to: 'NUM OP VAR OP', label: 'OP' },
        { from: 'NUM OP VAR OP', to: 'NUM OP VAR OP VAR', label: 'VAR' },
        { from: 'NUM OP VAR OP VAR', to: 'NUM OP VAR OP VAR OP', label: 'OP' },
        { from: 'NUM OP VAR OP VAR OP', to: 'NUM OP VAR OP VAR OP VAR', label: 'VAR' },
        { from: 'NUM OP VAR OP VAR OP VAR', to: 'NUM OP VAR OP VAR OP VAR EQ', label: 'EQ' },
        { from: 'NUM OP VAR OP VAR OP VAR EQ', to: 'NUM OP VAR OP VAR OP VAR EQ NUM', label: 'NUM' },

        { from: 'NUM OP VAR', to: 'NUM OP VAR OP NUM', label: 'OP' },
        { from: 'NUM OP VAR OP NUM', to: 'NUM OP VAR OP NUM OP', label: 'OP' },
        { from: 'NUM OP VAR OP NUM OP', to: 'NUM OP VAR OP NUM OP VAR', label: 'VAR' },
        { from: 'NUM OP VAR OP NUM OP VAR', to: 'NUM OP VAR OP NUM OP VAR OP', label: 'OP' },
        { from: 'NUM OP VAR OP NUM OP VAR OP', to: 'NUM OP VAR OP NUM OP VAR OP NUM', label: 'NUM' },
        { from: 'NUM OP VAR OP NUM OP VAR OP NUM', to: 'NUM OP VAR OP NUM OP VAR OP NUM OP', label: 'OP' },
        { from: 'NUM OP VAR OP NUM OP VAR OP NUM OP', to: 'NUM OP VAR OP NUM OP VAR OP NUM OP VAR', label: 'VAR' },
        { from: 'NUM OP VAR OP NUM OP VAR OP NUM OP VAR', to: 'NUM OP VAR OP NUM OP VAR OP NUM OP VAR EQ', label: 'EQ' },
        { from: 'NUM OP VAR OP NUM OP VAR OP NUM OP VAR EQ', to: 'NUM OP VAR OP NUM OP VAR OP NUM OP VAR EQ NUM', label: 'NUM' },

        { from: 'START', to: 'VAR', label: 'VAR' },
        { from: 'VAR', to: 'VAR OP', label: 'OP' },
        { from: 'VAR OP', to: 'VAR OP NUM', label: 'NUM' },
        { from: 'VAR OP NUM', to: 'VAR OP NUM OP', label: 'OP' },
        { from: 'VAR OP NUM OP', to: 'VAR OP NUM OP VAR', label: 'VAR' },
        { from: 'VAR OP NUM OP VAR', to: 'VAR OP NUM OP VAR OP', label: 'OP' },
        { from: 'VAR OP NUM OP VAR OP', to: 'VAR OP NUM OP VAR OP NUM', label: 'NUM' },
        { from: 'VAR OP NUM OP VAR OP NUM', to: 'VAR OP NUM OP VAR OP NUM OP', label: 'OP' },
        { from: 'VAR OP NUM OP VAR OP NUM OP', to: 'VAR OP NUM OP VAR OP NUM OP VAR', label: 'VAR' },
        { from: 'VAR OP NUM OP VAR OP NUM OP VAR', to: 'VAR OP NUM OP VAR OP NUM OP VAR EQ', label: 'EQ' },
        { from: 'VAR OP NUM OP VAR OP NUM OP VAR EQ', to: 'VAR OP NUM OP VAR OP NUM OP VAR EQ NUM', label: 'NUM' },
    ];

    
  return { fsmStates, fsmTransitions, acceptingStates, startingStates };
}
