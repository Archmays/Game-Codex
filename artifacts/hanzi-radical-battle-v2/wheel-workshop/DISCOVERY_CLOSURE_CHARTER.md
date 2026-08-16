# Wheel Workshop discovery closure charter

- Task: `GAME-CODEX-HANZI-WHEEL-RETIRE-AND-V2-INTEGRATE`
- Mode: `DISCOVERY_MODE`
- Start branch / SHA: `main` / `3dfa537d41d6f7abccf6ef7bf460290656ef65fe`
- Start origin SHA: `3dfa537d41d6f7abccf6ef7bf460290656ef65fe`
- Start worktree: clean
- Start V2 source identity: `58B7803CC30D19A219ADEF69751ECE2126808E8E3829AE44A81476C732289FBA`

## Authorized question and value

Retire the standalone Hanzi Wheel identity while preserving its complete nine-grade raw library, then add an optional deterministic Wheel Workshop inside the V2 Chapter One camp. The child value is a short, pressure-free three-character activity whose first view has one clear spin action. The Hanzi learning value is that the child must choose a partner component and place it in the real ordered structure before the complete character, pronunciation, familiar word, short meaning, and meaning magic appear.

## Frozen discovery findings

1. The legacy source is `packages/data/learningGames.ts`: nine ordered sets (`p1` through `j3`), each with 18 char records and 12 word records (162 char, 108 word, 270 total).
2. `packages/data/memoryCards.ts` consumes the char records and is an authorized dependency closure; its nine-grade behavior must remain intact without retaining a public standalone-wheel export.
3. The standalone identity is registered only through `games/hanzi-wheel/`, `packages/data/gameCatalog.ts`, shared exports, root CSS, README/tests, and the current hub baseline. No stable public `hanzi-wheel` deep link exists, so no new compatibility route will be invented.
4. Internal formula-audit matching finds 150/162 exact accepted char combinations. Twelve records lack an exact accepted match: `p1.char.008`, `p3.char.000`, `p3.char.008`, and `p4.char.001` through `p4.char.009`. The circular/result-as-component and non-glyph cases will never enter playable data. A correction is allowed only where a current source chain supports it; otherwise quarantine.
5. All 108 word records remain byte-faithful raw context data. Word fragments/non-standalone segments, especially the seeded `j2` cases, are context-only and cannot appear as independent child-facing words.
6. Unicode 17.0 Unihan is an identity/reading cross-check; repository sources own playable structure decisions. Make Me a Hanzi was reviewed as an optional cross-check with distinct dictionary/graphics licenses, but no external dataset will be committed or loaded at runtime.
7. Pre-mutation baselines pass: `pnpm test` 253/253; `pnpm build`; `pnpm run test:hanzi-v2` 57/57; `pnpm run validate:hanzi-v2` including 90,000 seeds with zero failures.

## Allowed dependency closure

- `games/hanzi-radical-battle/v2/wheel-workshop/**`
- V2 camp integration files under `games/hanzi-radical-battle/v2/chapter-one/`
- `games/hanzi-wheel/**` deletion
- `packages/data/{learningGames,memoryCards,gameCatalog,index}.ts`
- `apps/hub/**`, `apps/my-game-world/**`, `src/{main,app-route,styles}.ts*` only where references or affected presentation require it
- Task-relevant tests, baselines, tools, package scripts, canonical V2 docs, root README, concise wheel artifacts, final handoff ZIP

## Protected contracts and non-goals

- Preserve 36 Chapter One characters/pages, 3 heroes, 3 regions plus core, 18 selectable and 3 innate abilities, 9 behaviors, 4 bosses, exactly 8 camp repairs, V1 migration/route, corrupt/future save handling, launcher/Pages/return routes, input modes, mute, reduced motion, and existing V1/Chapter One baselines.
- No ninth repair, second `GameDefinition`, public child-facing wheel route, backend, account, telemetry, score, streak, ranking, daily/FOMO/loot/time pressure, punitive loss, PII, external runtime request, release tag, manual public deployment, or real-child claim.

## Acceptance and repair rule

Finish only on one unchanged final source tree with all requested gates passing, three independent semantic reviews reconciled, no unresolved Sev-1/2, authorized new wheel baselines accepted then verified twice without update, exact-path commits/push, terminal CI or truthful resumable status, manifest-driven cleanup, and one verified return ZIP. Deterministic in-scope findings are `AUTO_REVISE`; only the user-authorized true escalation categories can become `ESCALATE_HUMAN`.
