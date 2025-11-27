import json
from collections import defaultdict

INPUT_FILE = "python_assignments.txt"
OUTPUT_FILE = "markov_transitions.json"

def normalise_probabilities(c):
    total = sum(c.values())
    return {k: v / total for k, v in c.items()}

def main():
    transition_counts = defaultdict(lambda: defaultdict(int))

    states = set()
    states.add("START")
    states.add("$")

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
            transition_counts[last]["$"] += 1

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
        "endState": ["$"],
        "markovTransitions": transitions
    }

    with open(OUTPUT_FILE, "w") as out:
        json.dump(data, out, indent=2)

    print("Done →", OUTPUT_FILE)

if __name__ == "__main__":
    main()
