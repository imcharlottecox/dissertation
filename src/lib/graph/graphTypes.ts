export type StateNode = {
    id: string;
    x: number;
    y: number;
    fx?: number | null;
    fy?: number | null;
    vx?: number;
    vy?: number;
};

export type mTransition = {
    from: string;
    to: string;
    probability: number;  
};

export type fTransition = {
    from: string;
    to: string;
    label: string;  
};

//from fsmhierarchical viewer
export type Subgraph = {
    depthLevel: number;
    parentState?: string;
    entry: string;
    exit: string;
    states: string[];
    acceptingStates: string[];
    startingStates: string[];
    transitions: fTransition[];
};

export type Warp = {
    from: string;
    into?: string;
    backto?: string;
};

// export type EdgeRenderDatum = {
//     key: string;
//     label?: string;
//     source: { x: number; y: number };
//     target: { x: number; y: number };
//     path: string;
//     labelX: number;
//     labelY: number;
//     isLoop: boolean;
// };

export type EdgeRenderingData = {
    id: string;
    label: string | undefined;
    from: string;
    to: string;
    sourceNode: HStateNode;
    targetNode: HStateNode;
    path: string;
    labelX: number;
    labelY: number;
    probability: number;
    isSelfLoop: boolean;
    isBidirectional: boolean;
    angle: number;
    isUpward: boolean;
};


export type HStateNode = {
    id: string;
    displayName: string;
    x: number;
    y: number;
    parent: string | null; //sgs parent id
    depth: number; //which nest
    visible: boolean;
    kind: "base" | "sub" | "hiddenPort";
}
export interface HEdge {
    id: string;
    from: string;
    to: string;
    label?: string;
    visible: boolean;
    kind: "base" | "sub" | "warp" ;
    // parent: string;
    parent: string | null;
    // cachedPath?: string;
    // cachedLabelX?: number;
    // cachedLabelY?: number;
    // cachedAngle?: number;
    // cachedIsSelfLoop?: boolean;
  }
export interface HGraph {
    nodes: Map<string, HStateNode>;
    edges: Map<string, HEdge>;
    activeSubgraphs: Set<string>; 
}
export type FSM = {
    fsmStates: string[];
    fsmTransitions: fTransition[];
    startingStates: string[];
    acceptingStates: string[];
}
export type DFA = {
    start: string;
    states: string[];
    alphabet: string[];
    transitions: Map<string, Map<string, string>>;
    dead: string;
    accepting: Set<string>;
}