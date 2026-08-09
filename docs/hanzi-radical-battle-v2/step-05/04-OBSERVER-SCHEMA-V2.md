# STEP 05 Observer Schema v2

Schema v2 corrects meaning without rewriting the immutable v1 observation.

## Checkpoints

`checkpointReach` is derived from technical events and is read-only:

- `REACHED`
- `NOT_REACHED`
- `STOPPED_BEFORE`

`checkpointNotice` is a human field and defaults to `UNRECORDED`:

- `UNRECORDED`
- `NOTICED_WITHOUT_PROMPT`
- `NOTICED_AFTER_BUILT_IN_SUPPORT`
- `NOTICED_AFTER_REGION_ONLY_PROMPT`
- `ADULT_ANSWER_REQUIRED`
- `STOPPED`

Reach never claims noticing or understanding. Notice never overrides whether a route event occurred.

## Replay

- `replayIntent`: the human-recorded choice such as `AGAIN_NOW`.
- `parentObservedReplayRequest`: the parent's direct observation.
- `actualReplayAction`: derived only from a `replay_selected` technical event and read-only.

## v1 migration

Migration is pure and non-destructive. It preserves human fields that still have equivalent meaning, derives reach/action from technical events, maps ambiguous legacy checkpoint values to `UNRECORDED` notice, and emits explicit consistency warnings. A legacy replay boolean cannot create an actual replay when no technical event exists.

Every migrated export keeps evidence kind/build identity and records its source schema. Summary output includes an `Evidence consistency warnings` section rather than silently repairing contradictions.

The checked-in migration fixture is de-identified and labelled `SYNTHETIC_FROM_SCHEMA_ONLY`; tests do not copy real observation content into Git. The canonical machine-readable contract is `04-FIRST-USE-OBSERVATION-SCHEMA-V2.json`.
