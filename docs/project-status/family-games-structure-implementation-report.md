# 家庭游戏项目结构状态报告

## 当前状态

项目已经整理为一个可长期维护的浏览器游戏集合：

- 统一入口：`index.html` -> `src/main.ts` -> `apps/hub/`。
- 游戏目录：10 个现有游戏都在 `games/` 下通过 `GameDefinition` 接入大厅。
- 共享能力：`packages/game-core/`、`packages/ui/`、`packages/data/` 分别承载挂载接口、共享 UI 和共享数据。
- 运行资源：`public/` 保存发布时需要复制的静态资源。
- 维护资料：`docs/` 和 `source/` 保存说明、课程资料和素材来源。

## 重要边界

- 数学实验室当前仍由 `src/game/` 承载 Phaser 实现，`games/math-lab/` 只是大厅适配层。
- `tmp/` 是临时截图和生成中间产物，不进入 Git 维护版本。
- `dist/` 是构建结果，由本地命令或 GitHub Actions 生成。
- 项目不需要后端、登录、支付、广告或联网学习记录。

## 维护命令

```powershell
pnpm dev
pnpm test
pnpm build
```

## 发布方式

GitHub Pages workflow 位于 `.github/workflows/pages.yml`。推送到 `main` 后会运行测试、构建并发布 `dist/`。

## 新增游戏流程

1. 在 `games/新游戏名/` 下创建 `index.ts` 和 `README.md`。
2. 导出完整 `GameDefinition`。
3. 在 `packages/data/gameCatalog.ts` 中注册。
4. 运行测试和构建。
5. 手动检查大厅入口、进入游戏、返回大厅和手机宽度显示。

详细模板见 `docs/game-template.md`。

## 最近整理重点

- 根目录新增维护型 `README.md`。
- 大厅卡片增加学习目标和当前状态。
- 每个游戏 README 统一为结构化说明。
- Vite 设置 `base: "./"`，适配 GitHub Pages 子路径发布。
- GitHub Pages workflow 发布 `dist/`。
- 临时目录 `tmp/` 纳入忽略规则，并从 Git 跟踪范围移出。
