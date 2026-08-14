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
