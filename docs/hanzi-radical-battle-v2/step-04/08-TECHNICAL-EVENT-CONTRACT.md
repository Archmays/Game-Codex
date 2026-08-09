# Technical event contract

## Activation and transport

Activate the bridge only for `mode=child-first-use` with a valid session grant. Use `BroadcastChannel` first and a session-scoped `localStorage` storage event fallback. The channel is:

```text
hanzi-v2-step04:<sessionId>
```

The child keeps a session-local allowlisted log so a reconnecting observer can recover missing sequence numbers. Close channels/listeners at session end. An absent or broken observer never blocks game rules or completion.

## Event envelope

Every event has only:

```text
schemaVersion
sessionId
sequence
relativeMs
eventType
safeMetadata
```

`sequence` starts at one and strictly increases. The observer deduplicates by session and sequence, rejects conflicts/gaps as technical warnings, and never rewrites game state.

## Allowed event types

`session_opened`, `child_route_ready`, `first_action`, `phase_entered`, `invalid_placement`, `built_in_hint_shown`, `spell_formed`, `meaning_magic_completed`, `ability_selected`, `boss_intent_shown`, `boss_phase_completed`, `camp_repaired`, `spellbook_opened`, `run_completed`, `replay_selected`, `session_stopped`, `technical_error`.

`safeMetadata` is exact per event: session mute and zero-based replay index; coarse action kind; an accepted runtime phase; one of four accepted encounter IDs; hint level 1/2; one of four first-run character IDs after formation; one of three ability IDs; Boss phase `lin`/`xing`; replay origin; stop code; or an allowlisted local error code plus recoverability. Empty events carry `{}`. It never includes a component, card, slot, solver/next answer, score, exact input, free text, URL, device, voice, or personal data. Encounter/character IDs are post-action technical identifiers and are not rendered as parent guidance.

## Forbidden collection

Do not send name, age, school, birth date, IP, user agent, resolution fingerprint, coordinates, raw keys, voice, image, audio, video, transcript, free text, correct card/slot/answer, exact device voice, score, or remote-request information.

## Technical summary boundaries

FINISH may derive route loaded, sequence health, errors, completion, relative duration, invalid placement count, built-in hint count, selected ability, camp/spellbook activity, and replay flags. These facts do not establish comprehension, learning, engagement, acceptance, or promotion.
