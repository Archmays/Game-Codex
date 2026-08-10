# STEP 04 Diff Summary

Implementation commit `fe8d73f6451554cb782b4ea148027b2f922946df` contains 57 scoped files: 7,572 insertions and 59 deletions. Packaging compatibility commit `a934887d97ae7ef33c403ee80a10aca7b095624c` changes only `PACKAGE_STEP_04_READINESS.ps1` (13 insertions, 2 deletions) so the readiness packager runs under Windows PowerShell 5.1.

- Audio changed-only revision: manifest display/speech separation, exact local TTS phrases, `zh-CN`, automatic formed-character speech, replay speech, mute/silent fallback, and stop-all audio cancellation.
- Guarded runtime: child-first-use session grant, exact fixture/real marker matching, clean child chrome, at most one additional formal replay, immediate neutral stop.
- Observer: parent audio preflight, READY/mode gate, same-origin minimal event bridge, neutral answer-free dashboard, observation schema, optional cards, compact fallback, export and privacy validation.
- Tooling: project Skill, START/FINISH, strict TypeScript contract validator, automated WebP capture, readiness packager, docs and tests.
- Evidence/status: parent feedback ingest, freeze contract, decision log, traceability matrix, and `AUTHORIZED_CHILD_FIRST_USE_READY` status.

Frozen gameplay/content changes: none. The manifest identity remains `fnv1a:67ad1fe2`; the new `visualPinyin` and `spokenPhrase` fields are the authorized audio-data separation only.

Other games changed: none. `apps/hub/` and `packages/data/gameCatalog.ts` were not changed; the default hub remains ten entries and has no Hanzi V2 STEP 04 promotion.

Pre-existing untracked STEP 01–03 artifacts and `.playwright-cli` were preserved and excluded from the commit.
