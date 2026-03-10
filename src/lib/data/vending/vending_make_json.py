import json
from collections import defaultdict, Counter

INPUT_FILE = "vending_markov_40p.txt"
OUTPUT_FILE = "vending_markov.json"

END_STATE = "PRESSED_PAY"
MARKOV_STATES = ["10p", "20p", "5p", "50p", END_STATE]

def normalise_probabilities(counts):
    total = sum(counts.values())
    return {k: v / total for k, v in counts.items()}

def main():
    start_counts = Counter()
    transition_counts = defaultdict(lambda: defaultdict(int))

    with open(INPUT_FILE) as f:
        for line in f:
            tokens = line.strip().split()
            if not tokens:
                continue

    # transition_counts["START"][tokens[0]] += 1
            start_counts[tokens[0]] += 1

            for a, b in zip(tokens, tokens[1:]):
                transition_counts[a][b] += 1

            # transition_counts[tokens[-1]]["PRESSED PAY"] += 1
    start_distribution = normalise_probabilities(start_counts)
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
        "markovStates": MARKOV_STATES,
        "mStartingStates": [],
        "startDistribution": {
            k: round(v, 3) for k, v in start_distribution.items()
        },
        "endState": [END_STATE],
        "markovTransitions": transitions
    }
    with open(OUTPUT_FILE, "w") as out:
        json.dump(data, out, indent=2)

    print("Done", OUTPUT_FILE)

if __name__ == "__main__":
    main()
