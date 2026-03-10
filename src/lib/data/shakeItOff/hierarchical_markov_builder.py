import json
import re
from collections import defaultdict
from pathlib import Path
from typing import List, Dict
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "utilities"))
from parse_helpers import tokenise_by_line, normalise_probabilities, context_to_strID, best_start_node

BASE_DIR = Path(__file__).parent
INPUT_FILE = BASE_DIR / "shakeItOff_labelled.txt"
OUTPUT_FILE = BASE_DIR / "shakeItOff_hierarchical_markov.json"
SECTION_ID_RE = re.compile(r"^\[(\w+)\]$")
MIN_WORD_PROB = 0.00001

def parse_labelled_txt(path:str):
    section_seq: List[str] =[]
    section_lines: Dict[str, List[List[str]]] = defaultdict(list)
    current_section: str|None = None

    for raw_line in Path(path).read_text().splitlines():
        stripped = raw_line.strip()
        m = SECTION_ID_RE.match(stripped)
        if m:
            current_section = m.group(1)
            section_seq.append(current_section)
        elif current_section and stripped:
            tokens = tokenise_by_line(stripped)
            section_lines[current_section].extend(tokens)
    return section_seq, dict(section_lines)


def build_section_chain(section_seq: List[str]):
    counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for i in range(len(section_seq)-1):
        counts[section_seq[i]][section_seq[i+1]] += 1
    states = sorted(set(section_seq))
    transitions = []
    for src, dests in counts.items():
        for target, p in normalise_probabilities(dests).items():
            transitions.append({"from": src, "to": target, "probability": p})
    return states, transitions
    

def build_word_chain(lines):
    counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    first_words: Dict[str, int] = defaultdict(int)

    for tokens in lines:
        if not tokens:
            continue
        first_words[tokens[0]] +=1
        for i in range(len(tokens) -1):
            counts[tokens[i]][tokens[i+1]] += 1
    states: set[str] = set()
    transitions: List[dict] = []

    for src, dests in counts.items():
        for target, p in normalise_probabilities(dests).items():
            if p < MIN_WORD_PROB:
                continue
            states.add(src)
            states.add(target)
            transitions.append({"from": src, "to": target, "probability": p})
            
    starting = [max(first_words, key=first_words.get)] if first_words else []
    for s in starting:
        states.add(s)

    return {
        "markovStates": sorted(states),
        "mStartingStates": starting,
        "markovTransitions": transitions
    }

def main():
    section_seq, section_lines = parse_labelled_txt(INPUT_FILE)
    top_states, top_transitions = build_section_chain(section_seq)
    word_chains = {
        section: build_word_chain(lines)
        for section, lines in section_lines.items()
    }

    output = {
        "markovStates": top_states,
        "mStartingStates": [section_seq[0]] if section_seq else [],
        "endState": [],
        "markovTransitions": top_transitions,
        "wordChains": word_chains
        }
    
    Path(OUTPUT_FILE).write_text(json.dumps(output, indent=2))
    print("Done")

if __name__ == "__main__":
    main()
