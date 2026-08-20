# 汉字魔法战 · 墨迹森林完整篇：字光归林

V3.0.0 在当前 V2 第一章和字轮工坊之上新增完整篇章，不移动或改写 legacy 真源。正式入口为 `?play=hanzi-magic-complete&from=hub`；V1、V2 路由和存档继续独立兼容。

## 儿童价值

孩子从世界场景直接继续下一段冒险。合字、连接真实部件家族、按真实字序组合词语都会立刻修复森林；失败不扣除已获得进度，也不出现排名、连胜、倒计时或羞辱文案。

## 汉字学习价值

- 第一章继续使用 36 个 V2 canonical 字。
- 第二、三章各增加 18 个不重复核心字，其中每章 12 个主线字和 6 个可选字。
- 核心 72 字连接到 18 个部件家族和 36 个双字词；部件、偏旁和部首不混称。
- 联想画面只解释字义与世界魔法，不冒充字源。
- 字轮原始 270 条记录、审核处置和冻结 hash 保持不可变；V3 只建立 adapter。

## 自动验证路径

纯规则层拥有内容、手牌、家族、词序、进度与迁移真值。Vitest 验证 schema、唯一解、solvers、存档和 legacy；确定性模拟验证可达性与覆盖；Playwright 验证真实 route、输入、响应式、无障碍、网络、视觉和生命周期。最终机器结论不代表真人儿童乐趣或学习效果。

## 完整篇入口

- `?play=hanzi-magic-complete&from=hub`：三章世界、尾声与通关后自由探索的正式入口。
- `&chapter=one|two|three`：三个可恢复的故事章节；第二、三章按需加载。
- `&view=spellbook|wheel|archive`：72 字魔法书、72 字字轮与不会重置进度的故事档案。
- `&postgame=free-adventure|component-trails|word-resonance`：三条无排名、无收集门槛的通关后林路。
- `&slice=family|word`：保留为纯规则与浏览器回归入口，不作为儿童主导航。

完整篇共用纯 reducer、唯一解求解器、V3 本地 action replay 存档、pointer/keyboard/touch 输入、点击替代拖动、reduced motion 和 V2 音频控制器。故事通关不要求 72/72 收集；V1、V2 与字轮旧存档按来源保留并迁移到独立 V3 存档。

## 稳定验证命令

- `pnpm run validate:hanzi-complete`：内容、规则、存档、200,000 场景模拟与四审查协调。
- `pnpm run test:e2e:hanzi-complete`：功能浏览器套件与 36 条、19 档案验收矩阵。
- `pnpm run test:visual:hanzi-complete`：83 个 V3 稳定视觉、ARIA 与几何状态的无更新校验。
- `pnpm run verify:pages:hanzi-complete`：正式 Pages 路由、延迟资产、存档、legacy 与部署 commit 身份。
- `pnpm run package:hanzi-complete`：从正式报告目录生成唯一回传 ZIP 与 SHA-256。

## 非目标

V3.0.0 不加入后端、账号、云端儿童资料、排行榜、FOMO、惩罚性进度损失或强制书写。Hanzi Writer/笔顺数据只保留未来 `StrokeDataProvider` 接口边界，不阻塞本次发布。
