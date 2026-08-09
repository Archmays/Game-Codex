# STEP 05 First-Use Evidence Reconciliation

This document is a privacy-safe synthesis calculated from the immutable observation event stream. The local derived JSON is generated at `artifacts/hanzi-radical-battle-v2/step-05/derived/STEP-05-FIRST-USE-EVIDENCE-DERIVED.json`; it is not committed.

## Technical timeline

| Event | Elapsed ms |
| --- | ---: |
| Route ready | 18 |
| First pointer action | 2122 |
| First spell: 明 | 14388 |
| Built-in support before 花 | 23543 |
| Spell: 花 | 27351 |
| Ability chosen: star-path | 32598 |
| Boss 林 intent | 34003 |
| Built-in support for 林 | 39367 |
| Spell: 林 | 44934 |
| Boss 林 phase complete | 46186 |
| Boss 星 intent | 47385 |
| Built-in support for 星 | 51392 |
| Spell: 星 | 55507 |
| Boss 星 phase complete | 56762 |
| Camp repaired | 58974 |
| Spellbook opened | 60101 |
| Run completed | 63241 |

The canonical sequence contains 56 events, numbered 1–56 with no gap, duplicate, or technical-error event. Invalid placement count is zero. The three support events are the only built-in hints.

## Reach reconciliation

Reach is technical and read-only. It is derived from event presence, never copied from the legacy editable checkpoint values.

| Checkpoint | Derived reach | Basis |
| --- | --- | --- |
| firstScreen | `REACHED` | route/game ready event |
| firstSpell | `REACHED` | 明 spell event |
| secondStructure | `REACHED` | 花 encounter/spell event |
| abilityChoice | `REACHED` | star-path selection event |
| bossIntent | `REACHED` | boss intent events |
| safeFailure | `NOT_REACHED` | no safe-failure event |
| campRepair | `REACHED` | camp repair event |
| spellbook | `REACHED` | spellbook-open event |

Legacy human checkpoint values that said `NOT_REACHED` are not silently treated as “the child did not notice.” In schema v2, notice starts as `UNRECORDED` unless a human value actually exists.

## Replay reconciliation

| Field | Value | Authority |
| --- | --- | --- |
| `replayIntent` | `AGAIN_NOW` | human observation |
| `parentObservedReplayRequest` | `OBSERVED` | explicit human observation |
| `actualReplayAction` | `false` | no `replay_selected` event |
| `runCount` | `1` | technical event stream |

Evidence consistency warning: **Human replay intent/request recorded, but no `replay_selected` event.** Therefore the result is not described as “the child replayed.”

## Provisional decision

`PROMOTE_TO_PRIVATE_WORLD_ENTRY_AFTER_CHANGED_ONLY_FIX`

The evidence supports making the already bounded Hanzi magic run the first candidate entrance in a private child world after the reported voice-context defect is fixed. It does not establish learning effectiveness, retention, generalized usability, remaining-eight readiness, full Ink Forest readiness, or production-art readiness.
