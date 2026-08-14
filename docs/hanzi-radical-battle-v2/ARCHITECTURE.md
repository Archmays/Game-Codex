# 当前架构

## 入口与表现

Vite + TypeScript 提供单页入口，`src/app-route.ts` 解析稳定 route，`src/main.ts` 挂载当前第一章、V1 legacy、经典大厅或家庭世界。当前 canonical deep link 是 `?play=hanzi-v2-chapter-one&from=hub`。

仓库保留 Phaser 3 作为游戏运行栈的一部分；当前第一章的密集文字、按钮、设置和可访问名称由 DOM overlay 承担，世界场景使用正式图像、CSS 与音效反馈。规则不由表现层决定。

## 规则与内容

- `chapter-one/characters.ts` 与相关内容模块定义 36 字 current manifest。
- `m3-run-generator.ts`、`m3-machine.ts` 与 reducer 组成可 seed、可回放的确定性规则层。
- Phaser/DOM 只消费规则状态并派发动作；模拟器和测试可在无浏览器情况下运行同一 contract。
- `golden-slice/` 名称虽来自历史阶段，仍是 V1 内容、存档与兼容类型的 live dependency；`content/` 的 revision hash、`save/schema.ts` 及 `simulation/` 的事件/结构棋盘纯规则也仍被当前代码使用，因此保留最小必要层，不为目录美观重写。

## 存档

`chapter-one/m4-save.ts` 使用防御性 `localStorage` schema，校验版本、字段、内容 revision 与 run replay；支持备份恢复、较新版本只读保护及 V1→V2 迁移。`v1/` 与 `golden-slice/save/` 是迁移和 legacy route 的必要兼容层。无账号、云存档或网络儿童追踪。

## 资产

运行时只从 `public/assets/hanzi-radical-battle/v2/theme-c/` 读取稳定资产：第一章 72 个资产与 V1 兼容资产。`chapter-one/m5-assets.ts` 是第一章 manifest；源代码不依赖 `artifacts/`。

## 启动与发布

启动器只管理身份匹配的本仓库 Vite 进程。GitHub Pages 沿用仓库现有构建与相对资产路径。`artifacts/.../v2-chapter-one/` 中的 ZIP 是冻结 V2.0.0 发布物，不是 runtime dependency。
