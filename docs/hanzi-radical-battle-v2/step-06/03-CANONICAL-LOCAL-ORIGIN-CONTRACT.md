# Canonical Local Origin Contract

## One family origin

The formal long-lived family entry is exactly:

```text
http://127.0.0.1:5175/
```

`http://localhost:5175/`, `http://127.0.0.1:5173/`, `http://127.0.0.1:5176/`, another browser profile, and private/incognito storage are not aliases. The STEP 04 real first-use progress belongs to the canonical `127.0.0.1:5175` origin.

## Family launcher

`tools/my-game-world/START_MY_GAME_WORLD.cmd` delegates to the PowerShell launcher, resolves the repository, checks Node and pnpm, binds Vite to `127.0.0.1:5175`, safely reuses only a matching repository/command/port server, opens `/`, preserves localStorage, and prints the exact URL. A process on the port that cannot be proven to be the expected repository Vite instance blocks startup.

`tools/my-game-world/STOP_MY_GAME_WORLD.cmd` stops only the PID recorded by the launcher after revalidating PID, command, repository root, and port. It never kills an unrelated process, clears localStorage, deletes a save, or modifies Git. `pnpm run play:my-game-world` provides the same fixed host and port without changing the global `pnpm dev` default.

## Official continuity gate

Before an official child route opens, all conditions must hold:

- the runtime origin is exactly `http://127.0.0.1:5175`;
- the canonical Golden Slice save key exists and storage is available;
- the canonical save validates without corruption recovery;
- `completedRuns > 0` and the accepted first run is complete;
- the spellbook contains exactly the required discoveries `明`, `花`, `林`, and `星` (IDs `ming`, `hua`, `lin`, `xing` may be used in the safe projection);
- camp repairs project to `lamp=true`, `flowers=true`, `guardianTrees=true`, and `starPath=true`.

The exported projection contains only `originMatched`, `canonicalSavePresent`, `completedAndComplete`, `discoveredCharacterIds`, `campRepairFlags`, and `recoveredFromCorruption`; it never contains the whole save.

Any mismatch yields `SECOND_USE_PROGRESS_CONTINUITY_BLOCKED`, does not open the official child route, and explains the local cause: wrong origin, wrong browser profile, private mode/storage unavailable, cleared or missing save, incomplete save, or corruption. The observer never recreates, repairs, imports, or synthesizes real progress from first-use evidence. Normal `/` remains usable with fresh local state, but that play is not continuity evidence.

Fixture mode may install an isolated complete save projection solely for automated tooling checks. Every fixture export is labelled `SYNTHETIC_TOOLING_TEST_ONLY` and can never become `REAL_CHILD_SECOND_USE`.
