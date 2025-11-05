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