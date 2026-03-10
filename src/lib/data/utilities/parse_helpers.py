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