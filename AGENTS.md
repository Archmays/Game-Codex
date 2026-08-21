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
- Never delete user-provided assets or move formal runtime assets without checking references and identity.
- Hanzi content changes must follow `docs/hanzi-radical-battle-v2/CONTENT-RULES.md` and use `hanzi-structure-quality`.

## Skills and task routing

For a nontrivial learning-game/product task, read `.agents/skills/SKILL_INDEX.md` and use the smallest relevant Skill. Do not perform broad Skill discovery for ordinary Git/docs/localized maintenance.

Do not print a boilerplate Skill audit at the start and end of every response. Mention the Skill only when it materially affects the work, validation, or handoff.

## Machine-first review

Routine UX, visual, accessibility, interaction, and regression review belongs to Codex first, not to the user.

- For nontrivial game behavior/content/UI changes, use `machine-first-game-review` with the project’s current discovery/acceptance route.
- For a small localized fix with a known failure and no new product/learning behavior, a targeted test plus affected-page/browser check is sufficient unless the project’s current quality gate requires more.
- Run the affected game/page and directly affected tests. Check the hub/entry/return flow when the change can affect navigation.
- If pointer/touch/tutorial/responsive behavior changes, include real-browser validation.
- On failure, identify the root cause, revise, and rerun the affected check. Do not stop merely because a fixed number of attempts was exhausted.
- Escalate only genuine safety/privacy risk, irreversible publication, missing credential/permission, an unresolved value choice, or an inherently real-human behavior question.

Keep final evidence proportional to risk; do not generate large process packs for ordinary fixes.

## Git

Stay on the current branch, preserve unrelated work, and normally make one final commit and one push. Do not rewrite history, force-push, or modify existing tags without explicit authorization.

## Task closure and cleanup

- Use `tmp/tasks/<TASK_ID>/` for non-trivial task discovery, working files, tests, screenshots, reports, and package staging; none of these process files enter Git.
- Validate the final source tree before creating one return package. Then run the maintenance cleanup plan, apply, and verify stages.
- Confirm the final return ZIP bytes and SHA-256 are unchanged by cleanup, remove every task T3 transient, and retain only the current handoff.
- A blocked task may retain only the minimum recovery diagnostics and one blocked ZIP. Never accumulate round, retry, or changed-only packages.
- Maintenance deletion uses explicit manifest paths and hashes, never broad globs. Routine QA remains Codex's responsibility.
