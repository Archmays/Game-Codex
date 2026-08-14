# AGENTS.md

## 项目定位

- 这是家庭使用的儿童学习游戏仓库，优先支持识字、数学、科学、英语、化学启蒙和亲子互动。
- 儿童界面应清楚、反馈明确、操作简单；家长说明与儿童游戏面分离。
- 保持轻量：一次任务连续完成，做最小完整修改和最小充分验证。不要引入企业审批流、数据库或额外治理平台。

## 目录与技术边界

- `apps/hub/` 是统一游戏大厅；`games/` 存放独立游戏；共享能力只在确有复用时进入 `packages/`。
- 汉字魔法战 V2 当前真源入口是 `docs/hanzi-radical-battle-v2/README.md`，源码在 `games/hanzi-radical-battle/v2/`，正式运行资产在 `public/assets/hanzi-radical-battle/v2/`，当前测试在 `tests/hanzi-v2/` 与 `tests/e2e/hanzi-v2/`。
- 延续 Vite、TypeScript、Phaser 3、DOM overlay 与防御性 `localStorage`。不得为整理而改写已验证的模拟、存档或表现层。
- 不修改无关游戏，不复制公共逻辑，不为单次使用新增抽象，不把小游戏拆成独立仓库。

## 产品与安全规则

- 不引入后端儿童追踪、账号、云端儿童资料、广告、支付、排行榜、连胜压力、每日登录奖励、FOMO、战利品箱、惩罚性进度损失或羞辱性失败文案。
- 只保存本地、匿名、最低必要状态。不得把儿童姓名、学校、照片或真实身份放入仓库、截图或证据包。
- 自动验证可以证明技术与内容 contract；不得把它写成真人儿童体验、乐趣或学习效果验证。真人观察可按用户明确要求开展，但不是日常开发或内容扩展的门禁。
- 汉字内容变化必须遵守 `docs/hanzi-radical-battle-v2/CONTENT-RULES.md`，并使用 `hanzi-structure-quality` Skill。

## 素材规则

- 优先复用当前正式资产。简单图标或基础图形可直接实现；需要位图插图时使用当前可用的 image generation、搜索或资产工具并验证运行效果。
- 只有工具、权限或必要源文件确实不可用时才记录 blocker；不要仅因素材精细度把 prompt 交回用户。
- 不删除用户素材；移动正式资产前必须证明引用并校验字节身份。

## Skill usage audit

非平凡的学习游戏或产品任务开始前，读取 `.agents/skills/SKILL_INDEX.md`，选择最小适用 Skill。普通 Git 操作不触发学习游戏 Skill，除非同时改变或评估游戏、学习内容、儿童可用性或 UI。

回复开头包含：

### Skill usage
- Selected skill(s): `<skill-id>` or `none`
- Skill path(s): canonical path or `none`
- Reason: one sentence

回复结尾包含：

### Skill audit
- Skill(s) actually used:
- Key rule(s) followed:
- Files read from the skill folder:
- Relevant skill not used, with reason:

只提供审计摘要，不披露私有推理。

## 汉字魔法战 V2 工作入口

对 `games/hanzi-radical-battle/` 或 V2 的非平凡工作，按需读取：

1. `.agents/skills/SKILL_INDEX.md`
2. `docs/hanzi-radical-battle-v2/README.md`
3. 与任务直接相关的 `ARCHITECTURE.md`、`CONTENT-RULES.md`、`QUALITY-GATES.md`、`DECISIONS.md` 或 `STATUS.md`

新功能必须说明儿童价值、汉字学习价值，以及自动验证路径；若目标本身是了解真实儿童行为，再另列观察路径。不要恢复 STEP 01–07、Golden Slice 审核或固定字数阶段流程。

## 验证与机器验收

- Game-Codex 修改默认使用 `machine-first-game-review`：首次改动前用 `DISCOVERY_MODE`，最终用 `ACCEPTANCE_MODE`，输出 `PASS_MACHINE`、`AUTO_REVISE` 或 `ESCALATE_HUMAN`。
- 修改后必须运行项目或受影响页面；检查大厅、已有入口、目标游戏进入与返回，并运行受影响测试。汉字 V2 的当前命令见 `docs/hanzi-radical-battle-v2/QUALITY-GATES.md`。
- 失败时重新分类根因，换测试、实现或工具方法，继续自动修复；不得因固定轮数耗尽而停止。
- 只在真实安全/隐私风险、不可逆发布、凭证或外部权限缺失、无法自动判断的价值取舍、或无法替代的真人行为问题上升级给用户。不要要求用户做例行 UX、视觉、无障碍或回归验收。
- 不为每次任务生成大套过程 evidence；最终保留与风险相称的简洁、同源验证结果。

## Git

- 留在当前分支，保护无关改动。一个任务通常一个清晰 commit 和一次 push；不重写历史、不 force push、不修改既有 tags。
