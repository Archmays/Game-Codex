# STEP 04 Observer Evidence

Routes:

- Parent: `?observe=hanzi-v2-step04&session=...`
- Child: `?play=hanzi-v2-golden-slice&mode=child-first-use&session=...&seed=...`
- Synthetic child only: the same guarded route plus exact `fixture=1` and a matching persisted fixture grant.

The parent route requires exact session, seed, build SHA, launch nonce, commit, generated, checked and started identities. Preflight requires all four phrase requests, one of `SOUND_OK` / `START_MUTED` / `CANCEL`, observer mode, and READY before opening a child window.

The child route keeps the accepted game and necessary child settings only. It excludes seed/debug/review/observer/export/reset chrome. Fixture and real routes are non-interchangeable; the fixture child has an unavoidable synthetic/no-child-data banner.

The bridge uses `BroadcastChannel` with localStorage/storage-event fallback, strict increasing sequence, dedupe/reconnect, a closed minimal event allowlist, and no remote transport. Observer loss or storage failure cannot change game rules.

The observer shows phase/time/minimal signal/hint/mute only—never the correct card, component, slot, solver, next answer or score. Adult region-only intervention is limited to `WORLD`, `BOARD`, or `HAND`. Immediate stop pauses input/timers/audio and displays neutral rest copy. Optional Again-Again, accepted-art moment cards and two ending questions remain skippable and unscored.

The strict schema, privacy denylist and FINISH reject PII, profile/device identity, exact voice, coordinates/raw keys, free child quotes, scores, media, storage dumps, remote URLs, identity mismatch and fixture/real mismatch. Summary sections separate technical facts, human observations, parent notes and explicit non-conclusions.

Evidence: ten post-commit WebP technical screenshots plus `SCREENSHOT-INDEX.md`; capture report has zero console/page errors and zero remote requests. E2E 5/5 includes actual synthetic child/observer sync and export. No real child observation was performed.
