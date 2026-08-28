# 儿童学习游戏集合

这是一个家庭使用的儿童学习游戏项目。项目目标是持续收纳多个可在浏览器中打开的小游戏，优先支持识字、数学、科学、英语、化学启蒙和亲子互动。

项目保持为静态网页形式：本地使用 Vite 开发，发布时生成 `dist/`，可以部署到 GitHub Pages 或类似静态网站服务。

## 汉字魔法战 V3 完整篇

《汉字魔法战 · 墨迹森林完整篇：字光归林》V3.0.0 是当前正式中文旗舰，入口为 `?play=hanzi-magic-complete&from=hub`。V1、V2 路由、存档与冻结 tag 继续兼容；当前机器发布状态见 `docs/hanzi-radical-battle-v3/README.md`，legacy 边界见 `docs/hanzi-radical-battle-v2/README.md`。

真人儿童验证由用户明确设为 `NO_BY_USER_DIRECTION_AND_NOT_A_DEVELOPMENT_GATE`；机器通过不代表儿童乐趣、学习效果、偏好或保持度。

## 当前游戏

<!-- GAME_PORTFOLIO:START -->
`allGameDefinitions` 保留 9 个可挂载定义，但儿童产品组合已明确收敛为 3 个活跃产品；经典大厅只投影这 3 个产品。世界模块、兼容入口和共享引擎分别维护，不再拿定义数冒充产品数。

| 游戏 | 学科 | 目标世界 | 定义角色 | 活跃儿童产品 | 质量等级 | 当前状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 汉字魔法战 | 识字 | 中文世界 | 活跃儿童产品 | 是 | S | 墨迹森林完整篇 |
| 算式滑轨 | 数学 | 数学世界 | 世界模块挂载 | 否 | S | 可玩 |
| 数学世界 | 数学 | 数学世界 | 活跃儿童产品 | 是 | A | 可玩 |
| 英语世界 | 英语 | 英语世界 | 活跃儿童产品 | 是 | A | 英语世界 V2 |
| 目标工坊 | 数学 | 数学世界 | 世界模块挂载 | 否 | B | 数学世界模块 |
| 时钟塔 | 数学 | 数学世界 | 世界模块挂载 | 否 | C | 数学世界模块 |
| 阵列工坊 | 数学 | 数学世界 | 世界模块挂载 | 否 | C | 数学世界模块 |
| 记忆配对 | 识字 | 共享模块 | 兼容适配定义 | 否 | C | 可玩 |
| 声韵试炼 | 识字 | 中文世界 | 兼容适配定义 | 否 | C | 已并入墨迹森林 |

三个正式世界（chinese / math / english）包含 11 个显式世界模块；6 个兼容表面与 2 个共享引擎独立登记。算式滑轨只作为数学世界旗舰模块进入；目标工坊与记忆配对也不再占用重复 Classic 卡，模块、引擎、存档和既有规范 route 均保留。

项目阶段：Foundation、Math World、Chinese Consolidation、English V2 与 Play Readiness 均为 COMPLETE；Natural-use Observation 为 ACTIVE；家庭稳定基线已冻结在 `game-codex-family-stable-v1.0.0`；下一自动阶段为 `NONE`。
本次 `gameplay-coherence-02` 是用户明确授权、由发布 tag 目标闭合的独立 bounded development cycle；源码不提前冒充外部发布完成。它不关闭 Natural-use Observation，也不创建自动后续任务。
家庭使用入口、可选 Observation Kit 与重新开发边界见 `docs/project-status/natural-use.md`。
<!-- GAME_PORTFOLIO:END -->

> **算式滑轨 V3：**4 章共 200 关已按新 schema 重建；正式棋盘教程、统一状态机、40 个手工金标准、确定性生成、真实 pointer/键盘 E2E 与 25 关 UI-only agent 试玩均已纳入发布门禁。它现在只作为数学世界 S 级旗舰模块进入；当前组合真值见 `docs/gameplay-coherence/README.md`，关卡验收与后续儿童观察边界见 `docs/equation-slider/rebuild-v3/`。

## 本地运行

安装依赖：

```powershell
pnpm install
```

家庭长期使用请运行固定启动器（它会保持与既有进度相同的 origin）：

```powershell
.\tools\my-game-world\START_MY_GAME_WORLD.cmd
```

固定地址必须是 `http://127.0.0.1:5175/`。结束本地服务时运行：

```powershell
.\tools\my-game-world\STOP_MY_GAME_WORLD.cmd
```

也可以在开发时启动默认入口：

```powershell
pnpm run play:my-game-world
```

进度与 origin 和浏览器 profile 绑定。家庭连续使用时不要改用 `localhost`、其他端口或其他浏览器 profile，也不要使用无痕模式保存长期进度。普通 `pnpm dev` 仍保留给旧开发工作流，不改变其默认端口。

路由约定：

- `/` 或 `?world=my-game-world`：我的游戏世界；
- `?hub=classic`：3 个正式世界的备用入口；算式滑轨、目标工坊、时钟塔和阵列工坊归入数学世界，记忆配对归入中文/英语世界，旧定义、route 与存档兼容继续保留；
- `?world=math-world`：数学世界 · 数感实验城；支持 `station=lab|clock|array|target|slider` 直接进入并刷新恢复；
- 世界、森林与经典大厅之间使用 query-only 返回链接，兼容 GitHub Pages 项目子路径。

## 测试和构建

运行测试：

```powershell
pnpm test
```

构建静态网站：

```powershell
pnpm build
```

构建结果会输出到 `dist/`。`dist/` 是生成结果，不需要手工维护。

> 算式滑轨除 Node/Vitest 外，还维护 Playwright 真实浏览器 E2E、响应式截图和 UI-only agent 试玩证据。

## 发布到 GitHub Pages

本项目包含 GitHub Pages workflow：`.github/workflows/pages.yml`。

推荐流程：

1. 把仓库推送到 GitHub。
2. 在仓库设置中启用 GitHub Pages，并选择 GitHub Actions 作为来源。
3. 推送到 `main` 分支后，workflow 会自动安装依赖、运行测试、构建并发布 `dist/`。
4. 等待 Actions 完成后，使用 GitHub Pages 提供的网页链接访问游戏大厅。

项目已设置 Vite `base: "./"`，适合部署在 GitHub Pages 的项目子路径下。

## 如何新增游戏

1. 在 `games/新游戏名/` 下创建游戏文件。
2. 至少包含 `index.ts` 和 `README.md`。
3. `index.ts` 导出一个 `GameDefinition`，包含 `id`、`title`、`description`、`subject`、`recommendedAge`、`learningGoal`、`status` 和 `mount()`。
4. 在 `packages/data/gameCatalog.ts` 中导入并加入 `allGameDefinitions`，再由 Portfolio 可见性确定是否进入 `classicGameCatalog`。
5. 如果是共享题库或词库，放到 `packages/data/`；如果是单个游戏专用数据，优先放在该游戏目录内。
6. 运行 `pnpm test` 和 `pnpm build`。
7. 手动检查大厅能看到新游戏，能进入并返回大厅。

更详细的模板见 `docs/game-template.md`。

## 如何修改已有游戏

- 每个游戏优先只改自己的 `games/游戏名/` 目录。
- 共享 UI、存档、类型和工具放在 `packages/`，不要在多个游戏之间复制公共逻辑。
- 数学实验室当前由 `games/math-lab/` 适配大厅，真实 Phaser 实现仍在 `src/game/`。不要在同一次小改动里大规模迁移它。
- 改动后至少检查大厅、被修改的游戏、返回大厅流程、测试和构建。
- 涉及拖动、触控、教程遮罩或响应式交互的游戏，必须增加真实浏览器测试，不能只依赖 Node 单元测试。

## 目录说明

- `apps/hub/`：统一游戏大厅。
- `games/`：各个独立小游戏。
- `packages/game-core/`：游戏挂载接口、游戏定义类型和本地存档封装。
- `packages/ui/`：共享 DOM UI。
- `packages/data/`：共享题库、词库和游戏目录。
- `public/`：运行时静态资源，会被构建复制到发布结果。
- `assets/`：长期共享的图片和音效源文件说明。
- `source/`：课程标准、素材来源和生成资料，不是运行时必需目录。
- `docs/`：架构、模板、研究资料和维护说明。
- `tmp/`：临时截图和生成中间产物，本地保留，不进入 Git 维护版本。

## 常见问题

- 大厅打不开：先运行 `pnpm install`，再运行 `pnpm dev`。
- 图片或关卡数据加载失败：确认相关文件在 `public/assets/` 或 `public/data/` 下，路径不要以系统绝对路径开头。
- GitHub Pages 页面空白：确认 workflow 成功完成，且 Vite 配置保留 `base: "./"`。
- 新游戏不显示：确认已加入 `packages/data/gameCatalog.ts`。
- 测试失败：先看失败测试指向的是题库、游戏目录注册，还是共享逻辑。

## 隐私和安全

不要把孩子真实照片、真实姓名、学校内部资料、家庭地址、学习记录、账号密码、API key、token 或其他敏感信息提交到仓库。

当前游戏只使用浏览器本地状态和 localStorage，不需要登录、服务器、支付、广告或联网学习记录。
