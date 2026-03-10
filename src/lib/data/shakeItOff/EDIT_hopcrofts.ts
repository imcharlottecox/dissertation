export type DFA = {
  start: string;
  states: string[];
  alphabet: string[];
  accepting: Set<string>;
  transitions: Map<string, Map<string, string>>; 
  dead: string;
};

type Partition = Set<string>[];
type BlockIdMap = Map<string, number>;

export function hopcroftMinimiseDFA(dfa: DFA): DFA {
  ensureTotal(dfa);

  const Q = new Set(dfa.states);
  const F = new Set(dfa.accepting);
  const NF = new Set([...Q].filter((s) => !F.has(s)));

  let P: Partition = [];
  if (F.size > 0) P.push(F);
  if (NF.size > 0) P.push(NF);

  const W: Set<string>[] = [];
  if (F.size > 0 && NF.size > 0) {
    W.push(F.size <= NF.size ? F : NF);
  } else if (F.size > 0) {
    W.push(F);
  } else {
    W.push(NF);
  }

  const rev = buildReverseIndex(dfa);

  while (W.length > 0) {
    const A = W.pop()!; // a block
    for (const c of dfa.alphabet) {
      const X = preimage(rev, c, A);

      if (X.size === 0) continue;

      const newP: Partition = [];
      for (const Y of P) {
        const inter = intersection(Y, X);
        if (inter.size === 0 || inter.size === Y.size) {
          newP.push(Y);
          continue;
        }
        const diff = difference(Y, X);

        // Replace Y by inter and diff
        newP.push(inter);
        newP.push(diff);

        // Update worklist: if Y was in W, replace it; else add smaller part
        const yIndexInW = indexOfSetInArray(W, Y);
        if (yIndexInW !== -1) {
          // replace Y with both parts
          W.splice(yIndexInW, 1, inter, diff);
        } else {
          W.push(inter.size <= diff.size ? inter : diff);
        }
      }
      P = newP;
    }
  }

  // Build mapping from old state -> block id
  const blockOf = new Map<string, number>();
  P.forEach((block, i) => {
    for (const s of block) blockOf.set(s, i);
  });

  // Name each block deterministically (use smallest state id inside block)
  const blockNames = P.map((block) => canonicalName(block));

  // Construct new DFA
  const newStates = blockNames.slice();
  const newStart = blockNames[blockOf.get(dfa.start)!];

  const newAccepting = new Set<string>();
  for (let i = 0; i < P.length; i++) {

    for (const s of P[i]) {
      if (dfa.accepting.has(s)) {
        newAccepting.add(blockNames[i]);
        break;
      }
    }
  }

  const newDead = blockNames[blockOf.get(dfa.dead)!];

  const newTransitions = new Map<string, Map<string, string>>();
  for (let i = 0; i < P.length; i++) {
    const rep = P[i].values().next().value as string; // representative state
    const fromName = blockNames[i];
    const row = new Map<string, string>();

    for (const a of dfa.alphabet) {
      const toOld = dfa.transitions.get(rep)!.get(a)!;
      const toBlock = blockOf.get(toOld)!;
      row.set(a, blockNames[toBlock]);
    }
    newTransitions.set(fromName, row);
  }

  return {
    start: newStart,
    states: newStates,
    alphabet: dfa.alphabet.slice(),
    accepting: newAccepting,
    transitions: newTransitions,
    dead: newDead,
  };
}

/** Optional: return mapping old->new for debugging / animation */
export function hopcroftMinimiseDFAWithMapping(dfa: DFA): { min: DFA; mapOldToNew: Map<string, string> } {
  const min = hopcroftMinimiseDFA(dfa);

  // Rebuild mapping by re-running partitioning quickly is annoying; easiest is:
  // compute by simulating canonical naming is not directly accessible here.
  // If you want mapping, we can extend hopcroftMinimiseDFA to return it.
  // For now provide a placeholder error to avoid silent misuse.
  throw new Error("Use hopcroftMinimiseDFA() for now; ask and I’ll return a mapping-enabled variant cleanly.");
}

/* ---------------- helpers ---------------- */

function ensureTotal(dfa: DFA) {
  for (const s of dfa.states) {
    const row = dfa.transitions.get(s);
    if (!row) throw new Error(`DFA missing transition row for state ${s}`);
    for (const a of dfa.alphabet) {
      if (!row.has(a)) throw new Error(`DFA is not total: missing δ(${s}, ${a})`);
    }
  }
}

function buildReverseIndex(dfa: DFA): Map<string, Map<string, Set<string>>> {
  // rev.get(symbol).get(toState) = set(fromStates)
  const rev = new Map<string, Map<string, Set<string>>>();
  for (const a of dfa.alphabet) rev.set(a, new Map());

  for (const from of dfa.states) {
    const row = dfa.transitions.get(from)!;
    for (const a of dfa.alphabet) {
      const to = row.get(a)!;
      const byTo = rev.get(a)!;
      let preds = byTo.get(to);
      if (!preds) {
        preds = new Set<string>();
        byTo.set(to, preds);
      }
      preds.add(from);
    }
  }
  return rev;
}

function preimage(rev: Map<string, Map<string, Set<string>>>, symbol: string, A: Set<string>): Set<string> {
  const out = new Set<string>();
  const byTo = rev.get(symbol);
  if (!byTo) return out;

  for (const t of A) {
    const preds = byTo.get(t);
    if (!preds) continue;
    for (const p of preds) out.add(p);
  }
  return out;
}

function intersection(A: Set<string>, B: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const x of A) if (B.has(x)) out.add(x);
  return out;
}

function difference(A: Set<string>, B: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const x of A) if (!B.has(x)) out.add(x);
  return out;
}

function indexOfSetInArray(arr: Set<string>[], target: Set<string>): number {
  // Compare by reference (we reuse same Set objects in P)
  for (let i = 0; i < arr.length; i++) if (arr[i] === target) return i;
  return -1;
}

function canonicalName(block: Set<string>): string {
  // deterministic: pick lexicographically smallest state id
  let best: string | null = null;
  for (const s of block) {
    if (best === null || s.localeCompare(best) < 0) best = s;
  }
  return best ?? "S_min";
}
