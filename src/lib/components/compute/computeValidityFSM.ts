import type { fTransition } from '$lib/graph/graphTypes';

export function ComputeFlatValidityFSM(
    fsmTransitions: { from: string; to: string; label: string }[],
    input: string[],
    acceptingStates: string[],
    startingStates: string[],
): boolean {
    if (input.length === 0) return false;

    let currentStates = new Set(startingStates);

    for (const token of input) {
        const next = new Set<string>();
        for (const state of currentStates) {
            for (const t of fsmTransitions) {
                if (t.from === state && t.label === token) {
                    next.add(t.to);
                }
            }
        }
        if (next.size === 0) return false;
        currentStates = next;
    }

    return [...currentStates].some(s => acceptingStates.includes(s));
}
export interface Subgraph {
    depthLevel: number;
    parentState?: string;
    entry: string;
    exit: string;
    states: string[];
    acceptingStates: string[];
    startingStates: string[];
    transitions: fTransition[];
}

export interface WarpEntry {
    from: string;
    into?: string;
    backto?: string;
}

type Config = {
    state: string;
    stack: string[]; 
};

function configKey(c: Config): string {
    return c.state + "|" + c.stack.join(",");
}

export function ComputeValidityFSM(
    fsmTransitions: fTransition[],
    input: string[],
    acceptingStates: string[],
    subgraphs: Record<string, Subgraph> = {},
    warps: WarpEntry[] = [],
    startingStates: string[] = ["S0:START"],
): boolean {
    if (input.length === 0) return false;

    const { transitions, warpMap, callMap, returnStates } = buildGraph(subgraphs);

    let configs: Map<string, Config> = new Map();
    for (const s of startingStates) {
        const initial = epsilonClose({ state: s, stack: [] }, warpMap, callMap, returnStates);
        for (const c of initial) configs.set(configKey(c), c);
    }

    for (const char of input) {
        const next = new Map<string, Config>();

        for (const config of configs.values()) {
            const matching = transitions.filter(
                t => t.from === config.state && labelMatchesChar(t.label, char)
            );
            for (const t of matching) {
                const moved: Config = { state: t.to, stack: config.stack };
                const closed = epsilonClose(moved, warpMap, callMap, returnStates);
                for (const c of closed) {
                    const k = configKey(c);
                    if (!next.has(k)) next.set(k, c);
                }
            }

            if (char === ")") {
                const stack = config.stack;
                if (stack.length > 0) {
                    const returnState = stack[stack.length - 1];
                    const newStack = stack.slice(0, -1);
                    const returnConfig: Config = { state: returnState, stack: newStack };
                    const afterReturn = transitions.filter(
                        t => t.from === returnState && labelMatchesChar(t.label, char)
                    );
                    if (afterReturn.length > 0) {
                        for (const t of afterReturn) {
                            const moved: Config = { state: t.to, stack: newStack };
                            const closed = epsilonClose(moved, warpMap, callMap, returnStates);
                            for (const c of closed) {
                                const k = configKey(c);
                                if (!next.has(k)) next.set(k, c);
                            }
                        }
                    } else {
                        const closed = epsilonClose(returnConfig, warpMap, callMap, returnStates);
                        for (const c of closed) {
                            const k = configKey(c);
                            if (!next.has(k)) next.set(k, c);
                        }
                    }
                }
            }
        }

        if (next.size === 0) return false;
        configs = next;
    }

    return [...configs.values()].some(
        c => acceptingStates.includes(c.state) && c.stack.length === 0
    );
}


const TOP_LEVEL_TRANSITIONS: fTransition[] = [
    { from: "S0:START",             to: "S1:VARIABLE_IDENTIFIER", label: "variable name" },
    { from: "S0:START",             to: "S0:START",                label: "space" },
    { from: "S1:VARIABLE_IDENTIFIER", to: "S2:EQUAL",              label: "=" },
    { from: "S1:VARIABLE_IDENTIFIER", to: "S1:VARIABLE_IDENTIFIER", label: "space" },
    { from: "S2:EQUAL",             to: "S2:EQUAL",                label: "space" },
];

const SUBGRAPH_TRANSITION_OVERRIDES: Record<string, fTransition[]> = {
    "S1:VARIABLE_IDENTIFIER": [
        { from: "START_PORT", to: "IDENTIFIER", label: "[A-Za-z] | _" },
        { from: "IDENTIFIER", to: "IDENTIFIER", label: "[A-Za-z0-9] | _" },
        { from: "IDENTIFIER", to: "ID_END",     label: "space" },
        { from: "IDENTIFIER", to: "EXIT_PORT",  label: "=" }, 
        { from: "ID_END",     to: "ID_END",     label: "space" },
        { from: "ID_END",     to: "EXIT_PORT",  label: "=" },
    ],
    "S3:VALUE.BOOL": [
        { from: "space",  to: "T_node", label: "T" },
        { from: "T_node", to: "r",      label: "r" },
        { from: "r",      to: "u",      label: "u" },
        { from: "u",      to: "e",      label: "e" },
        { from: "e",      to: "end",    label: "newline" },
        { from: "space",  to: "F_node", label: "F" },
        { from: "F_node", to: "a",      label: "a" },
        { from: "a",      to: "l",      label: "l" },
        { from: "l",      to: "s",      label: "s" },
        { from: "s",      to: "e2",     label: "e" },
        { from: "e2",     to: "end",    label: "newline" },
    ],
    "S3:VALUE.NUMBER.INTEGER": [
        { from: "space",   to: "Integer",   label: "[0-9]" },
        { from: "Integer", to: "Integer",   label: "[0-9]" },
        { from: "Integer", to: "end",       label: "new line" },
        // Exit when operator or ')' seen inside expression context
        { from: "Integer", to: "expr_exit", label: "+ | - | * | / | %" },
        { from: "Integer", to: "expr_exit", label: ")" },
    ],
    "S3:VALUE.NUMBER.FLOAT": [
        { from: "space",   to: "Int",     label: "[0-9]" },
        { from: "space",   to: "Dot",     label: "." },
        { from: "Int",     to: "Int",     label: "[0-9]" },
        { from: "Int",     to: "Dot_ai",  label: "." },
        { from: "Int",     to: "e",       label: "e" },
        { from: "Dot_ai",  to: "e",       label: "e" },
        { from: "Dot_ai",  to: "Dec",     label: "[0-9]" },
        { from: "Dot_ai",  to: "end",     label: "new line" },
        { from: "e",       to: "e_sign",  label: "+ | -" },
        { from: "e",       to: "e_dig",   label: "[0-9]" },
        { from: "e_dig",   to: "e_dig",   label: "[0-9]" },
        { from: "e_dig",   to: "end",     label: "new line" },
        { from: "e_sign",  to: "e_dig",   label: "[0-9]" },
        { from: "Dot",     to: "Dec",     label: "[0-9]" },
        { from: "Dec",     to: "Dec",     label: "[0-9]" },
        { from: "Dec",     to: "e",       label: "e" },
        { from: "Dec",     to: "end",     label: "new line" },
        { from: "Int",     to: "expr_exit", label: "+ | - | * | / | %" },
        { from: "Int",     to: "expr_exit", label: ")" },
        { from: "Dec",     to: "expr_exit", label: "+ | - | * | / | %" },
        { from: "Dec",     to: "expr_exit", label: ")" },
        { from: "Dot_ai",  to: "expr_exit", label: "+ | - | * | / | %" },
        { from: "Dot_ai",  to: "expr_exit", label: ")" },
        { from: "e_dig",   to: "expr_exit", label: ")" },
    ],
    "S3:VALUE.NUMBER.COMPLEX": [
        { from: "space",   to: "Int",     label: "[0-9]" },
        { from: "space",   to: "Dot",     label: "." },
        { from: "Int",     to: "Int",     label: "[0-9]" },
        { from: "Int",     to: "Dot_ai",  label: "." },
        { from: "Int",     to: "e",       label: "e" },
        { from: "Int",     to: "j",       label: "j" },
        { from: "Dot_ai",  to: "e",       label: "e" },
        { from: "Dot_ai",  to: "Dec",     label: "[0-9]" },
        { from: "Dot_ai",  to: "end",     label: "new line" },
        { from: "Dot_ai",  to: "j",       label: "j" },
        { from: "e",       to: "e_sign",  label: "+ | -" },
        { from: "e",       to: "e_dig",   label: "[0-9]" },
        { from: "e_dig",   to: "e_dig",   label: "[0-9]" },
        { from: "e_dig",   to: "end",     label: "new line" },
        { from: "e_dig",   to: "j",       label: "j" },
        { from: "e_sign",  to: "e_dig",   label: "[0-9]" },
        { from: "Dot",     to: "Dec",     label: "[0-9]" },
        { from: "Dec",     to: "Dec",     label: "[0-9]" },
        { from: "Dec",     to: "e",       label: "e" },
        { from: "Dec",     to: "end",     label: "new line" },
        { from: "Dec",     to: "j",       label: "j" },
        { from: "j",       to: "end",     label: "new line" },
        { from: "j",       to: "expr_exit", label: "+ | - | * | / | %" },
        { from: "j",       to: "expr_exit", label: ")" },
        { from: "Int",     to: "expr_exit", label: "+ | - | * | / | %" },
        { from: "Int",     to: "expr_exit", label: ")" },
    ],
    // "S3:VALUE.NUMBER.EXPRESSION": [
    //     { from: "After_atom", to: "end",      label: "new line" },
    //     { from: "After_atom", to: "After_op", label: "+ | - | * | / | %" },
    //     { from: "After_op",   to: "Paren",    label: "(" },
    //     { from: "expect_atom", to: "Paren",   label: "(" },
    //     { from: "Wait",       to: "After_atom", label: ")" },
    //     { from: "After_atom", to: "After_atom", label: ")" },
        
    // ],
//     "S3:VALUE.NUMBER.EXPRESSION": [
//     { from: "After_atom", to: "end",        label: "new line" },
//     { from: "After_atom", to: "After_op",   label: "+ | - | * | / | %" },
//     { from: "After_op",   to: "expect_atom", label: "null" },  // epsilon via warp
//     // ( on After_op and expect_atom: handled by callMap from letFSM2 transitions
//     // ) on Wait: handled by call/return stack pop + Wait -> After_atom
//     { from: "Wait",       to: "After_atom", label: ")" },
// ],
    "S3:VALUE.NUMBER.EXPRESSION": [
        { from: "After_atom",  to: "end",        label: "new line" },
        { from: "After_atom",  to: "After_op",   label: "+ | - | * | / | %" },
        { from: "After_op",  to: "expect_atom",   label: "call S3:VALUE.NUMBER" },
        { from: "expect_atom", to: "Paren",      label: "(" },
        { from: "After_op",    to: "Paren",      label: "(" },
        { from: "Paren",       to: "Wait",       label: "call S3:VALUE.NUMBER.EXPRESSION" },
        { from: "Wait",        to: "After_atom", label: ")" },
    ],
};

type CallEdge = { from: string; callTarget: string; returnTo: string };

function buildGraph(subgraphs: Record<string, Subgraph>): {
    transitions: fTransition[];
    warpMap: Map<string, Set<string>>;
    callMap: CallEdge[];          
    returnStates: Set<string>;   
} {
    const mergedSubgraphs: Record<string, Subgraph> = {};
    for (const [key, sg] of Object.entries(subgraphs)) {
        mergedSubgraphs[key] = SUBGRAPH_TRANSITION_OVERRIDES[key]
            ? { ...sg, transitions: SUBGRAPH_TRANSITION_OVERRIDES[key] }
            : sg;
    }

    const transitions: fTransition[] = [...TOP_LEVEL_TRANSITIONS];
    const warpMap = new Map<string, Set<string>>();
    const callMap: CallEdge[] = [];
    const returnStates = new Set<string>();

    function addWarp(from: string, to: string) {
        if (!warpMap.has(from)) warpMap.set(from, new Set());
        warpMap.get(from)!.add(to);
    }

    const subgraphEntries: Record<string, string> = {};
    for (const [sgKey, sg] of Object.entries(mergedSubgraphs)) {
        subgraphEntries[sgKey] = `${sgKey}.${sg.entry}`;
        returnStates.add(`${sgKey}.${sg.exit}`);
    }

    for (const [sgKey, sg] of Object.entries(mergedSubgraphs)) {
        for (const t of sg.transitions) {
            const callMatch = t.label.match(/^call\s+(\S+)/i);
            if (callMatch) {
                const calledSG = callMatch[1];
                const callTarget = subgraphEntries[calledSG];
                const returnTo = `${sgKey}.${t.to}`; 
                if (callTarget) {
                    callMap.push({
                        from: `${sgKey}.${t.from}`,
                        callTarget,
                        returnTo,
                    });
                }
                continue; 
            }
            transitions.push({
                from:  `${sgKey}.${t.from}`,
                to:    `${sgKey}.${t.to}`,
                label: t.label,
            });
        }
    }

    const WARPS: Array<[string, string]> = [
        ["S0:START",                             "S1:VARIABLE_IDENTIFIER.START_PORT"],
        ["S1:VARIABLE_IDENTIFIER.EXIT_PORT",     "S2:EQUAL"],
        ["S2:EQUAL",                             "S3:VALUE.BOOL.space"],
        ["S2:EQUAL",                             "S3:VALUE.STRING.space"],
        ["S2:EQUAL",                             "S3:VALUE.NUMBER.INTEGER.space"],
        ["S2:EQUAL",                             "S3:VALUE.NUMBER.FLOAT.space"],
        ["S2:EQUAL",                             "S3:VALUE.NUMBER.COMPLEX.space"],
        ["S2:EQUAL",                             "S3:VALUE.NUMBER.EXPRESSION.expect_atom"],
        ["S3:VALUE.BOOL.end",                    "S4:END"],
        ["S3:VALUE.STRING.end",                  "S4:END"],
        ["S3:VALUE.NUMBER.end",                  "S4:END"],
        ["S3:VALUE.NUMBER.FLOAT.end",            "S4:END"],
        ["S3:VALUE.NUMBER.INTEGER.end",          "S4:END"],
        ["S3:VALUE.NUMBER.COMPLEX.end",          "S4:END"],
        ["S3:VALUE.NUMBER.EXPRESSION.end",       "S4:END"],
        ["S3:VALUE.NUMBER.FLOAT",                "S3:VALUE.NUMBER.FLOAT.space"],
        ["S3:VALUE.NUMBER.COMPLEX",              "S3:VALUE.NUMBER.COMPLEX.space"],
        ["S3:VALUE.NUMBER.INTEGER",              "S3:VALUE.NUMBER.INTEGER.space"],
        ["S3:VALUE.NUMBER.EXPRESSION",           "S3:VALUE.NUMBER.EXPRESSION.expect_atom"],
        ["S3:VALUE.NUMBER.SIGN",                 "S3:VALUE.NUMBER.FLOAT.space"],
        ["S3:VALUE.NUMBER.SIGN",                 "S3:VALUE.NUMBER.COMPLEX.space"],
        ["S3:VALUE.NUMBER.SIGN",                 "S3:VALUE.NUMBER.INTEGER.space"],
        ["S3:VALUE.NUMBER.SIGN",                 "S3:VALUE.NUMBER.EXPRESSION.expect_atom"],
        ["S3:VALUE.NUMBER.EXPRESSION.expect_atom", "S3:VALUE.NUMBER.INTEGER.space"],
        ["S3:VALUE.NUMBER.EXPRESSION.expect_atom", "S3:VALUE.NUMBER.FLOAT.space"],
        ["S3:VALUE.NUMBER.EXPRESSION.expect_atom", "S3:VALUE.NUMBER.COMPLEX.space"],
        ["S3:VALUE.NUMBER.INTEGER.expr_exit",    "S3:VALUE.NUMBER.EXPRESSION.After_op"],
        ["S3:VALUE.NUMBER.FLOAT.expr_exit",      "S3:VALUE.NUMBER.EXPRESSION.After_op"],
        ["S3:VALUE.NUMBER.COMPLEX.expr_exit",    "S3:VALUE.NUMBER.EXPRESSION.After_op"],
        ["S3:VALUE.NUMBER.EXPRESSION.After_op",  "S3:VALUE.NUMBER.EXPRESSION.expect_atom"],
        ["S3:VALUE.NUMBER.INTEGER.Integer",      "S3:VALUE.NUMBER.EXPRESSION.After_atom"],
        ["S3:VALUE.NUMBER.FLOAT.Dec",            "S3:VALUE.NUMBER.EXPRESSION.After_atom"],
        ["S3:VALUE.NUMBER.FLOAT.Dot_ai",         "S3:VALUE.NUMBER.EXPRESSION.After_atom"],
        ["S3:VALUE.NUMBER.FLOAT.e_dig",          "S3:VALUE.NUMBER.EXPRESSION.After_atom"],
        ["S3:VALUE.NUMBER.COMPLEX.j",            "S3:VALUE.NUMBER.EXPRESSION.After_atom"],
    ];

    for (const [from, to] of WARPS) addWarp(from, to);
    return { transitions, warpMap, callMap, returnStates };
}


function epsilonClose(
    start: Config,
    warpMap: Map<string, Set<string>>,
    callMap: CallEdge[],
    returnStates: Set<string>,
): Config[] {
    const result = new Map<string, Config>();
    const queue: Config[] = [start];

    while (queue.length > 0) {
        const config = queue.pop()!;
        const key = configKey(config);
        if (result.has(key)) continue;
        result.set(key, config);

        const warps = warpMap.get(config.state);
        if (warps) {
            for (const target of warps) {
                const next: Config = { state: target, stack: config.stack };
                if (!result.has(configKey(next))) queue.push(next);
            }
        }

        for (const edge of callMap) {
            if (edge.from === config.state) {
                const next: Config = {
                    state: edge.callTarget,
                    stack: [...config.stack, edge.returnTo],
                };
                if (!result.has(configKey(next))) queue.push(next);
            }
        }
    }

    return [...result.values()];
}

function labelMatchesChar(label: string, char: string): boolean {
    return label.split(" | ").map(p => p.trim()).some(p => matchesPart(p, char));
}

function matchesPart(part: string, char: string): boolean {
    switch (part.toLowerCase()) {
        case "space":              return char === " " || char === "\t";
        case "newline":
        case "new line":           return char === "\n" || char === "\r";
        case "null":               return false;
        case "operator":           return "+-*/%<>=!&|^~".includes(char);
        case "variable name":      return /^[A-Za-z_]$/.test(char);
        case "variable value":     return /^[0-9"TtFf]$/.test(char);
        case "whole number":       return /^[0-9]$/.test(char);
        case "decimal number":     return /^[0-9.]$/.test(char);
        case "complex number":     return /^[0-9.]$/.test(char);
        case "numerical expression": return /^[0-9.(+\-]$/.test(char);
        case '"text"':             return char === '"';
        case "true":               return char === "T";
        case "false":              return char === "F";
    }
    const classMatch = part.match(/^\[([^\]]+)\]$/);
    if (classMatch) return matchesCharClass(classMatch[1], char);
    if (part.length === 1) return char === part;
    return false;
}

function matchesCharClass(classBody: string, char: string): boolean {
    let i = 0;
    while (i < classBody.length) {
        if (i + 2 < classBody.length && classBody[i + 1] === "-") {
            if (char >= classBody[i] && char <= classBody[i + 2]) return true;
            i += 3;
        } else {
            if (char === classBody[i]) return true;
            i++;
        }
    }
    return false;
}