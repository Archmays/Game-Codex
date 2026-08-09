# Skill Index

This is the single Skill root for Game-Codex. Resolve paths exactly as written; `$CODEX_HOME` means the active Codex home (normally `C:/Users/mays-/.codex` on this machine). Do not create a second `skill/` or `.codex/skills/` tree in this repository.

## Required load order for Hanzi Radical Battle V2

1. Read the initiative guardrail documents named in `AGENTS.md`.
2. Load `child-first-learning-game` for any child-facing experience or promotion decision.
3. Load `hanzi-structure-quality` for any character, component, structure, word, pronunciation, meaning, image, or playable-manifest change.
4. Load only the technical or discipline Skill needed for the bounded task.
5. Treat real child, parent, or teacher acceptance as independent from automated PASS.

## Canonical routes

| Skill ID | Canonical path | Source identity | Use when | Project constraint |
| --- | --- | --- | --- | --- |
| `child-first-learning-game` | `.agents/skills/child-first-learning-game/SKILL.md` | Project-local, STEP 01 | Child experience, UI, feedback, retention, accessibility, privacy, or playtest gates change | Child-first and healthy-interest rules are mandatory |
| `hanzi-structure-quality` | `.agents/skills/hanzi-structure-quality/SKILL.md` | Project-local, STEP 01 | Hanzi data, slots, combinations, words, images, or manifests change | Adult content/age-fit review remains required |
| `family-education-game-autopilot` | `$CODEX_HOME/skills/family-education-game-autopilot/SKILL.md` | Global installed Skill | Bounded audit or improvement rounds for family learning games | Follow its phase/status reporting; do not infer human acceptance |
| `game-studio` | `$CODEX_HOME/plugins/cache/openai-curated/game-studio/27126220/skills/game-studio/SKILL.md` | OpenAI `game-studio@openai-curated` 0.1.2, source commit `11c74d6ba24d3a6d48f54a194cd00ef3beea18f9` | Route a browser-game task to the smallest relevant Game Studio workflow | Plugin is installed and enabled; do not vendor a duplicate |
| `web-game-foundations` | `$CODEX_HOME/plugins/cache/openai-curated/game-studio/27126220/skills/web-game-foundations/SKILL.md` | Same OpenAI plugin identity | Browser-game loop, state, input, pause, persistence, and performance foundations | Local-only persistence; no backend |
| `phaser-2d-game` | `$CODEX_HOME/plugins/cache/openai-curated/game-studio/27126220/skills/phaser-2d-game/SKILL.md` | Same OpenAI plugin identity | Phaser 3 implementation or architecture changes | Simulation owns rules; Phaser scenes stay thin; DOM owns dense text |
| `game-ui-frontend` | `$CODEX_HOME/plugins/cache/openai-curated/game-studio/27126220/skills/game-ui-frontend/SKILL.md` | Same OpenAI plugin identity | HUD, menus, responsive layout, child-facing UI | Protect playfield; reduced motion; no dashboard-like child home |
| `sprite-pipeline` | `$CODEX_HOME/plugins/cache/openai-curated/game-studio/27126220/skills/sprite-pipeline/SKILL.md` | Same OpenAI plugin identity | Future sprite planning, generation, normalization, or validation | Not authorized in FOUNDATION; use only after an approved visual brief |
| `game-playtest` | `$CODEX_HOME/plugins/cache/openai-curated/game-studio/27126220/skills/game-playtest/SKILL.md` | Same OpenAI plugin identity | Browser playtest and screenshot evidence | Automation cannot substitute for Huang Xiaoyue's observation |
| `game-feel` | `.agents/skills/vendor/gamedev-skills/game-feel/SKILL.md` | `gamedev-skills/awesome-gamedev-agent-skills` commit `2bea8297d9f09d90d6720c0334221417f7c9a928`, Apache-2.0 | Tune a small number of high-value feedback moments | Avoid heavy shake/flashes; provide reduced motion; translate examples to Phaser |
| `audio-design` | `.agents/skills/vendor/gamedev-skills/audio-design/SKILL.md` | Same pinned repository and license | Plan or tune optional layered game audio | No network audio, no startling peaks, and silent play remains understandable |
| `save-systems` | `.agents/skills/vendor/gamedev-skills/save-systems/SKILL.md` | Same pinned repository and license | Version local save schema, validation, migration, and recovery | Translate file examples to defensive `localStorage`; no cloud save |
| `prototype-fast` | `.agents/skills/vendor/gamedev-skills/prototype-fast/SKILL.md` | Same pinned repository and license | Bound a golden-slice experiment to one observable question | Interpret as Minimum Lovable Prototype: small scope, but first spell, character, monster, one choice, camp change, and sound/visual feedback must be credible enough to test attraction |
| `level-design` | `.agents/skills/vendor/gamedev-skills/level-design/SKILL.md` | `gamedev-skills/awesome-gamedev-agent-skills` commit `2bea8297d9f09d90d6720c0334221417f7c9a928`, Apache-2.0 | Author the golden-slice critical path, teach/practice/test beats, pacing, and readable guidance | Translate spatial metrics to the fixed Phaser camera/playfield; keep the 3–5 minute slice and validate with child observation before dressing or expansion |
| `puzzle` | `.agents/skills/vendor/gamedev-skills/puzzle/SKILL.md` | Same pinned repository and license | Specify deterministic component-slot legality, resolution, undo, solvability, and input locking | Use a small pure rule state, not match-3 scoring/time pressure; wrong placement stays reversible and never labels the child as wrong |

OpenAI Game Studio 0.1.2 is MIT-licensed. The installed manifest, six routed Skill files, and four required reference files were SHA-256 matched to source commit `11c74d6ba24d3a6d48f54a194cd00ef3beea18f9` on 2026-08-09. The six vendored gamedev Skills retain upstream `LICENSE` and `NOTICE` at `.agents/skills/vendor/gamedev-skills/`.

## Selection rule

Use the minimum set that covers the task. Do not load asset, audio, save, or prototyping guidance merely because it exists. If a canonical path is unavailable, report the exact missing path and continue only with unaffected work; do not invent a replacement or claim it was read.
