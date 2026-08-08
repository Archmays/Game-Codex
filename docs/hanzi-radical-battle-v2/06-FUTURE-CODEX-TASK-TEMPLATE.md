# 未来 Codex 任务模板

将以下内容作为每个汉字魔法战 V2 任务的固定开头与收尾。只填写与当前任务真实相关的项；不得用模板扩大授权范围。

## 任务开始

```text
Initiative: hanzi-radical-battle-v2
Current phase: <FOUNDATION | GOLDEN_SLICE_CANDIDATE | CHILD_PLAYTEST_READY | REVISE | PROMOTED>

Required reads completed:
- docs/hanzi-radical-battle-v2/00-NORTH-STAR.md
- docs/hanzi-radical-battle-v2/00-NORTH-STAR.json
- docs/hanzi-radical-battle-v2/03-TRACEABILITY-MATRIX.md
- docs/hanzi-radical-battle-v2/04-DECISION-LOG.md
- .agents/skills/SKILL_INDEX.md

Applicable Skills read:
- <skill-id + canonical path>

Paths allowed to change:
- <exact path(s)>

Child-experience question to validate:
- <one observable question>

Traceability row(s):
- <existing feature row(s), or decision-log entry required before work>

Explicitly not doing:
- <scope exclusions>

Four-question gate:
1. More like play than practice? <yes + evidence>
2. Character-building remains the core action? <yes + evidence>
3. Understandable with little parent explanation? <yes + validation path>
4. Avoids anxiety, manipulation, shame, and compulsive retention? <yes + evidence>
```

If any four-question answer is “no” or cannot be supported, stop that sub-change and record `REJECTED_FOR_NOW` or `NEEDS_USER_DECISION`; continue only unaffected authorized work.

## 任务结束

```text
Changed paths:
- <exact paths>

Traceability status updated:
- <row -> state>

Decision log updated:
- <decision ID, only if a real decision occurred; otherwise none>

Guardrail validation:
- pnpm run validate:hanzi-v2-foundation: <PASS/FAIL + result>
- prohibited mechanic/dependency scan: <PASS/FAIL + result>
- scope expansion check: <PASS/FAIL + result>

Technical evidence:
- targeted tests: <command + result>
- browser/device flow: <environment + result>
- screenshots: <identity-bound paths or none with reason>
- build: <command + result>

Human evidence still required:
- <child/parent/teacher observation or acceptance>

Current state:
- <FOUNDATION | GOLDEN_SLICE_CANDIDATE | CHILD_PLAYTEST_READY | REVISE | PROMOTED>

Explicitly not claimed:
- Code completion is not game success.
- Automated PASS is not child, parent, or teacher acceptance.
```

Before handoff, verify no Godot, backend/account, cloud child tracking, daily-login reward, streak pressure, leaderboard, loot box, FOMO timer, punitive progress loss, shaming failure language, unapproved >12-character manifest, other-game rewrite, or pre-playtest full expansion entered the diff.
