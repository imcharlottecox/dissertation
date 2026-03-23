import json
import re
from collections import defaultdict
from pathlib import Path
from typing import List, Dict
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "utilities"))
from parse_helpers import tokenise_by_line, normalise_probabilities, context_to_strID, best_start_node, build_word_chain

BASE_DIR = Path(__file__).parent
INPUT_FILE = BASE_DIR / "shakeItOff_labelled.txt"
OUTPUT_FILE = BASE_DIR / "shakeItOff_hierarchical_markov.json"
subgraph_ID_RE = re.compile(r"^\[(\w+)\]$")
MIN_WORD_PROB = 0.00001

def parse_labelled_txt(path:str):
    subgraph_seq: List[str] =[]
    subgraph_lines: Dict[str, List[List[str]]] = defaultdict(list)
    current_subgraph: str|None = None

    for raw_line in Path(path).read_text().splitlines():
        stripped = raw_line.strip()
        m = subgraph_ID_RE.match(stripped)
        if m:
            current_subgraph = m.group(1)
            subgraph_seq.append(current_subgraph)
        elif current_subgraph and stripped:
            tokens = tokenise_by_line(stripped)
            subgraph_lines[current_subgraph].extend(tokens)
    return subgraph_seq, dict(subgraph_lines)


def build_subgraph_chain(subgraph_seq: List[str]):
    counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for i in range(len(subgraph_seq)-1):
        counts[subgraph_seq[i]][subgraph_seq[i+1]] += 1
    states = sorted(set(subgraph_seq))
    transitions = []
    for src, dests in counts.items():
        for target, p in normalise_probabilities(dests).items():
            transitions.append({"from": src, "to": target, "probability": p})
    return states, transitions
    

def main():
    subgraph_seq, subgraph_lines = parse_labelled_txt(INPUT_FILE)
    top_states, top_transitions = build_subgraph_chain(subgraph_seq)
    word_chains = {
        subgraph: build_word_chain(
            [token for line in lines for token in line],
            min_prob = MIN_WORD_PROB,
            use_start_end = False,
        )
        for subgraph, lines in subgraph_lines.items()
    }

    output = {
        "markovStates": top_states,
        "mStartingStates": [subgraph_seq[0]] if subgraph_seq else [],
        "endState": [],
        "markovTransitions": top_transitions,
        "wordChains": word_chains,
        "subgraphLines":{
            subgraph: [" ".join(line) for line in lines]
            for subgraph, lines in subgraph_lines.items()
        }
        }
    
    Path(OUTPUT_FILE).write_text(json.dumps(output, indent=2))
    print("Done")

if __name__ == "__main__":
    main()
