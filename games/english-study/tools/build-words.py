"""Rebuild the local high-frequency lookup set from a pinned ECDICT CSV.

Download the source commit and verify its SHA-256 before this script runs.
The full upstream CSV is intentionally kept outside the shipped repository.
"""

import argparse
import csv
import hashlib
import json
import re
from pathlib import Path

SOURCE_COMMIT = "bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b"
SOURCE_SHA256 = "1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf"
MAX_RANK = 12000
ROOT = Path(__file__).resolve().parents[3]
GAME = ROOT / "games" / "english-study"


def clean_translation(raw: str) -> str:
    # The CSV serializes line breaks as literal backslash-n sequences.
    lines = [line.strip() for line in raw.replace("\\r", "\n").replace("\\n", "\n").replace("\r", "\n").split("\n")]
    # Keep general senses; specialist bracketed lines are not used in this compact view.
    general = [line for line in lines if line and not re.search(r"\[[^\]]+\]", line)]
    if not general:
        # Some frequent words (for example internet) are tagged only as a domain term.
        general = [re.sub(r"^\[[^\]]+\]\s*", "", line) for line in lines if line]
    return "\n".join(general[:5])[:480]


def build(source: Path) -> list[dict[str, object]]:
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != SOURCE_SHA256:
        raise SystemExit(f"ECDICT source hash differs: {digest}")

    accepted = json.loads((ROOT / "docs/english-v2/release/WORD-GRAPH.json").read_text(encoding="utf-8"))
    sentences = {sentence["id"]: sentence for sentence in accepted["sentences"]}
    curated = {word["lemma"]: word for word in accepted["words"]}

    rows: dict[str, dict[str, object]] = {}
    with source.open(encoding="utf-8-sig", newline="") as stream:
        for raw in csv.DictReader(stream):
            word = raw["word"].lower()
            if not re.fullmatch(r"[a-z]+", word) or not raw["frq"].isdigit():
                continue
            rank = int(raw["frq"])
            if not 0 < rank <= MAX_RANK:
                continue
            gloss = clean_translation(raw["translation"])
            if not gloss:
                continue
            if word in rows and rank >= int(rows[word]["rank"]):
                continue
            rows[word] = {
                "word": word,
                "zh": gloss,
                "definition": "",
                "partOfSpeech": "",
                "example": "",
                "exampleZh": "",
                "phonetic": raw["phonetic"].strip()[:80],
                "rank": rank,
                "source": "ecdict",
            }

    # Keep the accepted child sense for every existing V2 word while expanding lookup.
    for word, curated_row in curated.items():
        old = rows.get(word)
        example = next((sentences[sid] for sid in curated_row["sentenceIds"] if sid in sentences), None)
        rows[word] = {
            "word": word,
            "zh": curated_row["childGlossZh"],
            "definition": curated_row["childDefinitionEn"],
            "partOfSpeech": curated_row["partOfSpeech"],
            "example": example["text"] if example else "",
            "exampleZh": example["scaffoldZh"] if example else "",
            "phonetic": old["phonetic"] if old else "",
            "rank": old["rank"] if old else MAX_RANK + 1,
            "source": "curated",
        }

    result = sorted(rows.values(), key=lambda row: (int(row["rank"]), str(row["word"])))
    if len(result) < 10000 or sum(row["source"] == "curated" for row in result) != 48:
        raise SystemExit(f"Coverage gate failed: {len(result)} words")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source_csv", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    content = json.dumps(build(args.source_csv), ensure_ascii=False, separators=(",", ":")) + "\n"
    output = GAME / "words.json"
    if args.check:
        if output.read_text(encoding="utf-8") != content:
            raise SystemExit("words.json differs from the pinned source")
    else:
        output.write_text(content, encoding="utf-8")
    print(f"English Study: {len(json.loads(content))} entries; source {SOURCE_COMMIT}")
