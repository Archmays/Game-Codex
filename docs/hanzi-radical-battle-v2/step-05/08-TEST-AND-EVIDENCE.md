# STEP 05 Test and Evidence

## Required automated gates

- foundation validation;
- STEP 03 regression;
- STEP 04 regression;
- STEP 05 targeted unit/contract tests;
- STEP 05 Playwright E2E;
- full Vitest suite;
- TypeScript and Vite production build.

STEP 05 targeted coverage includes voice anti-spoiler, v1→v2 observation migration, immutable evidence reconciliation, no/partial/repaired/corrupt world state, child-facing copy, route/context gating, semantic/content freeze, privacy, review identity/export, and settings preservation.

## Browser evidence

The E2E run covers default `/`, private world, repaired camp, spellbook, forest, treasure box, classic ten-game hub, complete→world return, keyboard and pointer use, reduced motion, desktop/tablet/mobile viewports, no remote request, no console/page error, and review export.

Required privacy-safe screenshots are written under `artifacts/hanzi-radical-battle-v2/step-05/screenshots/`:

1. `01-world-home-desktop.webp`
2. `02-world-home-mobile.webp`
3. `03-world-home-tablet.webp`
4. `04-repaired-camp.webp`
5. `05-world-spellbook.webp`
6. `06-world-forest-portal.webp`
7. `07-world-treasure-box.webp`
8. `08-classic-hub-wrapper.webp`
9. `09-run-complete-return-world.webp`
10. `10-audio-context-matrix.webp`
11. `11-evidence-reconciliation.webp`
12. `12-parent-review-summary.webp`

Automated PASS establishes technical readiness only. It cannot mark any parent decision, authorize the default route, validate learning, or replace a real second-use observation.

## Final evidence record

The final technical run on 2026-08-09 recorded:

| Command | Result |
| --- | --- |
| `pnpm run validate:hanzi-v2-foundation` | PASS — 1 file, 12 tests |
| `pnpm run validate:hanzi-v2:step03` | PASS — foundation 12/12, STEP 03 9 files and 28 tests, TypeScript |
| `pnpm run validate:hanzi-v2:step04` | PASS — foundation 12/12, STEP 04 7 files and 27 tests, TypeScript |
| `pnpm run validate:hanzi-v2:step05` | PASS — foundation 12/12, STEP 05 9 files and 38 tests, TypeScript |
| `pnpm run test:hanzi-v2:step05` | PASS — 9 files, 38 tests |
| `pnpm run test:e2e:hanzi-v2:step05` | PASS — 4 browser tests and all 12 required WebP files |
| `pnpm test` | PASS — 53 files, 320 tests |
| `pnpm build` | PASS — TypeScript and Vite build, 211 modules transformed |

The closeout report and technical ZIP record screenshot identities, independent acceptance findings, Git commit, and package SHA-256. These results establish technical candidate readiness only; real parent review remains a separate gate.
