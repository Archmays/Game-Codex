# STEP 07 current state and contract

## Baseline and root cause

The immutable pre-change reference is Git `8e00aa61d796578f7e593243caa514da5a307189`. At that tree, the shared shell fixed `html`, `body`, and `#app` to 100% height and set `body { overflow: hidden }`. A route-name exception list enabled scrolling only for STEP 02/03/04; STEP 05 had a local `!important` escape and STEP 06 had none. Adult tools therefore depended on a growing step list instead of a page contract.

The uploaded STEP 06 readiness ZIP has SHA-256 `2895180C36949924B55430DAD9F735CBDC7EE60FAFA23BE6435BDF94BB210638`. Its observation JSON has SHA-256 `984FE8BFD964A24E20C8DBD8AC29CA02F827868DAA9400D0CEE8A23FC5EA589D` and declares `evidenceKind=SYNTHETIC_TOOLING_TEST_ONLY`; it is fixture-only tooling evidence, not a real-child observation.

The same baseline treated any `session` query as STEP 06 evidence. That was unsafe once a versioned STEP 07 observer existed.

## Human-authorized exceptional repair lineage

The ordinary dependency-aware repair allowance was exhausted at three rounds and remains recorded as `repairRoundsConsumed=3`. The resulting `THREE-REPAIR-LOOPS-FAILED` evidence is preserved unchanged. After that escalation, the user explicitly authorized the one-time, narrow `HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_01`; it is not a fourth ordinary `AUTO_REVISE` loop and creates no broader repair authority.

The blocked tree confused unique evidence rows with unique browser contexts. The canonical contract now declares every one of the 40 `rowKey` values and binds them to exactly 22 isolated scenario contexts. Six contexts intentionally capture multiple states in sequence. Correct sequential reuse is accepted, while missing rows or contexts, unknown identities, wrong row-to-context bindings, cross-scenario reuse, and accidental scenario splitting fail closed.

After that repair passed, the visual baseline candidate exposed a separate test-harness ordering defect: the harness waited for `camp_intro` before activating the existing public “走进墨林” control that enters that phase. The user separately authorized `HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_02_VISUAL_HARNESS_SEQUENCE_ONLY`. Its sole behavior change is the test sequence `goto → click 走进墨林 → wait camp_intro → capture`; it does not change runtime, gameplay, content, UI, state transitions, or any gate. Final lineage therefore remains `repairRoundsConsumed=3` and `ordinaryAutoReviseLoop=false`, with exactly two human-authorized exceptional repairs bound to their separate contracts.

That corrected sequence then exposed a deterministic canvas-baseline defect: Playwright can disable CSS animation but cannot freeze the existing infinite Phaser tweens. The user separately authorized `HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_03_VISUAL_HARNESS_REDUCED_MOTION_ONLY`. The visual test now selects the product-supported `prefers-reduced-motion: reduce` path before navigation and asserts the mounted game reports reduced motion before capture. It does not change runtime animation code, screenshot tolerance, masks, timeouts, gameplay, content, or UI. Final lineage remains three ordinary repair rounds plus exactly three separately bound human exceptional repairs.

The later closed-recovery lane is preserved as one separate authorization, and the current final closure is separately authorized by `HUMAN_AUTHORIZED_STEP07_FINAL_CLOSURE_SKILL_CLEANUP_ASSET_FOUNDRY_01`. The canonical lineage is therefore:

- `repairRoundsConsumed=3`;
- `ordinaryAutoReviseLoop=false`;
- `humanExceptionalRepairs=3`;
- `closedRecoveryAuthorizations=1`;
- `finalClosureAuthorizations=1`.

The final closure is category-bound authority for the frozen lifecycle, accessibility, harness, evidence, reporting, and directly caused dependency regressions. It is not ER05, a fourth ordinary revise round, or open-ended repair permission. It cannot change Hanzi content, gameplay, save semantics, child-facing value choices, privacy, or network behavior.

## Frozen final-closure finding disposition

Before the first final-closure mutation, the charter froze all seven semantic findings. No unknown pre-existing product issue may be appended after that freeze; only a regression directly caused by an authorized mutation may be handled inside the same dependency closure.

| Finding | Severity | Frozen disposition | Closure boundary |
| --- | --- | --- | --- |
| `R1-CHILD-UX-001` | Sev-4 | `NON_BLOCKING_BACKLOG` | Existing internal build identifier is a visible child-surface polish choice, so this closure does not change it. |
| `R2_CLASSIC_NESTED_MAIN_LANDMARK` | Sev-3 | `FIX_NOW` | Replace only the outer classic-hub-from-world `main`; retain the hub's authoritative `main`. |
| `R2_FOREST_PRIMARY_HEADING_MISSING` | Sev-3 | `FIX_NOW` | Expose the existing forest title as the single H1 with explicit inherited-style resets and no intended visual change. |
| `R2_OBSERVER_EXPORT_LABEL_WRAP` | Sev-4 | `NON_BLOCKING_BACKLOG` | The adult export control remains functional and named; shortening its visible label is out of this zero-visual-change closure. |
| `R3_ROUTE_LIFECYCLE_EVIDENCE_GAP` | Sev-2 | `FIX_NOW` | Close observer/session recovery defects and add source-bound L1-L6 lifecycle evidence with fail-closed controls. |
| `R3_RAPID_INPUT_RACE_EVIDENCE_GAP` | Sev-3 | `FIX_NOW` | Add public-action burst coverage at six existing transition boundaries without altering runtime rules. |
| `R3_CLASSIC_HUB_NESTED_MAIN_LANDMARK` | Sev-3 | `FIX_NOW` | Preserve the independent R3 finding while closing the same atomic defect as the R2 classic-hub finding. |

The closure allows at most three closure-local automatic repair loops. Two corrected the lifecycle harness's public-action sequence after it exercised reversible controls as if they were transition controls. The third and final loop closed the same classic-hub landmark dependency after the required enter-game assertion proved that one legacy game rendered its own scene-level `main` inside the hub-owned game-stage `main`; its four scene containers are now neutral `section` elements. These remain bounded harness/accessibility repairs inside the frozen finding dependency closure; they add no finding, gameplay mutation, or ordinary repair round. Final acceptance still requires a fresh run bound to the final frozen source tree, and any repeated blocker now requires stopping.

## Observation routing contract

`resolveObservationContext(search)` is the only second-use context resolver. It returns `step06`, `step07`, `none`, or `invalid` and requires an explicit matching pair:

- `evidence=hanzi-v2-step06` with an `s06-…` session;
- `evidence=hanzi-v2-step07` with an `s07-…` session.

A bare session never selects instrumentation. Unsupported, duplicate, missing, or cross-version values fail closed. App routing is explicit and precedence ordered through the exported route registry. STEP 07 uses `?observe=hanzi-v2-step07`; the read-only machine report uses `?report=game-machine-review`.

## Page-mode and scrolling contract

`activatePageMode()` and `resetPageMode()` own the shell lifecycle:

- `game-fullscreen`: child gameplay owns the viewport and document scrolling is locked;
- `adult-tool`: the document is the single vertical scroll owner, horizontal overflow is forbidden, and `#app` reflows naturally;
- `document`: denial and ordinary document fallbacks reflow naturally.

STEP identity classes remain theme hooks and test selectors only. They do not control shell height or overflow. The app machine-report route is explicitly a non-authoritative contract shell; the generated `MACHINE-REVIEW-REPORT.html` is the authoritative report. Both use the same adult-tool scroll, reflow, focus, and horizontal-overflow rules.

## Machine-review architecture

The canonical manifest is generated from the app-route registry and `packages/data/gameCatalog.ts`. Browser scenarios use fresh Playwright contexts with synthetic localStorage; they never launch a family Chrome profile or clear a family save. Requests to `http://127.0.0.1:5175` and its Vite/static assets are `SAME_ORIGIN_ALLOWED`; all external HTTP/HTTPS, telemetry, CDN, remote font, tracking, and API traffic are `EXTERNAL_NETWORK_FORBIDDEN`.

Hard-gate evidence, screenshots, ARIA snapshots, event traces, semantic reviews, and agent profiles are merged only after their individual evidence files exist. The report is read-only and has no parent decision controls.

## Frozen scope

STEP 07 changes tooling, routing, page shells, tests, and the simplified observer. It does not add the remaining eight characters, replay routes, heroes, bosses, monsters, currency, a full Ink Forest, old-game redesign, gameplay rebalancing, or learning/engagement conclusions. Theme C work begins only after a successful final commit and push, produces machine-reviewed candidates outside the tracked runtime, and cannot support a `FINAL_ART_INTEGRATED` claim. The ten classic games are smoke-only unless a small shared Sev-1 defect is found.
