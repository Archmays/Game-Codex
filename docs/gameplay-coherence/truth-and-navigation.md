# Truth and Navigation

## Portfolio layers

| Concept | Current truth |
| --- | --- |
| Mount definitions | 9; all retained for runtime/adapter compatibility. |
| Top-level child products | 3: `hanzi-radical-battle`, `math-lab`, `english-spell-battle`. |
| Classic backup cards | The same 3 top-level products. |
| World modules | 11; nested child activities with explicit mount, runtime owner, host product/world, profile, route, and runtime saves. |
| Compatibility surfaces | 6; Classic plus retained legacy routes/adapters, distinct from products. |
| Shared engines | 2; Memory Match and game-core local storage. |
| Play surfaces | 39 current surfaces, 5 primary first-use surfaces. |
| Save inventory | 37 exact known keys; no namespace deletion. |

`CLASSIC_CARD_EXCEPTIONS` is intentionally empty. `portfolio:check` fails if a nested `world-module-mount` becomes a Classic card without a non-empty, identity-bound exception record; the governance test proves both rejection and explicit-exception behavior.

## Math World runtime truth

| Station | Mount / runtime owner | Host product/world | Profile | Runtime save | Canonical route |
| --- | --- | --- | --- | --- | --- |
| Lab | `math-lab` | `math-lab` / math | `a-core-world` | `math-battle-web/save-v1` | `?world=math-world&station=lab` |
| Clock | `clock-reader` | `math-lab` / math | `c-module` | `family-games/clock-reader` | `?world=math-world&station=clock` |
| Array | `multiplication-adventure` | `math-lab` / math | `c-module` | `family-games/multiplication-adventure` | `?world=math-world&station=array` |
| Target | `make-target` | `math-lab` / math | `b-independent-puzzle` | `family-games/make-target` | `?world=math-world&station=target` |
| Slider | `equation-slider` | `math-lab` / math | `s-equation-release` | `family-games/equation-slider` | `?world=math-world&station=slider` |

Every station also declares the Math World host save `family-games/math-world/v1`; host save and runtime save are separate fields and only combined where a consumer needs both.

## Navigation and continuation

- Math map → station uses `history.pushState`; direct station URLs and refresh remain canonical.
- Back/forward synchronizes the station with the URL and restores the map station button or station heading focus only after navigation, not on a passive direct load.
- Map return restores the originating station button. Visited state says `上次来过`; the most recent station says `继续这里` without claiming completion or mastery.
- Equation's internal route-map exit says `回数学世界地图` and calls the Math World host exit.
- A valid Equation `lastLevelId` opens on mount; first-use tutorial behavior remains attached only to `es-1-01`.
- Four chapters, 200 IDs, solver/generator/hints, S gates, progress namespace, legacy save read, and direct route remain unchanged.
