# Game-Codex project instructions

## Project identity

This is a family-use children’s learning-game repository for literacy, mathematics, science, English, introductory chemistry, and parent-child play.

Keep the child interface clear, feedback understandable, and controls simple. Separate parent-facing explanation from the child play surface. Keep the project lightweight: no enterprise approval flows or speculative infrastructure.

## Architecture boundary

- `apps/hub/` is the shared game hub; `games/` contains individual games; move capabilities into `packages/` only when they are genuinely shared.
- Reuse the existing Vite/TypeScript/Phaser/DOM-overlay/local-storage architecture.
- Do not rewrite stable simulation/save/presentation code merely for cleanup.
- Do not modify unrelated games, duplicate shared logic, create abstractions for one-off use, or split small games into new repositories.
- For Hanzi Magic Battle V2, use `docs/hanzi-radical-battle-v2/README.md` as the current route and read only the related architecture/content/quality/status docs needed by the task.

## Child safety and privacy

Do not add backend child tracking, accounts, cloud child profiles, ads, payment, leaderboards, streak pressure, daily-login/FOMO mechanics, loot boxes, punitive progress loss, or humiliating failure copy.

Store only anonymous/minimum local state. Do not place a child’s real name, school, photo, address, or other identifying family data in repository code, screenshots, fixtures, or evidence packages.

Automated validation proves technical/content contracts only. Do not claim it proves real-child fun, learning effectiveness, or retention.

## Assets and learning content

- Prefer current approved runtime assets.
- Use simple SVG/CSS for genuinely simple graphical UI; for concrete/illustrative imagery, use approved assets or available image/search/generation tools and verify the result in the actual game.
- Do not hand a solvable visual task back to the user merely because higher-quality art takes more work.
- Never delete user-provided assets or move current shipped/accepted runtime assets without checking references and identity.
- Hanzi content changes must follow `docs/hanzi-radical-battle-v2/CONTENT-RULES.md` and use `hanzi-structure-quality`.

## Task lanes

The root selects one lane. `.agents/skills/SKILL_INDEX.md` and the selected Skill own full-route procedure; the five-line nested game instructions remain sufficient local additions in the bounded lane.

1. **Read/retrieval:** Read only the requested game/current source context. Do not create task roots, acceptance evidence, freezes, packages, cleanup transactions, or commits.
2. **Bounded correction:** Use for an isolated wording, answer, equation, diagram, layout/style, or local bug with a known affected surface when it does not alter learning objectives, progression/sequence, content/question set, interaction model, assessment design, shared hub/routes/persistence/runtime/schema, child privacy, or release state. Run directly affected tests and exercise the affected page/interaction in a representative browser. Check hub/entry/return only when navigation can be affected.
3. **New/substantial:** Use for a new game or a change to learning objectives, progression/sequence, content/question set, interaction model, assessment design, or child-facing control/accessibility behavior across screens. Read the Skill index, select the smallest relevant Skill, and run its full development and machine-review route.
4. **Shared/high-risk/release:** Use for shared hub/routes/persistence/runtime/schema/state, migrations, child privacy or real family data, deployment/release, destructive asset/state work, or another shared contract. Run machine acceptance plus only the required affected-consumer, migration, privacy, and release gates.

Routine UX, visual, accessibility, interaction, and regression review belongs to Codex first. Include real-browser validation when pointer, touch, keyboard, tutorial, responsive, or navigation behavior changes. On failure, fix the cause and rerun the affected check; broaden only when the failure shows wider impact.

Use `machine-first-game-review` for lane 3, lane 4, or an explicit readiness/acceptance request. A bounded correction does not enter acceptance merely because it changes game files. Keep evidence proportional to the selected route.

## Git

Stay on the current branch, preserve unrelated work, and normally make one final commit and one push. Do not rewrite history, force-push, or modify existing tags without explicit authorization.

## Task closure and cleanup

- Use `tmp/tasks/<TASK_ID>/`, source freezes, return ZIPs, manifests, retention tiers, and cleanup plan/apply/verify only when the selected route or requested handoff requires them.
- Validate source before packaging. When a ZIP is required, preserve its final bytes/hash through cleanup and retain only the required handoff or minimum blocked diagnostics.
- Clean only task-created scratch unless an authorized maintenance route names exact additional targets. Deletion uses explicit validated paths, never broad globs.
