import { computeValidityFSM } from "$lib/components/compute/computeHiearchicalValidity";
import type { fTransition, Warp } from "$lib/graph/graphTypes";
import { makeLetFSM } from "./letFSM";

const TOP_LEVEL_TRANSITIONS: fTransition[] =[
    { from: 'S0:START', to: 'S1:VARIABLE_IDENTIFIER', label: 'variable name'},
    { from: 'S0:START', to : 'S0:START', label: 'space'},
    { from: 'S1:VARIABLE_IDENTIFIER', to: 'S2:EQUAL', label: '=' },
    { from: 'S1:VARIABLE_IDENTIFIER', to: 'S1:VARIABLE_IDENTIFIER', label: 'space' },
    { from: 'S2:EQUAL', to: 'S2:EQUAL', label: 'space' },
];

const SUBGRAPH_TRANSITION_OVERRIDES: Record<string, fTransition[]> = {
    'S3:VALUE.NUMBER.INTEGER': [
        { from: 'space', to: 'Integer', label: '[0-9]' },
        { from: 'Integer', to: 'Integer', label: '[0-9]' },
        { from: 'Integer', to: 'end', label: 'new line' },
        //added
        { from: 'Integer', to: 'expr_exit', label: '+ | - | * | / | %' },
        { from: 'Integer', to: 'expr_exit', label: ')' },
    ],
    "S3:VALUE.NUMBER.FLOAT":
    [
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
        //added
        { from: 'Integer', to: 'expr_exit', label: '+ | - | * | / | %' }, 
        { from: 'Integer', to: 'expr_exit', label: ')' }, 
        { from: 'Decimal_int', to: 'expr_exit', label: '+ | - | * | / | %' }, 
        { from: 'Decimal_int', to: 'expr_exit', label: ')' },         
        { from: 'Dot_after_int', to: 'expr_exit', label: '+ | - | * | / | %' }, 
        { from: 'Dot_after_int', to: 'expr_exit', label: ')' }, 
        { from: 'e_digit', to: 'expr_exit', label: ')' }, 
    ],
    "S3:VALUE.NUMBER.COMPLEX":
    [
        { from: 'space', to: 'Integer', label: '[0-9]' },
        { from: 'space', to: 'Dot', label: '.' },
        { from: 'Integer', to: 'Integer', label: '[0-9]' },                
        { from: 'Integer', to: 'Dot_after_int', label: '.' },
        { from: 'Integer', to: 'e', label: 'e' },
        { from: 'Integer', to: 'j', label: 'j' },
        { from: 'Dot_after_int', to: 'e', label: 'e' },
        { from: 'Dot_after_int', to: 'Decimal_int', label: '[0-9]' },
        { from: 'Dot_after_int', to: 'end', label: 'new line' },
        { from: 'Dot_after_int', to: 'j', label: 'j' },
        { from: 'e', to: 'e_sign', label: '+ | -' },
        { from: 'e', to: 'e_digit', label: '[0-9]' },
        { from: 'e_digit', to: 'e_digit', label: '[0-9]' },
        { from: 'e_digit', to: 'end', label: 'new line' },
        { from: 'e_digit', to: 'j', label: 'j' },
        { from: 'e_sign', to: 'e_digit', label: '[0-9]' },
        { from: 'Dot', to: 'Decimal_int', label: '[0-9]' },
        { from: 'Decimal_int', to: 'Decimal_int', label: '[0-9]' },
        { from: 'Decimal_int', to: 'e', label: 'e' },
        { from: 'Decimal_int', to: 'end', label: 'new line' },
        { from: 'Decimal_int', to: 'j', label: 'j' },
        { from: 'j', to: 'end', label: 'new line' },
        //added
        { from: 'j', to: 'expr_exit', label: '+ | - | * | / | %' }, 
        { from: 'j', to: 'expr_exit', label: ')' }, 
        { from: 'Integer', to: 'expr_exit', label: '+ | - | * | / | %' }, 
        { from: 'Integer', to: 'expr_exit', label: ')' }, 
    ],
    "S3:VALUE.NUMBER.EXPRESSION":[
        // { from: 'expect_atom', to: 'After_atom', label: 'Call S3:VALUE.NUMBER' },
        { from: 'After_atom', to: 'end', label: 'new line' },
        { from: 'After_atom', to: 'After_op', label: '+ | - | * | / | %' },
        // { from: 'After_op', to: 'expect_atom', label: 'call S3:VALUE.NUMBER.EXPRESSION' },
        { from: 'After_op', to: 'Parenthesis_expr', label: '(' },
        { from: 'expect_atom', to: 'Parenthesis_expr', label: '(' },
        { from: 'Parenthesis_expr', to: 'Wait', label: 'call S3:VALUE.NUMBER.EXPRESSION' },
        { from: 'Wait', to: 'After_atom', label: ')' },
        //added
        // { from: 'expect_atom', to: 'has_content', label: 'call S3:VALUE.NUMBER.EXPRESSION'},
        // { from: 'has_content', to: 'After_op', label: '+ | - | * | / | %' }, 
        // { from: 'has_content', to: 'end', label: 'new line' },         
    ]
}

const WARPS: Array<[string, string]> = [
        [  'S0:START',  'S1:VARIABLE_IDENTIFIER.START_PORT'],
        [  'S1:VARIABLE_IDENTIFIER.EXIT_PORT',  'S2:EQUAL'],
        // [  'S2:EQUAL',  'S3:VALUE.START_PORT'],
        // [  'S3:VALUE.EXIT_PORT',  'S4:END'],
        // [  'S3:VALUE.BOOL.space',  'S3:VALUE.BOOL.space' ],
        // [  'BOOL',  'BOOL.space' ],
        // [  'BOOL.end',  'S3:VALUE.EXIT_PORT' ],
        [  'S2:EQUAL',  'S3:VALUE.BOOL.space' ],
        [  'S3:VALUE.BOOL.end',  'S4:END' ],
        [  'S2:EQUAL',  'S3:VALUE.STRING.space' ],
        [  'S3:VALUE.STRING.end',  'S4:END' ],
        // [  'S2:EQUAL',  'S3:VALUE.NUMBER.space' ],
        [  'S3:VALUE.NUMBER.end',  'S4:END' ],
        [  'S2:EQUAL',  'S3:VALUE.NUMBER.FLOAT.space' ],
        [  'S3:VALUE.NUMBER.FLOAT.end',  'S4:END' ],
        [  'S2:EQUAL',  'S3:VALUE.NUMBER.INTEGER.space' ],
        [  'S3:VALUE.NUMBER.INTEGER.end',  'S4:END' ],
        [  'S2:EQUAL',  'S3:VALUE.NUMBER.COMPLEX.space' ],
        [  'S3:VALUE.NUMBER.COMPLEX.end',  'S4:END' ],
        [  'S2:EQUAL',  'S3:VALUE.NUMBER.EXPRESSION.expect_atom' ],
        [  'S3:VALUE.NUMBER.EXPRESSION.end',  'S4:END' ],
        [  'S3:VALUE.NUMBER.FLOAT',  'S3:VALUE.NUMBER.FLOAT.space' ],
        [  'S3:VALUE.NUMBER.COMPLEX',  'S3:VALUE.NUMBER.COMPLEX.space' ],
        [  'S3:VALUE.NUMBER.INTEGER',  'S3:VALUE.NUMBER.INTEGER.space' ],
        [  'S3:VALUE.NUMBER.EXPRESSION',  'S3:VALUE.NUMBER.EXPRESSION.expect_atom' ],
        [  'S3:VALUE.NUMBER.SIGN',  'S3:VALUE.NUMBER.FLOAT.space'],
        [  'S3:VALUE.NUMBER.SIGN',  'S3:VALUE.NUMBER.COMPLEX.space'],
        [  'S3:VALUE.NUMBER.SIGN',  'S3:VALUE.NUMBER.INTEGER.space'],
        [  'S3:VALUE.NUMBER.SIGN',  'S3:VALUE.NUMBER.EXPRESSION.expect_atom'],
        //added
        [  'S3:VALUE.NUMBER.EXPRESSION.expect_atom',  'S3:VALUE.NUMBER.FLOAT.space' ],
        [  'S3:VALUE.NUMBER.EXPRESSION.expect_atom',  'S3:VALUE.NUMBER.INTEGER.space' ],
        [  'S3:VALUE.NUMBER.EXPRESSION.expect_atom',  'S3:VALUE.NUMBER.COMPLEX.space' ],
        [  'S3:VALUE.NUMBER.INTEGER.expr_exit',  'S3:VALUE.NUMBER.EXPRESSION.After_op' ],
        [  'S3:VALUE.NUMBER.FLOAT.expr_exit',  'S3:VALUE.NUMBER.EXPRESSION.After_op' ],
        [  'S3:VALUE.NUMBER.COMPLEX.expr_exit',  'S3:VALUE.NUMBER.EXPRESSION.After_op' ],
        [  'S3:VALUE.NUMBER.EXPRESSION.After_op',  'S3:VALUE.NUMBER.EXPRESSION.expect_atom' ],
        [  'S3:VALUE.NUMBER.INTEGER.Integer',  'S3:VALUE.NUMBER.EXPRESSION.After_atom' ],
        [  'S3:VALUE.NUMBER.FLOAT.Decimal_int',  'S3:VALUE.NUMBER.EXPRESSION.After_atom' ],
        [  'S3:VALUE.NUMBER.FLOAT.Dot_after_int',  'S3:VALUE.NUMBER.EXPRESSION.After_atom' ],
        [  'S3:VALUE.NUMBER.FLOAT.e_digit',  'S3:VALUE.NUMBER.EXPRESSION.After_atom' ],
        [  'S3:VALUE.NUMBER.COMPLEX.j',  'S3:VALUE.NUMBER.EXPRESSION.After_atom' ],


        
    ];
const ALL_OVERRIDES = {
    ...SUBGRAPH_TRANSITION_OVERRIDES
};
export function computeLetValidity(input: string[]): boolean{
    const {fsmTransitions, acceptingStates, startingStates, subgraphs, warps} = makeLetFSM();
    return computeValidityFSM(
        TOP_LEVEL_TRANSITIONS, 
        input,
        acceptingStates,
        subgraphs,
        [],
        startingStates,
        SUBGRAPH_TRANSITION_OVERRIDES,
        WARPS
        
    );
}