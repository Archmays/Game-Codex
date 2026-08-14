# 汉字魔法战 V2

汉字魔法战是家庭使用的儿童识字冒险游戏：玩家把正确部件放进真实结构位置，合成汉字并触发字义魔法。当前版本为 **V2.0.0**，状态为 `CHAPTER_ONE_COMPLETE`。

## 当前规模

- 36 个可玩汉字与 36 条魔法书记录
- 3 位英雄、3 个区域与墨王核心
- 18 个可选能力、3 个英雄固有能力
- 9 种怪物行为、4 位首领、8 个营地修复对象
- 本地存档、V1→V2 迁移、损坏存档恢复、静音、减少动画、键盘/鼠标/触控

## 启动与访问

- 本地：双击 `tools/hanzi-v2-chapter-one/START_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.cmd`
- 开发：`pnpm run play:hanzi-v2`
- Pages：<https://archmays.github.io/Game-Codex/?play=hanzi-v2-chapter-one&from=hub>

## 当前真源

- 产品源码：`games/hanzi-radical-battle/v2/chapter-one/`
- 仍在使用的兼容层：`games/hanzi-radical-battle/v2/golden-slice/`、`v1/`、`content/`、`save/`、`simulation/`
- 正式运行资产：`public/assets/hanzi-radical-battle/v2/theme-c/`
- 当前单元与内容测试：`tests/hanzi-v2/`
- 当前 E2E：`tests/e2e/hanzi-v2/`
- 视觉/ARIA baseline：`tests/hanzi-v2/baselines/`
- 当前工具：`tools/hanzi-v2-chapter-one/`
- 冻结发布物：`artifacts/hanzi-radical-battle-v2/v2-chapter-one/`

下一次开发先读本页，再按任务读取 `ARCHITECTURE.md`、`CONTENT-RULES.md`、`QUALITY-GATES.md`、`DECISIONS.md` 与 `STATUS.md`。不要恢复 STEP 01–07 的过程树。

机器验证不代表真人儿童体验或学习效果；当前事实始终记录为 `REAL_CHILD_VALIDATION=NO_BY_USER_DIRECTION`。
