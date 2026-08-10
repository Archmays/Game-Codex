# STEP 06 Diff Summary

Final range: `c46e660396257767692e94d61263b4662a11ccfb..8e00aa61d796578f7e593243caa514da5a307189`

Git reports 66 files changed, 3708 insertions, and 110 deletions.

## Product and routing

- Promoted the accepted world to `/`; retained `?world=my-game-world`; made classic catalog explicit at `?hub=classic`.
- Added a pure route-priority resolver and query-only evidence propagation without replacing `apps/hub` or `packages/data/gameCatalog.ts`.
- Updated browser titles/theme and the existing hub-targeted E2E URLs.

## Continuity and local launch

- Added exact `127.0.0.1:5175` family START/STOP tooling with repository-root, PID, command, host, and port validation.
- Added a raw canonical-save continuity gate and a fixture-only synthetic save builder. Official routes never invoke synthetic reconstruction.

## Second-use tooling

- Added the local event schema/bridge/grant/privacy layer, parent observer, strict observation export, START/FINISH scripts, and a clearly labelled fixture contract.
- Added nine STEP 06 unit files, one 25-scenario browser specification, a fixed-port Playwright config, and six package scripts.
- Added the requested STEP 06 contracts and expanded the existing child observation Skill with a distinct second-use/re-entry section.

## Frozen and untouched

- Encounter, hand, ability, boss, animation timing, accepted Theme C content, four-character set, world copy, and three-object hierarchy remain frozen.
- The only Golden Slice runtime edit lets the existing `initialMuted` option support the authorized second-use `START_MUTED` mode; it does not change simulation truth or persistent progress.
- No new dependency, art asset, remaining character, persuasive mechanic, account, backend, network request, service worker, or notification was added.
- No other game runtime code changed; only their classic-hub E2E entry URLs were made explicit.
