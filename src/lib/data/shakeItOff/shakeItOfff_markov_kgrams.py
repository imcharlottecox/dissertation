import json 
import re
from collections import defaultdict
from pathlib import Path
from typing import List, Tuple, Dict
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "utilities"))
from parse_helpers import tokenise_song, normalise_probabilities, context_to_strID, best_start_node
K = 2

BASE_DIR = Path(__file__).parent
INPUT_FILE = BASE_DIR / "./shakeItOff.txt"
OUTPUT_FILE = BASE_DIR / f"shakeItOff_v2_{K}gram_markov.json"


CLEAN_REGEX = re.compile(r"[^a-z0-9\s'\-]+")

# def tokenise_song(text: str) -> List[str]:
#     tokens: List[str] = []
#     for line in text.splitlines():
#         line = line.strip().lower()
#         if not line:
#             continue
#         line = CLEAN_REGEX.sub("", line)
#         parts = re.split(r"\s+", line)
#         parts = [p for p in parts if p]
#         tokens.extend(parts)
#     return tokens


# def normalise_probabilities(counts):
#     total = sum(counts.values())
#     if total == 0: 
#         return {}
#     return {k: v / total for k, v in counts.items()}

# def context_to_strID(context: Tuple[str, ...]) -> str:
#     # return json.dumps(list(context))

#     return " ".join(context)

def main():
    text = Path(INPUT_FILE).read_text()
    corpus = tokenise_song(text)
    if len(corpus) < K:
        return 
    context_size = K-1
    # counts[context][nextword] = frequency
    counts: Dict[Tuple[str, ...], Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for i in range(len(corpus) - context_size):
        context = tuple(corpus[i:i+context_size])
        next_word = corpus[i+context_size]
        counts[context][next_word] += 1

    states = set()
    transitions = []

    # in_degree = defaultdict(int)
    # out_degree = defaultdict(int)
    # best_Node = None
    # best_score = -1

    for context, next_counts in counts.items():
        src = context_to_strID(context)
        states.add(src)
        probabilities = normalise_probabilities(next_counts)

        for next_word, p in probabilities.items():
            next_context = (*context[1:], next_word)
            dest = context_to_strID(next_context)
            states.add(dest)
            transitions.append({
                "from": src,
                "to": dest,
                "probability": round(p, 2)
            })
            # out_degree[src] += 1
            # in_degree[dest] += 1
            # for s in states:
            #     score = in_degree[s] + out_degree[s]
            #     if score > best_score or (score == best_score and out_degree[s] > out_degree[best_Node]):
            #         best_score = score
            #         best_Node = s
        


    top_anchor_node = best_start_node(transitions)
    data = {
        "markovStates": sorted(states),
        "mStartingStates": [top_anchor_node],
        "endState": [],
        "markovTransitions": transitions
    }

    Path(OUTPUT_FILE).write_text(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()