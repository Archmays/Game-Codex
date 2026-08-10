# STEP 06 Canonical Origin Evidence

## Contract

The only official family origin is `http://127.0.0.1:5175/`. It preserves the origin under which STEP 04 real first-use progress already exists. `localhost:5175`, ports 5173/5176, another browser profile, private mode, missing storage, and cleared or corrupt storage are not continuity aliases.

## Launcher evidence

The final family launcher:

- resolves `D:\ChatGPT-Codex-Projects\Game-Codex` from its own path;
- requires existing Node, pnpm, and this repository's Vite CLI;
- launches Vite with the repository as both the explicit positional root and working directory;
- requires host `127.0.0.1`, port `5175`, and `--strictPort`;
- verifies the live listener's PID, command line, Vite path, explicit repository root, start time, host, and port before reuse or stop;
- records only the proven server and never clears browser storage.

Final runtime evidence: PID `40240` answered HTTP 200 at the canonical root, was reused without changing PID, then was stopped by the exact recorded STOP launcher. Port 5175 no longer listened and the server record was removed. Game progress and localStorage were not cleared or rewritten.

## Continuity gate evidence

The gate directly parses the canonical Golden Slice save and requires `completedRuns > 0`, spellbook IDs `ming/hua/lin/xing`, lamp plus all three derived repair flags, and no corruption recovery. Wrong host/port, unavailable storage, missing save, partial STEP 02 state, invalid JSON/schema, incomplete spellbook, and incomplete repairs return `SECOND_USE_PROGRESS_CONTINUITY_BLOCKED`. A normal fresh world remains usable outside official evidence mode.

Synthetic complete progress exists only behind the exact `SYNTHETIC_TOOLING_TEST_ONLY` fixture marker and is never used to authorize a real official continuity check.
