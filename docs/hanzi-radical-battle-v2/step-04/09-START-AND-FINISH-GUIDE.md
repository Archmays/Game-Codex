# START and FINISH guide

## Real local session

From `tools/hanzi-v2-step04/` run:

```powershell
.\START_STEP_04_CHILD_FIRST_USE.cmd
```

START checks Node/pnpm and existing dependencies; canonical feedback SHA and exact `YES`; accepted review identity; frozen encounter/ability/boss/Theme C/manifest hashes; and STEP 04 targeted tests. It creates high-entropy session, seed, launch nonce, build identity, and parent-authorization identity; starts a strict loopback Vite port; records PID/process ownership under `tmp/hanzi-v2-step04`; and opens only the parent preflight.

The parent URL carries opaque session/build/launch values, exact commit SHA, and URL-escaped session/build/authorization timestamps (`started`, `generated`, `checked`). These values reproduce the START identity; the browser must not invent fallback identity for a real session. START never opens the child route. READY plus `SOUND_OK` or `START_MUTED` plus an observer-mode choice creates the short-lived browser grant and opens the child route.

Use `-NoBrowser` for automated readiness checks. It prints the parent URL without clicking READY or creating a child result.

## Finish and package

After the browser exports `STEP-04_CHILD_FIRST_USE_OBSERVATION.json`, run:

```powershell
.\FINISH_STEP_04_CHILD_FIRST_USE.cmd
```

FINISH looks in Downloads first and then `artifacts/hanzi-radical-battle-v2/step-04/observation-inbox/`, unless `-ObservationPath` is supplied. It validates schema, privacy, session/build/feedback identity, sequence, and evidence kind before copying anything.

Valid real output is copied to the untracked local observation folder and packaged as:

```text
artifacts/hanzi-radical-battle-v2/step-04/STEP-04_CHILD_FIRST_USE_RETURN_TO_CHATGPT.zip
```

The package contains the fixed observation JSON, separated summary, build identity, parent-authorization identity, schema, privacy validation, commit SHA, and package manifest. FINISH prints its SHA-256 and stops only the exact recorded STEP 04 server. It never stages or commits observation data.

## Synthetic dry-run

Codex/automation may run only fixture/NoBrowser mode:

```powershell
.\START_STEP_04_CHILD_FIRST_USE.ps1 -FixtureMode -NoBrowser
.\FINISH_STEP_04_CHILD_FIRST_USE.ps1 -FixtureMode -ObservationPath <fixture-json> -OutputRoot <non-canonical-temp-root>
```

Fixture START creates `SYNTHETIC_TOOLING_TEST_ONLY` data under `tmp/hanzi-v2-step04/fixtures/`; it never uses Downloads or the real inbox. Fixture FINISH refuses the canonical artifact root and creates a visibly synthetic package. It must never be described as a child session or pass.

`-NoBrowser` validates the launcher/FINISH contract without clicking a UI. The automated STEP 04 E2E and readiness capture separately exercise preflight → an explicitly marked `fixture=1` child route → same-origin observer sync → stop/export. A fixture grant and a real grant are rejected if their route markers are interchanged, and the fixture child surface always displays `SYNTHETIC_TOOLING_TEST_ONLY · NO CHILD DATA`.

## Safe process ownership

Port `5175` is strict. If occupied by an unrecorded or mismatched process, START refuses it and kills nothing. PID reuse is guarded by task, repository, port, Vite path/arguments, and process start time. FINISH likewise refuses to stop an unknown process.
