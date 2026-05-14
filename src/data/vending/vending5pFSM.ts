import type { fTransition } from "$lib/graph/graphTypes";
export function makeVending5pFSM() {
    const startingStates: string[] = ['S: 0p'];

    const acceptingStates: string[] = ['S: ≥40p'];

    const fsmStates: string[] = [
        'S: 0p',
        'S: 5p',
        'S: 10p',
        'S: 15p',
        'S: 20p',
        'S: 25p',
        'S: 30p',        
        'S: 35p',
        'S: ≥40p',
    ];

    const fsmTransitions: fTransition[] = [
        { from: 'S: 0p', to: 'S: 10p', label: '10p' },
        { from: 'S: 0p', to: 'S: 20p', label: '20p' },
        { from: 'S: 0p', to: 'S: 5p', label: '5p' },

        { from: 'S: 5p', to: 'S: 10p', label: '5p' },
        { from: 'S: 5p', to: 'S: 15p', label: '10p' },
        { from: 'S: 5p', to: 'S: 25p', label: '20p' },

        { from: 'S: 10p', to: 'S: 15p', label: '5p' },
        { from: 'S: 10p', to: 'S: 20p', label: '10p' },
        { from: 'S: 10p', to: 'S: 30p', label: '20p' },

        { from: 'S: 15p', to: 'S: 20p', label: '5p' },
        { from: 'S: 15p', to: 'S: 25p', label: '10p' },
        { from: 'S: 15p', to: 'S: 35p', label: '20p' },

        { from: 'S: 20p', to: 'S: 25p', label: '5p' },
        { from: 'S: 20p', to: 'S: 30p', label: '10p' },
        { from: 'S: 20p', to: 'S: ≥40p', label: '20p' },

        { from: 'S: 25p', to: 'S: 30p', label: '5p' },
        { from: 'S: 25p', to: 'S: 35p', label: '10p' },
        { from: 'S: 25p', to: 'S: ≥40p', label: '20p' },

        { from: 'S: 30p', to: 'S: 35p', label: '5p' },
        { from: 'S: 30p', to: 'S: ≥40p', label: '10p, 20p' },

        { from: 'S: 35p', to: 'S: ≥40p', label: '5p, 10p, 20p' },


        { from: 'S: ≥40p', to: 'S: ≥40p', label: '5p, 10p, 20p' },
    ];

    return { fsmStates, fsmTransitions, acceptingStates, startingStates };
}
