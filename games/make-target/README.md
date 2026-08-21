# 目标工坊

## 游戏目标

练习数感、四则运算顺序和目标数推理。

## 适合对象

- 年龄：7-10 岁。
- 适合亲子共玩：家长和孩子可以轮流提出下一步合并方案。

## 玩法说明

从确定性题库取得 4 张牌，按左、右顺序选择操作数，再用加减乘除合并。减法不取绝对值，除法不静默换序且必须整除；每张合成牌携带可精确复算的 AST。

## 涉及知识点

- 加减乘除。
- 运算顺序。
- 目标数拆解和推理。

## 设备适配

- 支持鼠标和触控。
- 适合手机、平板和电脑。
- 不需要音频或打印材料。

## 当前完成度

V1.0.0 支持目标 10、12、24、完整撤销和四层提示。提示来自 solver graph，只逐层展示关系、牌对、运算或第一步，不直接给完整答案。

## 后续改进建议

- 发布 manifest 为每个目标提供 4 题，并记录解数量、难度、canonical solution 与合法第一步。
- 系统测试覆盖 1..10 的全部 4-card multisets × 3 个目标（2,145 组）。

## 接入方式

- 导出：`makeTargetGame`。
- 同一 AST、solver、manifest 和 `family-games/make-target` save 同时服务 Classic 与 Math World。
- Math World station：`?world=math-world&station=target`。
