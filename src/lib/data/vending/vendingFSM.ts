export type Transition = { from: string; to: string; label: string };

export function makeVending40pFSM() {
    const startingStates: string[] = ['S: 0p'];

    const acceptingStates: string[] = ['S: ≥40p'];

    const fsmStates: string[] = [
        'S: 0p',
        'S: 10p',
        'S: 20p',
        'S: 30p',
        'S: ≥40p',
    ];

    const fsmTransitions: Transition[] = [
        { from: 'S: 0p', to: 'S: 10p', label: '10p' },
        { from: 'S: 0p', to: 'S: 20p', label: '20p' },

        { from: 'S: 10p', to: 'S: 20p', label: '10p' },
        { from: 'S: 10p', to: 'S: 30p', label: '20p' },

        { from: 'S: 20p', to: 'S: ≥40p', label: '20p' },
        { from: 'S: 20p', to: 'S: 30p', label: '10p' },

        { from: 'S: 30p', to: 'S: ≥40p', label: '10p, 20p' },

        { from: 'S: ≥40p', to: 'S: ≥40p', label: '10p, 20p' },
    ];

    return { fsmStates, fsmTransitions, acceptingStates, startingStates };
}
