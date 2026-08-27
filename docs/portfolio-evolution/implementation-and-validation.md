# Portfolio Evolution 实施与验证

本页记录 `GAME-CODEX-PORTFOLIO-EVOLUTION-GOAL-01` 的实现边界和发布证明方法。机器证据只证明代码、内容合同、路由、存档、浏览器行为和部署身份；真实儿童兴趣、理解、学习效果、留存与家庭验收均为 `NOT_PERFORMED_AND_NOT_CLAIMED`。

## 发布身份

- 起点：`73ae9d6be140c9e8294781b9f8e6ed296590c438`。
- 目标分支：`main`；禁止 force push 和历史重写。
- 家庭稳定基线：`game-codex-family-stable-v1.0.0` / `8b890ff14880bcb576dd1ced37e14e6e3df28af1`，不移动、不覆盖。
- 本轮发布标签目标：`game-codex-portfolio-evolution-v1.0.0`；只有同一最终 SHA 的本地、CI 与 Pages 证明闭合后才创建。
- 最终提交不是在文档中手写的可漂移副本；权威解析为 `git rev-list -n 1 game-codex-portfolio-evolution-v1.0.0`，并必须同时等于本地 `HEAD`、`origin/main`、GitHub Actions `github.sha` 与 Pages 根元素的 `data-build-commit`。

## 已实施的组合收敛

### 分层真源

`packages/data/gamePortfolio.ts` 现在分别表达：

- 9 个 mount definitions；
- 4 个 active child products；
- 11 个 world modules；
- 6 个 compatibility surfaces（Classic 备用入口、Hanzi V1/V2、English/Pinyin legacy route、Memory definition adapter）；
- 2 个 shared engines；
- Classic Hall 从 active-product truth 确定性投影 4 张卡，不再从“定义仍可 mount”推导独立儿童产品。

`gameCatalog`、My Game World、Classic Hall、项目状态页、surface manifest、检查器与测试使用同一分层真源。My Game World 仍是 Hub，不被记作第十个产品；本轮没有增加正式游戏。

### 高置信度决策落地

| 对象 | 主决策 | 实施 |
| --- | --- | --- |
| 汉字魔法战 | `KEEP` | 保留三章、72 字、正式世界和所有 V1/V2/V3 route/save；不扩内容。 |
| 算式滑轨 | `KEEP` | 保留 200 关与关卡 ID；拒绝中央可见表达式不变的相邻动作，并同步 solver、提示、审计与反馈。 |
| 数学世界 | `KEEP` | 保留五个开放站点；由真源提供产品入口和模块关系。 |
| 英语世界 | `KEEP` | 保留五区、30 story-core、48 词、词光册和 English Memory。 |
| Make Target | `MERGE` | 取消重复 Classic 卡，保留 Math World Target 站点、旧 mount 与存档。 |
| Clock | `MERGE` | 明确为 Math World module，保留 adapter、route 和 save。 |
| Array | `MERGE` | 明确为 Math World module，保留 adapter、route 和 save。 |
| Memory | `RETIRE_STANDALONE` | 取消通用独立儿童卡；保留共享 `memory-match` 引擎、世界活动、definition adapter 与旧 save。 |
| Pinyin | `COMPATIBILITY_ONLY` | 保留旧 definition/save；儿童侧规范入口仍在墨迹森林声韵试炼。 |

### Equation visible-no-change 专项

对 200 关执行了基于 `(reel indexes, required-tile bitmask, target bitmask)` 的全图 BFS，并比较完整图和移除 same-display edges 后的图：

- same-display transitions：216；
- affected levels：82；
- initially exposed levels：45；
- shortest-path benefit levels：39；
- initial and benefit levels：21；
- required same-display move levels：0；
- 无该边仍可解：82/82；
- 最大最短路径差：1；
- catalog hash：`fnv1a32-2b6c450b`。

因此没有批量改写关卡或放宽完成条件。运行时只拒绝数学显示不变的尝试，不修改 state 或 move count；反馈说明“这一格数学内容没有变化”，并给出可见下一步。权威逐关记录位于 `games/equation-slider/levels/generated-audit.json`。

### 存档与兼容

- 37 个已知 save key 保留，Parent Save Vault 仍只处理 allowlist 内的本机匿名数据。
- 取消 Classic 卡不删除 route、mount、engine 或 save namespace。
- Make Target 采用 version 1 envelope；legacy payload 可确定性迁移，future version 只读拒绝且不覆盖原字节，malformed payload 安全回退。
- Hanzi V1/V2/V3、Math/English world、Equation、Memory/Pinyin adapters 与固定同源边界继续由组合 smoke、产品 profile 和 Save Vault 覆盖。
- 没有账户、云端儿童档案、遥测、广告、付费、排行、streak、FOMO、战利品或 PII。

## 机器审查与分歧处理

两轮只读独立审查使用同一原始树、不同 rubric：

1. `GAMEPLAY_REVIEW`：core loop、game feel、pacing、world identity、replay、visual/input feedback。
2. `LEARNING_PORTFOLIO_REVIEW`：intrinsic integration、progression/scaffolding、uniqueness/duplication、maintenance、route/save/privacy。

二者对 4 个 active products、Make Target/Memory 收敛、Clock/Array/Pinyin 定位和 Classic 角色达成一致。对 Equation，gameplay 视角偏向重写重复 reel；全量算法证据证明没有必需隐形边且兼容重写成本更高，最终采用“拒绝不可见边 + 因果反馈 + solver/hint 同步”的最小完整修复。此结论仍不代表真实儿童已经理解该反馈。

## 本地同树门禁

### 已完成的候选预检

在最后一项长期证据文件加入前，候选树已完成受影响 Portfolio closure，以及 play-readiness、surface integrity、a11y、Save Vault、performance、natural-use privacy、natural-use browser 和各世界 visual/geometry 矩阵；所有选中项目通过。Playwright 输出中的 skip 均来自测试声明的项目/viewport 组合排除，不是测试内跳过或 xfail。机器可读结果、命令、计数、源摘要与边界见 `evidence/local-validation-evidence.json`。

该记录明确是预检，不冒充最终同树证明。证据文件加入后必须刷新 source-tree identity，并在不再修改候选源的条件下执行一次最终综合门禁；最终命令记录随回传包保存，发布完成还需同一提交的 CI 与 Pages 精确身份回读。

发布提交只在下列能力全部于同一未再修改的 source tree 通过后冻结：

| 能力 | 权威命令/证据 |
| --- | --- |
| 生成与真源漂移 | `pnpm run portfolio:generate`; `pnpm run portfolio:evolution:generate`; `pnpm run portfolio:check`; `pnpm run portfolio:evolution:check`; `pnpm run levels:check` |
| 类型、单元与构建 | `pnpm exec tsc --noEmit`; `pnpm test`; `pnpm build` |
| 影响路由 | `pnpm run test:portfolio:affected`; `pnpm run test:portfolio:smoke`; `pnpm run validate:play-surface-integrity` |
| 真实浏览器输入/可达性 | `pnpm run test:e2e:hittest:representative`; `pnpm run test:e2e:scroll-reachability:representative`; `pnpm run test:a11y:play-readiness` |
| 存档与运行时预算 | `pnpm run test:save-vault`; `pnpm run test:performance:portfolio` |
| S/A/B/C 产品层 | Hanzi、Equation、Math、English、Make Target、模块与 compatibility route 的现有正式 profile |
| 隐私 | natural-use schema/privacy/browser profile；外部请求、账户、PII 与遥测均为零 |

真实浏览器矩阵覆盖 Chromium 及仓库受影响 profile 声明的额外浏览器，1440/1366 desktop、768 tablet、390/360 mobile，pointer、keyboard、touch emulation、reduced motion，以及产品已提供的 high contrast、large text、left-hand 设置。还覆盖 back/exit/reload、local save、console/page error、asset 404 和非预期外部请求。

Classic 由 6 卡收敛到 4 卡、世界页 document-scroll owner 修复后，只更新了经人工像素检查确认的少量视觉基线；随后必须以 no-update 模式复跑。过程截图、失败 trace 和重复证据不进入长期目录。

## CI、Pages、标签与清理证明

- CI：`.github/workflows/ci.yml` 的 `Portfolio CI` 对最终 `main` SHA 执行组合门禁。
- Pages：`.github/workflows/pages.yml` 以 `VITE_BUILD_COMMIT=${{ github.sha }}` 构建并部署；线上 verifier 必须读取 `html[data-build-commit]` 并与完整 40 位最终 SHA 相等。
- 正式 URL：`https://archmays.github.io/Game-Codex/`；在线检查覆盖 My Game World、三个世界、四个 active products、canonical/compatibility routes、save/return、console/network/assets。
- 发布标签只在本地、CI 与 Pages 同 SHA 后创建并回读；若标签已存在则使用语义正确的 patch 版本，绝不覆盖。
- 精确 workflow run、最终 SHA、Pages verifier 输出、tag target、ZIP manifest 与清理后复核保存在根目录最终回传包；它们是本页稳定合同的实例化证据。
- 清理在回传 ZIP 生成并独立校验之后，按显式路径和 SHA 的 maintenance `plan → apply → verify` 事务执行；删除本 Goal 的 `GOAL_STATE`、构建输出、测试结果、过程报告和 staging，保留长期文档、必要截图、根 ZIP 与其 SHA-256。

发布判据：tracked workspace clean，`HEAD == origin/main == release tag == CI sha == Pages data-build-commit`，最终 ZIP 在清理前后字节与 SHA-256 不变。
