import csv
import json
import sys
from pathlib import Path
import re

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
UTLITIES_DIR = DATA_DIR/"utilities"
INTERACTIVE_DIR = DATA_DIR/"interactive"
sys.path.insert(0, str(UTLITIES_DIR))

from parse_helpers import tokenise_song, build_word_chain

INPUT_CSV = INTERACTIVE_DIR/ "TED_Talk.csv"
OUTPUT_FILE = INTERACTIVE_DIR/"TED_Talk.json"

MAX_DURATION = 600
MAX_TALKS = 50
MIN_TOKENS = 10
MIN_PROB = 0.01
TRANSCRIPT_COL = "transcript"
TITLE_COL = "talk__name"
DURATION_COL = "duration"

def get_transcript(row: dict) -> str:
    txt = row.get(TRANSCRIPT_COL, "").strip()
    if txt: 
        return txt
    return ""

def main():
    if not INPUT_CSV.exists(): 
        print("INPUT CSV not found")
    talks = []
    skipped_duration = 0
    skipped_transcript = 0

    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                duration = int(row.get(DURATION_COL, 0))
            except ValueError: 
                continue
            if duration>MAX_DURATION:
                skipped_duration += 1
                continue
            talk__name = row.get(TITLE_COL, "").strip()
            transcript = get_transcript(row)

            if not transcript or not talk__name:
                skipped_transcript += 1
                continue
            # strip (laughter)
            transcript_clean = re.sub(r"\([^)]*\)", " ", transcript)
            tokens = tokenise_song(transcript_clean)
            if len(tokens)< MIN_TOKENS:
                skipped_transcript +=1
                continue

            chain = build_word_chain(tokens, min_prob=MIN_PROB, round_dp=4, use_start_end=False)
            talks.append({
                "talk__name": talk__name,
                "duration": duration,
                "tokens": tokens,
                **chain, #mStates, startingstates, endstate, transitions
            })

            if len(talks) >= MAX_TALKS:
                break
    talks.sort(key=lambda t: t["duration"])
    Path(OUTPUT_FILE).write_text(json.dumps(talks, indent=4), encoding="utf-8")
if __name__ == "__main__":
    main()