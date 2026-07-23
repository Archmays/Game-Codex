# 算式滑轨 V3｜最终验收与发布报告

## 结论

`COMPLETE_WITH_DOCUMENTED_LIMITATIONS`

算式滑轨已完成运行时根治、V3 schema、200 关重建、40 个手工金标准、solver/内容审计、真实 Chromium 交互回归、25 关 UI-only agent 试玩、production preview、GitHub Pages 工作流和线上 `390×844` touch 浏览器验收。运行时、游戏 README 与根 README 均已恢复为准确的“可玩”状态。

本结论不包含真人儿童验证，也不把浏览器代理试玩解释为儿童可用性证据。`Child validation: NOT YET PERFORMED`。

## WEB 交接：仓库改名与发布身份

- WEB 交接基线：`b2c9379d3c6067f033685037c96af01040f90956`
- 重构前本地 HEAD：`4d151d78e5d9d910db0beb280031a4becff16a16`
- 同步 WEB 基线后的起点：`b2c9379d3c6067f033685037c96af01040f90956`
- 原 GitHub 仓库：`Archmays/family-learning-games`
- 用户指定的新 GitHub 名称：`Game-Codex`
- 当前 GitHub 仓库：`Archmays/Game-Codex`
- 当前远端：`https://github.com/Archmays/Game-Codex.git`
- 默认分支：`main`
- 实现与发布提交：`0060c0191ec202d483521cff288e6c83e89da2d4`
- Pages 工作流：`Deploy GitHub Pages`，run `29980147948`
- 工作流结果：build `PASS`；deploy `PASS`
- 工作流链接：`https://github.com/Archmays/Game-Codex/actions/runs/29980147948`
- Pages URL：`https://archmays.github.io/Game-Codex/`

仓库改名已在 GitHub 端实际完成，本地 `origin` 也已切换到新 URL。改名没有重写 Git 历史；上述实现提交以非强制 push 进入 `main`。本报告作为后续 docs-only closeout 提交，不改变已经通过工作流和线上验收的运行时树；交接时以远端 `main` 的最终 SHA 为准。

## 根因与修复

| 根因 | 旧行为 | V3 修复 |
| --- | --- | --- |
| tutorial | 静态 modal 令正式棋盘 `inert`，点击“下一步”即可推进 | coach 直接附着正式 `es-1-01`；必须真实移动右滑轨才推进 |
| 3×9 DOM | controls 和 window 都带 reel index，preview 对全部节点 `replaceChildren()` | render model 只更新正式 tile 状态；control 永不成为 tile 容器 |
| 2-tile projection | previous/current/next 以两个 tile 重复投影，identity 重复或缺失 | 每条正式 movable reel 恰好三个唯一 tile ID，DOM 各出现一次 |
| content | 首关大量 `0/4`，全同 operator reel 没有数学决策 | 首关为两条 number reel + fixed `+`；目录移除 0，operator 只在真实选择时可动 |
| testing gap | 只有 Node/Vitest，无法检测 pointer、capture、inert、DOM 和首屏 | Playwright 覆盖 mouse/touch、click、buttons、keyboard、取消、滚动、响应式、长操作与线上 Pages |

## RUNTIME-CONFIRM 关闭情况

- `RUNTIME-CONFIRM-01 PASS`：正式教程棋盘无 `inert`；hit test 目标是正式 tile；真实移动后 coach 才推进。
- `RUNTIME-CONFIRM-02 PASS`：pointer preview 前后正式 tile/control 节点集不变，不执行 DOM 替换。
- `RUNTIME-CONFIRM-03 PASS`：首关两列始终为 6 个正式 tile，不再从 3 格膨胀成 9 格。
- `RUNTIME-CONFIRM-04 PASS`：所有正式 `data-tile-id` 非空且唯一；fixed token 不进入 coverage。
- `RUNTIME-CONFIRM-05 PASS`：100 次混合动作和三 reel 120 次交替操作保持节点、ID、controls、listener、capture 与几何稳定；`pointercancel`、`lostpointercapture` 和 destroy 均有回归。
- `RUNTIME-CONFIRM-06 PASS`：`360×800`、`390×844`、`768×1024`、`1024×768`、`1440×900` 均通过；手机首屏包含目标、完整棋盘和主操作。
- `RUNTIME-CONFIRM-07 PASS`：Pages workflow 对实现提交成功；线上 `390×844` touch 浏览器从 `0/6`、0 步真实操作到 `2/6`、1 步，无页面错误或失败资源。

## Gate A｜首关与核心交互

`PASS`

- 正式首关：`es-1-01`
- 目标：6
- 初始式：`4 + 5 = 9`
- 结构：两条 number reel + fixed `+`
- reels：`[1,2,4]`、`[5,4,2]`
- required tiles：6
- 至少三个正确 arrangement 才完成 coverage
- 教程真实动作、错误教程动作、重开教程、undo/reset、pointer、scroll 和 reduced motion 均通过
- Gate A Playwright：26/26

## Gate B｜40 个手工金标准

`PASS`

- 每章 10 关，共 40 关
- schema、solver、唯一最小覆盖、学习元数据和三级提示全部通过
- 浏览器逐关检查 40/40：能加载、呈现稳定正式 DOM、执行一个公开 UI 动作并精确撤销
- 该浏览器证据定位为 DOM/adapter 合同抽查，不把“一次移动 + 撤销”冒充 40 关完整试玩；完整完成证据由 25 关 UI-only playtest 另行承担

## Gate C｜200 关目录

`PASS`

| 指标 | 结果 |
| --- | ---: |
| 章节 | 4 |
| 每章 | 50 / 50 / 50 / 50 |
| 站区 | 20，每站 10 关 |
| 总关数 | 200 |
| 手工金标准 | 40 |
| 确定性生成 | 160 |
| target / multi-target / equality | 130 / 30 / 40 |
| 2 / 3 / 4 / 5 movable reels | 60 / 100 / 25 / 15 |
| exact duplicate groups | 0 |
| near duplicates | 0 |
| 同站相邻重复 | 0 |
| generation retry | 0 |
| rejected candidate reasons | 0 |
| 无解 / 孤立 required tile / 缺失 target | 0 / 0 / 0 |
| 目录哈希 | `fnv1a32-2b6c450b` |

全部 200 关都有唯一最小覆盖集合，且最少需要三个正确 arrangement。`pnpm levels:check` 可从同一 40 关模板逐字节重建四章 JSON 和 `generated-audit.json`。

### 数值与运算分布

- number tile `0`：0 次；各章前 10 关均为 0 次。
- number tile `1`：28 次；全量范围 1–36。
- Chapter 1：只使用 fixed `+`，全部数字、目标和有效结果不超过 20。
- Chapter 2：只使用 `+ / −`。
- Chapter 3：20/50 为加减间隔复习。
- fixed operator token：`+ 165`、`− 25`、`× 40`、`÷ 15`。
- movable operator tile：`+ 120`、`− 80`、`× 40`、`÷ 0`。

重复值 reel 共 108 条，涉及 82 关；216/216 个重复值 tile identity 都能在至少一个成立关系中覆盖，不可覆盖为 0。45 关可能出现一次“可见数学值不变、tile identity 改变”的动作，已明确列入儿童观察风险，未伪装成数值变化。

## Gate D｜发布门禁

`PASS`

### 本地与 CI

- `pnpm install --frozen-lockfile`：PASS，锁文件不漂移。
- 算式滑轨 targeted Vitest：13 files，111/111 PASS。
- `pnpm test` 本地首轮：195/196 PASS；唯一失败是 README 仍被旧目录测试要求包含“200 个固定关卡”。断言改为 V3 的“200 份 schema + 40 金标准”后，失败文件 8/8 PASS。
- 最终实现提交的 Pages `Run tests`：PASS，证明最终树的完整 `pnpm test` 通过。
- `pnpm test:e2e`：54/54 PASS，Chromium 单 worker，2.6 分钟。
- `pnpm build`：PASS，119 modules transformed。
- targeted 失败闭包复跑：拖拽并发 1/1、章末 checkpoint 1/1、对应 progress unit 13/13。
- Pages workflow run `29980147948`：install、tests、build、artifact、deploy 全部 PASS。

### 旧红灯与门禁有效性

旧实现先运行同一方向的浏览器合同：23 项中 21 FAIL、2 PASS。失败覆盖教程阻断、control 被改写、27 个视觉 tile、重复 identity、pointer cancel、coverage 和手机首屏，因此新 E2E 不是无法检测旧缺陷的恒绿测试。

### Production preview

构建产物经真实 Chromium preview 验证：

- 大厅加载；
- 算式滑轨卡片状态为“可玩”；
- 正式教程棋盘加载；
- 记忆翻牌作为另一款游戏可进入；
- 两款游戏均可返回大厅；
- `index.html` 使用相对 `./assets/` 路径；
- page errors：0；失败 document/script/stylesheet：0。

第一次 preview harness 使用了不存在的通用“开始游戏”文案，因此在进入另一款游戏前超时；改为该游戏真实的“开始翻牌”后上述未执行路径通过。该次是验收脚本定位错误，不是产品失败，也没有因此修改产品。

### Pages 线上验收

线上 URL：`https://archmays.github.io/Game-Codex/`

真实 Chromium `390×844`、touch context、cache-busting URL 验证：

- document HTTP 200；
- 大厅与“可玩”状态正确；
- 教程正式棋盘和主操作均在首屏；
- touch 操作从 0 步、`0/6` 到 1 步、`2/6`；
- 记忆翻牌可进入；
- 返回大厅成功；
- page errors：0；失败 responses：0。

## 交互、响应式与无障碍结果

- mouse drag：PASS；只提交一格和一次 move。
- touch pointer：PASS；真实 PointerEvent 路径与线上 touch context 均验证。
- adjacent tile click：PASS。
- 可见上下按钮：PASS。
- keyboard：PASS；Tab、Enter、Arrow 完成、重玩、下一关和返回均不依赖 pointer。
- pointercancel / lostpointercapture：PASS；不提交、不改 coverage、不破坏几何。
- active drag 并发：PASS；direct adapters、undo、reset 在 dragging 中锁定，release 只提交一次。
- undo/reset：PASS；精确恢复纯状态 snapshot。
- unique tile IDs：PASS；6/9/15 tile 拓扑均验证。
- scroll conflict：PASS；reel 内纵向手势本地处理，reel 外页面可滚动。
- reduced motion：PASS；不等待反馈动画解锁。
- ARIA：fixed token、reel、三个位置、中央值、选中和点亮均有语义；pointer preview 不逐帧进入 live region。
- audio：PASS；Web Audio 合成移动/成功/完成提示，开关真实控制并持久化。
- checkpoint：PASS；rest、station、chapter 有短回顾；章末同时持久化最终站和章节 checkpoint，重玩不重复弹较弱回顾。
- 响应式：`360×800`、`390×844`、`768×1024`、`1024×768`、`1440×900` 全部 PASS。
- 视觉 E2E：12/12；正式 after 截图 14 张。

## UI-only agent 试玩

`PASS_WITH_EVIDENCE_BOUNDARY`

- 正式教程：通过真实棋盘完成，没有跳过；1 次动作。
- 抽样关卡：25/25；四章为 6/6/6/7 关，覆盖 20/20 站区和四个第 50 关。
- 关卡动作：226；含教程共 227。
- 输入：drag 6、keyboard 6、control + adjacent tile 13。
- 错误路径：4 关、5 次错误动作，随后均恢复并完成。
- 三级提示：221 组；一级/二级/三级各 221 次。
- multi-target：6；equality：6；5-reel：4。
- fallback：0。
- 决策只读取可见 DOM、提示、coverage 和反馈；没有导入 solver/reducer/catalog，没有注入完成状态。

这是一轮刻意重提示的自动化可完成性验证，证明“当前 UI 状态 → 动态提示 → 可执行动作 → 完成 coverage”闭环，不证明儿童能独立理解或觉得有趣。

## 三轮反思摘要

1. 数学/数据/算法：从值级题库升级为显式 tile/target identity、fail-closed schema、当前状态 solver、唯一最小覆盖和可重建目录；残余观察点是重复值 identity。
2. 交互/UI/无障碍：从 DOM 替换改为单一不可变 board state；根治教程、3×9、并发输入和逐帧朗读，并补齐 44 px 级触控、声音与 checkpoint。
3. 教育性/趣味性：移除 `0` 堆积、装饰性 operator、倒计时和压力机制；用分层提示与阶段回顾支撑节奏，但儿童理解、兴趣与真实手指体验仍待观察。

完整反思见 `12-final-reflection.md`。

## 持久证据与清理

持久保留：

- V3 交互、质量和验收合同；
- 旧运行基线与 21/23 红灯报告；
- 200 关质量报告与 `generated-audit.json`；
- 40 gold source、160 关生成器与 solver 证据；
- 25 关 agent 浏览器报告；
- 儿童后续验证清单；
- 三轮反思；
- before 11 张、after 14 张正式截图，共 25 个文件、2,101,794 bytes；
- 54 项 Playwright 回归规范。

已删除：

- `.playwright-cli/`：16 个临时 YAML，81,092 bytes；
- `test-results/`：临时 `.last-run.json` 与失败 trace 目录；
- `dist/`：475 个 preview 生成文件，118,209,748 bytes；
- 未采用 trace、浏览器缓存和临时 preview 进程。

Git object 数据库在提交前打包快照为 loose 27.22 MiB + pack 636.55 MiB；提交触发 repack 后为 loose 27.41 KiB + pack 663.44 MiB，总量约从 663.77 MiB 到 663.47 MiB。正式截图自身为约 2.00 MiB；其余新增体积主要是 200 关物化 JSON、测试与报告。未提交 `node_modules`、浏览器下载、`dist`、trace、账号信息或机器绝对路径。

## 已知限制

1. `Child validation: NOT YET PERFORMED`。
2. 45 关的同值不同 identity 动作需要真人儿童观察是否造成“数字没变”的困惑。
3. 尚未由真实屏幕阅读器用户或实体手机/平板完成辅助技术与手部体验验证；当前证据为真实 Chromium 加 touch/viewport 模拟。
4. Vite 报告共享主 chunk 约 1.81 MB（gzip 437.85 kB）的非阻断警告；本任务未改造整个多游戏大厅的共享 Phaser 分包。
5. GitHub Actions 给出 actions Node.js 20 弃用兼容提示，但 runner 已强制使用 Node.js 24，本次 build/deploy 成功；后续维护可单独升级对应 action 大版本。

## 最终边界

运行时、内容、测试和 Pages 发布已闭环；真人儿童观察是明确的后续研究，不是本次完成声明中的伪造通过项。

`Child validation: NOT YET PERFORMED`
