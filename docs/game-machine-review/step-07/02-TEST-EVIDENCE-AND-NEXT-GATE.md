# STEP 07 test evidence and next gate

## Simplified real second-use observer

The STEP 07 observer keeps machine-derived route/action facts read-only and asks a parent for only five structured observations:

1. recognized the previous world;
2. noticed persistent repairs;
3. required a direct adult answer;
4. appeared comfortable;
5. engagement tone.

It also permits one optional preset-only privacy-safe note and a stop reason. Free text is not exported. It does not ask for boss intent, state-machine terminology, learning judgments, interventions, or a long narrative. Fixture output is visibly and structurally `SYNTHETIC_TOOLING_TEST_ONLY`.

Real startup is fail-closed: branch/remote identity, clean tracked tree, final `PASS_MACHINE` verdict, exact final commit, STEP 05 authorization, continuity, privacy confirmation, and a short-lived same-origin runtime grant must all match. Fixture mode does not create the real-child return ZIP.

## Required evidence

Machine-generated evidence stays under `artifacts/game-machine-review/step-07/`:

- `MACHINE-REVIEW-REPORT.json`, `MACHINE-REVIEW-SUMMARY.md`, `MACHINE-REVIEW-REPORT.html`, `MACHINE-REVIEW-VERDICT.json`;
- `SCROLL-MATRIX.json` and `.md`;
- `GAME-CATALOG-MACHINE-SMOKE.json`;
- `DEEP-ROUTE-EVIDENCE.json`, `STEP07-LIFECYCLE-EVIDENCE.json`, `EVIDENCE-MANIFEST.json`, and `DERIVED-OUTPUT-SEAL.json`;
- `screenshots/`, `traces/`, `semantic-reviews/`, and `agent-playthrough/`;
- `FINAL-SOURCE-FREEZE.json`, lifecycle/accessibility/baseline/no-update/static-report proofs, the cleanup plan and post-package cleanup contract, and the pre-change reference plus established visual/ARIA baselines. The actual cleanup result and hygiene verdict are generated beside the immutable ZIP after it exists, because those receipts bind the ZIP's own SHA-256 and therefore cannot truthfully be embedded inside the same ZIP.

The final evidence table, pushed commit, source-tree identity, command results, reviewer outcomes, and readiness ZIP hash are filled from generated evidence only. They are not pre-declared here.

The repair lineage is fixed: three ordinary rounds were consumed and `THREE-REPAIR-LOOPS-FAILED.json` remains valid history. Three later, separate human authorizations are bound at `repair-rounds/exceptional-repair-01/EXCEPTION_CONTRACT.json`, `repair-rounds/exceptional-repair-02/EXCEPTION_CONTRACT.json`, and `repair-rounds/exceptional-repair-03/EXCEPTION_CONTRACT.json`. Exceptional Repair 01 is limited to the 40-row/22-context validator contract. Exceptional Repair 02 is limited to ordering the existing public “走进墨林” action before the `camp_intro` wait/capture. `HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_03_VISUAL_HARNESS_REDUCED_MOTION_ONLY` is limited to selecting and asserting the existing public reduced-motion path for deterministic visual capture. Every final report invocation retains repair round `3`, binds all three IDs in canonical order, and records `humanExceptionalRepairs=3` and `ordinaryAutoReviseLoop=false`.

The preserved recovery/final-closure metadata additionally records `closedRecoveryAuthorizations=1` and `finalClosureAuthorizations=1`. `HUMAN_AUTHORIZED_STEP07_FINAL_CLOSURE_SKILL_CLEANUP_ASSET_FOUNDRY_01` froze seven findings before mutation. Five entries are `FIX_NOW` (including the independent R2/R3 records for the same classic-hub landmark defect) and two Sev-4 entries remain explicit `NON_BLOCKING_BACKLOG`. The closure has used all three local repair loops: two for lifecycle-harness public-action sequencing and one for the same classic-hub landmark dependency exposed by the required enter-game assertion. None changes the ordinary or exceptional-repair counts; any repeated blocker now stops the technical lane.

## Dependency-ordered validation runbook

Start from the exact baseline reference already captured, preserve it, and clear only stale STEP 07 generated evidence. Freeze the source tree before running the following sequence; any later source change invalidates the affected evidence.

First generate isolated fixture and raw browser evidence:

```powershell
tools\hanzi-v2-step07\START_STEP_07_REAL_SECOND_USE.cmd -FixtureMode
tools\hanzi-v2-step07\FINISH_STEP_07_REAL_SECOND_USE.cmd -FixtureMode
pnpm run test:e2e:adult-tools
pnpm run test:e2e:machine-games
pnpm run test:e2e:machine-deep-a11y
pnpm run test:e2e:hanzi-v2:step07
pnpm run test:e2e:hanzi-v2:step07:lifecycle
pnpm run test:hanzi-v2:step07:targeted-closure
```

Create the affected visual/ARIA candidate, run changed-only R2/R3, then run full semantic reconnaissance. Have the three isolated semantic reviewers independently read the shared raw evidence and write their schema-valid files plus `REVIEW-CONFLICTS.json`; a reviewer must not read another reviewer’s findings. Do not promote a candidate until Sev-1/2, known structural accessibility blockers, and unknown blockers are zero, while preserving every chartered Sev-3/4 disposition.

```powershell
pnpm run review:machine:evidence:visual-baseline-update
```

After all authorized source repairs and tracked cleanup have been applied, compute `FINAL_SOURCE_TREE_SHA256`, write `FINAL-SOURCE-FREEZE.json`, and prohibit every later tracked-file mutation. Every formal evidence command verifies the tracked diff/status and source identity before and after execution. Any mismatch invalidates the affected record instead of carrying evidence forward.

On that final frozen tree, regenerate the raw browser evidence and reviewer files, record the five real command gates, run the visual/ARIA candidate update, complete semantic acceptance, establish that candidate, prove it without updates, and only then seal promotion:

```powershell
pnpm run review:machine:evidence:compile
pnpm run review:machine:evidence:targeted-tests
pnpm run review:machine:evidence:step-regressions
pnpm run review:machine:evidence:full-tests
pnpm run review:machine:evidence:build
pnpm run review:machine:evidence:visual-baseline-update
# regenerate changed-only R2/R3, then full R1/R2/R3 and REVIEW-CONFLICTS.json
pnpm run review:machine:evidence:visual-no-update
pnpm run review:machine:evidence:promote-baseline
pnpm run finalize:machine:games
pnpm exec tsx tools/game-machine-review/run-machine-review.ts --repair-round 3 --exceptional-repair-id HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_01 --exceptional-repair-id HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_02_VISUAL_HARNESS_SEQUENCE_ONLY --exceptional-repair-id HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_03_VISUAL_HARNESS_REDUCED_MOTION_ONLY
pnpm run test:e2e:machine-static-report
pnpm exec tsx tools/game-machine-review/run-machine-review.ts --repair-round 3 --exceptional-repair-id HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_01 --exceptional-repair-id HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_02_VISUAL_HARNESS_SEQUENCE_ONLY --exceptional-repair-id HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_03_VISUAL_HARNESS_REDUCED_MOTION_ONLY
```

Review the final diff, commit the unchanged accepted file tree, push `main`, and verify `origin/main == HEAD`. Because the commit changes Git identity but not file bytes, regenerate the commit-bearing report, test that exact static HTML, and seal the final report again:

```powershell
git push origin main
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
pnpm exec tsx tools/game-machine-review/run-machine-review.ts --repair-round 3 --exceptional-repair-id HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_01 --exceptional-repair-id HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_02_VISUAL_HARNESS_SEQUENCE_ONLY --exceptional-repair-id HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_03_VISUAL_HARNESS_REDUCED_MOTION_ONLY
pnpm run test:e2e:machine-static-report
pnpm exec tsx tools/game-machine-review/run-machine-review.ts --repair-round 3 --exceptional-repair-id HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_01 --exceptional-repair-id HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_02_VISUAL_HARNESS_SEQUENCE_ONLY --exceptional-repair-id HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_03_VISUAL_HARNESS_REDUCED_MOTION_ONLY
$finalHead = (git rev-parse HEAD).Trim()
pnpm exec tsx tools/game-machine-review/evidence-identity.ts verify-readiness . artifacts/game-machine-review/step-07 $finalHead
pnpm run package:machine:step07-readiness
```

The tracked cleanup plan may delete only explicitly superseded STEP 07 narratives whose knowledge has already been extracted; North Star, traceability, decisions, parent feedback, real-child evidence, tests, tooling, baselines, and source/licence records remain protected. Untracked evidence cleanup uses the no-new-dependency commands below and deletes only exact T3 allowlist entries after the readiness ZIP has been created and verified:

```powershell
pnpm run review:machine:cleanup:plan
pnpm run review:machine:cleanup:apply
pnpm run review:machine:cleanup:verify
```

`CLEANUP-PLAN.json`, `CLEANUP-RESULT.json`, and `PROJECT-HYGIENE-VERDICT.json` must preserve T4 human evidence, retain the required history index, verify selected-asset inventory, confirm the pushed source tree is unchanged, and confirm the readiness ZIP still exists with its recorded SHA-256.

Only after STEP 07's final commit is pushed and `HEAD == origin/main` may the Theme C foundry produce Batch 01 candidates. That artifact-only stage may write prompts, raw candidates, machine reviews, selected candidates, thumbnails, and a contact sheet under `artifacts/hanzi-radical-battle-v2/asset-foundry/theme-c/batch-01/`; it may not modify tracked source or the frozen source-tree identity. Its maximum claim is `THEME_C_ASSET_BATCH_01_MACHINE_SELECTED_NOT_INTEGRATED`: selected images are candidates only and are never copied into the Phaser/runtime asset path by this task.

Choose the exact staging paths and commit message from the reviewed diff; do not use a blanket add that captures unrelated user artifacts. The readiness packager itself requires `main == HEAD == origin/main`, a clean tracked/staged tree, and a canonical PASS verdict before it writes the ZIP.

The final report and verdict must state `repairRoundsConsumed=3`, `humanExceptionalRepairs=3`, and `ordinaryAutoReviseLoop=false`, with an exact ordered `exceptionalRepairs` list. Entry 01 binds `HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_01`, `THREE_REPAIR_LOOPS_FAILED`, `ROW_UNIQUENESS_CONFUSED_WITH_CONTEXT_UNIQUENESS`, and `CANONICAL_ROW_TO_CONTEXT_MAPPING_WITH_SEQUENTIAL_REUSE`. Entry 02 binds `HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_02_VISUAL_HARNESS_SEQUENCE_ONLY`, `POST_EXCEPTION_UNRELATED_VISUAL_HARNESS_BLOCKER`, `VISUAL_HARNESS_START_ACTION_ORDER_INVERTED`, and `PUBLIC_START_ACTION_BEFORE_CAMP_CAPTURE`. Entry 03 binds `HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_03_VISUAL_HARNESS_REDUCED_MOTION_ONLY`, `POST_EXCEPTION_02_UNRELATED_VISUAL_CANVAS_STABILITY_BLOCKER`, `PHASER_CANVAS_INFINITE_TWEEN_NOT_FROZEN_BY_PLAYWRIGHT_CSS_ANIMATION_CONTROL`, and `PRODUCT_SUPPORTED_REDUCED_MOTION_VISUAL_HARNESS`.

## Verdict and next gate

`STEP 07 COMPLETE / MACHINE_QA_ACCEPTED_REAL_SECOND_USE_READY` is permitted only when every required technical gate is bound to one final file tree and the pushed commit. Until the same-tree acceptance, final runners, static-report proof, push verification, asset-only foundry, return package, and cleanup verification are complete, these documents describe the acceptance contract rather than declaring PASS. The next human gate is the family's real second-use observation using the START/FINISH tools; that real observation is not part of Codex technical execution.

No current or future machine report may claim `REAL_SECOND_USE_PASSED`, `GAME_FUN_PROVEN`, `LONG_TERM_ENGAGEMENT_VALIDATED`, replay/remaining-eight/full-forest authorization, or `LEARNING_VALIDATED`.
