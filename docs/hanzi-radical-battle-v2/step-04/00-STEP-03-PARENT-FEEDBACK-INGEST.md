# STEP 03 parent feedback ingest

## Canonical input

- File: `artifacts/hanzi-radical-battle-v2/step-03/review/STEP-03_PARENT_REVIEW_FEEDBACK.json`
- SHA-256: `3F0BFAC4C6D318AC197AFA95764ACFB3A9E7FE9CE47BF6FA18C1514879EA417C`
- Accepted review identity SHA-256: `DBA281F9954DFB591E2F3D7498B1B8F09F6C050BFBFA2436C9961B0513D73D3E`
- Initiative: `hanzi-radical-battle-v2`
- Parent authorization: `authorizeChildFirstUse = YES`

The fixed SHA and embedded identity are both required. A same-named file, a later regenerated review, or an authorization copied out of context is not sufficient.

## Decisions carried forward

`goldenSliceDecision`, `manifestDecision`, the three ability decisions, `bossDecision`, and all eight asset decisions are `ACCEPT`. Their accepted runtime identity remains frozen. The only changed item is `audioDecision = REVISE`; the canonical item note says the pinyin should remain visible but should not be read.

The authorized correction is therefore:

```text
汉字可以由 TTS 朗读；
汉语拼音继续显示；
TTS 不朗读汉语拼音；
朗读“汉字 + 熟悉词”，例如“明，明亮的明。”
```

Authorization permits one guarded, local child first-use session after technical readiness. It does not mean the revised audio is accepted, a child session has occurred, the child accepted the game, or promotion is authorized.

## Fail-closed handling

START must stop before opening a browser on any missing file, SHA mismatch, review-identity mismatch, malformed/incomplete decision set, authorization other than exact `YES`, or frozen-source drift. It must report the failure without rewriting feedback or regenerating acceptance.

## Recorded baseline

The instructed implementation baseline is commit `f6d47676a5434d74afdb865bb2f6c783522c0d90`. A later HEAD is permitted only when the canonical feedback and frozen identities still match; no reset or overwrite is allowed.
