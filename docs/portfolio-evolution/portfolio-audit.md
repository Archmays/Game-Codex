# Game-Codex Portfolio 机器优先审计

> Goal：`GAME-CODEX-PORTFOLIO-EVOLUTION-GOAL-01`；审计日期：2026-08-27；初始事实绑定：`73ae9d6be140c9e8294781b9f8e6ed296590c438`。本页由 `portfolio-evidence.json` 确定性生成。

## 三本证据账

- `ENGINEERING_EVIDENCE`：Repository facts, deterministic audits, unit tests, browser tests, CI and exact-commit deployment checks.
- `PRODUCT_EVIDENCE`：Machine first-use inspection and rubric-based product inference; useful for design decisions but not a child outcome claim.
- `AUTHENTIC_CHILD_EVIDENCE`：`UNKNOWN / NOT PERFORMED / NOT CLAIMED`。

## 组合前后事实

| 事实 | Before | After |
| --- | ---: | ---: |
| Mount definitions | 9 | 9 |
| Classic cards | 6 | 4 |
| Play surfaces | 42 | 40 |
| Primary surfaces | 8 | 6 |
| Known save keys | 37 | 37 |

After 的活跃儿童产品：`hanzi-radical-battle` / `math-lab` / `english-spell-battle` / `equation-slider`。定义、世界模块、兼容表面、共享引擎和 save inventory 分层维护；取消卡片不删除实现、route 或存档。

## 100 分 rubric

| Dimension | Weight |
| --- | ---: |
| core-loop clarity | 8 |
| intrinsic learning-game integration | 12 |
| meaningful choice | 8 |
| feedback and game feel | 10 |
| challenge, scaffolding and fairness | 8 |
| depth and content variation | 8 |
| pressure-free replay / return value | 8 |
| world identity and portfolio cohesion | 8 |
| learning feedback / visible growth | 7 |
| accessibility / input / responsive | 7 |
| portfolio uniqueness | 10 |
| maintenance / asset / compatibility cost | 6 |
| **Total** | **100** |

## Scorecards

| 定义 | 总分 | core-loop clarity | intrinsic learning-game integration | meaningful choice | feedback and game feel | challenge, scaffolding and fairness | depth and content variation | pressure-free replay / return value | world identity and portfolio cohesion | learning feedback / visible growth | accessibility / input / responsive | portfolio uniqueness | maintenance / asset / compatibility cost | 信心 | 决策 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 汉字魔法战 / 墨迹森林<br>`hanzi-radical-battle` | 89.0 | 4 | 5 | 5 | 5 | 4 | 5 | 4 | 5 | 4 | 5 | 5 | 1 | `B` | `KEEP`<br>`POLISH` `CONTENT_FREEZE` `ROUTE_KEEP` `SAVE_KEEP` |
| 算式滑轨<br>`equation-slider` | 78.0 | 3 | 4 | 4 | 4 | 4 | 5 | 4 | 3 | 3 | 5 | 5 | 2 | `A` | `KEEP`<br>`POLISH` `CONTENT_FREEZE` `ROUTE_KEEP` `SAVE_KEEP` |
| 数学世界 / 数感实验城<br>`math-lab` | 81.0 | 4 | 4 | 5 | 4 | 4 | 5 | 4 | 5 | 3 | 4 | 4 | 2 | `B` | `KEEP`<br>`POLISH` `CONTENT_FREEZE` `ROUTE_KEEP` `SAVE_KEEP` `RESEARCH_ONLY` |
| 英语世界 / 词光岛<br>`english-spell-battle` | 88.2 | 5 | 5 | 4 | 4 | 5 | 4 | 4 | 5 | 4 | 5 | 5 | 2 | `B` | `KEEP`<br>`POLISH` `CONTENT_FREEZE` `ROUTE_KEEP` `SAVE_KEEP` |
| 目标工坊<br>`make-target` | 82.4 | 4 | 5 | 5 | 3 | 5 | 3 | 4 | 3 | 4 | 4 | 5 | 4 | `B` | `MERGE`<br>`RETIRE_STANDALONE` `ENGINE_KEEP` `CONTENT_FREEZE` `ROUTE_KEEP` `SAVE_KEEP` |
| 时钟塔<br>`clock-reader` | 85.0 | 5 | 5 | 4 | 3 | 4 | 3 | 4 | 4 | 4 | 5 | 5 | 5 | `B` | `MERGE`<br>`ENGINE_KEEP` `CONTENT_FREEZE` `ROUTE_KEEP` `SAVE_KEEP` |
| 阵列工坊<br>`multiplication-adventure` | 81.8 | 5 | 5 | 3 | 3 | 4 | 3 | 3 | 4 | 5 | 4 | 5 | 5 | `B` | `MERGE`<br>`ENGINE_KEEP` `CONTENT_FREEZE` `ROUTE_KEEP` `SAVE_KEEP` |
| 记忆配对共享定义<br>`memory-card` | 68.8 | 5 | 4 | 2 | 3 | 3 | 4 | 4 | 2 | 3 | 5 | 2 | 5 | `B` | `RETIRE_STANDALONE`<br>`MERGE` `ENGINE_KEEP` `CONTENT_FREEZE` `SAVE_KEEP` |
| 拼音旧定义适配层<br>`pinyin-magic-battle` | 74.2 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 5 | 4 | 5 | 1 | 3 | `B` | `COMPATIBILITY_ONLY`<br>`ENGINE_KEEP` `CONTENT_FREEZE` `ROUTE_KEEP` `SAVE_KEEP` |

总分只支持排序和讨论；correctness、privacy、route/save compatibility 与 accessibility 可独立否决一个实现。所有评分都是产品推断，不是儿童结果。

## 逐定义证据与决策合同

### 汉字魔法战 / 墨迹森林 — `KEEP`

- Route/state：?play=hanzi-magic-complete; three chapters, 72-character truth, component families, word order, Pinyin, Memory, archive and postgame; V1/V2 compatibility retained.
- 证据 / 分类 / 信心：`docs/hanzi-radical-battle-v3/README.md`；`tests/hanzi-complete`；`tests/e2e/hanzi-complete`；`docs/portfolio-evolution/evidence/first-use-hanzi.png`；`FACT_AND_INFERENCE`；`B`。
- Top strength：Component placement, word ordering and family connections are the learning actions and visibly repair one coherent world.
- Top problem：The compatibility/content/asset surface is large, and machine evidence cannot establish child pacing or return value.
- Unknowns：Whether a child independently understands the first objective within 30 seconds；Whether chapter pacing, return value or long-term learning is effective in family use。
- 实施：No content expansion; retain the canonical product and all compatibility contracts while converging portfolio truth around it.
- Route impact：No route removed or redirected.
- Save impact：All existing namespaces retained byte-compatibly.
- Shared-engine impact：Continues consuming memory-match through Chinese Memory.
- Tests：Hanzi content/simulation gates；representative browser routes；portfolio compatibility smoke。
- Rollback：Revert only portfolio metadata/projection; canonical game bytes and routes remain independently mountable.
- Not-do：No fourth chapter；No character-count expansion；No real-child outcome claim。
- Child-evidence boundary：`UNKNOWN_NOT_PERFORMED_NOT_CLAIMED`。

### 算式滑轨 — `KEEP`

- Route/state：?world=math-world&station=slider and Classic alternate launcher; 200 deterministic levels across four chapters.
- 证据 / 分类 / 信心：`games/equation-slider/levels/generated-audit.json`；`tests/equation-slider-level-audit-v3.test.ts`；`tests/equation-slider-board-state.test.ts`；`tests/e2e/equation-slider.spec.ts`；`docs/portfolio-evolution/evidence/equation-same-display-rejection.png`；`FACT_AND_INFERENCE`；`A`。
- Top strength：A deep deterministic manipulation puzzle with solver-backed content, undo/reset, hints and multiple representations.
- Top problem：82 levels contained a legal adjacent tile-identity change with no visible mathematical change; 45 exposed it initially.
- Unknowns：Whether children understand the new rejection explanation without adult help；Whether rejecting the edge is preferable in lived play to reauthoring the affected reels。
- 实施：Reject same-display adjacent moves without incrementing state, explain why, direct the player toward a visible mathematical change, and make solver/hints use visible-move distance.
- Route impact：Both canonical Math World and Classic alternate routes retained.
- Save impact：Existing save namespace and published level IDs retained.
- Shared-engine impact：Game-owned reducer, evaluator, solver and generator retained.
- Tests：200-level deterministic audit；board-state rejection and alternate path；real-browser same-display rejection；S release profile。
- Rollback：Revert rejection/visible-distance changes and regenerated audit; level source JSON remains unchanged.
- Not-do：No threshold weakening；No level-ID rewrite；No hidden identity requirement；No content expansion。
- Child-evidence boundary：`UNKNOWN_NOT_PERFORMED_NOT_CLAIMED`。

### 数学世界 / 数感实验城 — `KEEP`

- Route/state：?world=math-world; five open stations: lab, clock, array, target and slider.
- 证据 / 分类 / 信心：`games/math-lab/world/activity-registry.ts`；`games/math-lab/world/world-save.ts`；`tests/e2e/math-world.spec.ts`；`docs/portfolio-evolution/evidence/first-use-math.png`；`FACT_AND_INFERENCE`；`B`。
- Top strength：Five freely accessible, mechanically distinct stations form a coherent choice-rich world.
- Top problem：Station settings and progress are fragmented; a visit is not evidence of mastery or a basis for cross-station recommendations.
- Unknowns：Whether children can choose and re-enter stations without adult explanation；Whether any cross-station mastery or recommendation model would be valid。
- 实施：Retain the five-station world; converge Make Target as station-only and record equal-sharing/partition as a future specification, not a new game.
- Route impact：Canonical world and all five station routes retained.
- Save impact：World and station namespaces retained; no cross-station mastery inference added.
- Shared-engine impact：Station-owned implementations remain in games/; no speculative package abstraction.
- Tests：Math unit/content gates；desktop/mobile browser world gate；station compatibility routes。
- Rollback：Restore Classic projection metadata; Math World and station routes remain unchanged.
- Not-do：No sixth station in this cycle；No world-wide mastery claim from visits；No reward economy。
- Child-evidence boundary：`UNKNOWN_NOT_PERFORMED_NOT_CLAIMED`。

### 英语世界 / 词光岛 — `KEEP`

- Route/state：?world=english-world; five regions, 48-word corpus, 30 story-core missions, journal, sentence loop and English Memory; legacy route retained.
- 证据 / 分类 / 信心：`games/english-spell-battle/README.md`；`games/english-spell-battle/v2/core/machine.ts`；`tests/e2e/english-v2/slice.spec.ts`；`docs/portfolio-evolution/evidence/first-use-english.png`；`FACT_AND_INFERENCE`；`B`。
- Top strength：Meaning, grapheme building, sentence placement and visible world response form one intrinsic chain.
- Top problem：The core mission path is mostly linear and content/assets are expensive; replay value is not established by machine evidence.
- Unknowns：Whether the meaning-spelling-sentence-world chain is understood by children without help；Whether TTS fallback quality and replay value are adequate on actual family devices。
- 实施：No corpus expansion; retain world, journal, memory, language help and TTS fallback while aligning product truth.
- Route impact：Canonical and legacy routes retained.
- Save impact：Both English namespaces retained.
- Shared-engine impact：Continues consuming memory-match through English Memory.
- Tests：English content/machine gates；region/journal/memory browser routes；portfolio smoke。
- Rollback：Revert portfolio metadata/projection only; English routes and saves remain independent.
- Not-do：No large vocabulary expansion；No cloud profile；No inferred learning outcome。
- Child-evidence boundary：`UNKNOWN_NOT_PERFORMED_NOT_CLAIMED`。

### 目标工坊 — `MERGE`

- Route/state：?world=math-world&station=target; 12 deterministic puzzles; mount definition retained, duplicate Classic card retired.
- 证据 / 分类 / 信心：`games/make-target/index.ts`；`games/make-target/solver.ts`；`tests/math-world-target.test.ts`；`tests/e2e/math-world.spec.ts`；`FACT_AND_INFERENCE`；`B`。
- Top strength：Exact arithmetic composition is the game action, with order control, undo and graduated solver hints.
- Top problem：Only 12 puzzles and the same implementation appeared in both Classic and Math World; the save lacked a schema version.
- Unknowns：Whether children discover and revisit the station after removal of the duplicate Classic card；How many family saves still use the unversioned legacy shape。
- 实施：Remove the duplicate Classic card, keep the Math World station, add deterministic migration from the legacy unversioned save and preserve future-save read-only behavior.
- Route impact：Canonical Math station retained; mount definition remains available for compatibility code.
- Save impact：Legacy wins/completedPuzzleIds migrate to v1; future versions are never overwritten.
- Shared-engine impact：AST/solver/manifest remain game-owned.
- Tests：legacy and future save migration；12-puzzle solvability；Math route/return browser gate。
- Rollback：Restore the Classic projection; v1 loader remains backward compatible with old bytes.
- Not-do：No puzzle-count expansion；No code deletion；No save-key rename。
- Child-evidence boundary：`UNKNOWN_NOT_PERFORMED_NOT_CLAIMED`。

### 时钟塔 — `MERGE`

- Route/state：?world=math-world&station=clock; world-module mount only.
- 证据 / 分类 / 信心：`games/clock-reader/index.ts`；`games/clock-reader/model.ts`；`tests/math-world-clock.test.ts`；`tests/e2e/math-world.spec.ts`；`FACT_AND_INFERENCE`；`B`。
- Top strength：Direct clock manipulation synchronizes hands, digital time, exact language and relative language.
- Top problem：Bounded challenge depth and no independent growth record do not justify a separate child product.
- Unknowns：Whether children transfer the manipulation to independent time-reading language；Whether its current challenge depth supports voluntary replay。
- 实施：Keep as a Math World module mount with no Classic card.
- Route impact：Math station route unchanged.
- Save impact：Clock namespace retained.
- Shared-engine impact：Remains game-owned because it has one canonical consumer.
- Tests：clock model/content；pointer/keyboard route browser gate。
- Rollback：Portfolio metadata can be reverted without touching module code or save bytes.
- Not-do：No speculative package extraction；No standalone card；No pressure mechanics。
- Child-evidence boundary：`UNKNOWN_NOT_PERFORMED_NOT_CLAIMED`。

### 阵列工坊 — `MERGE`

- Route/state：?world=math-world&station=array; world-module mount only.
- 证据 / 分类 / 信心：`games/multiplication-adventure/index.ts`；`games/multiplication-adventure/model.ts`；`tests/math-world-array.test.ts`；`tests/e2e/math-world.spec.ts`；`FACT_AND_INFERENCE`；`B`。
- Top strength：Rows, columns, cell count, expression and transpose invariant change together without a detached answer layer.
- Top problem：Three-mode loop is shallow and lacks an independent progression reason for standalone status.
- Unknowns：Whether children connect transpose invariance to multiplication structure；Whether three modes provide sufficient variety for repeat family use。
- 实施：Keep as a Math World module mount with no Classic card.
- Route impact：Math station route unchanged.
- Save impact：Array namespace retained.
- Shared-engine impact：Remains game-owned because it has one canonical consumer.
- Tests：array model/content；pointer/keyboard route browser gate。
- Rollback：Portfolio metadata can be reverted without touching module code or save bytes.
- Not-do：No speculative package extraction；No standalone card；No content expansion。
- Child-evidence boundary：`UNKNOWN_NOT_PERFORMED_NOT_CLAIMED`。

### 记忆配对共享定义 — `RETIRE_STANDALONE`

- Route/state：Chinese Memory and English Memory remain canonical world activities; the generic mount definition and both save namespaces remain, while the duplicate Classic card is retired.
- 证据 / 分类 / 信心：`packages/activity-engines/memory-match/app.ts`；`tests/chinese-support/memory.test.ts`；`tests/e2e/chinese-support/support.spec.ts`；`tests/e2e/english-v2/slice.spec.ts`；`FACT_AND_INFERENCE`；`B`。
- Top strength：A validated calm shared relation engine with deterministic decks and robust keyboard/touch recovery.
- Top problem：The generic Classic wrapper added no distinct world, progression or content beyond canonical Chinese and English uses.
- Unknowns：Whether families valued the generic Classic entry as a direct shortcut；Whether repeated matching produces durable vocabulary or character learning。
- 实施：Remove only the duplicate Classic card and play-surface projection; retain definition adapter, world activities, engine and saves.
- Route impact：Chinese/English canonical routes retained; definition adapter remains registered.
- Save impact：Both legacy and shared-engine namespaces retained.
- Shared-engine impact：memory-match remains a first-class shared engine for Chinese and English.
- Tests：shared-engine state/content；Chinese/English memory browser routes；save inventory exact-key gate。
- Rollback：Restore the Classic projection without changing the engine or stored data.
- Not-do：No engine deletion；No save deletion；No generic card duplication。
- Child-evidence boundary：`UNKNOWN_NOT_PERFORMED_NOT_CLAIMED`。

### 拼音旧定义适配层 — `COMPATIBILITY_ONLY`

- Route/state：?play=pinyin-magic-battle legacy route and mount definition retained; canonical activity is ?play=hanzi-magic-complete&view=pinyin.
- 证据 / 分类 / 信心：`games/pinyin-magic-battle/index.ts`；`games/hanzi-radical-battle/complete/support/pinyin/app.ts`；`tests/chinese-support/pinyin.test.ts`；`tests/e2e/chinese-support/support.spec.ts`；`FACT_AND_INFERENCE`；`B`。
- Top strength：The canonical Sound-Rhyme activity has three deterministic modes, calm feedback, hints, optional speech and versioned save.
- Top problem：The nine-definition entry is an alias/wrapper and contributes no independent product identity.
- Unknowns：Whether children hear and apply the targeted sound distinctions without adult support；Whether any family still depends on the legacy standalone route as its primary entry。
- 实施：Keep the old definition/route as compatibility while exposing the canonical Chinese-world activity only.
- Route impact：Legacy and canonical routes retained.
- Save impact：Both Pinyin namespaces retained.
- Shared-engine impact：Canonical Pinyin machine remains Chinese-world-owned.
- Tests：72-record content gate；legacy/canonical route browser gate；save compatibility。
- Rollback：Compatibility metadata can be reverted without changing routes or bytes.
- Not-do：No separate Classic card；No duplicated engine；No corpus expansion。
- Child-evidence boundary：`UNKNOWN_NOT_PERFORMED_NOT_CLAIMED`。

## 两轮独立审查

### GAMEPLAY_REVIEW

- Reviewer：`/root/final_gameplay_review`；run：`GAMEPLAY_REVIEW_FINAL_2026-08-27_R4`。
- 最终候选绑定：`RELEASE_TAG_TARGET`；轮次：`FINAL_CANDIDATE`；判定：`PASS_MACHINE`；日期：2026-08-27。
- Source tree：`sha256-git-clean-filter-tree-with-self-normalized-evidence-v1` / 1470 files / `30d8f58ea3135882a2e905f4b93c4b40ff2a2b0d19cc4c66a87d608e429da415`。
- 身份合同：Reviewed against the current release candidate; any later tracked mutation invalidates this review; the release tag and exact-SHA readback bind the immutable final tree.
- 独立性：Read-only subagent; no product edits; separate browser origin and gameplay-first rubric.
- Rubric：core loop / game feel / pacing / world identity / replay / visual feedback / input recovery
- 关键结论：Keep four active products; converge Make Target and Memory duplicate cards; reject Equation Slider actions whose mathematical display does not change while retaining every level and compatibility contract.
- Findings：`GPR-01` `SEV_2` → `FIXED`：Same-visible adjacent moves are rejected without mutating moves or state, calm feedback explains why, and solver/hints use the visible-move graph; all 82 affected levels remain solvable.（`games/equation-slider/board-state.ts`；`games/equation-slider/solver.ts`；`games/equation-slider/levels/generated-audit.json`；`tests/e2e/equation-slider.spec.ts`）；`GPR-02` `SEV_2` → `FIXED`：Classic and My Game World now project the four active products from one truth while duplicate Make Target and Memory cards retire without deleting their playable implementations.（`packages/data/gamePortfolio.ts`；`packages/data/gameCatalog.ts`；`apps/my-game-world/index.ts`；`tests/e2e/play-readiness/portfolio.spec.ts`）；`GPR-03` `SEV_2` → `FIXED`：Make Target legacy state migrates to version 1 only on a safe write boundary, reload restores it, and a future-version save remains byte-exact and read-only through interaction.（`games/make-target/index.ts`；`packages/data/saveKeyInventory.ts`；`tests/e2e/math-world.spec.ts`；`tests/save-vault/save-vault.test.ts`）；`GPR-04` `SEV_3` → `FIXED`：Affected-gate routing now selects the Equation S release, level, visual/geometry and playtest profiles plus the changed Hanzi wheel profile.（`tools/portfolio/affected-gates.ts`；`tests/e2e/hanzi-v2/wheel-workshop.spec.ts`；`tests/e2e/interaction-integrity/portfolio-hittest.spec.ts`）；`GPR-05` `SEV_2` → `FIXED`：Two redundant whole-catalog audit recomputations that made the 445-test gate timeout were removed; the dedicated live audit still matches the generated deterministic hash, targeted tests pass 16/16, and the complete unit suite passes 445/445.（`tests/equation-slider-solver.test.ts`；`tests/equation-slider-level-audit-v3.test.ts`；`games/equation-slider/levels/generated-audit.json`）；`GPR-06` `SEV_2` → `FIXED`：The decorative Hanzi path light now reproduces its intended in-bounds appearance without adding an invisible 8% document tail; its aria-hidden wrapper uses overflow:hidden instead of the globally unauthorized overflow:clip, and the static scroll contract plus strict desktop, mobile and tablet screenshots pass.（`games/hanzi-radical-battle/complete/ui/complete-world.css`；`tests/e2e/chinese-support/visual.spec.ts`；`tests/e2e/hanzi-complete/visual.spec.ts-snapshots/world-mobile-390x844.png`）
- 验证证据：`docs/portfolio-evolution/evidence/local-validation-evidence.json`；`tests/equation-slider-solver.test.ts`；`tests/e2e/equation-slider.spec.ts`；`tests/e2e/math-world.spec.ts`。
- 未关闭 blocker：无；真实儿童证据：`UNKNOWN_NOT_PERFORMED_NOT_CLAIMED`。

### LEARNING_PORTFOLIO_REVIEW

- Reviewer：`/root/final_learning_review`；run：`LEARNING_PORTFOLIO_REVIEW_FINAL_2026-08-27_R4`。
- 最终候选绑定：`RELEASE_TAG_TARGET`；轮次：`FINAL_CANDIDATE`；判定：`PASS_MACHINE`；日期：2026-08-27。
- Source tree：`sha256-git-clean-filter-tree-with-self-normalized-evidence-v1` / 1470 files / `30d8f58ea3135882a2e905f4b93c4b40ff2a2b0d19cc4c66a87d608e429da415`。
- 身份合同：Reviewed against the current release candidate; any later tracked mutation invalidates this review; the release tag and exact-SHA readback bind the immutable final tree.
- 独立性：Read-only subagent; no product edits; learning/portfolio-first rubric independent from gameplay review.
- Rubric：intrinsic integration / learning progression / scaffolding / portfolio uniqueness / duplication / maintenance / route/save/privacy
- 关键结论：Separate mount definitions, active products, world modules, compatibility surfaces and shared engines; keep routes and saves independent from card visibility and retain authentic-child outcomes as unknown.
- Findings：`LPR-01` `SEV_2` → `FIXED`：The durable truth now distinguishes 9 mount definitions, 4 active products, 11 world modules, 6 compatibility surfaces and 2 shared engines.（`packages/data/gamePortfolio.ts`；`packages/data/playSurfaceManifest.ts`；`docs/project-status/portfolio-status.md`）；`LPR-02` `SEV_2` → `FIXED`：Portfolio Evolution remains RELEASE_BOUND until exact tag, CI and Pages readback; Natural-use Observation remains ACTIVE and no child or family acceptance is inferred.（`packages/data/projectLifecycle.ts`；`docs/project-status/portfolio-roadmap.md`；`docs/project-status/portfolio-status.md`）；`LPR-03` `SEV_2` → `FIXED`：Portfolio evidence now has runtime structural validation, substantive review findings and dispositions, and the evolution checker is enforced by CI, Pages and the full readiness workflow.（`tools/portfolio/portfolio-evolution-docs.ts`；`tools/portfolio/check-portfolio-evolution.ts`；`.github/workflows/ci.yml`；`.github/workflows/pages.yml`）；`LPR-04` `SEV_2` → `FIXED`：The six-hats decision record now states 6 compatibility surfaces and the checker binds that count to the canonical layer truth.（`docs/portfolio-evolution/six-hats-and-decision-record.md`；`tools/portfolio/check-portfolio-evolution.ts`）；`LPR-05` `SEV_3` → `ACCEPTED`：Real-child comprehension, preference, learning and retention remain explicit unknowns and are future observation inputs, not blockers or synthetic claims in this release.（`docs/portfolio-evolution/portfolio-audit.md`；`docs/portfolio-evolution/next-roadmap.md`；`packages/data/projectLifecycle.ts`）；`LPR-06` `SEV_2` → `FIXED`：CI now installs Chromium and executes, rather than merely resolves, the full affected-gate closure selected from the exact push or pull-request range.（`.github/workflows/ci.yml`；`tools/portfolio/affected-gates.ts`）；`LPR-07` `SEV_2` → `FIXED`：The historical English V2 release builder keeps its six-card proof isolated from later Portfolio projections, while validating product-tag ancestry and only the English evidence inputs it actually consumes.（`tools/english-v2/build-release-reports.ts`；`tools/chinese-support/build-release-reports.ts`）
- 验证证据：`docs/portfolio-evolution/evidence/local-validation-evidence.json`；`tests/portfolio-governance.test.ts`；`tests/e2e/portfolio-smoke.spec.ts`；`tests/save-vault/save-vault.test.ts`。
- 未关闭 blocker：无；真实儿童证据：`UNKNOWN_NOT_PERFORMED_NOT_CLAIMED`。

## Equation Slider visible-no-change 专项

- 200 关、216 条同显示相邻转换、82 个受影响关卡；其中 45 关初始可触发。
- 禁用这些边后 82/82 仍可完成；0 关必须依赖；39 关最短路径增加，最大只增加 1 步。
- 算法：BFS over (reel indexes, required-tile bitmask, target bitmask), comparing all edges with a graph that removes moves whose selected visible value does not change.
- 决策：Reject a same-display adjacent attempt without state or move-count mutation; explain the absent mathematical change and direct the player to the opposite visible move.
- 每关真源：`games/equation-slider/levels/generated-audit.json`；目录 hash：`fnv1a32-2b6c450b`。

## Surface coverage

- Manifest：`packages/data/playSurfaceManifest.ts`；After 总数：40。
- Primary 真实浏览器：`my-game-world` / `classic-hub` / `hanzi-world` / `math-world` / `english-world` / `classic-equation`。
- 决策相关 secondary 真实浏览器：`hanzi-pinyin-assemble` / `hanzi-memory-glyph-pinyin` / `hanzi-v2-compat` / `hanzi-v1-compat` / `math-lab` / `math-clock` / `math-array` / `math-target` / `math-slider` / `english-journal` / `english-memory`。
- 其余覆盖：All remaining manifest surfaces are covered by the affected content/simulation, portfolio smoke, hit-test, scroll, accessibility, save and product profile suites; no manifest surface is intentionally excluded.
- 未覆盖：无。

## 分歧处理

- Four active products: Hanzi, Math World, English World and Equation Slider.
- Make Target belongs in Math World and should not keep a duplicate Classic card.
- Memory is a shared engine/world activity and should not keep a generic Classic card.
- Clock and Array remain Math World modules; Pinyin definition is compatibility-only.
- Classic remains a four-card alternate launcher, not product truth.
- My Game World remains a hub, not a learning product.

Equation 分歧：Gameplay review preferred reauthoring repeated reels; exhaustive engineering evidence showed no required same-display edge and a maximum one-move cost. The implemented minimum compatible repair rejects only the invisible edge, preserves all published levels/IDs/saves, provides explicit causal feedback, and binds solver/hints to visible moves. Level reauthoring is therefore deferred unless later evidence shows the rejection itself is confusing.

## 明确保留的未知项

- 儿童是否在 30 秒内真正理解目标、是否喜欢、是否会回玩、是否学会或保持：`UNKNOWN / NOT PERFORMED / NOT CLAIMED`。
- 自动测试、截图、UI agent、CI 和 Pages 验证只证明工程与产品契约，不证明家庭验收或教育效果。

