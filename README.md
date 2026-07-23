# 儿童学习游戏集合

这是一个家庭使用的儿童学习游戏项目。项目目标是持续收纳多个可在浏览器中打开的小游戏，优先支持识字、数学、科学、英语、化学启蒙和亲子互动。

项目保持为静态网页形式：本地使用 Vite 开发，发布时生成 `dist/`，可以部署到 GitHub Pages 或类似静态网站服务。

## 当前游戏

统一入口是游戏大厅，当前收录 10 个游戏：

| 游戏 | 学科 | 适合年龄 | 当前状态 |
| --- | --- | --- | --- |
| 记忆翻牌 | 识字 | 4-8 岁 | 可玩 |
| 数学实验室 | 数学 | 6-9 岁 | 可玩 |
| 汉字大转盘 | 识字 | 6-15 岁 | 可玩 |
| 汉字魔法战-偏旁部首 | 识字 | 6-10 岁 | 可玩 |
| 九九乘法表 | 数学 | 7-9 岁 | 可玩 |
| 英文魔法战 | 英语 | 5-9 岁 | 可玩 |
| 认识时钟 | 数学 | 5-7 岁 | 可玩 |
| 凑10算12算24 | 数学 | 7-10 岁 | 可玩 |
| 算式滑轨 | 数学 | 6-10 岁 | 修复中（P0 教程与滑轨 DOM 缺陷） |
| 汉字魔法战-拼音 | 识字 | 6-8 岁 | 可玩 |

> **算式滑轨维护说明：**仓库中已有 4 章、200 份 solver 验证关卡数据，但当前浏览器实现存在已确认的教程阻断和拖动后棋盘膨胀问题，暂不能视为正式可玩版本。重构依据见 `docs/equation-slider/rebuild-v3/`。

## 本地运行

安装依赖：

```powershell
pnpm install
```

启动游戏大厅：

```powershell
pnpm dev
```

然后打开终端显示的本地地址，通常是 `http://127.0.0.1:5173/`。

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

> 当前通用测试以 Node/Vitest 为主；算式滑轨重构必须补充真实浏览器 E2E 后，才可恢复“可玩”状态。

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
4. 在 `packages/data/gameCatalog.ts` 中导入并加入 `gameCatalog`。
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
