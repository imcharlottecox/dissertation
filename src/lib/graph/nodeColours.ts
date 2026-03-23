export const NODE_COLOURS ={
    regular: "#DDDDDD",
    starting: "#99DDFF",
    accepting: "#BBCC33"
} as const;

export const SUBGRAPH_COLOURS = [
    "#77AADD",
    "#44BB99",
    "#EEDD88",
    "#EE8866",
    "#FFAABB",
    "#99DDFF"
] as const;

export const SECTION_COLOURS: Record<string, string> = {
    verse: SUBGRAPH_COLOURS[0],
    chorus: SUBGRAPH_COLOURS[4],
    prechorus: SUBGRAPH_COLOURS[2],
    bridge: SUBGRAPH_COLOURS[5],
    outro: SUBGRAPH_COLOURS[1],
};


export function subgraphColour(index: number): string{
    return SUBGRAPH_COLOURS[index%SUBGRAPH_COLOURS.length];
}
export function sectionColour(name: string, index = 0): string{
    return SECTION_COLOURS[name] ?? subgraphColour(index);
}

export const NODE_STROKES = {
    regular: "#888888",
    starting: "#2a6fa8",
    accepting: "#6b7a1a",
} as const;