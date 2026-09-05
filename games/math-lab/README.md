# 数学世界 · 数感实验城

稳定定义 `mathLabGame` / `math-lab` 只挂载 `world/` 导航壳，提供按需加载的两个站点：

1. 算式滑轨站（`?world=math-world&station=slider`），保留原 200 关及全部规则和存档语义。
2. 目标工坊（`?world=math-world&station=target`），保留原题库、提示和存档语义。

地图沿用现有插画，支持桌面、平板、窄屏、键盘、触控和减少动画。地图只保存访问站点及动态效果设置。

旧 `station=lab|clock|array` 被识别后使用 replaceState 规范化到数学世界，显示“这个小游戏已收起，可以选择下面的游戏。”，不自动进入站点。退役 lastStation 不作为继续提示；旧访问记录、设置和扩展字段保留。损坏、未来版本或不可识别存档不覆盖。

`math-battle-web/save-v1`、旧时钟和阵列精确键继续由 `packages/data/saveKeyInventory.ts` 和 Save Vault 导出 / 恢复保护。

处置与验证见 [第一步退役报告](../../docs/portfolio-retirement-step1.md)。
