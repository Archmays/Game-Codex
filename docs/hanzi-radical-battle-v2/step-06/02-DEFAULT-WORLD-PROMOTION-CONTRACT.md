# Default World Promotion Contract

## Route result

| Route | Required surface |
| --- | --- |
| `/` | My Game World |
| `?world=my-game-world` | Alias to the same world |
| `?hub=classic` | Classic ten-game hub wrapper |
| `?hub=classic&from=world` | Classic ten-game hub wrapper with a world return |

Dispatch priority is fixed: `play` → `observe` → `review` → explicit `hub` → explicit world alias → default world. Default promotion must never intercept STEP 02/03/05 review, STEP 04/06 observation, direct Golden Slice, child-first-use, or E2E fixture routes. Unknown explicit values fail closed rather than silently becoming an authorized evidence route.

## Compatibility and navigation

The classic wrapper consumes the existing `apps/hub` and `packages/data/gameCatalog.ts`; it does not duplicate or rewrite the ten-game catalogue. Existing games still enter and return to the catalogue. The wrapper adds a visible `回我的游戏世界` route, and world-to-forest, forest-to-world, world-to-classic, and classic-to-world navigation stays query-relative or uses the Vite base. No project-subpath flow may encode `/` as an absolute return target.

During an authorized STEP 06 session, world, forest, spellbook, and classic-hub transitions preserve only `evidence=hanzi-v2-step06` and the validated `session` identity. Normal routes carry neither field.

## Browser identity

| Surface | `document.title` | `theme-color` |
| --- | --- | --- |
| Default world / alias | `我的游戏世界` | frozen Theme C world dark `#071c2a` |
| Classic hub | `游戏百宝箱` | classic hub identity |
| Ink Forest | `汉字魔法战 · 墨迹森林` | frozen Theme C identity |
| Review / observer | Adult-facing title | adult-facing identity |

The child world contains no teacher catalogue, version, session, test, or observer chrome. No PWA manifest, service worker, notification, remote request, or route redirect loop is introduced.

## Validation and value mapping

The child value is a direct return to the accepted adventure world with one obvious active portal and two optional objects. The Hanzi-learning value is continuity: the four discovered characters and repaired camp remain visible before any new play. Unit tests cover route priority, aliases, base-safe links, titles, and ten-game compatibility; browser checks cover desktop/mobile/tablet, forest entry, classic entry/return, and an instrumented child root that is visually identical to normal `/`.
