---
name: child-first-use-observation
description: Guard low-interference, local first-use and second-use/re-entry observation for young children in family learning games. Use when preparing, running, validating, packaging, or interpreting an authorized child acceptance gate, a changed-only revision, a parent observer surface, an observation schema, or a private local playtest return package.
---

# Child First-Use Observation

Preserve the child's genuine first encounter. Treat technical events, observed behavior, parent interpretation, and optional child choices as separate evidence layers. Never turn one session into a claim about learning, general usability, acceptance, or promotion.

## Required workflow

1. Read the initiative north star, accepted build identity, changed-only contract, parent authorization, privacy contract, and stop conditions.
2. Name one observable first-use question and freeze every accepted item outside that question.
3. Refuse the real child route unless the canonical authorization and exact build identity validate.
4. Prepare a familiar local device. Disable notifications and recording. Offer sound or mute without lowering eligibility.
5. Use the neutral opening: `这里有一段小冒险，你可以自己看看。想停随时可以停。`
6. Let built-in support appear before adult support. Keep any adult action to the intervention codes below.
7. Stop immediately on request, distress, sensory discomfort, privacy or identity mismatch, technical failure, or need for an adult answer.
8. Export only schema-valid, minimum local evidence. Run the PII and identity validators before packaging.
9. Summarize technical facts, human observations, parent notes, and non-conclusions in separate sections.

## Observation rules

- Let the child act without continuous Think Aloud, repeated why-questions, tests, or `你学会了吗`.
- Let the child decline the two optional closing questions.
- Observe behavior; do not score errors or label intelligence, ability, confusion, success, or failure.
- Let the parent provide technical help only. Never reveal the correct card, component, slot, or next answer.
- Use `POINT_TO_REGION_ONLY` only for the world, board, or hand region—not an item inside it.
- Mark `ADULT_ANSWER_REQUIRED` as a core usability risk; do not conceal it as technical assistance.
- Permit immediate stopping without completion. Use neutral recovery copy and preserve already found local progress.
- Allow at most one extra run in the formal package. Separate spontaneous replay from parent-prompted replay.

Use only these intervention codes: `NONE`, `REPEAT_VISIBLE_COPY`, `POINT_TO_REGION_ONLY`, `TECHNICAL_ASSIST`, `ADULT_ANSWER_REQUIRED`, `STOPPED`.

For a first-use package, use only these stop codes: `CHILD_REQUEST`, `DISTRESS`, `SENSORY_DISCOMFORT`, `TECHNICAL`, `PRIVACY`, `IDENTITY`, `ADULT_ANSWER_REQUIRED`, `OTHER`.

## Second-use / re-entry

- Keep first-use and second-use evidence separate. A first encounter asks whether the child can enter the accepted experience; a later re-entry asks whether the child recognizes the world, chooses a destination, and can complete a destination-to-world return loop.
- Run re-entry only in a natural, separate session and record a coarse interval bucket. Never join it to the first session or infer long-term retention from one revisit.
- Require the canonical local origin, the same browser profile, an identity-bound short-lived grant, and an existing canonical completed save. Fail closed on a wrong origin, missing or partial save, unavailable storage, or corruption; never reconstruct progress from earlier evidence.
- Give no correct destination. Use the neutral prompt `你想去哪里都可以。` and allow region-only pointing to `WORLD`, `WORLD_OBJECTS`, `FOREST_PLAYFIELD`, `BOARD`, or `HAND`, never to a particular world object, card, slot, or answer.
- Derive first action, first destination, route entry, and return-loop facts only from ordered technical events. Keep stated intent and parent observation separate from actual action.
- Use the second-use contract's declared stop set. It may distinguish `PROGRESS_CONTINUITY` and `NATURAL_END` from the first-use identity and interruption boundary, but must never turn a stop into child-visible failure.
- End the formal observation before any requested free play continues. Exclude later free play from the evidence and do not infer long-term engagement, learning effectiveness, retention, or broader content readiness.

## Evidence and privacy boundary

- Keep the system local and same-origin. Prefer `BroadcastChannel`; use a scoped `localStorage` storage-event fallback.
- Collect only allowlisted relative events. Do not collect names, ages, schools, birth dates, IP addresses, user agents, screen fingerprints, exact coordinates, raw keys, free child quotes, exact voice names, scores, media, or browser-storage dumps.
- Do not record audio, video, photographs, screen capture, or transcripts. Do not upload or make remote requests.
- Keep observer notes under 1000 characters and reject denylisted PII before export.
- Label fixtures `SYNTHETIC_TOOLING_TEST_ONLY`; never present them as a real child result.
- Let the game continue when the observer bridge disconnects. Telemetry must never own game rules.

## Optional tools

Offer picture cards, Again-Again choices, a region-only prompt, a same-origin observer bridge, or a local fixture dry-run only when useful. Show picture cards and Again-Again only after completion or stopping; make every choice skippable. Never add a reward, countdown, pressure, score, ranking, or automatic pass decision.

## Interpretation boundary

Report route loading, ordered events, errors, relative time, hints, invalid placements, chosen ability, camp/spellbook activity, completion, and replay as technical facts. Report observer enums and intervention codes as human observations. Preserve parent notes only after privacy validation. Explicitly withhold conclusions about learning effectiveness, generalized usability, child acceptance, promotion, comparative preference, and long-term retention.

For post-session reconciliation:

- Derive checkpoint reach only from technical events; keep parent-entered checkpoint notice as a separate field whose default is `UNRECORDED`.
- Keep replay intent, a parent-observed replay request, and an actual replay action separate. Only a technical `replay_selected` event may establish the actual action.
- Treat the raw exported observation as immutable. Migrate through a pure derived copy and never write repaired fields back into the original evidence.
- List evidence-consistency warnings explicitly whenever technical events and human fields differ; do not silently repair or collapse the layers.

Agent or Playwright activity can validate tooling only. It cannot replace a child, generate child acceptance, or authorize promotion.
