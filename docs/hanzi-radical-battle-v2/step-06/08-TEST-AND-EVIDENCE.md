# STEP 06 Test and Evidence Contract

## Required automated coverage

The targeted unit suite includes:

- `tests/hanzi-radical-battle-v2-step06-parent-auth.test.ts`
- `tests/hanzi-radical-battle-v2-step06-default-route.test.ts`
- `tests/hanzi-radical-battle-v2-step06-route-compatibility.test.ts`
- `tests/hanzi-radical-battle-v2-step06-origin-continuity.test.ts`
- `tests/hanzi-radical-battle-v2-step06-progress-gate.test.ts`
- `tests/hanzi-radical-battle-v2-step06-observer-schema.test.ts`
- `tests/hanzi-radical-battle-v2-step06-event-bridge.test.ts`
- `tests/hanzi-radical-battle-v2-step06-privacy.test.ts`
- `tests/hanzi-radical-battle-v2-step06-freeze.test.ts`

`tests/e2e/hanzi-radical-battle-v2-step06.spec.ts` covers desktop/mobile/tablet default world, repaired state, spellbook, treasure, explicit ten-game hub, classic game entry/return, forest entry/return, browser title/theme, observer preflight, blocked wrong origin, accepted complete progress, clean instrumented child root, forest/spellbook/treasure first destinations, cross-navigation events, return, stop, privacy, reduced motion, console/page errors, and absence of remote requests.

Progress tests cover the exact canonical origin plus complete save, wrong port, localhost alias, missing save, partial STEP 02 state, corruption, unavailable/incognito-like storage, synthetic complete fixture, real-route fail closed, and normal fresh-world use.

## Commands

Run and record actual results for:

```powershell
pnpm run validate:hanzi-v2-foundation
pnpm run validate:hanzi-v2:step03
pnpm run validate:hanzi-v2:step04
pnpm run validate:hanzi-v2:step05
pnpm run validate:hanzi-v2:step06
pnpm run test:hanzi-v2:step06
pnpm run test:e2e:hanzi-v2:step06
pnpm test
pnpm build
```

Launcher verification is limited to `START_MY_GAME_WORLD.cmd`, `STOP_MY_GAME_WORLD.cmd`, `START_STEP_06_SECOND_USE_CHECK.cmd -FixtureMode`, and `FINISH_STEP_06_SECOND_USE_CHECK.cmd -FixtureMode`. Codex must not invoke real mode.

## Fixture dry-run

The dry-run proves exact parent authorization, synthetic complete progress, observer readiness, clean child root, forest entry, return to world, stop, schema validation, privacy validation, and FINISH packaging. Its observation and every derived file say `SYNTHETIC_TOOLING_TEST_ONLY`; no real child action or conclusion is synthesized.

## Screenshot set

The technical evidence set contains:

1. `01-default-root-world-desktop.webp`
2. `02-default-root-world-mobile.webp`
3. `03-classic-hub-explicit-route.webp`
4. `04-route-title-identity.webp`
5. `05-canonical-origin-preflight.webp`
6. `06-progress-continuity-pass.webp`
7. `07-progress-continuity-blocked.webp`
8. `08-second-use-observer-ready.webp`
9. `09-second-use-child-root-clean.webp`
10. `10-first-destination-forest.webp`
11. `11-returned-to-world.webp`
12. `12-second-use-summary-fixture.webp`

These are rendered tooling states with no real child identity and are not child-usability evidence.

## Independent acceptance

A separate read-only pass must verify exact feedback and both `YES` values; default world and explicit classic hub; all ten games; priority and Pages-safe routing; canonical origin; fail-closed continuity without synthetic reconstruction; clean unbiased child UI; technical first-destination derivation; answer-free observer; frozen gameplay/world/content; absence of new art, pressure mechanics, PII, and network; complete tests/build; and no claim that a real second-use occurred. Sev-1 or Sev-2 findings must be fixed before closeout.
