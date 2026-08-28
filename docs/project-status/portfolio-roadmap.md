# Game-Codex Portfolio 长期路线

> 路线只描述产品阶段，不创建空的儿童世界占位页；每个替代入口必须成熟并验证后，才退役对应经典大厅独立入口。

## 1. Foundation — COMPLETE

Portfolio 真源、分级门禁、安全维护事务、CI 与 Pages 组合验证。

## 2. Math World — COMPLETE

数感实验城与五个自由开放站点。

- 发布 tag：`math-world-v1.0.0`
- 当前 route：`?world=math-world`

## 3. Chinese Consolidation — COMPLETE

墨迹森林、声韵试炼与字光配对完成收拢。

- 发布 tag：`chinese-consolidation-v1.0.0`
- 当前 route：`?play=hanzi-magic-complete`

## 4. English V2 — COMPLETE

词光岛五个区域、词光册、句子任务与 English Memory。

- 发布 tag：`english-world-v2.0.0`
- 当前 route：`?world=english-world`

## 5. Play Readiness — COMPLETE

首用、反馈、返回、存档保险箱、无障碍、性能与长期家庭使用准备。

- 发布 tag：`game-codex-play-ready-v1.0.0`
- 当前 route：`?world=my-game-world`

## 6. Natural-use Observation — ACTIVE

普通家庭使用已开始；Observation Kit 保持家长主动、本机最小化、默认零记录，只在自然出现的真实证据需要时使用。

- 发布 tag：`game-codex-observation-kit-v1.0.0`
- 当前 route：`?world=my-game-world&parent=observation`

## 明确授权的有界开发周期

- `portfolio-evolution-01`：`RELEASE-BOUND`；触发为 `EXPLICIT_USER_AUTHORIZATION`；发布 tag 为 `game-codex-portfolio-evolution-v1.0.0`。
- 完成条件：`RELEASE_TAG_TARGET`；只有 tag、CI 与 Pages 同 SHA 回读后才对外成立。
- Natural-use 影响：`ONGOING_NOT_CLOSED`；真人儿童验证：`NOT_PERFORMED_AND_NOT_CLAIMED`。

- `gameplay-coherence-02`：`RELEASE-BOUND`；触发为 `EXPLICIT_USER_AUTHORIZATION`；发布 tag 为 `game-codex-gameplay-coherence-v1.0.1`。
- 完成条件：`RELEASE_TAG_TARGET`；只有 tag、CI 与 Pages 同 SHA 回读后才对外成立。
- Natural-use 影响：`ONGOING_NOT_CLOSED`；真人儿童验证：`NOT_PERFORMED_AND_NOT_CLAIMED`。

## 终态边界

- `NEXT: Normal family use. New development only when real evidence or a reproducible defect exists.`
- 下一自动阶段：`NONE`
- 家庭稳定基线：`game-codex-family-stable-v1.0.0`（`8b890ff14880bcb576dd1ced37e14e6e3df28af1`）
- 真实儿童验证：`NOT_PERFORMED_AND_NOT_CLAIMED`
- Observation Kit：`READY`
- Natural-use evidence：`ACTIVE`
- Natural-use Observation 处于 ACTIVE，但工具仍为可选、家长主动、本机保存、默认零记录且没有规定频率；机器审核不冒充儿童兴趣、学习效果或保持度。
