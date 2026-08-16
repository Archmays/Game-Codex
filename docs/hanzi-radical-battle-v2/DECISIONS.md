# 长期决策

- 技术栈保持 Vite + TypeScript + Phaser 3 + DOM overlay，不迁移 Godot。
- 确定性 simulation/reducer 拥有规则；表现层只显示状态并派发动作。
- DOM 承担密集文字、按钮、设置和可访问名称；游戏世界保持儿童可读，不做课程 dashboard。
- 合字是核心施法动作，真实空间结构、部件顺序和位置不可被能力或提示改写。
- playable content 使用确定性、版本化 manifest；36 字是 V2.0.0 当前规模，不是永久上限。
- 存档 local-only、版本化、防御性解析；继续保留 V1→V2 迁移与损坏恢复。
- 不使用排行榜、全球比较、连胜、每日奖励、FOMO、战利品箱、惩罚性进度损失或羞辱性失败。
- 机器优先完成例行功能、UX、视觉、无障碍、响应式和回归 QA；不把自动 PASS 写成实际儿童乐趣或学习效果。
- 用户已接受 V1 核心玩法方向。真人儿童验证按用户方向不执行，也不是继续开发的常设门禁。
- 正式运行资产只从稳定 `public/assets/` 路径加载；Git history、tags 和冻结 release ZIP 承担历史档案职责。
- “汉字大转盘”不再拥有独立目录、catalog 卡片、公开 data export 或产品首页；旧库迁入 V2 字轮工坊的原始层，经典大厅固定为 9 个独立游戏。
- 字轮工坊始终在营地可见，沿用 `magic-tree` 修复的解锁语义；它是可选 portal，不是主线关卡或第九个修复对象。
- 字轮采用独立 reducer/state machine 和独立版本化存档，不复制战斗 reducer，不改动第一章 36 字、36 页魔法书或 M3 战斗 contract。
- 未发现旧独立玩法的稳定公共 deep link，因此不发明兼容 route；旧转动次数不是学习进度，保留为无害孤立 localStorage，不主动读取或删除。
- 当前维护状态可记为 V2.1.0，但不创建 release/tag、不修改冻结 V2.0.0 ZIP，也不手工触发公开部署。
