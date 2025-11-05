from collections import defaultdict
import re
import pandas as pd
import json

df = pd.read_csv("algebraicExpressions.csv")

pattern_to_examples = defaultdict(list)

for expr in df["expression"]:
    tokens = re.findall(r'[A-Za-z0-9]+|[+\-*/=]', expr)
    symbolic = []
    for t in tokens:
        if re.fullmatch(r"[A-Za-z]", t):
            symbolic.append("VAR")
        elif re.fullmatch(r"[0-9]+", t):
            symbolic.append("NUM")
        elif t in "+-*/":
            symbolic.append("OP")
        elif t == "=":
            symbolic.append("EQ")
    pattern = " ".join(symbolic)
    pattern_to_examples[pattern].append(expr)

for pattern, examples in pattern_to_examples.items():
    print(f"{pattern}")  # show up to 3 examples per pattern

print(f"Total unique patterns: {len(pattern_to_examples)}")

with open("algebraicArrayDataset.ts", "w") as f:
    f.write("export const algebraicArrayDataset = ")
    json.dump(pattern_to_examples, f, indent=2)
    f.write(";")