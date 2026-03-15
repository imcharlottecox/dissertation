// import type { builtFSM } from '$lib/data/shakeItOff/shakeitoff';
// import type { fTransition } from '$lib/graph/graphTypes';

// export function ComputeValidityFSM(fsmTransitions: fTransition[], input: string[], acceptingStates: string[]): boolean {
//     let currentState = "START";
//     if (input.length === 0) return false;

//     for (const token of input){
//         const nextState = fsmTransitions.find(transition => transition.from === currentState && transition.label === token);
//         if (nextState){
//             currentState = nextState.to;
//         } else {
//             return false;
//         }
//     }
//     return acceptingStates.includes(currentState);
// }
// computeValidityFSM.ts
// Hierarchical NFA walker for letFSM2-style FSMs.
//
// Architecture:
//   - All subgraph states are namespaced on merge (e.g. "space" in S3:VALUE.STRING
//     becomes "S3:VALUE.STRING.space") — eliminates state-name collisions across subgraphs.
//   - Warp targets in letFSM2 already use fully-qualified names, so they match directly.
//   - Top-level abstract transitions (S2:EQUAL->S3:VALUE, S3:VALUE->S4:END) are excluded
//     from the validator — they exist for display only. The char-level subgraphs handle
//     actual validation.
//   - Abstract "Call/call" labels in EXPRESSION subgraph become epsilon warps into NUMBER
//     subgraphs; operator/paren chars trigger an expr_exit back to EXPRESSION.After_op.

export interface fTransition {
    from: string;
    to: string;
    label: string;
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function ComputeValidityFSM(
    fsmTransitions: fTransition[],
    input: string[],
    acceptingStates: string[],
    subgraphs: Record<string, Subgraph> = {},
    warps: WarpEntry[] = [],
): boolean {
    if (input.length === 0) return false;

    const { transitions: allTransitions, warpMap } = buildNamespacedGraph(subgraphs);
    let currentStates = epsilonClosure(new Set(["S0:START"]), warpMap);

    for (const char of input) {
        const nextStates = new Set<string>();
        for (const state of currentStates) {
            const matching = allTransitions.filter(
                t => t.from === state && labelMatchesChar(t.label, char)
            );
            for (const t of matching) {
                epsilonClosure(new Set([t.to]), warpMap).forEach(s => nextStates.add(s));
            }
        }
        if (nextStates.size === 0) return false;
        currentStates = nextStates;
    }

    return [...currentStates].some(s => acceptingStates.includes(s));
}

// ---------------------------------------------------------------------------
// Top-level transitions (non-abstract only — abstract display transitions excluded)
// ---------------------------------------------------------------------------

const TOP_LEVEL_TRANSITIONS: fTransition[] = [
    { from: "S0:START",             to: "S1:VARIABLE_IDENTIFIER", label: "variable name" },
    { from: "S0:START",             to: "S0:START",                label: "space" },
    // Note: S2:EQUAL->S3:VALUE (abstract) and S3:VALUE->S4:END (abstract) excluded.
    // Validation routes through the char-level subgraphs via warps instead.
    { from: "S1:VARIABLE_IDENTIFIER", to: "S2:EQUAL",              label: "=" },
    { from: "S1:VARIABLE_IDENTIFIER", to: "S1:VARIABLE_IDENTIFIER", label: "space" },
    { from: "S2:EQUAL",             to: "S2:EQUAL",                label: "space" },
];

// ---------------------------------------------------------------------------
// Subgraph transition overrides
// These replace the raw letFSM2 transitions with validator-ready versions:
//   - Namespacing is applied by buildNamespacedGraph
//   - BOOL uses uppercase T/F to match real input
//   - IDENTIFIER gets a direct '=' exit (no-space-before-= case)
//   - INTEGER/FLOAT/COMPLEX get expr_exit transitions for operator/paren
// ---------------------------------------------------------------------------

// These are injected by overriding the subgraph transitions map passed from letFSM2.
// The public API accepts the raw subgraphs object from makeLetFSM() but internally
// replaces transitions for the subgraphs listed below.
const SUBGRAPH_TRANSITION_OVERRIDES: Record<string, fTransition[]> = {
    "S1:VARIABLE_IDENTIFIER": [
        { from: "START_PORT", to: "IDENTIFIER", label: "[A-Za-z] | _" },
        { from: "IDENTIFIER", to: "IDENTIFIER", label: "[A-Za-z0-9] | _" },
        { from: "IDENTIFIER", to: "ID_END",     label: "space" },
        { from: "IDENTIFIER", to: "EXIT_PORT",  label: "=" }, // no-space-before-= fix
        { from: "ID_END",     to: "ID_END",     label: "space" },
        { from: "ID_END",     to: "EXIT_PORT",  label: "=" },
    ],
    "S3:VALUE.BOOL": [
        // Uppercase T/F to match real typed input ('True', 'False')
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
    "S3:VALUE.NUMBER.EXPRESSION": [
        { from: "After_atom", to: "end",      label: "new line" },
        { from: "After_atom", to: "After_op", label: "+ | - | * | / | %" },
        { from: "After_op",   to: "Paren",    label: "(" },
        { from: "expect_atom", to: "Paren",   label: "(" },
        { from: "Wait",       to: "After_atom", label: ")" },
    ],
};

// ---------------------------------------------------------------------------
// Graph construction — namespaced subgraph merge + warp map
// ---------------------------------------------------------------------------

function buildNamespacedGraph(subgraphs: Record<string, Subgraph>): {
    transitions: fTransition[];
    warpMap: Map<string, Set<string>>;
} {
    // Merge raw subgraphs with our overrides
    const mergedSubgraphs: Record<string, Subgraph> = {};
    for (const [key, sg] of Object.entries(subgraphs)) {
        mergedSubgraphs[key] = SUBGRAPH_TRANSITION_OVERRIDES[key]
            ? { ...sg, transitions: SUBGRAPH_TRANSITION_OVERRIDES[key] }
            : sg;
    }

    const transitions: fTransition[] = [...TOP_LEVEL_TRANSITIONS];
    const warpMap = new Map<string, Set<string>>();

    function addWarp(from: string, to: string) {
        if (!warpMap.has(from)) warpMap.set(from, new Set());
        warpMap.get(from)!.add(to);
    }

    for (const [sgKey, sg] of Object.entries(mergedSubgraphs)) {
        for (const t of sg.transitions) {
            if (/^call\s/i.test(t.label)) continue; // skip abstract call labels
            transitions.push({
                from:  `${sgKey}.${t.from}`,
                to:    `${sgKey}.${t.to}`,
                label: t.label,
            });
        }
    }

    const WARPS: Array<[string, string]> = [
        ["S0:START",                                        "S1:VARIABLE_IDENTIFIER.START_PORT"],
        ["S1:VARIABLE_IDENTIFIER.EXIT_PORT",                "S2:EQUAL"],
        ["S2:EQUAL",                                        "S3:VALUE.BOOL.space"],
        ["S2:EQUAL",                                        "S3:VALUE.STRING.space"],
        ["S2:EQUAL",                                        "S3:VALUE.NUMBER.INTEGER.space"],
        ["S2:EQUAL",                                        "S3:VALUE.NUMBER.FLOAT.space"],
        ["S2:EQUAL",                                        "S3:VALUE.NUMBER.COMPLEX.space"],
        ["S2:EQUAL",                                        "S3:VALUE.NUMBER.EXPRESSION.expect_atom"],
        ["S3:VALUE.BOOL.end",                               "S4:END"],
        ["S3:VALUE.STRING.end",                             "S4:END"],
        ["S3:VALUE.NUMBER.end",                             "S4:END"],
        ["S3:VALUE.NUMBER.FLOAT.end",                       "S4:END"],
        ["S3:VALUE.NUMBER.INTEGER.end",                     "S4:END"],
        ["S3:VALUE.NUMBER.COMPLEX.end",                     "S4:END"],
        ["S3:VALUE.NUMBER.EXPRESSION.end",                  "S4:END"],
        ["S3:VALUE.NUMBER.FLOAT",                           "S3:VALUE.NUMBER.FLOAT.space"],
        ["S3:VALUE.NUMBER.COMPLEX",                         "S3:VALUE.NUMBER.COMPLEX.space"],
        ["S3:VALUE.NUMBER.INTEGER",                         "S3:VALUE.NUMBER.INTEGER.space"],
        ["S3:VALUE.NUMBER.EXPRESSION",                      "S3:VALUE.NUMBER.EXPRESSION.expect_atom"],
        ["S3:VALUE.NUMBER.SIGN",                            "S3:VALUE.NUMBER.FLOAT.space"],
        ["S3:VALUE.NUMBER.SIGN",                            "S3:VALUE.NUMBER.COMPLEX.space"],
        ["S3:VALUE.NUMBER.SIGN",                            "S3:VALUE.NUMBER.INTEGER.space"],
        ["S3:VALUE.NUMBER.SIGN",                            "S3:VALUE.NUMBER.EXPRESSION.expect_atom"],
        // EXPRESSION: abstract calls -> epsilon into NUMBER subgraphs
        ["S3:VALUE.NUMBER.EXPRESSION.expect_atom",          "S3:VALUE.NUMBER.INTEGER.space"],
        ["S3:VALUE.NUMBER.EXPRESSION.expect_atom",          "S3:VALUE.NUMBER.FLOAT.space"],
        ["S3:VALUE.NUMBER.EXPRESSION.expect_atom",          "S3:VALUE.NUMBER.COMPLEX.space"],
        // expr_exit (operator/paren consumed inside NUMBER) -> After_op -> expect_atom
        ["S3:VALUE.NUMBER.INTEGER.expr_exit",               "S3:VALUE.NUMBER.EXPRESSION.After_op"],
        ["S3:VALUE.NUMBER.FLOAT.expr_exit",                 "S3:VALUE.NUMBER.EXPRESSION.After_op"],
        ["S3:VALUE.NUMBER.COMPLEX.expr_exit",               "S3:VALUE.NUMBER.EXPRESSION.After_op"],
        ["S3:VALUE.NUMBER.EXPRESSION.After_op",             "S3:VALUE.NUMBER.EXPRESSION.expect_atom"],
        // Paren entry
        ["S3:VALUE.NUMBER.EXPRESSION.Paren",                "S3:VALUE.NUMBER.EXPRESSION.expect_atom"],
    ];

    for (const [from, to] of WARPS) addWarp(from, to);
    return { transitions, warpMap };
}

// ---------------------------------------------------------------------------
// NFA epsilon closure
// ---------------------------------------------------------------------------

function epsilonClosure(states: Set<string>, warpMap: Map<string, Set<string>>): Set<string> {
    const closure = new Set(states);
    const queue = [...states];
    while (queue.length > 0) {
        const s = queue.pop()!;
        const targets = warpMap.get(s);
        if (!targets) continue;
        for (const t of targets) {
            if (!closure.has(t)) { closure.add(t); queue.push(t); }
        }
    }
    return closure;
}

// ---------------------------------------------------------------------------
// Semantic label matcher — no regex exposed to students
// ---------------------------------------------------------------------------

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