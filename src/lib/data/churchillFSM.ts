export type Transition = { from: string; to: string; label: string };

export function makeChurchillFSM() {
  const acceptingStates = ['surrender', 'ACCEPT'];
  const startingStates = ['START'];
  const fsmStates = [
    'START', 'we', 'shall', 'fight', 'on', 'the',
    'beaches', 'landing', 'grounds', 'in', 'fields',
    'and', 'streets', 'hills', 'never', 'surrender', 
    // 'ACCEPT'
  ];
  const fsmTransitions: Transition[] = [
    { from: 'START', to: 'we', label: 'we' },
    { from: 'we', to: 'shall', label: 'shall' },
    { from: 'shall', to: 'fight', label: 'fight' },
    { from: 'fight', to: 'on', label: 'on' },
    { from: 'on', to: 'the', label: 'the' },
    { from: 'the', to: 'beaches', label: 'beaches' },
    { from: 'beaches', to: 'we', label: 'we' },
    { from: 'the', to: 'landing', label: 'landing' },
    { from: 'landing', to: 'grounds', label: 'grounds' },
    { from: 'grounds', to: 'we', label: 'we' },
    { from: 'fight', to: 'in', label: 'in' },
    { from: 'in', to: 'the', label: 'the' },
    { from: 'the', to: 'fields', label: 'fields' },
    { from: 'fields', to: 'and', label: 'and' },
    { from: 'and', to: 'in', label: 'in' },
    { from: 'the', to: 'streets', label: 'streets' },
    { from: 'streets', to: 'we', label: 'we' },
    { from: 'the', to: 'hills', label: 'hills' },
    { from: 'hills', to: 'we', label: 'we' },
    { from: 'shall', to: 'never', label: 'never' },
    { from: 'never', to: 'surrender', label: 'surrender' },
    { from: 'surrender', to: 'ACCEPT', label: 'END' }
  ];

  return { fsmStates, fsmTransitions, acceptingStates, startingStates };
}
