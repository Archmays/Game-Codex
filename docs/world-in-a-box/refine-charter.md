# Four model rebuild — 2026-09-21

Start: `58cd16b7`, main, clean working tree. Scope: Elsa, Frauenkirche body/dome, six palace pieces plus their fixed support, Augustus bridge. Preserve 18/16 pieces, names, saves, routes, actions, Window Breeze and unrelated games. No new game mechanics. Authoring library is separate from scene assembly. Candidate exports are checked locally before commit/promotion.

Discovery from the current running game (1440×1000, isolated Chrome, real button assembly):

| Asset | Findings to repair |
|---|---|
| Elsa | Protruding bead eyes/nose/mouth; spherical jaw; horizontal fringe with no swept-back volume; nine ellipsoid braid beads; boots penetrate skirt at rest; cape is a rigid trapezoid |
| Church | Squat blank octagonal body; windows buried by octagon; random old-stone rectangles; ball corner roofs; narrow-waisted bulb dome and disconnected lantern |
| Palace | Thin unrelated columns; unarticulated rectangular permanent plinth; no continuous entrance/interior/crown structure; randomly spaced cone fins; crude rectangular doors |
| Bridge | Segmented wedges with conspicuous seams; square piers without cutwaters; blank spandrels and solid slab rails; abrupt bank connection |

Allowed dependency closure: the two scene builders, dedicated four-model library/authoring/import scripts, their two assembled blend/GLB exports and manifests, only necessary scene lighting coordination, scoped browser/geometry QA, source/reference/report/evidence files. No model reducer/save changes anticipated. Source baseline recorded in task scratch; final checks bound to final tree. Public input checks stay separate from fixed-camera/neutral-material visual diagnostics. Technical pass cannot override visible defects.

Stop after four assets and necessary integration, visual repair, input/action/save regression, build, scoped commit/push and independent CI/Pages verification. Any unresolved visual requirement must be reported as incomplete rather than promoted on test results alone. Six review layers are Codex review perspectives, not six human reviewers.

Regression finding before repair: exact boat berthing check failed even after `boatRunning=false`. The existing reducer enters lateral alignment when longitudinal error is below .001, without snapping longitude to the endpoint. A state at 5.7995 can therefore stop permanently short of 5.8. Include one bounded assignment in `dresden-model.ts` and a deterministic near-endpoint counterexample in the existing city test file; preserve route, speed, clearance, controls, save schema and the existing 0.0001 browser assertion. This is an existing numerical boundary exposed during required vehicle regression, not a model collision or a new transport feature.
