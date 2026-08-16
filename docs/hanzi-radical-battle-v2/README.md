# 汉字魔法战 V2

汉字魔法战是家庭使用的儿童识字冒险游戏：玩家把正确部件放进真实结构位置，合成汉字并触发字义魔法。当前维护版本为 **V2.1.0**；它在冻结的 V2.0.0 第一章之后增加可选“字轮工坊”，不创建新 release tag，也不改写冻结发布物。

## 当前规模

- 36 个可玩汉字与 36 条魔法书记录
- 3 位英雄、3 个区域与墨王核心
- 18 个可选能力、3 个英雄固有能力
- 9 种怪物行为、4 位首领、8 个营地修复对象
- 本地存档、V1→V2 迁移、损坏存档恢复、静音、减少动画、键盘/鼠标/触控
- 1 个营地可选字轮工坊：保留 9 个来源层级、162 条原始字记录和 108 条原始词记录；审核后首版提供 36 条确定性合字记录

“汉字大转盘”已退役为独立游戏。其原始资料保存在 `v2/wheel-workshop/library/`，通过“原始层—审核层—可玩层”进入字轮工坊；第一章 36 字、36 页魔法书和 8 个营地修复合同没有改变。

## 启动与访问

- 本地：双击 `tools/hanzi-v2-chapter-one/START_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.cmd`
- 开发：`pnpm run play:hanzi-v2`
- Pages：<https://archmays.github.io/Game-Codex/?play=hanzi-v2-chapter-one&from=hub>

## 当前真源

- 产品源码：`games/hanzi-radical-battle/v2/chapter-one/`
- 字轮工坊源码与三层字库：`games/hanzi-radical-battle/v2/wheel-workshop/`
- 仍在使用的兼容层：`games/hanzi-radical-battle/v2/golden-slice/`、`v1/`、`content/`、`save/`、`simulation/`
- 正式运行资产：`public/assets/hanzi-radical-battle/v2/theme-c/`
- 当前单元与内容测试：`tests/hanzi-v2/`
- 当前 E2E：`tests/e2e/hanzi-v2/`
- 视觉/ARIA baseline：`tests/hanzi-v2/baselines/`
- 当前工具：`tools/hanzi-v2-chapter-one/`
- 字轮冻结、审核与模拟工具：`tools/hanzi-v2-wheel-workshop/`
- 字轮正式审核产物：`artifacts/hanzi-radical-battle-v2/wheel-workshop/`
- 冻结发布物：`artifacts/hanzi-radical-battle-v2/v2-chapter-one/`

下一次开发先读本页，再按任务读取 `ARCHITECTURE.md`、`CONTENT-RULES.md`、`QUALITY-GATES.md`、`DECISIONS.md` 与 `STATUS.md`。不要恢复 STEP 01–07 的过程树。

机器验证不代表真人儿童体验、乐趣或学习效果；本次字轮整合记录为 `REAL_CHILD_VALIDATION=NOT_PERFORMED_AND_NOT_CLAIMED`。
