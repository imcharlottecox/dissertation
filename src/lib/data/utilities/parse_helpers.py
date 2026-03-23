from typing import List, Tuple, Dict
import re
from collections import defaultdict

CLEAN_REGEX = re.compile(r"[^a-z0-9\s'-]")

def tokenise_song(text: str) -> List[str]:
    tokens: List[str] = []
    for line in text.splitlines():
        line = line.strip().lower()
        if not line:
            continue
        line = CLEAN_REGEX.sub("", line)
        parts = re.split(r"\s+", line)
        parts = [p for p in parts if p]
        tokens.extend(parts)
    return tokens

def tokenise_by_line(text: str) -> List[str]:
    lines: List[List[str]] = []
    for line in text.splitlines():
        line = line.strip().lower()
        if not line:
            continue
        line = CLEAN_REGEX.sub("", line)
        parts = re.split(r"\s+", line)
        parts = [p for p in parts if p]
        if (parts):
            lines.append(parts)
    return lines


def normalise_probabilities(counts):
    total = sum(counts.values())
    if total == 0: 
        return {}
    return {k: v / total for k, v in counts.items()}

def context_to_strID(line: Tuple[str, ...]) -> str:
    return " ".join(line)

def best_start_node(transitions: List[dict]) -> str|None:
    in_degree: Dict[str, int] = defaultdict(int)
    out_degree: Dict[str, int] = defaultdict(int)

    for t in transitions:
        out_degree[t["from"]] +=1
        in_degree[t["to"]] +=1

    all_nodes = set(in_degree) | set(out_degree)
    if not all_nodes:
        return None
    
    return max(all_nodes, key=lambda s: (in_degree[s]+out_degree[s], out_degree[s]))


def build_word_chain(tokens: list[str], min_prob = 0.00005, round_dp =4, use_start_end = False):
    counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    # first_words: Dict[str, int] = defaultdict(int)

    if not tokens:
        return {
        "markovStates": [],
        "mStartingStates": ["START"],
        "endState": ["END"],
        "markovTransitions": []
    }
    if use_start_end:
        counts["START"][tokens[0]] += 1
        for a,b in zip(tokens, tokens[1:]):
            counts[a][b] +=1

        counts[tokens[-1]]["END"] += 1
        starting = ["START"]
        end_state = ["END"]
        extra_states = {"START", "END"}
    else: 
        for a, b in zip(tokens, tokens[1:]):
            counts[a][b] += 1
        starting = [tokens[0]]
        end_state =[]
        extra_states = {tokens[0]}

    states = set(extra_states)
    transitions: List[dict] = []

    for src, dests in counts.items():
        for target, p in normalise_probabilities(dests).items():
            if p < min_prob:
                continue
            states.add(src)
            states.add(target)
            transitions.append({"from": src, "to": target, "probability": round(p, round_dp)})

    return {
        "markovStates": sorted(states),
        "mStartingStates": starting,
        "endState": end_state, 
        "markovTransitions": transitions
    }
