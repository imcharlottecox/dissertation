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
  probability?: number;  
};

export type fTransition = {
  from: string;
  to: string;
  label?: string;  
};

//from fsmhierarchical viewer
export type Subgraph = {
  level: number;
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

export type EdgeRenderDatum = {
    key: string;
    label?: string;
    source: { x: number; y: number };
    target: { x: number; y: number };
    path: string;
    labelX: number;
    labelY: number;
    isLoop: boolean;
};


