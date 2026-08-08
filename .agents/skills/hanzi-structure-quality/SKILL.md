---
name: hanzi-structure-quality
description: Validate simplified-Chinese character structure, component labels, pronunciation, meaning, vocabulary, imagery, and child-fit manifests. Use whenever Hanzi content, structure slots, combinations, spellbook entries, hints, illustrations, or playable character pools are created or changed.
---

# Hanzi Structure Quality

Treat character correctness and child suitability as independent gates. Machine checks can catch inconsistent fields; a qualified adult must still judge linguistic accuracy, familiarity, and age fit.

## Required distinctions

- Use the correct simplified form for the intended locale and font support.
- Do not collapse `部件` (a compositional component), `偏旁` (a positional component used in character analysis), and `部首` (a dictionary indexing category) into one concept. Label the actual role used by each record.
- Represent left-right, top-bottom, enclosure, semi-enclosure, stacked, and 品字-like layouts with correct spatial slots. Validate both component order and position.
- Do not treat an associative illustration as historical etymology. Mark mnemonics as mnemonics.
- Do not simplify phonosemantic relationships into false rules. State whether a component is semantic, phonetic, both, uncertain, or only a modern visual cue.

## Per-character content gate

Every playable record must bind one stable character ID to:

- simplified glyph and, only when useful, the traditional counterpart;
- structure type and ordered component slots;
- component role labels and render-safe glyphs;
- standard Mandarin pronunciation with tone marks or tone numbers;
- concise child-appropriate meaning;
- at least one familiar word whose pronunciation and meaning match the entry;
- an illustration brief consistent with the word or meaning;
- familiarity level, age-fit tier, and world-region tag;
- source/provenance fields and adult-review status.

Reject a record when the glyph, structure, pronunciation, word, meaning, and illustration do not describe the same intended character sense.

## Mother library versus playable manifest

- Keep the large candidate library separate from the child-facing playable manifest.
- Never sample rare characters directly into a low-age card pool merely because their components combine cleanly.
- Control the ratio of new to familiar characters; the golden slice uses at most 12 intentionally reviewed characters.
- A playable manifest must be deterministic, versioned, and reviewable. Randomness selects only within the approved manifest.
- Preserve source data; derive child-facing selections rather than rewriting the mother library to fit a scene.

## Verification workflow

1. Validate schema, IDs, component-slot cardinality, deterministic ordering, and cross-field references automatically.
2. Render every approved character and structure state in the target browser/font stack.
3. Review pronunciation, meaning, familiar word, and illustration alignment record by record.
4. Require teacher or parent acceptance for age fit and unfamiliar-word load; technical PASS does not imply that acceptance.
5. Send any disputed, rare, or uncertain record back to `CANDIDATE` rather than silently including it.
