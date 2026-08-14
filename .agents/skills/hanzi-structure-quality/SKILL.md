---
name: hanzi-structure-quality
description: Validate simplified-Chinese character structure, component labels, pronunciation, meaning, vocabulary, imagery, and child-fit manifests whenever Hanzi content or playable pools change.
---

# Hanzi Structure Quality

Treat linguistic correctness, structural legality, and content selection as separate contracts. Prefer source-backed records and executable cross-field checks; request human judgment only for genuinely ambiguous language or value choices.

## Required distinctions

- Use the correct simplified form for the intended locale and verify target-font rendering.
- Do not collapse `部件`、`偏旁` and `部首`; label the actual role represented by each record.
- Model left-right, top-bottom, enclosure, semi-enclosure, stacked, and 品字-like layouts with correct ordered spatial slots.
- Mark associative pictures as mnemonics, not historical etymology. Do not turn phonosemantic tendencies into false rules.

## Per-character contract

Every playable record binds one stable ID to the simplified glyph, structure and ordered components, role labels, pronunciation, concise meaning, familiar word, illustration brief, familiarity/age-fit metadata, world tag, and source fields. Reject any record whose glyph, structure, pronunciation, word, meaning, or illustration refers to a different character sense.

## Library and manifest

- Keep broad candidate data separate from the deterministic, versioned playable manifest.
- Do not select rare characters merely because their components combine cleanly; control familiar/new load as a content decision.
- No fixed character-count or real-child-playtest gate applies. Expansion is allowed when the requested scope is authorized and all current content, structure, ambiguity, render, and regression gates pass.
- Preserve source data; derive child-facing selections rather than rewriting sources to fit a scene.

## Verification

1. Validate schema, IDs, component-slot cardinality, ordering, uniqueness/ambiguity, and cross-field references.
2. Render every changed glyph and structure state in the target browser/font stack.
3. Check pronunciation, familiar word, meaning, image alignment, and source fields record by record.
4. Route disputed or uncertain records back to candidate status; do not silently publish them.
