# 记忆配对

## 游戏目标

用非压力式翻牌寻找字形、读音和词语之间的关系。

## 适合对象

4–8 岁家庭儿童；可由孩子独立或亲子共同使用。

## 玩法说明

一次翻开两张；关系相合时保留，不相合时温和翻回。可以切换三个中文内容包。

## 涉及知识点

汉字字形、规范拼音、固定熟悉词语，以及观察和工作记忆。

## 设备适配

支持鼠标、触控、方向键与 Enter/Space；支持移动端和减少动态效果。

## 当前完成度

V1.0.0，共享关系引擎、三包、Classic 与墨迹森林包装均已接入机器门禁。

## 后续改进建议

只有在获得经过验证的正式字义图像后，才考虑增加字义图片包。

## 接入方式

Classic 使用 `memory-card` 定义；墨迹森林使用 `?play=hanzi-magic-complete&view=memory`。

Classic 的 `memory-card` 独立入口继续保留，现由 `packages/activity-engines/memory-match/` 的共享关系配对引擎驱动。墨迹森林的“字光配对”使用同一引擎。

首批内容包：

- 同字寻踪：字形 ↔ 同一字形
- 字音回声：汉字 ↔ 规范拼音
- 词境相认：汉字 ↔ 固定熟悉词语

新存档使用 `family-games/memory-match/v1`。旧 `family-games/memory-card/progress` 只作兼容保留，不显示旧最佳步数或完成次数，也不会被删除。

儿童运行时不导入 `LEGACY_WHEEL_SOURCE` 或旧 `memoryCards` 题库。
