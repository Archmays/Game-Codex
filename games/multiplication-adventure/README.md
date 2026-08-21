# 阵列工坊

## 游戏目标

用小方块和挑战题帮助孩子理解乘法阵列关系，熟练 1 到 9 的乘法事实。

## 适合对象

- 年龄：7-9 岁。
- 适合亲子共玩：家长可以陪孩子复述乘法口诀，并让孩子解释小方块阵列。

## 玩法说明

孩子可直接改变 1–9 行和列，阅读真实方格数量，并把阵列翻转为“列 × 行”；方向变化时总数保持不变。

## 涉及知识点

- 乘法事实。
- 阵列模型。
- 乘法口诀和数量分组。

## 设备适配

- 支持鼠标、触控和数字输入。
- 适合手机、平板和电脑。
- 不需要音频或打印材料。

## 当前完成度

V1.0.0 数学世界模块。旧 10 题得分循环、最佳成绩和 `source/` eager-load 已退出核心体验；任务 seeded 可重现。

## 后续改进建议

- 81 个 1–9 乘积、81 个 cell count/label 与 81 个 transpose 状态由纯模型测试覆盖。
- 旧 `family-games/multiplication-adventure/*` 只读兼容。

## 接入方式

- 导出：`multiplicationAdventureGame`。
- 全部定义：`packages/data/gameCatalog.ts`；经典大厅独立可见性为 false。
- Math World station：`?world=math-world&station=array`。
