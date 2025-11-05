import re
import pandas as pd
from bs4 import BeautifulSoup

with open("ASDiv.xml", "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "xml")

formulae = []
for formula in soup.find_all("Formula"):
    text = formula.get_text(strip=True)
    if re.match(r'^[A-Za-z0-9+\-*/= ]+$', text):
        
        #exclude formulae with brackets or more than one char - aka words, not variables
        if "(" not in text and ")" not in text and " " not in text and not re.search(r'[A-Za-z]{2,}', text):
            expr = re.sub(r'(\d)([a-zA-Z])', r'\1*\2', text)
            formulae.append(expr.strip())

print(f"extracted {len(formulae)} formulae")

df = pd.DataFrame(formulae, columns=["expression"])
df.to_csv("algebraicExpressions.csv", index=False)
