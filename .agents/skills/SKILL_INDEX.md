# Skill Index

这是 Game-Codex 的唯一项目 Skill 路由。路径按下表解析；不要在仓库内创建第二套 Skill 树。

## 选择顺序

1. 先读 `AGENTS.md` 与任务直接相关的当前文档。
2. 只加载覆盖任务所需的最小 Skill 集。
3. 仅在根 `AGENTS.md` 的第 3、第 4 车道或明确 readiness/acceptance 请求中使用 `machine-first-game-review`；汉字内容变化同时使用 `hanzi-structure-quality`；儿童界面或反馈变化同时使用 `child-first-learning-game`。
4. 只有用户明确要求真人首次/再次使用观察时，才加载 `child-first-use-observation`。
5. 自动 PASS 只代表其声明的机器 contract，不代表真人儿童体验、偏好或学习效果。

## Canonical routes

| Skill ID | Canonical path | Use when | Current constraint |
| --- | --- | --- | --- |
| `machine-first-game-review` | `.agents/skills/machine-first-game-review/SKILL.md` | 根 AGENTS 第 3、第 4 车道或明确 readiness/acceptance 请求；局部修正不自动升级 | discovery 在改动前；acceptance 绑定最终同源树；例行问题自动修复 |
| `hanzi-structure-quality` | `.agents/skills/hanzi-structure-quality/SKILL.md` | 汉字、部件、结构、读音、词义、图像或 playable manifest 变化 | 结构与跨字段一致性必须可自动验证；无固定 12 字门禁 |
| `child-first-learning-game` | `.agents/skills/child-first-learning-game/SKILL.md` | 儿童首屏、核心循环、反馈、难度、可用性、隐私或本地记录变化 | 保护健康体验；真人观察不是日常开发门禁，不得虚构真人结论 |
| `child-first-use-observation` | `.agents/skills/child-first-use-observation/SKILL.md` | 用户明确授权的真人首次/再次使用准备、观察、隐私与解释 | 本地最小证据；合成工具绝不冒充真人证据 |

按任务还可使用项目内 `vendor/gamedev-skills/` 的 `game-feel`、`audio-design`、`save-systems`、`prototype-fast`、`level-design`、`puzzle`，以及已安装的全局 Skill。仅在其学科确实进入范围时加载。

`machine-first-game-review/references/` 提供 source freeze、lifecycle/evidence 与 retention/cleanup 规则；只读当前阶段需要的 reference。路径缺失时报告准确路径并继续不受影响的工作，不得假称已读。
