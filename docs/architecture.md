# 项目架构

本项目是一个静态网页儿童学习游戏集合。一个 Vite + TypeScript 前端应用承载统一游戏大厅，多个小游戏通过同一套挂载接口进入和退出。

## 运行方式

- 根入口是 `index.html` 和 `src/main.ts`。
- `src/app-route.ts` 解析并规范化 query 路由；`src/main.ts` 按结果动态加载字间行者、字阵守城、经典大厅、记忆配对兼容入口、STEP4 试玩入口、数学世界或默认的我的游戏世界，并设置页面模式与标题。
- `apps/my-game-world/` 提供默认世界及经典大厅挂载入口；`apps/hub/` 读取 `packages/data/gameCatalog.ts`，展示经典游戏卡片并把选中的游戏挂载到页面容器中。直接游戏和世界入口不都经过经典大厅。
- 每个游戏返回一个 `MountedGame`，在退出时销毁自己的计时器、DOM 或 Phaser 实例。

## 目录职责

- `apps/hub/`：统一游戏大厅，负责游戏列表、进入游戏、返回大厅。
- `games/`：独立小游戏目录。新增游戏必须放在 `games/新游戏名/`。
- `packages/game-core/`：共享挂载接口、游戏定义类型和 localStorage 存档封装。
- `packages/ui/`：共享 DOM UI，例如按钮、面板、状态块和反馈。
- `packages/data/`：共享题库、词库和游戏目录。
- `src/game/`：历史数学实验室源码，仅保留历史；当前构建明确拒绝把它载入运行图。`games/math-lab/world/` 是当前数学世界导航壳，只有 slider、target 两个活动站。
- `public/`：运行时静态资源，例如图片、关卡 JSON 和 favicon。这里的文件会进入发布结果。
- `assets/`：长期共享素材源文件说明。放源文件时要说明用途和授权状态。
- `source/`：课程标准、素材来源、生成资料和研究材料。它不是运行时必需目录。
- `docs/`：架构、模板、研究资料和维护说明。
- `tests/`：单元测试、内容校验和游戏目录检查。
- `tmp/`：临时截图和生成中间产物，只保留在本地，不进入长期 Git 维护版本。

## 游戏接入边界

每个游戏导出一个 `GameDefinition`：

- `id`：稳定 ID，用于存档命名空间和目录识别。
- `title`：大厅显示名称。
- `description`：一句话玩法说明。
- `subject`：学科方向。
- `recommendedAge`：适合年龄。
- `learningGoal`：大厅展示的学习目标。
- `status`：当前状态，例如 `可玩` 或 `可玩原型`。
- `mount(context)`：把游戏挂载到大厅提供的容器内。

游戏内部可以自由组织 DOM、Canvas 或 Phaser 实例，但必须在 `destroy()` 中清理自己创建的资源。

## 共享与独立

- 单个游戏专用逻辑优先留在该游戏目录。
- 多个游戏真正复用的 UI、存档、题库或工具再放入 `packages/`。
- 不为了一个游戏新增抽象。
- 不复制共享题库到多个游戏目录。
- 不把运行时逻辑依赖到 `tmp/` 或本机绝对路径。

## 数学世界与历史边界

`math-lab` 保留稳定目录身份，当前运行实现为 `games/math-lab/world/`。旧 lab、clock、array 只保留兼容路由与原存档，旧入口返回数学世界，不重新挂载历史运行时。

不要把普通维护变成恢复退休游戏。`vite.config.ts` 的运行图检查和 `tests/portfolio-retirement.test.ts` 继续验证该边界。

## 当前维护入口

| 修改任务 | 代码归属 | 直接验证 |
| --- | --- | --- |
| 改挑战准备或战斗面板 | 字阵 `ui/challenges.ts`、`ui/workbench.ts`、`ui/hud.ts`；动作在 `actions.ts`，`coordinator.ts` 组装。挑战规则仍由 `tactics.ts`/`model.ts` 唯一拥有 | `pnpm exec vitest run tests/hanzi-tower-defense`（含各地图/短关）、`pnpm validate:hanzi-tower-defense`、`pnpm test:e2e:hanzi-tower-defense`；短关另跑 `playwright.short-missions.config.ts` |
| 改棋盘或教程显示 | 滑轨 `board-view.ts`、`board-panels.ts`；`board-input.ts` 只桥接输入，`board-controller.ts` 调用原 reducer；`index.ts` 管章节/进度 | `pnpm exec vitest run tests/equation-slider`、`pnpm levels:check`、`pnpm test:e2e:equation-slider`；动规则再跑 release 与 visual |
| 改场景交互 | 世界盒子三 runtime 管各自流程，`box-gesture.ts`/`box-pause.ts`/`box-lifecycle.ts` 管本地平台能力，`continuous-turn.ts` 保留持续旋转。奇物 `action-panel.ts`/`selection.ts`/`landmark-view.ts` 管界面，`action-coordinator.ts` 经既有 Intention 执行与整体取消 | `pnpm test:world-in-a-box`、`pnpm test:oddity-puzzles` 与对应 `test:e2e:*` 深度命令 |
| 改查字/书写 | 两书房各自 `workbench.ts` 组装，`shelf-view.ts` 管书架。汉字 `query-controller.ts`/`card-view.ts`/`playback.ts` 管查字、卡片和播放，`stroke-view.ts`/`handwriting.ts` 保留原引擎；英语 `writing-board.ts`/`writing-clock.ts`/`word-dialog.ts` 管呈现、时钟和弹窗，`letter-strokes.ts`/`writing-player.ts` 保留原笔顺时间线。各自 model 保有原 schema，输入模块保留各自键位 | `pnpm exec vitest run tests/hanzi-stroke-lab.test.ts tests/english-study.test.ts tests/english-study-writing-clock.test.ts`、`pnpm test:e2e:hanzi-stroke-lab`、`pnpm test:e2e:english-study` |
| 改存档与设置 | 各游戏自己的 save/progress/model 验证 schema；`game-core` 只封装 namespace 操作；`preferences/world-home.ts` 拥有共享偏好；memory-match `save.ts` 拥有状态分类与写保护；Save Vault 保留原字节/校验/恢复 | `pnpm exec vitest run tests/game-core-storage.test.ts tests/memory-match-save.test.ts tests/maintenance-boundaries.test.ts tests/save-vault`、`pnpm test:e2e:storage`；共享变更再跑受影响消费者 |

字间行者入口保留规则动作与页面协调，`panels.ts`/`board-view.ts` 管显示，`input-controller.ts` 管快捷键，`hint-search.ts` 拥有 Worker 与请求代次，`page-lifecycle.ts`/`scene-bridge.ts` 管暂停和资源退出；对应 `pnpm validate:hanzi-word-adventure` 与 `pnpm test:e2e:hanzi-word-adventure`。

## 元数据与加载

- `gameCatalog` 的 GameDefinition 是儿童标题与挂载入口来源；tower/adventure 的轻量 `definition.ts` 不静态载入 Phaser。直接运行路由仍加载原 mount 导出。
- `gamePortfolio` 拥有产品角色、可见性和维护画像；`playSurfaceManifest` 拥有具体路由/交互表面；`saveKeyInventory` 拥有保险箱精确允许键。用途不同，保持独立，由 `pnpm portfolio:check` 检查一致性。
- `pnpm portfolio:generate` 从上述来源生成 README 组合表及状态文档；不要手工同步生成段。元数据读取器只解析 AST，不执行游戏、启动引擎或读取存档。
- `apps/my-game-world/world-state.ts` 仅保留兼容导出；底层游戏通过 `packages/preferences/world-home.ts` 读取原键与原 schema。

## 检查与测试服务器

`pnpm test:portfolio:affected -- --changed-files <以逗号分隔的仓库路径>` 列出既有受影响检查；加 `--run` 执行。`pnpm typecheck` 同时检查应用/测试及独立的 `tsconfig.tools.json`。工具配置使用 Node globals；DOM 类型只用于工具中的浏览器回调和其导入的共享领域类型，不把 Vitest globals 混入工具。

英语书房与汉字书房完整命令分别覆盖其配置中的 Chromium/WebKit、桌面/手机/平板。可以用 `--project=chromium-desktop --project=webkit-desktop` 做明确子集；子集通过不代表整矩阵。测试默认启动独立 4191/4192；`ENGLISH_BASE`/`HSL_BASE` 可指定已准备的隔离服务器，输出用 `GAME_CODEX_EVIDENCE_ROOT`。

世界盒子、奇物深度命令由 `tools/maintenance/run-scene-checks.ts` 自动启停独立服务器，默认 4193/4194。生产验证先 `pnpm build`，再 `pnpm test:e2e:world-in-a-box -- --preview` / `pnpm test:e2e:oddity-puzzles -- --preview`。世界盒子 14 个脚本中，11 个使用生产构建；`dresden-geometry`、`step03-surface`、`refine-actions` 需要读取导出网格或安装源码钩子，明确在同一源码的独立 4197 开发服务器执行。源码检查不冒充生产构建证据。`SCENE_BASE_URL` 可指向固定测试构建（须用 `SCENE_CHECKS` 排除上述三个源码检查）；`SCENE_CHECKS` 选择世界盒子脚本，`QA_PROFILES`/`ODDITY_PROFILES` 选择已定义设备，日志须注明所选子集。`test:e2e:oddity-legacy` 专门要求显式 `ODDITY_LEGACY_ORIGIN` 和 `ODDITY_ORIGIN`，旧包不存在时必须报告未验证，不替换为构造当前存档。

家庭启动器固定 `127.0.0.1:5175` 和其存储 origin 不变。所有自动检查使用新建浏览器上下文或专用临时用户目录，不连接用户个人浏览器配置。长浏览器验证使用固定构建，避免开发时 HMR 重置状态。现有截图只做 no-update 比较，不批量更新基线。

## 发布边界

GitHub Pages 发布只需要源码、`public/` 运行资源、依赖锁文件和 workflow。`dist/` 由 CI 生成，`tmp/` 不进 Git。

`source/` 可以保留为课程和素材来源资料，但它不是游戏运行所需内容。发布页面只使用构建产物 `dist/`。
