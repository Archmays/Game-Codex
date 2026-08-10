# STEP 06 Test Summary

## Automated validation

| Check | Result |
| --- | --- |
| `pnpm run validate:hanzi-v2-foundation` | PASS — 12/12 |
| `pnpm run validate:hanzi-v2:step03` | PASS — STEP 03 28/28 plus foundation |
| `pnpm run validate:hanzi-v2:step04` | PASS — STEP 04 27/27 plus foundation |
| `pnpm run validate:hanzi-v2:step05` | PASS — STEP 05 38/38 plus foundation |
| `pnpm run validate:hanzi-v2:step06` | PASS — foundation 12/12, STEP 06 25/25, TypeScript PASS |
| `pnpm run test:hanzi-v2:step06` | PASS — 9 files, 25/25 |
| `pnpm run test:e2e:hanzi-v2:step06` | PASS — final-SHA Chromium 8/8 |
| `pnpm test` | PASS — 62 files, 345/345 |
| `pnpm build` | PASS — TypeScript and Vite production build, 224 modules |

Vite emitted only its existing non-blocking large-chunk advisory for Phaser. No dependency or lockfile changed.

## Browser coverage

The final E2E run covered desktop/mobile/tablet default world, repaired state, spellbook and treasure choices, explicit ten-game classic hub, classic game enter/return, forest entry and full run, world return, route title/theme, observer preflight, wrong-origin block, complete-progress acceptance, clean instrumented child root, all three first destinations, cross-navigation events, stop, reduced motion, 44 px controls, console/page errors, privacy, and no remote request. All eight tests passed and regenerated the twelve required WebP screenshots against final HEAD.

## Launcher and fixture checks

- `START_MY_GAME_WORLD.cmd -NoBrowser`: PASS at `http://127.0.0.1:5175/`.
- Exact same repository/port reuse: PASS with PID `40240`.
- `STOP_MY_GAME_WORLD.cmd`: PASS; the recorded PID stopped, the record was removed, and port 5175 no longer listened.
- Windows PowerShell parser/encoding: PASS for ten launcher files (CRLF, UTF-8 without BOM; CMD ASCII).
- Initial fixture probing exposed unavailable `Get-FileHash` in Windows PowerShell; the final second commit replaced it with .NET SHA-256 and an exact feedback-hash probe passed.
- `START_STEP_06_SECOND_USE_CHECK.cmd -FixtureMode`: final PASS; produced only `SYNTHETIC_TOOLING_TEST_ONLY`, bound to final HEAD.
- `FINISH_STEP_06_SECOND_USE_CHECK.cmd -FixtureMode`: final PASS; strict schema, identity, sequence, continuity, privacy, stop, summary, and ZIP packaging passed.
- Synthetic observation SHA-256: `984FE8BFD964A24E20C8DBD8AC29CA02F827868DAA9400D0CEE8A23FC5EA589D`.
- Synthetic return ZIP SHA-256: `FB5F5EF7A5DEF269B35F80CAC3E83F9450C87B3D5E6AD2E90CA3B0DFF21B55EE`.

No real second-use session was run.
