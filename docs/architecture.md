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
- `src/game/`：现有 Phaser 数学实验室实现。当前保留原位，通过 `games/math-lab/` 接入大厅。
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

## 数学实验室过渡说明

数学实验室是现有 Phaser 游戏，真实实现仍在 `src/game/`，运行资源在 `public/assets/` 和 `public/data/`。当前只通过 `games/math-lab/` 建立大厅适配层。

不要在普通维护任务中把它整体迁移到 `games/math-lab/`。如果以后确实需要迁移，应单独规划，先覆盖资源路径、场景启动、存档兼容和大厅返回流程。

## 发布边界

GitHub Pages 发布只需要源码、`public/` 运行资源、依赖锁文件和 workflow。`dist/` 由 CI 生成，`tmp/` 不进 Git。

`source/` 可以保留为课程和素材来源资料，但它不是游戏运行所需内容。发布页面只使用构建产物 `dist/`。
