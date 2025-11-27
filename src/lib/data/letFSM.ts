export function makeLetFSM() {
    //hypothetical dataset
    // name = "Anna"
    // age = 17
    // snowing = true
    // VARIABLE = [name, age, snowing]
    // VALUE = ["Anna", 17, true]

    //TODO: ALLOW FOR NEGATIVE NUMBERS
    //ALLOW FOR ARRAY ACCESS

    const acceptingStates = ['4:END'];
    const startingStates = ['0:START'];

    const fsmStates = [
        '0:START',
        '1:VARIABLE_IDENTIFIER',
        '2:EQUAL',
        '3:VALUE',
        '4:END'
    ];

    const fsmTransitions = [
        { from: '0:START', to: '1:VARIABLE_IDENTIFIER', label: '[A-Za-z]+'},
        { from: '0:START', to : '0:START', label: 'space'},
        { from: '1:VARIABLE_IDENTIFIER', to: '2:EQUAL', label: '=' },
        { from: '1:VARIABLE_IDENTIFIER', to: '1:VARIABLE_IDENTIFIER', label: 'space' },
        { from: '2:EQUAL', to: '3:VALUE', label: '([0-9]+ | "[A-Za-z0-9]*" | True | False)' },
        { from: '2:EQUAL', to: '2:EQUAL', label: 'space' },
        { from: '3:VALUE', to: '4:END', label: 'New Line' }
    ];

    const subgraphs = {
        '1:VARIABLE_IDENTIFIER': {
            level: 1,
            entry: 'START_PORT',
            exit: 'EXIT_PORT',
            states: ['START_PORT', 'IDENTIFIER', 'ID_END', 'EXIT_PORT'],
            acceptingStates: ['IDENTIFIER'],
            startingStates: ['START_PORT'],
            transitions: [
                { from: 'START_PORT', to: 'IDENTIFIER', label: '([A-Za-z]|_)'},
                { from: 'IDENTIFIER', to: 'IDENTIFIER', label: '([A-Za-z0-9]|_)'},
                { from: 'IDENTIFIER', to: 'ID_END', label: 'space'},
                { from: 'ID_END', to: 'ID_END', label: 'space'},
                { from: 'ID_END', to: 'EXIT_PORT', label: '='}
            ],
        },
        '3:VALUE': {
            level: 1,
            entry: 'START_PORT',
            exit: 'EXIT_PORT',
            acceptingStates: ['BOOL', 'STRING', 'INTEGER', 'FLOAT', 'EXPR'],
            startingStates: ['START_PORT'],
            states: ['START_PORT', 'BOOL', 'STRING', 'INTEGER', 'FLOAT', 'EXPR', 'EXIT_PORT'],
            transitions: [
                { from: 'START_PORT', to:'BOOL', label: 'True | False'},
                { from: 'START_PORT', to:'STRING', label: '"text"'},
                { from: 'START_PORT', to:'INTEGER', label: '[0-9]+'},
                { from: 'START_PORT', to:'EXPR', label: '[0-9]+ | "\\("'},
                { from: 'START_PORT', to:'FLOAT', label: '[0-9]*.[0-9]+ | [0-9]+.[0-9]*'},
                { from: 'BOOL', to: 'EXIT_PORT', label: 'New Line'},
                { from: 'STRING', to: 'EXIT_PORT', label: 'New Line'},
                { from: 'INTEGER', to: 'EXIT_PORT', label: 'New Line'},
                { from: 'FLOAT', to: 'EXIT_PORT', label: 'New Line'},
                { from: 'EXPR', to: 'EXIT_PORT', label: 'New Line'},

            ]
        },

        '3:VALUE.BOOL': {
            level: 2,
            parentState: 'BOOL',
            entry: 'space',
            exit: 'end',
            states: ['space', 't', 'r', 'u', 'e', 'f', 'a', 'l', 's', 'end'],
            acceptingStates: ['end'],
            startingStates: ['space'],
            transitions: [
                { from: 'space', to: 't', label: 't' },
                { from: 't', to: 'r', label: 'r' },
                { from: 'r', to: 'u', label: 'u' },
                { from: 'u', to: 'e', label: 'e' },
                { from: 'e', to: 'end', label: 'newline' },
                { from: 'space', to: 'f', label: 'f' },
                { from: 'f', to: 'a', label: 'a' },
                { from: 'a', to: 'l', label: 'l' },
                { from: 'l', to: 's', label: 's' },
                { from: 's', to: 'e', label: 'e' },
                { from: 'e', to: 'end', label: 'newline' }
            ]
        },
        '3:VALUE.EXPR': {
            level: 2,
            parentState: 'EXPR',
            entry: 'START',
            exit: 'END',
            startingStates: ['START'],
            acceptingStates: ['END'],
            states: [
                'START', 'NUM', 'OP', 'AFTER_OP', 'OPEN_PAREN', 'CLOSE_PAREN', 'END'
            ],
            transitions: [
                // number
                { from: 'START', to: 'NUM', label: '[0-9]+' },
                { from: 'NUM', to: 'OP', label: '(\\+|\\-|\\*|/)' },
                { from: 'OP', to: 'AFTER_OP', label: '[0-9]+' },
                { from: 'AFTER_OP', to: 'OP', label: '(\\+|\\-|\\*|/)' },
                { from: 'AFTER_OP', to: 'END', label: ')"? | newline' },

                // parentheses
                { from: 'START', to: 'OPEN_PAREN', label: '\\(' },
                { from: 'OPEN_PAREN', to: 'NUM', label: '[0-9]+' },
                { from: 'OPEN_PAREN', to: 'OPEN_PAREN', label: '\\(' },
                { from: 'NUM', to: 'CLOSE_PAREN', label: '\\)' },
                { from: 'CLOSE_PAREN', to: 'OP', label: '(\\+|\\-|\\*|/)' },
                { from: 'CLOSE_PAREN', to: 'END', label: 'newline' }
            ]
        },

    };
    const warps = [
        { from: '0:START', into: '1:VARIABLE_IDENTIFIER.START_PORT'},
        { from: '1:VARIABLE_IDENTIFIER.EXIT_PORT', backto: '2:EQUAL'},
        { from: '2:EQUAL', into: '3:VALUE.START_PORT'},
        { from: '3:VALUE.EXIT_PORT', backto: '4:END'},
        // { from: '3:VALUE.BOOL.space', into: '3:VALUE.BOOL.space' },
        // { from: 'BOOL', into: 'BOOL.space' },
        // { from: 'BOOL.end', backto: '3:VALUE.EXIT_PORT' },
        { from: '2:EQUAL', into: '3:VALUE.BOOL.space' },
        { from: '3:VALUE.BOOL.end', backto: '4:END' },
        { from: '2:EQUAL', into: '3:VALUE.EXPR.START' },
        { from: '3:VALUE.EXPR.END', backto: '4:END' },
    ];

    return { fsmStates, fsmTransitions, acceptingStates, startingStates, subgraphs, warps };
}
