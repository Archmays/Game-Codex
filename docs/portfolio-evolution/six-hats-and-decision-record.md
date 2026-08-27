# 六顶思考帽与 Portfolio 决策记录

本记录与 [`portfolio-evidence.json`](portfolio-evidence.json) 的 100 分矩阵和逐定义合同配套。总分支持讨论，但 correctness、privacy、route/save compatibility 与 accessibility 可单独否决实现。

## 1. White Hat — 只列事实

- 起点 `73ae9d6be140c9e8294781b9f8e6ed296590c438`：9 个 mount definitions、6 个 Classic cards、42 个 play surfaces、8 个 primary surfaces、37 个 known save keys。
- 三个正式世界为 Chinese / Math / English；Math World 有 lab、clock、array、target、slider 五站。
- Hanzi 当前真源为三章、72 字；English 为五区、48 词、30 个 story-core；Equation 为四章 200 关；Make Target 为 12 题。
- 9 个定义的当前内容在本轮全部 `CONTENT_FREEZE`；没有新增正式游戏或扩大目录。
- 两轮独立审查都把 active child portfolio 收敛到 Hanzi、Math World、English World、Equation Slider。
- Equation 全量审计：216 条同显示相邻转换、82 个受影响关卡、45 个初始暴露关卡；禁用这些边后 82/82 可完成、0 关依赖、39 关最短路径只增加 1 步。
- Natural-use Observation 当前仍为 `ACTIVE`；`NEXT_PROJECT_PHASE = null`，`automaticLargeTask = NONE`；本轮由用户另行明确授权。
- 真实儿童观察、家庭接受、乐趣、理解、学习与保持：`UNKNOWN / NOT PERFORMED / NOT CLAIMED`。

## 2. Red Hat — 只列感受假设

以下全部是 `PRODUCT_EVIDENCE / INFERENCE`，不是观察事实：

- 四张产品卡可能比六张“产品/模块混排”更容易形成稳定的组合心智模型。
- 同值方块被点击却只增加步数，可能让儿童感觉输入失效或规则任意；直接解释并不提交，可能更可信。
- Make Target 和 Memory 在 Classic 与世界内重复出现，可能让家长误以为它们是不同内容。
- My Game World 的视觉世界感可能比 Classic 强，但没有核心循环时仍可能被体验为入口页。
- Math Lab 的旧 Phaser 仪表盘与新世界地图风格差异，可能让连续性变弱；本轮证据不足以安全重做。

## 3. Black Hat — 风险

- 把 `allGameDefinitions` 当产品数会继续把 mount、module、adapter 和 product 混为一谈。
- 删除卡片若联动删除 definition、route、save key 或 asset，会破坏兼容与家庭数据。
- 把 world visit 当 mastery 会制造错误推荐和不真实的家长总结。
- 全量重写 82 个 Equation 关卡会改变 gold/content identity、提示、最短路径和已有进度，风险高于证据要求。
- 只修改审计阈值或只增加装饰反馈会保留不可见动作，不能解决因果断裂。
- 把 Natural-use 标成 COMPLETE 会虚构家庭观察证据；把本轮写成自动 next task 又与明确授权事实冲突。
- 为追求仓库变小而删除 source master、兼容资产或不可重建证据，可能不可逆。
- Optional pilot 会挤占 route/save、浏览器、CI、Pages 和清理闭环，因此本轮取消。

## 4. Yellow Hat — 已有优势

- Hanzi 的部件、词序和家族关系与世界修复内在整合，具有清楚的旗舰身份。
- Equation 的 reducer/evaluator/solver/generator、200 关和多输入门禁提供了可精确修复的强底座。
- Math World 已把五种不同操作机制收进自由开放地图；无需增加新游戏即可提高组合清晰度。
- English 的“意义—拼词—短句—世界回应”是完整的学习动作链。
- Make Target 的 AST/solver、Memory 的共享 relation engine、Pinyin 的规范 machine 都值得保留；产品收敛不等于代码删除。
- Save Vault、精确 key inventory、local-only 运行和 return contracts 已提供可验证的兼容底座。

## 5. Green Hat — 争议项的替代方案

### Product truth

- 方案 A：继续用 9 definitions 代表 9 产品。优点是字段少；缺点是错误表达当前儿童入口。
- 方案 B：分为 active products / world modules / compatibility surfaces / shared engines。优点是 route/save 可保留而不制造重复卡片。
- 决定：方案 B。

### Memory

- 方案 A：保留通用 Classic 卡，继续与中文/英语世界重复。
- 方案 B：退役独立卡，保留共享引擎、定义适配、中文/英语活动和两套 save namespace。
- 决定：方案 B，`RETIRE_STANDALONE + ENGINE_KEEP + SAVE_KEEP`。

### Make Target

- 方案 A：继续同时作为 Classic 独立产品和 Math station。
- 方案 B：只作为 Math station，保留 mount definition、AST/solver/manifest 和存档。
- 决定：方案 B，`MERGE + RETIRE_STANDALONE`；并先补 save version/migration。

### Equation visible-no-change

- 方案 A：重写 82 关所有重复 reel，改变发布内容与分析。
- 方案 B：给重复 identity 增加长期可见标记，并把 coverage 规则教给儿童。
- 方案 C：拒绝不会改变中央数学显示的边，不提交、不计步，解释原因，并让 solver/hints 使用可见移动距离。
- 决定：方案 C。0 个关卡依赖该边，最大路径代价为 1；这是保持关卡 ID、content hash 语义和 save 兼容的最小完整修复。若未来真实证据显示拒绝本身仍困惑，再考虑 A。

### Classic Hall

- 方案 A：完全删除 Classic，并重写所有 `from=hub`/return 契约。
- 方案 B：保留为简单备用启动器，只展示四个 active products。
- 决定：方案 B。

### My Game World

- 方案 A：本轮实现 V2 元游戏、跨世界货币或成长。
- 方案 B：诚实保持 hub，只让组合真源一致；未来只有在明确证据与授权下研究一个本机、可删除、无压力的创作工具。
- 决定：方案 B。

### Math 下一机制

- 方案 A：立即增加 equal-sharing/partition station。
- 方案 B：先形成规格，等待 station-level evidence、settings 和新的明确授权。
- 决定：方案 B；不增加第十个游戏，也不在本轮加入第六站。

## 6. Blue Hat — 最终决策与顺序

1. 先建立四层组合真源，保留 9 definitions、37 save keys 和 legacy routes。
2. Classic 收敛到四个 active products；Make Target / Memory 只移除重复卡片。
3. Make Target 增加 v1 migration 和 future-readonly 保护。
4. Equation 生成全量路径 audit，拒绝同显示边，更新 solver/hints、派生 audit 与浏览器测试。
5. 同步 manifest、generator、checker、README、lifecycle 和文档。
6. 运行 affected profile、完整组合门禁、CI 和 exact-commit Pages；最后做 manifest-based 清理、tag 和回传包。

## 12 个必须回答的 Portfolio 问题

1. **Definitions、产品组合和 compatibility registry 是否分离？** 是。9 definitions 是 mount registry；儿童产品为 4 个；11 world modules、6 compatibility surfaces、2 shared engines 分开维护。
2. **Memory 是否保留独立入口？** 否。`RETIRE_STANDALONE`，中文/英语活动、engine、definition adapter、routes 与 saves 保留。
3. **Make Target 如何定位？** `MERGE` 到 Math World station；机制和代码保留，重复 Classic 卡退役。
4. **Clock、Array、Pinyin adapter？** Clock/Array 是 active Math modules；Pinyin definition 为 `COMPATIBILITY_ONLY`，canonical Sound-Rhyme 仍 active。
5. **长期共享引擎？** `memory-match` 与 local-storage/game-core contracts；Equation、Make Target、Pinyin 保持各自 owner，不为标签做无消费者抽象。
6. **Classic 是否存在？** 存在，承担 compatibility-safe alternate launcher/return destination，不再是真正产品组合的真源。
7. **My Game World 是产品还是 Hub？** 当前是 Hub。最小改变是让投影真源一致并诚实命名；不做 V2 元游戏。
8. **哪些 content freeze？** 全部 9 definitions 的当前目录：Hanzi 72、Equation 200、English 48/30、Pinyin 72、Math 五站、Make Target 12、Clock、Array、Memory packs。
9. **Equation visible-no-change？** 拒绝边、不提交/不计步、解释原因、hint/solver 按 visible distance；正式 audit 固定 82/45/39/21/0。
10. **Math 下一 mechanic？** Equal-sharing/partition workshop，规格见 `next-roadmap.md`；本轮不实现。
11. **安全清理候选？** 只清理 dist、test-results、Playwright/临时 goal 证据、旧 handoff 与重复过程截图。Runtime assets、source master、license/source notes、compatibility implementation 和 saves 全部保留；未发现足够高置信度的 runtime orphan，因此不做资产删除。
12. **Lifecycle 如何表达？** Natural-use Observation 保持 `ACTIVE`；新增 `portfolio-evolution-01` 明确授权周期并记为 `RELEASE_BOUND`，只有发布 tag、CI 与 Pages 同 SHA 回读后才闭合；`automaticLargeTask` 继续 `NONE`。

## 决策合同索引

9 个定义各自的 evidence、confidence、score、implementation、route/save/shared-engine impact、tests、rollback 和 not-do 均在 [`portfolio-audit.md`](portfolio-audit.md)“逐定义证据与决策合同”中由 JSON 真源生成。

`AUTHENTIC_CHILD_EVIDENCE = UNKNOWN / NOT PERFORMED / NOT CLAIMED`。
