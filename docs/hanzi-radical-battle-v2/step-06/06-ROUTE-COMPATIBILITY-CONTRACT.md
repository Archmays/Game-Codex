# STEP 06 Route Compatibility Contract

## Dispatch order

The application resolves one surface in this fixed order:

1. `play`
2. `observe`
3. `review`
4. explicit `hub`
5. explicit `world` alias
6. default world

This preserves direct Golden Slice play, child-first-use, STEP 02/03/05 review, STEP 04/06 observation, and fixture routes. `/` and `?world=my-game-world` render the same world. `?hub=classic` and `?hub=classic&from=world` render the existing ten-game catalogue through one wrapper. Unknown or malformed evidence/session values do not acquire observer privileges.

## Base-safe transition table

| From | To | Normal route requirement | Authorized STEP 06 requirement |
| --- | --- | --- | --- |
| World | Forest | query-relative Golden Slice route | preserve `evidence` + validated `session` |
| Forest | World | query-relative world alias or Vite-base-safe root | preserve context and mark `from=forest` |
| World | Spellbook | local world surface | preserve context inside the world |
| World | Classic hub | `?hub=classic&from=world` | preserve context |
| Classic hub | World | query-relative world route | preserve context and mark `from=classic-hub` |

No return link may hard-code `/` inside a GitHub Pages project subpath. Browser history must not redirect between the alias and default route or form a loop.

## Instrumented child route

The official child entry is `/?evidence=hanzi-v2-step06&session=<sessionId>`. It must be visually and textually identical to ordinary `/`: no session, version, test, fixture, observer chrome, answer, timer, or preferred destination is visible.

The grant is local, short-lived, bound to the exact STEP 05 authorization, final STEP 06 commit, canonical origin, interval choice, and continuity projection. Without a valid grant, an evidence-bearing route fails closed with a neutral parent-facing message and does not enter recording mode. Ordinary `/` stays available.

## Classic compatibility

The classic wrapper imports the canonical catalogue and leaves all ten entries, game code, entry behavior, and catalogue return behavior intact. It adds only the explicit world return. Tests that mean “classic hub” navigate to `?hub=classic`; their existing assertions are retained rather than weakened.
