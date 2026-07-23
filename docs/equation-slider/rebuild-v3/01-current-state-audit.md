# 算式滑轨重构 V3｜当前状态审计

## 审计范围

- 仓库：`Archmays/family-learning-games`
- 默认分支：`main`
- 审计时 `main`：`4d151d78e5d9d910db0beb280031a4becff16a16`
- 200 关功能提交：`06ec5eeae7a66496c985926e739f86324d3883b8`
- 两者关系：当前 `main` 仅比 200 关提交多 1 个整理提交；GitHub compare 未显示文件差异，因此当前算式滑轨源码仍等同于该功能提交。
- 仓库状态：public，未归档。
- 与本游戏相关的开放 issue：未发现。
- 与本游戏相关的 PR：未发现。仓库历史仅检索到一个与删除其他游戏有关的已合并 PR，和本次问题无关。

本报告是 **GitHub 源码静态审计**。用户提供的浏览器截图可证明实际缺陷已经出现；本阶段不运行 Vite、浏览器或 Playwright。所有需要运行环境确认的项目均标为 `RUNTIME-CONFIRM`，交由本地 Codex 完成。

## 当前产品声明与真实状态

当前仓库存在三处“可玩”声明：

1. 根 `README.md` 将算式滑轨标为“200 关可玩”。
2. `games/equation-slider/README.md` 将当前完成度写为“可玩”。
3. `games/equation-slider/index.ts` 的 `GameDefinition.status` 为“200 关可玩”。

静态代码与用户截图已经证明至少存在两个 P0 阻断缺陷：

- 教程不能操作真实棋盘；
- 拖动预览会破坏按钮与棋盘 DOM，产生每列 9 个视觉 tile。

因此，“200 关数据存在且 solver 验证通过”不能等同于“200 关可玩”。本次 WEB 阶段只修订文档状态，不修改运行时代码；`GameDefinition.status` 必须由本地 Codex 在开始修复时先改为“修复中”，全部发布门禁通过后再改回“可玩”。

## 已确认的核心文件结构

以下文件已通过 GitHub `main` 读取确认：

```text
games/equation-slider/
  README.md
  index.ts
  styles.css
  types.ts
  evaluator.ts
  solver.ts
  feedback.ts
  progress.ts
  level-audit.ts
  levels/
    manifest.ts
    chapter-1-addition.json
    chapter-2-add-sub.json
    chapter-3-mul-div.json
    chapter-4-reasoning.json
    generated-audit.json
  tools/
    generate-levels.ts

packages/data/
  gameCatalog.ts

tests/
  equation-slider-evaluator.test.ts
  equation-slider-solver.test.ts
  equation-slider-levels.test.ts

.github/workflows/
  pages.yml

package.json
vite.config.ts
vitest.config.ts
AGENTS.md
```

这不是本地文件系统的递归清单。Codex 开始执行时仍必须使用本地 `git ls-files` 枚举全部 `equation-slider` 文件，补齐本阶段无法通过目录 API确认的其他文件。

## 当前架构

### 运行方式

- Vite 静态前端；
- 游戏通过 `GameDefinition.mount()` 接入统一大厅；
- `gameCatalog.ts` 已注册 `equationSliderGame`；
- 关卡按章节动态 import；
- 进度存入浏览器 `localStorage`；
- 无登录、广告、支付和后端；
- GitHub Pages workflow 在每次推送 `main` 后运行 `pnpm test`、`pnpm build` 并部署 `dist`。

### 当前内容规模

`generated-audit.json` 声明：

- 总关数：200；
- 每章：50；
- 目标数模式：140；
- 多目标模式：40；
- 等式模式：20；
- solver 验证：200；
- 不可解关：0；
- 孤立 tile：0；
- 完全相同结构：0；
- 三列、每列两 tile 的入门形态：26 关；
- 其中同一 canonical plan 使用 16 次。

这些指标只说明**数据和 solver 的现有合同通过**，不证明屏幕渲染、真实拖动、儿童理解或长期趣味性通过。

## 当前测试能力与缺口

### 已有能力

- Vitest；
- 安全算式 evaluator 测试；
- solver、覆盖、唯一最小集合、非法关卡测试；
- 200 关数量、solver、结构签名、章节平均难度和部分拓扑复用测试；
- TypeScript 编译和 Vite build；
- Pages workflow。

### 关键缺口

`package.json` 当前没有：

- `@playwright/test`；
- `test:e2e`；
- 浏览器交互脚本。

`vitest.config.ts` 使用 `environment: "node"`，因此现有测试不会真实挂载浏览器 DOM，也不会执行：

- pointer hit testing；
- modal/inert 行为；
- pointer capture；
- `touch-action`；
- 拖动时 DOM 变化；
- 响应式布局；
- 页面滚动冲突；
- 真实鼠标、触控和键盘路径。

这正是当前 P0 缺陷能够在测试全部通过的情况下进入 `main` 的直接治理缺口。

## 当前关卡审计的盲区

现有审计关注：

- 可解性；
- 孤立 tile；
- 结构签名；
- topology 复用；
- canonical plan；
- 章节平均难度；
- target 分布。

但没有充分检查：

- 所有 number tile 的值分布；
- 首 10 关是否禁用 0；
- 单关是否大量重复同一数字；
- operator reel 是否所有值相同；
- 每个 tile ID 是否在屏幕只渲染一次；
- 某个 reel 的移动是否改变数学意义；
- 关卡是否由真人/agent 通过 UI 完成；
- 390×844 首屏是否优先显示棋盘；
- 教程是否要求真实操作而不是点“下一步”。

`generated-audit.json.targetValues` 统计的是目标结果，而不是所有 tile 值，因此不能发现第一关的 `0 / 4 / +` 高度重复问题。

## 当前首关事实

`chapter-1-addition.json` 的 `es-1-01`：

- 左 reel：`[0, 4]`
- 运算符 reel：`[+, +]`
- 右 reel：`[0, 4]`
- 目标：`4`
- 三个 reel 均以 index `1` 开始。

这份数据本身就会产生：

- 两个 number reel 只有 0 和 4；
- operator reel 的移动不改变数学符号；
- renderer 为 2-tile reel 强制显示“上一/中央/下一”三个位置时，同一 tile 必然重复出现在两个位置。

这不是截图偶然，也不是单纯 CSS 问题。

## 项目规则发现

根 `AGENTS.md` 要求非平凡任务先读取 `skill/SKILL_INDEX.md`。GitHub connector 对该路径和 `skills/SKILL_INDEX.md` 均返回未找到。Codex 必须在本地重新确认：

- skill 目录是否未提交；
- 是否由全局 `%USERPROFILE%\.codex\AGENTS.md` 提供；
- 是否存在路径大小写或同步差异。

不得因为索引缺失而跳过项目规则，也不得擅自创建一套与全局治理冲突的 skill 目录。

## WEB 阶段结论

状态：`BLOCKED_FOR_RUNTIME_REBUILD`

可以保留：

- 原创名称与整体数学轨道主题；
- evaluator 的安全原则；
- solver 与构建期物化方向；
- 4 章 × 50 关的内容目标；
- 本地存档、隐私边界；
- 章节按需加载。

必须重构：

- 教程；
- reel 数据/渲染合同；
- pointer preview；
- DOM 选择器；
- 早期关卡结构；
- 关卡质量审计；
- 浏览器测试；
- 移动端信息层级；
- “可玩”发布门禁。
