export function makeChurchillMarkov() {
    const mStartingStates = [
        'START'
    ];
    
    const markovStates = [
        'START', 'we', 'shall', 'fight', 'on', 'the',
        'beaches', 'landing', 'grounds', 'in', 'fields',
        'and', 'streets', 'hills', 'never', 'surrender', '$'
    ];

  const markovTransitions = [
    // START
    { from: 'START', to: 'we', probability: 1.0 },

    // we
    { from: 'we', to: 'shall', probability: 1.0 },

    // shall
    { from: 'shall', to: 'fight', probability: 0.8 },
    { from: 'shall', to: 'never', probability: 0.2 },

    // fight
    { from: 'fight', to: 'on', probability: 0.5 },
    { from: 'fight', to: 'in', probability: 0.5 },

    // on
    { from: 'on', to: 'the', probability: 1.0 },

    // the
    { from: 'the', to: 'beaches', probability: 0.2 },
    { from: 'the', to: 'landing', probability: 0.2 },
    { from: 'the', to: 'fields', probability: 0.2 },
    { from: 'the', to: 'streets', probability: 0.2 },
    { from: 'the', to: 'hills', probability: 0.2 },

    // beaches
    { from: 'beaches', to: 'we', probability: 1.0 },

    // landing
    { from: 'landing', to: 'grounds', probability: 1.0 },

    // grounds
    { from: 'grounds', to: 'we', probability: 1.0 },

    // in
    { from: 'in', to: 'the', probability: 1.0 },

    // fields
    { from: 'fields', to: 'and', probability: 1.0 },

    // and
    { from: 'and', to: 'in', probability: 1.0 },

    // streets
    { from: 'streets', to: 'we', probability: 1.0 },

    // hills
    { from: 'hills', to: 'we', probability: 1.0 },

    // never
    { from: 'never', to: 'surrender', probability: 1.0 },

    // surrender
    { from: 'surrender', to: '$', probability: 1.0 },

    // $ (absorbing)
    { from: '$', to: '$', probability: 1.0 }
  ];

    const endState = ['$']

  return { markovStates, markovTransitions, mStartingStates, endState};
}

