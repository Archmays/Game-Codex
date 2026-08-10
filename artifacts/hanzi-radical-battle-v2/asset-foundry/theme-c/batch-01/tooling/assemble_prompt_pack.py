from __future__ import annotations

import re
from pathlib import Path


BATCH = Path(__file__).resolve().parents[1]
FRAGMENTS = BATCH / "prompt-fragments"

HEADER = """# Theme C Asset Foundry — Batch 01 Prompt Pack

Status: candidate generation only; machine review required; no runtime integration authorized.

Truth source: accepted Theme C (`themeC`, `mage`, `companion`, `commonMonster`, `boss`, `camp`, `abilityCards`, `meaningMagic`) and the first-run meaning-magic set only (`明`, `花`, `林`, `星`). The generated art itself must contain no text or Hanzi; the game would overlay learning content separately if a later integration phase is authorized.

Shared art direction: original child-safe 夜光墨林; deep blue-green forest; soft cyan, lilac, coral, and warm-gold fluorescence; sparse stars; clear silhouettes; high-contrast reserved learning area where relevant; cute and non-threatening; no adult-dashboard styling; no text, Hanzi, gibberish, logo, watermark, or third-party imitation.

"""


def main() -> None:
    parts = [HEADER.rstrip()]
    for name in ("A01-A05.md", "A06-A10.md", "A11-A16.md"):
        path = FRAGMENTS / name
        parts.append(path.read_text(encoding="utf-8").strip())
    content = "\n\n".join(parts) + "\n"
    marker_count = content.count("【ChatGPT image】")
    if marker_count != 32:
        raise SystemExit(f"Expected 32 prompt markers, found {marker_count}")
    blocks = re.findall(r"```(?:text|markdown)?\s*\n(.*?)\n```", content, flags=re.DOTALL)
    prompt_blocks = [block for block in blocks if "【ChatGPT image】" in block]
    if len(prompt_blocks) != 32:
        raise SystemExit(f"Expected 32 fenced prompt blocks, found {len(prompt_blocks)}")
    bad = [index + 1 for index, block in enumerate(prompt_blocks) if block.splitlines()[0].strip() != "【ChatGPT image】"]
    if bad:
        raise SystemExit(f"Prompt block first-line violations: {bad}")
    output = BATCH / "prompt-pack.md"
    output.write_text(content, encoding="utf-8")
    print(f"{output} prompts={marker_count}")


if __name__ == "__main__":
    main()
