export function makeLetFSM() {

  const acceptingStates = ['ACCEPT'];
  const startingStates = ['START'];

  const fsmStates = [
    'START',
    'LET',
    'VAR',
    'EQ',
    'VALUE',
    'ACCEPT'
  ];

  const fsmTransitions = [
    { from: 'START', to: 'LET', label: 'let' },

    { from: 'LET', to: 'VAR', label: '[A-Za-z]+' },

    { from: 'VAR', to: 'EQ', label: '=' },

    { from: 'EQ', to: 'VALUE', label: '(\\d+|".*")' },

    { from: 'VALUE', to: 'ACCEPT', label: 'END' }
  ];

  return { fsmStates, fsmTransitions, acceptingStates, startingStates };
}
