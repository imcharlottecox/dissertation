// export const GRAPH_DEFAULTS_FSM = {
//   graphHeight: 300,
//   nodeRadius: 15,
//   padding: 20,
//   markerBoxWidth: 10,
//   markerBoxHeight: 10
// };

// export const GRAPH_DEFAULTS_MARKOV = {
//   graphHeight: 600,
//   nodeRadius: 15,
//   padding: 20,
//   markerBoxWidth: 10,
//   markerBoxHeight: 10
// };
const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 768;

export function getGraphDefaultsFSM() {
  const mobile = isMobile();
  return {
    graphHeight: 300,
    nodeRadius: mobile ? 5 : 15,
    padding: mobile ? 1 : 100,
    markerBoxWidth: 10,
    markerBoxHeight: 10,
  };
}

export function getGraphDefaultsMarkov() {
  const mobile = isMobile();
  return {
    graphHeight: 600,
    nodeRadius: mobile ? 10 : 15,
    padding: mobile ? 12 : 20,
    markerBoxWidth: 10,
    markerBoxHeight: 10,
  };
}
