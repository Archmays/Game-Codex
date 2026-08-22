# Wordlight Island V2 content rules

1. Every target word fixes exactly one child-facing sense and retains its Open English WordNet sense ID.
2. Every pronunciation is copied from the pinned CMUdict record; grapheme units are then aligned by hand. Runtime code must not infer G2P.
3. `simple-regular`, `common-pattern`, `irregular-supported`, and `optional-advanced` describe this project's support treatment, not a branded reading level.
4. An irregular mapping must expose at least one `irregular-heart` unit and a truthful hint. Silent letters carry an empty phoneme list.
5. Story words must have exactly one accepted, project-authored sentence in which the target occupies one unique token slot. Sentences contain 2–6 tokens before terminal punctuation.
6. Support words are declared separately and cannot also be target words in this release.
7. A concrete noun or action needs a formal reviewed asset. Color meanings use verified CSS fields; quantities use exact DOM object counts.
8. Optional words remain in the Word Journal and Memory/content graph only; they cannot block a story region.
9. Browser TTS may play only whole words or whole sentences. It is optional and is never evidence of phoneme-level pronunciation quality.
10. Machine validation is technical/content evidence only, never proof of child enjoyment, learning, retention, or human acceptance.
