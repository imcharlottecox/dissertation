# used for python and cartons
import json
from collections import defaultdict
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "utilities"))
from parse_helpers import normalise_probabilities

BASE_DIR = Path(__file__).parent.parent / "ca_letters"
# INPUT_FILE = "real_dataset/real_python_assignments.txt"
INPUT_FILE = BASE_DIR / "ca_words.txt"
OUTPUT_FILE = BASE_DIR / "ca_letters_markov.json"


def main():
    transition_counts = defaultdict(lambda: defaultdict(int))

    states = set()
    states.add("START")
    states.add("END")

    with open(INPUT_FILE) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            chars = list(line)

            first = chars[0]
            transition_counts["START"][first] += 1
            states.add(first)

            for a, b in zip(chars, chars[1:]):
                transition_counts[a][b] += 1
                states.add(a)
                states.add(b)

            last = chars[-1]
            transition_counts[last]["END"] += 1

    transitions = []
    for src, dests in transition_counts.items():
        norm = normalise_probabilities(dests)
        for dst, prob in norm.items():
            transitions.append({
                "from": src,
                "to": dst,
                "probability": round(prob, 3)
            })

    data = {
        "markovStates": sorted(states),
        "mStartingStates": ["START"],
        "endState": ["END"],
        "markovTransitions": transitions
    }

    with open(OUTPUT_FILE, "w") as out:
        json.dump(data, out, indent=2)

    print("Done", OUTPUT_FILE)

if __name__ == "__main__":
    main()
