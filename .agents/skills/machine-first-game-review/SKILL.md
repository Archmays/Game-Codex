---
name: machine-first-game-review
description: Run evidence-backed machine review, bounded automatic repair, and source-bound closeout for Game-Codex browser games, shared world routes, and adult observer or review tools.
---

# Machine-First Game Review

Use this Skill for implementation acceptance or formal readiness work involving gameplay, child-facing game UI, shared routes, persistence, accessibility, responsive behavior, privacy, or browser evidence. It owns routine machine QA; it does not create claims about unobserved real-child, parent, or teacher behavior.

## Six review layers

1. Source and identity: freeze the authorized question, changed paths, route/catalog inventory, accepted content, non-goals, and exact source identity.
2. Deterministic behavior: validate rules, persistence, migration, corrupt recovery, state invariants, and public transitions.
3. Browser lifecycle: validate route precedence, multi-page observer continuity, disconnect/reconnect, fallback, reload, history, stop, and conflicts.
4. Presentation and access: validate responsive layout, document scroll, keyboard/focus/targets, landmarks/headings/dialogs, reduced motion, and deterministic visual/ARIA states.
5. Runtime and privacy: require no console/page errors, explicit same-origin accounting, zero forbidden external requests, denylisted PII, and local minimum evidence.
6. Semantic review: run child-first UX, visual/accessibility, and adversarial QA rubrics independently against shared raw evidence, then merge findings.

## `DISCOVERY_MODE`

- Read applicable guardrails and discover the real source/evidence shape before relying on expected paths.
- Do not fail fast on a missing historical artifact when safe reconnaissance can establish the actual state.
- Complete semantic reconnaissance before the first product mutation.
- Freeze a closure charter containing every known finding, disposition, allowed dependency closure, stop condition, and repair limit.
- Treat references and candidates as non-accepted until exact-source acceptance proves otherwise.

See [recovery-and-source-freeze.md](references/recovery-and-source-freeze.md).

## `ACCEPTANCE_MODE`

- Fail closed on missing, stale, conflicting, or source-mismatched evidence.
- Run targeted dependency checks first, then the complete required regression and browser matrix.
- Accept a visual/ARIA candidate semantically before baseline establishment, run no-update verification against that establishment, then seal promotion from both command records.
- Re-run formal evidence and semantic reviewers on one unchanged final source tree.
- Derive reports and verdicts from canonical evidence rather than hand-written status.

See [lifecycle-and-evidence.md](references/lifecycle-and-evidence.md).

## Verdict

Emit exactly one:

- `PASS_MACHINE`: every hard gate passes, no Sev-1/2 or blocker remains, required profiles and matrices pass, no critical reviewer conflict exists, and final tests/build pass on the same tree.
- `AUTO_REVISE`: an in-scope deterministic repair remains within the frozen limit.
- `ESCALATE_HUMAN`: the remaining decision genuinely requires human authority or the bounded repair limit is exhausted.

## Auto-repair

Record each finding before mutation. Apply the smallest authorized repair, then rerun its dependency-affected logic, browser, semantic, and shared safety gates. A repair may close regressions it directly caused; it may not absorb unknown pre-existing product work, weaken gates, update baselines to manufacture a pass, or widen child data collection.

## Human escalation

When a repair fails, reclassify the root cause and change the test, implementation, or tool approach; do not stop because a fixed retry count was reached. Escalate only for real-child behavior the task genuinely depends on, value or preference choices, irreversible privacy/publication decisions, credentials or external permissions, or unresolved critical machine-reviewer disagreement. Provide one evidence-backed question and do not ask the user to perform routine UX, accessibility, browser, visual, or QA review.

## Phase closeout

After acceptance, record the final source freeze, run the final same-tree evidence/report sequence, verify any pushed commit, build the return package, then apply manifest-driven retention and cleanup. Preserve protected human evidence and make no claim about child fun, learning, retention, or promotion from synthetic tooling.

See [retention-and-cleanup.md](references/retention-and-cleanup.md).
