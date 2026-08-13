# V1 Discovery Closure Charter

- Target: 汉字魔法战 V2 V1.0.0
- Authorization: `HUMAN_AUTHORIZED_SKIP_REAL_SECOND_USE_AND_COMPLETE_V1_ONE_SHOT_01`
- Discovery baseline: `60cb7ffe3bbfe5936ca83577ac30f310f5933c91`
- Acceptance route: machine-first review; real-child validation remains `NO_BY_USER_DIRECTION`.

## Child-visible scope

- Exactly 12 characters: 明、花、林、星、草、看、园、回、包、风、猫、跑。
- Exactly three four-character adventures, one ability choice and one permanent repair per adventure.
- Theme C production art, 12 meaning-magic moments, a staged camp repair, a 12-character spellbook, free replay, local save/resume, sound and reduced-motion controls.
- The existing “汉字魔法战” hub card becomes the default V2 V1 entry; other game entries remain unchanged.

## Allowed mutation scope

- `games/hanzi-radical-battle/**`
- `apps/my-game-world/**` and the minimal hub/catalog files needed to route the existing card
- `packages/data/**` and immediate shared contracts needed by that route
- `assets/hanzi-radical-battle/v2/**`
- V2 guardrails under `docs/hanzi-radical-battle-v2/**`
- V1 tests, launcher files, package scripts, and V1 evidence under `artifacts/hanzi-radical-battle-v2/v1-release/**`
- Minimal release/build configuration only if required for the existing relative-base build.

## Protected scope

- All unrelated games and their data, gameplay, and assets.
- Historical STEP 01–07 evidence, accepted source identities, and the pre-existing untracked STEP 07 files.
- No backend, account, cloud child tracking, public deployment, daily-login reward, streak pressure, leaderboard, loot box, FOMO timer, punitive loss, or shaming language.
- No claims of real-child learning, preference, retention, or Second-Use evidence.

## Acceptance gates

1. Content, hand-auditor, simulation, save-migration/recovery, privacy/network, copy-health, build, and regression tests pass.
2. Browser playthroughs P1–P8 pass on the source-bound build, including desktop, mobile, keyboard, resume, corrupted-save recovery, reduced motion, and all three abilities.
3. Independent R1/R2/R3 machine reviews have no unresolved SEV-1/2/3 findings.
4. V1 baseline runner is byte-stable on a second pass; final source freeze and runtime asset manifests match the committed source.
5. One final ZIP and SHA-256 sidecar are verified before and after cleanup; commit, push, and remote SHA parity succeed.

## Stop boundary

Stop at `HANZI_MAGIC_BATTLE_V2_V1_PLAYABLE_READY`. Do not begin STEP 08/09, public deployment, or real-child observation. Future child play is optional and requires a separate family decision.
