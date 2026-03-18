export function makeLetFSM() {
    //hypothetical dataset
    // name = "Anna"
    // age = 17
    // snowing = true
    // VARIABLE = [name, age, snowing]
    // VALUE = ["Anna", 17, true]

    //TODO: ALLOW FOR NEGATIVE NUMBERS
    //ALLOW FOR ARRAY ACCESS

    const acceptingStates = ['S4:END'];
    const startingStates = ['S0:START'];

    const fsmStates = [
        'S0:START',
        'S1:VARIABLE_IDENTIFIER',
        'S2:EQUAL',
        'S3:VALUE',
        'S4:END'
    ];

    const fsmTransitions = [
        { from: 'S0:START', to: 'S1:VARIABLE_IDENTIFIER', label: 'variable name'},
        { from: 'S0:START', to : 'S0:START', label: 'space'},
        { from: 'S1:VARIABLE_IDENTIFIER', to: 'S2:EQUAL', label: '=' },
        { from: 'S1:VARIABLE_IDENTIFIER', to: 'S1:VARIABLE_IDENTIFIER', label: 'space' },
        { from: 'S2:EQUAL', to: 'S3:VALUE', label: 'variable value' },
        { from: 'S2:EQUAL', to: 'S2:EQUAL', label: 'space' },
        { from: 'S3:VALUE', to: 'S4:END', label: 'new Line' }
    ];

    const subgraphs = {
        'S1:VARIABLE_IDENTIFIER': {
            depthLevel: 1,
            entry: 'START_PORT',
            exit: 'EXIT_PORT',
            states: ['START_PORT', 'IDENTIFIER', 'ID_END', 'EXIT_PORT'],
            acceptingStates: ['IDENTIFIER'],
            startingStates: ['START_PORT'],
            transitions: [
                { from: 'START_PORT', to: 'IDENTIFIER', label: '[A-Za-z] | _'},
                { from: 'IDENTIFIER', to: 'IDENTIFIER', label: '[A-Za-z0-9] | _'},
                { from: 'IDENTIFIER', to: 'ID_END', label: 'space'},
                { from: 'ID_END', to: 'ID_END', label: 'space'},
                { from: 'ID_END', to: 'EXIT_PORT', label: '='}
            ],
        },
        'S3:VALUE': {
            depthLevel: 1,
            entry: 'START_PORT',
            exit: 'EXIT_PORT',
            acceptingStates: ['BOOL', 'STRING', 'NUMBER'],
            startingStates: ['START_PORT'],
            states: ['START_PORT', 'BOOL', 'STRING', 'NUMBER', 'EXIT_PORT'],
            transitions: [
                { from: 'START_PORT', to:'BOOL', label: 'True | False'},
                { from: 'START_PORT', to:'STRING', label: '"text"'},
                { from: 'START_PORT', to:'NUMBER', label: 'numerical expression'},
                { from: 'BOOL', to: 'EXIT_PORT', label: 'New Line'},
                { from: 'STRING', to: 'EXIT_PORT', label: 'New Line'},
                { from: 'NUMBER', to: 'EXIT_PORT', label: 'New Line'},
            ]
        },

        'S3:VALUE.BOOL': {
            depthLevel: 2,
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
        'S3:VALUE.STRING': {
            depthLevel: 2,
            parentState: 'STRING',
            entry: 'space',
            exit: 'end',
            states: ['space', 'opening_"', 'closing_"', 'character', 'end'],
            acceptingStates: ['end'],
            startingStates: ['space'],
            transitions: [
                { from: 'space', to: 'opening_"', label: '"' },
                { from: 'opening_"', to: 'character', label: '_ | [A-Za-z0-9] | operator | space' },
                { from: 'opening_"', to: 'closing_"', label: '"' },
                { from: 'character', to: 'character', label: '_ | [A-Za-z0-9] | operator | space' },
                { from: 'character', to: 'closing_"', label: '"' },
                { from: 'closing_"', to: 'end', label: 'newline' }
            ]
        },
        'S3:VALUE.NUMBER': {
            depthLevel: 2,
            parentState: 'NUMBER',
            entry: 'space',
            exit: 'end',
            states: ['space', 'FLOAT', 'COMPLEX', 'INTEGER', 'EXPRESSION', 'SIGN', 'end'],
            acceptingStates: ['end'],
            startingStates: ['space'],
            transitions: [
                { from: 'space', to: 'SIGN', label: '+ | -' },
                { from: 'space', to: 'FLOAT', label: 'decimal number' },
                { from: 'space', to: 'COMPLEX', label: 'complex number' },
                { from: 'space', to: 'INTEGER', label: 'whole number' },
                { from: 'space', to: 'EXPRESSION', label: 'numerical expression' },
                { from: 'SIGN', to: 'FLOAT', label: 'decimal number' },
                { from: 'SIGN', to: 'COMPLEX', label: 'complex number' },
                { from: 'SIGN', to: 'INTEGER', label: 'whole number' },
                { from: 'SIGN', to: 'EXPRESSION', label: 'numerical expression' },
                { from: 'FLOAT', to: 'end', label: 'new line' },
                { from: 'COMPLEX', to: 'end', label: 'new line' },
                { from: 'INTEGER', to: 'end', label: 'new line' },
                { from: 'EXPRESSION', to: 'end', label: 'new line' },
            ]
        },
        'S3:VALUE.NUMBER.FLOAT': {
            depthLevel: 3,
            parentState: 'FLOAT',
            entry: 'space',
            exit: 'end',
            states: ['space', 'Integer', 'Dot', 'Dot_after_int', 'e', 'Decimal_int', 'e_sign', 'e_digit', 'end'],
            acceptingStates: ['end'],
            startingStates: ['space'],
            transitions: [
                { from: 'space', to: 'Integer', label: '[0-9]' },
                { from: 'space', to: 'Dot', label: '.' },
                { from: 'Integer', to: 'Integer', label: '[0-9]' },                
                { from: 'Integer', to: 'Dot_after_int', label: '.' },
                { from: 'Integer', to: 'e', label: 'e' },
                { from: 'Dot_after_int', to: 'e', label: 'e' },
                { from: 'Dot_after_int', to: 'Decimal_int', label: '[0-9]' },
                { from: 'Dot_after_int', to: 'end', label: 'new line' },
                { from: 'e', to: 'e_sign', label: '+ | -' },
                { from: 'e', to: 'e_digit', label: '[0-9]' },
                { from: 'e_digit', to: 'e_digit', label: '[0-9]' },
                { from: 'e_digit', to: 'end', label: 'new line' },
                { from: 'e_sign', to: 'e_digit', label: '[0-9]' },
                { from: 'Dot', to: 'Decimal_int', label: '[0-9]' },
                { from: 'Decimal_int', to: 'Decimal_int', label: '[0-9]' },
                { from: 'Decimal_int', to: 'e', label: 'e' },
                { from: 'Decimal_int', to: 'end', label: 'new line' },
            ]
        },
        'S3:VALUE.NUMBER.COMPLEX': {
            depthLevel: 3,
            parentState: 'COMPLEX',
            entry: 'space',
            exit: 'end',
            states: ['space', 'Integer', 'Dot', 'Dot_after_int', 'e', 'Decimal_int', 'e_sign', 'e_digit', 'j', 'end'],
            acceptingStates: ['end'],
            startingStates: ['space'],
            transitions: [
                { from: 'space', to: 'Integer', label: '[0-9]' },
                { from: 'space', to: 'Dot', label: '.' },
                { from: 'Integer', to: 'Integer', label: '[0-9]' },                
                { from: 'Integer', to: 'Dot_after_int', label: '.' },
                { from: 'Integer', to: 'e', label: 'e' },
                { from: 'Dot_after_int', to: 'e', label: 'e' },
                { from: 'Dot_after_int', to: 'Decimal_int', label: '[0-9]' },
                { from: 'Dot_after_int', to: 'end', label: 'new line' },
                { from: 'e', to: 'e_sign', label: '+ | -' },
                { from: 'e', to: 'e_digit', label: '[0-9]' },
                { from: 'e_digit', to: 'e_digit', label: '[0-9]' },
                { from: 'e_digit', to: 'end', label: 'new line' },
                { from: 'e_sign', to: 'e_digit', label: '[0-9]' },
                { from: 'Dot', to: 'Decimal_int', label: '[0-9]' },
                { from: 'Decimal_int', to: 'Decimal_int', label: '[0-9]' },
                { from: 'Decimal_int', to: 'e', label: 'e' },
                { from: 'Decimal_int', to: 'end', label: 'new line' },
                { from: 'Decimal_int', to: 'j', label: 'j' },
                { from: 'e_digit', to: 'j', label: 'j' },
                { from: 'Dot_after_int', to: 'j', label: 'j' },
                { from: 'Integer', to: 'j', label: 'j' },
                { from: 'j', to: 'end', label: 'new line' },
            ]
        },
        'S3:VALUE.NUMBER.INTEGER': {
            depthLevel: 3,
            parentState: 'INTEGER',
            entry: 'space',
            exit: 'end',
            states: ['space', 'Integer', 'end'],
            acceptingStates: ['end'],
            startingStates: ['space'],
            transitions: [
                { from: 'space', to: 'Integer', label: '[0-9]' },
                { from: 'Integer', to: 'Integer', label: '[0-9]' },
                { from: 'Integer', to: 'end', label: 'new line' },
            ]
        },
        'S3:VALUE.NUMBER.EXPRESSION': {
            depthLevel: 3,
            parentState: 'EXPRESSION',
            entry: 'expect_atom',
            exit: 'end',
            startingStates: ['expect_atom'],
            acceptingStates: ['end'],
            states: ['expect_atom', 'After_atom', 'After_op', 'Parenthesis_expr', 'Wait', 'end'],
            transitions: [
                { from: 'expect_atom', to: 'After_atom', label: 'Call S3:VALUE.NUMBER' },
                { from: 'After_atom', to: 'end', label: 'new line' },
                { from: 'After_atom', to: 'After_op', label: '+ | - | * | / | %' },
                { from: 'After_op', to: 'expect_atom', label: 'null' },
                { from: 'After_op', to: 'Parenthesis_expr', label: '(' },
                { from: 'expect_atom', to: 'Parenthesis_expr', label: '(' },
                { from: 'Parenthesis_expr', to: 'Wait', label: 'call S3:VALUE.NUMBER.EXPRESSION' },
                { from: 'Wait', to: 'After_atom', label: ')' },
            ]
        },

    };
    const warps = [
        { from: 'S0:START', into: 'S1:VARIABLE_IDENTIFIER.START_PORT'},
        { from: 'S1:VARIABLE_IDENTIFIER.EXIT_PORT', backto: 'S2:EQUAL'},
        { from: 'S2:EQUAL', into: 'S3:VALUE.START_PORT'},
        { from: 'S3:VALUE.EXIT_PORT', backto: 'S4:END'},
        // { from: 'S3:VALUE.BOOL.space', into: 'S3:VALUE.BOOL.space' },
        // { from: 'BOOL', into: 'BOOL.space' },
        // { from: 'BOOL.end', backto: 'S3:VALUE.EXIT_PORT' },
        { from: 'S2:EQUAL', into: 'S3:VALUE.BOOL.space' },
        { from: 'S3:VALUE.BOOL.end', backto: 'S4:END' },
        { from: 'S2:EQUAL', into: 'S3:VALUE.STRING.space' },
        { from: 'S3:VALUE.STRING.end', backto: 'S4:END' },
        { from: 'S2:EQUAL', into: 'S3:VALUE.NUMBER.space' },
        { from: 'S3:VALUE.NUMBER.end', backto: 'S4:END' },
        { from: 'S2:EQUAL', into: 'S3:VALUE.NUMBER.FLOAT.space' },
        { from: 'S3:VALUE.NUMBER.FLOAT.end', backto: 'S4:END' },
        { from: 'S2:EQUAL', into: 'S3:VALUE.NUMBER.INTEGER.space' },
        { from: 'S3:VALUE.NUMBER.INTEGER.end', backto: 'S4:END' },
        { from: 'S2:EQUAL', into: 'S3:VALUE.NUMBER.COMPLEX.space' },
        { from: 'S3:VALUE.NUMBER.COMPLEX.end', backto: 'S4:END' },
        { from: 'S2:EQUAL', into: 'S3:VALUE.NUMBER.EXPRESSION.expect_atom' },
        { from: 'S3:VALUE.NUMBER.EXPRESSION.end', backto: 'S4:END' },
        { from: 'S3:VALUE.NUMBER.FLOAT', into: 'S3:VALUE.NUMBER.FLOAT.space' },
        { from: 'S3:VALUE.NUMBER.COMPLEX', into: 'S3:VALUE.NUMBER.COMPLEX.space' },
        { from: 'S3:VALUE.NUMBER.INTEGER', into: 'S3:VALUE.NUMBER.INTEGER.space' },
        { from: 'S3:VALUE.NUMBER.EXPRESSION', into: 'S3:VALUE.NUMBER.EXPRESSION.expect_atom' },
        { from: 'S3:VALUE.NUMBER.SIGN', into: 'S3:VALUE.NUMBER.FLOAT.space'},
        { from: 'S3:VALUE.NUMBER.SIGN', into: 'S3:VALUE.NUMBER.COMPLEX.space'},
        { from: 'S3:VALUE.NUMBER.SIGN', into: 'S3:VALUE.NUMBER.INTEGER.space'},
        { from: 'S3:VALUE.NUMBER.SIGN', into: 'S3:VALUE.NUMBER.EXPRESSION.expect_atom'},
        { from: 'S3:VALUE.NUMBER.FLOAT.end', backto: 'S3:VALUE.NUMBER.end'},
        { from: 'S3:VALUE.NUMBER.COMPLEX.end', backto: 'S3:VALUE.NUMBER.end'},
        { from: 'S3:VALUE.NUMBER.INTEGER.end', backto: 'S3:VALUE.NUMBER.end'},
        { from: 'S3:VALUE.NUMBER.EXPRESSION.end', backto: 'S3:VALUE.NUMBER.end'},


        
    ];

    return { fsmStates, fsmTransitions, acceptingStates, startingStates, subgraphs, warps };
}
