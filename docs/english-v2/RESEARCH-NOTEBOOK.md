# Wordlight Island V2 research notebook

Research cut-off: 2026-08-22. This notebook records mechanisms and source boundaries, not copied product expression.

## Instruction evidence

- [IES Foundational Skills practice guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/21/Published), released 2016 and revised 2019: supports explicit sound-segment/letter links, decoding, encoding and connected text.
- [IES Teaching Academic Content and Literacy to English Learners](https://ies.ed.gov/ncee/wwc/Docs/PracticeGuide/english_learners_pg_040114.pdf), 2014: supports learning a small vocabulary set intensively through varied oral and written encounters.
- [EEF Phonics](https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/phonics), reviewed October 2025: phonics should be explicit and systematic but is only one part of literacy; vocabulary and comprehension remain explicit.
- [EEF Improving Literacy in Key Stage 1](https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/literacy-ks-1), second edition 2020: used as a broad literacy mechanism check.

## Product-mechanism references

- [Teach Your Monster to Read overview](https://www.teachyourmonster.org/teach-your-monster-to-read-overview/): only the abstract sequence of grapheme recognition, blending/segmenting, tricky-word support and short-sentence meaning was considered.
- [GraphoGame evidence overview](https://graphogame.com/evidence/): only abstract letter-sound and word-recognition practice mechanisms were considered.
- [Duolingo ABC](https://abc.duolingo.com/): only abstract bite-sized phonics, vocabulary and story sequencing was considered.

No assets, characters, maps, wording, reward systems, branded progression or layouts were copied. The prior `Raz aa-A` string had no verified source or contract in the repository and is quarantined rather than promoted into V2.

## Lexical sources

- CMU Pronouncing Dictionary at commit `74790861f652b15e4ac49015a90074ad62a27690`: ARPABET provenance only; source documentation warns errors may remain.
- Open English WordNet 2025 edition: fixed sense IDs under CC BY 4.0; child definitions are original short paraphrases.

## Resulting mechanism

The implemented loop is `meaning image → hand-audited grapheme build → whole-word sentence slot → visible world response`. Hints may reveal structure, remove one distractor, or fix part of a word, but always leave at least one grapheme action to the child. Five regions are freely selectable and story progress is never lost as punishment.
