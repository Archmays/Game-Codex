# STEP 07 machine QA rubric and playthroughs

## Hard gates

All 15 declared hard gates must pass with cited evidence: compile, targeted tests, full tests, build, route precedence, state invariants, save/corrupt recovery, console/page errors, external network, privacy/PII, adult scroll/reflow, keyboard/focus/targets, accessibility structure, deterministic visual states, and child copy/forbidden mechanics.

Additional PASS conditions are: complete scroll matrix, complete catalog smoke, all six playthrough profiles, zero Sev-1/2 semantic findings, no unresolved critical reviewer conflict, zero external requests, privacy PASS, final full tests PASS, and final build PASS.

## Semantic review

The three separate rubrics are:

- `R1_CHILD_FIRST_UX`: first clear action, child-readable feedback, recovery, non-shaming copy, persistence recognition, and no adult-tool leakage into child surfaces;
- `R2_VISUAL_ACCESSIBILITY`: hierarchy, contrast, reflow, 44px child targets, focus visibility, accessible names/order, reduced motion, and screenshot/ARIA agreement;
- `R3_ADVERSARIAL_QA`: route conflicts, invalid/corrupt state, observer disconnect, mute, keyboard, touch, return loops, privacy, and external-network attempts.

Every review document records `reviewEngine`, `model`, `reviewMode`, and `evidenceFiles`. Allowed modes are only `INDEPENDENT_MODEL`, `INDEPENDENT_SUBAGENT`, or `RUBRIC_SEPARATED_SAME_MODEL`. A reviewer reads the shared raw evidence packet but not another reviewer’s findings; merge happens afterward. Findings must cite route/state plus real screenshot, ARIA, trace, or event evidence. “Looks good” is not evidence.

## Deterministic playthrough profiles

- `NOVICE_POINTER`: choose the first clear action and complete world → forest → world without debug controls.
- `HESITANT_WITH_HINTS`: wait for an idle hint, make one invalid placement, use the supported recovery, then complete.
- `KEYBOARD_ONLY`: use Tab, Enter/Space, Escape, visible focus, and a completable route.
- `MOBILE_TOUCH`: use 390×844, tap, drag, real touch scrolling, and no hover-only dependency.
- `MUTED_REDUCED_MOTION`: start muted with reduced motion, retain all necessary information, and complete.
- `RETURNING_USER`: load a synthetic repaired save, verify the recognition surface, open the spellbook, enter the forest, and return.

The scroll matrix separately exercises wheel, PageDown, End, top return, final focus and activation, real CDP touch swipe, one vertical scroll owner, and no horizontal overflow across every adult tool at 320×568, 390×844, 768×1024, and 1440×900; the 390×844 touch context is an additional real-input row.

## Visual and ARIA baseline discipline

`PRE_CHANGE_REFERENCE` is evidence from the original HEAD, not an accepted baseline. After hard, semantic, accessibility, and responsive review, STEP 07 may establish `STEP07_ESTABLISHED_BASELINE`. The same snapshots must then pass a no-update rerun. An update command is never treated as regression proof. ARIA baselines receive the same heading/role/name/order review before acceptance.

The ordering is fail-closed: finish the frozen mutations, rebuild affected candidate browser evidence, run changed-only review and then full semantic reconnaissance, and promote a candidate only when Sev-1/2, known structural accessibility blockers, and unknown blockers are all zero. After the last tracked mutation, record `FINAL_SOURCE_TREE_SHA256` and permit no further tracked-file change. Formal scroll, catalog, profile, deep-route, lifecycle, observer, visual, ARIA, command, and reviewer evidence is then regenerated on that same frozen tree. Visual and ARIA no-update verification, final runners, and static-report proof must all bind that identity.

## STEP 07 lifecycle and adversarial playthroughs

Each lifecycle browser test owns one isolated `BrowserContext`. Its `observerPage` and `childPage` share that context and same-origin storage/channel identity; different tests do not share a context.

- `L1_ACTIVE_CONNECTION`: prepare one synthetic STEP 07 session, open observer and child pages, emit a known event sequence, and require exact order, one session identity, and unique event IDs.
- `L2_DISCONNECT_CONTINUE_RECOVER`: disconnect the observer, continue child actions, reopen the observer on the same session, and require every allowlisted disconnect-window event with monotonic sequence and no duplicate.
- `L3_BROADCASTCHANNEL_FALLBACK`: disable only the formally supported `BroadcastChannel` capability, exercise the scoped localStorage storage-event fallback, and require ordering, dedupe, stop, and zero remote requests.
- `L4_RELOAD`: reload observer, child, and world surfaces while preserving validated grant/session identity, synthetic classification, progress continuity, and event dedupe.
- `L5_HISTORY_BACK_FORWARD`: exercise ordinary `world → forest → world → back → forward` navigation in one page and session. It must retain STEP 07 route context and must not claim BFCache restoration.
- `L6_CONFLICT`: fail closed for cross-version evidence/session pairs, bare session, unknown evidence, wrong origin, expired or invalid grant, and missing canonical completed save.
- `RAPID_INPUT_TRANSITIONS`: burst or duplicate public input at selection, final placement, ability, boss completion, finish-run, and return-world boundaries; require one logical transition/save effect and no console or page error.

Mutation-based validator controls must independently fail for a duplicate event, out-of-order sequence, wrong session, cross-version route, and a missing disconnect-window event. Telemetry remains local, allowlisted, and observational; it never owns gameplay rules.

## Repair and escalation

At most three dependency-aware repair rounds are allowed. Each round records a finding, makes the smallest fix, reruns affected deterministic/browser/semantic gates, and reruns shared safety gates. Changes to page mode, routing, main dispatch, global styles, game core, or shared world routing widen the affected scope. The final candidate gets one full regression, catalog, machine-review, and acceptance run.

Those three ordinary rounds were consumed and the required human escalation occurred. `HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_01` is a one-time authorization limited to the deep-route `40 rowKey ↔ 22 canonical context` validation contract. It keeps `repairRoundsConsumed=3`, preserves the original blocker history, does not relax any hard gate, is not a fourth ordinary repair loop, and is not a precedent for additional automatic repairs.

After Exceptional Repair 01 passed, a separate visual-harness order defect was stopped and escalated. `HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_02_VISUAL_HARNESS_SEQUENCE_ONLY` authorizes only moving the existing public “走进墨林” test action before the `camp_intro` wait and capture. It authorizes no runtime, gameplay, content, UI, routing, page-mode, gate, or snapshot-acceptance change. Final metadata records exactly two human exceptional repairs while the ordinary repair count remains three.

After Exceptional Repair 02 passed, the first camp capture proved that Phaser canvas tweens remain active when Playwright disables CSS animations. `HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_03_VISUAL_HARNESS_REDUCED_MOTION_ONLY` authorizes only a test-level public reduced-motion media preference plus an explicit `data-reduced-motion=true` assertion before capture. It does not authorize masks, tolerance/timeout changes, private Phaser controls, runtime animation changes, or altered child content. Final metadata records exactly three human exceptional repairs while `repairRoundsConsumed=3` and every hard gate remains unchanged.

`HUMAN_AUTHORIZED_STEP07_FINAL_CLOSURE_SKILL_CLEANUP_ASSET_FOUNDRY_01` is a new, finding-category-bounded closure, not another exceptional repair or ordinary revise loop. Its frozen charter permits at most three closure-local loops for charter findings or regressions directly caused by their mutations. Two loops repaired lifecycle harness action sequencing; the third closed the same classic-hub landmark dependency when the required enter-game assertion exposed one legacy game's scene-level `main` elements inside the hub-owned `main`. The product rules and frozen seven-finding list did not change. All three loops are now consumed; any repeated blocker, unknown root cause, or need to weaken a gate requires stopping rather than manufacturing a PASS.

Human escalation is reserved for real-child behavior, value/preference choices, irreversible privacy/publication decisions, critical reviewer conflict, or three failed repair rounds. Technical PASS does not answer those questions.
