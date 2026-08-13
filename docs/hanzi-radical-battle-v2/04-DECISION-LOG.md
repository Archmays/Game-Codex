# Decision Log

只记录真实、会改变范围或实现边界的决定；本文件不是每日过程日志。

## D-001 保持 Phaser 3，不迁移 Godot

日期：2026-08-09
决定：运行时继续使用 Vite + TypeScript + Phaser 3。
为什么：仓库已有 Phaser 3.90 主版本、Vite 构建、大厅挂载和 GitHub Pages 发布路径；黄金样板的 2D 世界、结构槽和战斗不需要第二引擎。
依据：当前 `package.json`、`src/game/config.ts`、OpenAI Game Studio engine-selection。
影响范围：未来 V2 架构与测试；新增 `project.godot` 或 Godot 依赖触发门禁。
明确没有做什么：没有迁移、双引擎原型或修改现有游戏实现。
何时重新评估：只有 Phaser 无法满足已验证的核心儿童体验，且用户明确授权技术迁移时。

## D-002 Phaser 只负责世界、角色、战斗编排与特效

日期：2026-08-09
决定：规则、可保存状态和内容 manifest 独立于 Phaser；Scene 保持薄。
为什么：精灵、补间或 Scene 生命周期不应决定汉字是否合法、战斗结果或存档状态，否则难以单测、复现和无动画运行。
依据：OpenAI Game Studio `phaser-architecture.md`，当前 V1 大型 mount 函数的耦合风险。
影响范围：未来 simulation/content/input/assets、Phaser view/adapter 分层。
明确没有做什么：本步骤没有创建 Scene、模拟层或重构 V1。
何时重新评估：黄金样板实现规划时细化目录，但不推翻规则真源边界。

## D-003 图鉴、设置和家长信息保留 DOM

日期：2026-08-09
决定：魔法书文字、设置、家长区和可访问性界面使用 DOM overlay。
为什么：密集中文、焦点、触控、可访问性和响应式布局在 DOM 更清楚；Canvas 主要保护世界与战斗表现。
依据：Game Studio engine-selection、frontend-prompts 与本项目技术锁。
影响范围：打开 DOM 模态层时必须门控 Phaser 输入；儿童首屏不显示家长指标。
明确没有做什么：没有重写大厅或创建 UI。
何时重新评估：只有具体表面用 Canvas 能显著改善已验证体验且仍满足可访问性时。

## D-004 不全量安装约 66 个外部 Skill

日期：2026-08-09
决定：只固定经逐文件审查的 `game-feel`、`audio-design`、`save-systems`、`prototype-fast` 及其直接 references。
为什么：其余引擎、商店发布和工作流不在本项目范围；全量引入会扩大权限面、上下文和漂移。
依据：上游仓库 commit `2bea8297d9f09d90d6720c0334221417f7c9a928`、Apache-2.0、STEP 01 安全审查。
影响范围：唯一 Skill 根为 `.agents/skills/`；Game Studio 已安装则不复制。
明确没有做什么：没有引入 Godot、Unity、Unreal、Steam 发布或其他无关 Skill。
何时重新评估：只有未来有明确任务、逐文件审查和用户范围支持时单独增加。

## D-005 先做最多 12 字黄金样板

日期：2026-08-09
决定：第一个可玩 manifest 最多 12 字，目标局长 3–5 分钟。
为什么：足以覆盖至少两到三类结构、熟悉/新字比例、两场普通战与一个小首领，同时能在一次儿童试玩中完整观察。
依据：北极星范围、`prototype-fast` 的单问题原则与 Minimum Lovable Prototype 转译。
影响范围：超过 12 字触发偏航；具体字表仍需成人逐字审核。
明确没有做什么：没有在本步骤挑选或实现具体 12 字。
何时重新评估：黄金样板经真实儿童试玩获得 `PROMOTE` 后，下一阶段另作范围决定。

## D-006 不使用连续登录、排行榜或其他压力留存

日期：2026-08-09
决定：持续兴趣只来自掌握、选择、角色差异、世界变化和魔法书。
为什么：登录压力、全球比较、FOMO、抽卡和惩罚性损失会把儿童回归动机转为焦虑或操纵，并遮蔽合字核心。
依据：北极星健康边界；Ninjacha 仅作为“哪些机制不借”的产品案例。
影响范围：相关词和依赖进入机器门禁与试玩观察。
明确没有做什么：没有加入日常任务、连胜、排名、抽取概率、货币或倒计时奖励。
何时重新评估：禁用原则不因增长目标重新评估；只可讨论无压力的内容回访方式。

## D-007 现有 382+ 组合只作为母库

日期：2026-08-09
决定：V1 数据保留为候选母库，不直接成为低龄随机牌池。
为什么：组合可生成不等于字形、读音、词义、熟悉度和年龄适配均已审核；生僻字或歧义会破坏核心体验。
依据：当前 `game-data.ts`、`hanzi-structure-quality` Skill、Make Me a Hanzi 数据/许可证分层案例。
影响范围：未来需独立、版本化、确定性的 playable manifest；母库原始数据不为场景手改。
明确没有做什么：没有删除、重排或改写现有数据。
何时重新评估：每次扩充 manifest 时逐字审核，不把整库一次性升级为可玩。

## D-008 必须真实儿童试玩后再扩建

日期：2026-08-09
决定：自动测试、构建、浏览器与截图都通过后，状态最多到 `CHILD_PLAYTEST_READY`；只有试玩门禁可给 `PROMOTE`。
为什么：自动化无法观察黄小越是否理解、兴奋、注意营地变化或主动想继续。
依据：DragonBox 研究边界、child-first Skill、`05-CHILD-PLAYTEST-AND-PROMOTION-GATE.md`。
影响范围：完整墨迹森林、更多区域与大量资产在试玩前均禁止。
明确没有做什么：没有把本次技术验证称为儿童/家长/教师验收。
何时重新评估：完成一次按门禁记录的真实试玩并作出三态结论时。

## D-009 `prototype-fast` 转译为 Minimum Lovable Prototype

日期：2026-08-09
决定：保留单问题、硬范围和 keep/revise/stop 标准，但不使用纯灰盒判断 6 岁儿童是否被吸引。
为什么：本项目的核心问题同时依赖第一次魔法、角色、怪物、选择、营地变化和基本声音/视觉可信度；无这些信号会测错问题。
依据：上游 `prototype-fast` 与项目 child-first/visual/audio 约束。
影响范围：黄金样板仍极小，但关键体验状态需有足够正式的表现与截图证据。
明确没有做什么：没有授权大规模美术资产库或把原型代码直接晋升为产品。
何时重新评估：黄金样板实施规划确定每个关键状态的最低表现预算时。

## D-010 STEP 02 只实现一个隔离的核心法术 Pilot

日期：2026-08-09
决定：把 `明 = 日 + 月` 作为 provisional 锚点，在隐藏的 `?review=hanzi-v2-step02` 家长审核入口实现一个 60–90 秒闭环；默认十游戏大厅与 V1 目录不接入 V2。
为什么：这一范围足以验证“结构归位 → 完整汉字 → 字义魔法 → 世界永久变化”的单一问题，同时不会误把一个 Pilot 扩成完整黄金样板。
依据：北极星、STEP 02 指令、母库 `game-data.ts`、`formula-audit.ts` 与 `visual-hints.ts` 对“明”的交叉证据。
影响范围：仅 `games/hanzi-radical-battle/v2/**`、独立家长审核应用、STEP 02 工具/测试/文档和查询路由。
明确没有做什么：没有默认儿童入口、三选一、第二场战斗、小首领、完整 Ink Forest 或儿童 playtest。
何时重新评估：家长完成固定 JSON 审核并明确决定是否授权 STEP 03 时。

## D-011 母库、候选审核清单与可玩 Pilot 保持三层分离

日期：2026-08-09
决定：V1 母库保持不可变；STEP 02 新建 15 字 provisional 候选清单；运行时只加载经五牌二/三部件全量求解器确认无替代组合的 Pilot 场景。
为什么：母库的 accepted 公式和视觉提示不证明拼音、儿童熟悉度、围合细分、适龄性或字源；把三层混在一起会让自动 PASS 越权替代家长判断。
依据：`hanzi-structure-quality`、390 个非空母库组合枚举、15 字母库/审计/视觉三向核对。
影响范围：候选字段全部保留 `reviewStatus: pending`、`pinyinReview: pending-parent-review`、`etymologyClaim: null`、稳定 revision hash 与 Round 2 changed-only carry-forward。
明确没有做什么：没有批准最终 10/12 字 manifest，没有把现有联想图称为字源，没有推断孩子已熟悉任何字。
何时重新评估：完成家长逐字审核；真实儿童试玩仍是后续独立门禁。

## D-012 Pilot 使用程序化方向稿，生产美术只交 Level 3 prompt

日期：2026-08-09
决定：Phaser 以程序化 Canvas 图形提供可运行的营地、角色、墨点、迷墨、灯与法术；A/B/C 只用于方向比较，18 个 Level 3 prompt 交给家长未来生成，不在本轮批量调用 ImageGen。
为什么：核心时序与轮廓需要现在可看，但角色一致性和复杂世界美术属于高精细成人方向决定；先生成会放大返工和资产漂移。
依据：项目素材 Level 1/2/3 规则、`sprite-pipeline`、`game-ui-frontend` 与 STEP 02 明确的 prompt-only 边界。
影响范围：程序化画面可作为技术 Pilot 证据，不得作为最终 sprite/品牌或视觉接受结论。
明确没有做什么：没有生产 spritesheet、没有批量生成图、没有为候选字创建新联想插图。
何时重新评估：家长在视觉方向决定中选择 A/B/C/MIX/REDO 后，且另行授权生产资产时。

## D-013 增加 level-design 与 puzzle 两个限域 Skill

日期：2026-08-09
决定：在既有固定上游 commit `2bea8297d9f09d90d6720c0334221417f7c9a928` 下，只增加 `level-design`、`puzzle` 及各自唯一直接 reference，并把它们加入唯一 Skill 索引。
为什么：STEP 03 需要可审计的 3–5 分钟节奏/关键路径规则，以及结构槽合法性、可撤回、可解性和输入锁规则；现有四个 vendor Skill 不覆盖这两个边界。
依据：六文件安全审查、Apache-2.0、逐文件 Git blob 与 SHA-256 核验、`01-SKILL-VETTING.md`。
影响范围：仅 `.agents/skills/vendor/gamedev-skills/level-design/**`、`.agents/skills/vendor/gamedev-skills/puzzle/**` 与 `.agents/skills/SKILL_INDEX.md`；保留既有 `LICENSE`/`NOTICE`。
明确没有做什么：没有安装完整上游仓库，没有改动既有四个 vendor Skill，没有引入 Godot、Unity、程序化关卡或新运行时依赖。
何时重新评估：只有明确任务需要另一个独立 discipline/genre Skill 时，再逐文件审查并单独决定。

## D-014 两个新 Skill 只做儿童汉字样板的有界转译

日期：2026-08-09
决定：`level-design` 只用于安全介绍—练习—轻微迁移—小首领的关键路径、节奏和可读引导；`puzzle` 只用于纯规则结构槽、合法性、撤回、可解性、确定性和动画期间输入锁。
为什么：通用 Skill 中的空间跳跃指标、Godot/Unity 示例、match-3 计分、时间限制和高压测试不适合 Phaser 3 的约 6 岁汉字合字核心，机械照搬会偏离北极星。
依据：北极星、`child-first-learning-game`、`hanzi-structure-quality`、两 Skill 原文及 `step-03/01-MULTI-SOURCE-DESIGN-SYNTHESIS.md`。
影响范围：未来 STEP 03 设计合同；核心动作仍是部件进入真实结构位置即施法，失败可撤回且不羞辱。
明确没有做什么：没有授权 match-3、倒计时、分数压力、复杂迷宫、程序化生成、Godot 示例代码或儿童试玩前扩建。
何时重新评估：只在黄金样板自动验证与真实儿童观察暴露具体问题时，对相应有界规则作小幅修订；不因此扩大范围。

## D-015 吸收 STEP 02 家长 ACCEPT 并把 STEP 03 停在家长终审

日期：2026-08-09
决定：按 identity-bound `STEP-02_PARENT_REVIEW_FEEDBACK.json` 正式带入 `corePilot = ACCEPT`、`visualDirection = C`、15/15 字候选 ACCEPT、7/7 storyboard ACCEPT 与 `authorizeStep03 = YES`；STEP 03 技术完成后的唯一状态为 `GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW`。
为什么：家长已授权实现 STEP 03，不应要求重审未变的 STEP 02 项；同时技术候选、家长终审和真实儿童首次使用仍是三个独立门禁。
依据：Canonical feedback SHA-256 `4236AAF0E81F4FE94F48B5CF8EEB89F44900DD52473E91ABA8CC4DB0E7EC3C6B`、STEP 03 指令与 `00-STEP-02-PARENT-ACCEPTANCE-INGEST.md`。
影响范围：STEP 02 unchanged accepted 项以 stable ID/hash carried forward；STEP 03 Round 1 只审核新建和受影响项；child observer 必须等待新 feedback 中顶层 `authorizeChildFirstUse = YES`。
明确没有做什么：没有宣称家长已接受 STEP 03，没有宣称 `CHILD_PLAYTEST_READY`或儿童接受，没有把 V2 推广到默认大厅。
何时重新评估：家长返回完整、identity-matched 的 STEP 03 feedback 后。本决定取代 D-008 中“技术状态最高到 `CHILD_PLAYTEST_READY`”的旧用词，不改变其“不得以自动证据代替真实观察”原则。

## D-016 正式 12 字与首次 run 四字锁定

日期：2026-08-09
决定：正式 Manifest 固定为明、林、花、草、星、看、园、回、包、风、猫、跑；清、晴、松保留 accepted-deferred；首次 run 只使用明、花、林、星。
为什么：12 字以 4/4/2/2 分布覆盖左右、上下、全包围和半包围，同时首次 3–5 分钟短局只需两种已教结构，不让成年储备渗入儿童首局。
依据：STEP 02 15/15 家长 ACCEPT、`hanzi-structure-quality`、固定手牌求解 audit 与 STEP 03 范围。
影响范围：运行时只读明/花/林/星 encounter；家长 Manifest 可查看 12+3 的来源、风险和 revision identity。
明确没有做什么：没有否定延后三字，没有从 382+ 母库随机添加字，没有实现另外八字的儿童关卡。
何时重新评估：家长 STEP 03 Manifest 决定或未来另行授权的内容扩展时。

## D-017 simulation 保持规则真源，视觉和音频只消费状态

日期：2026-08-09
决定：Golden Slice 的合法动作、board、能力、Boss、恢复和事件由确定性 simulation 唯一决定；Phaser 只画世界和播放反馈，DOM 负责结构 board、文字、设置和魔法书。
为什么：动画、音频或 pointer 结束事件不应决定汉字合法性；同一 action 边界才能保证 click/drag/keyboard、reduced motion、安全重试和给定 seed 可复现。
依据：`web-game-foundations`、`phaser-2d-game`、`puzzle`、STEP 02 structure board 与 STEP 03 状态机测试。
影响范围：`golden-slice/simulation/**`是规则真源，`content/**`是显式数据，`phaser/**` 与 `ui/**` 只发出 action 并渲染 state。
明确没有做什么：没有复制 STEP 02 成第二套不一致求解器，没有把 tween/audio 回调变成规则。
何时重新评估：只有新交互无法用现有 action/state 合同表达时，且必须先扩展 simulation 和测试。

## D-018 主题 C 以程序化候选完成，ImageGen 只做终审 seed audition

日期：2026-08-09
决定：唯一生产方向为 C：夜光墨林。儿童 route 只加载原创 Phaser Graphics/DOM 图形与稳定 asset key；使用官方 ImageGen 生成的角色、营地和三能力三张候选表只供家长比较。
为什么：程序化版可稳定验证桌面/平板/手机和无网络边界；seed 可提高风格判断品质，但在家长批准单帧前不应扩展成 strips。
依据：STEP 02 `visualDirection = C`、`sprite-pipeline`、项目 Level 3 精细美术边界与 `05-IMAGEGEN-THEME-C-SEED-PROMPTS.md`。
影响范围：三张原图保留在 artifacts，家长 review 只加载压缩 preview；所有 seed 均为 `GENERATED_PENDING_PARENT`、`reviewOnly = true`、`runtimeIncluded = false`。
明确没有做什么：没有把概念表当透明 sprite，没有逐帧生成，没有制作最终 strip，没有复制第三方角色或让原图进入儿童 bundle。
何时重新评估：家长在 STEP 03 资产终审中对单项 seed 给出决定，且后续任务另行授权 sprite-strip 生产时。

## D-019 STEP 03 家长决定按唯一 changed-only 音频修订吸收

日期：2026-08-09
决定：以 SHA-256 `3F0BFAC4C6D318AC197AFA95764ACFB3A9E7FE9CE47BF6FA18C1514879EA417C` 的 canonical feedback 为真源，带入 Golden Slice、12 字 Manifest、三能力、Boss 与全部资产 `ACCEPT`；唯一 changed item 是 `audioDecision = REVISE`，并带入 `authorizeChildFirstUse = YES`。
为什么：家长要求保留可见拼音，但 TTS 只朗读“汉字 + 熟悉词”，其余已接受身份不得因音频修订被重新生成或扩写。
依据：review identity SHA-256 `DBA281F9954DFB591E2F3D7498B1B8F09F6C050BFBFA2436C9961B0513D73D3E` 与五项 source snapshot freeze。
影响范围：为全部 12 字分离 `visualPinyin` 与 `spokenPhrase`；运行时、魔法书、STEP 03 review 和 STEP 04 preflight 只把 `spokenPhrase` 送入本地 TTS。
明确没有做什么：没有改变字表、熟悉词、结构、遭遇、能力、Boss、Theme C、存档语义、失败语言或默认大厅。
何时重新评估：仅当实际设备 preflight 发现技术问题时作音频层修订；不得借此重开已接受内容。

## D-020 技术状态只到授权儿童首次使用就绪

日期：2026-08-09
决定：建立受 parent READY、每次 audio preflight、短期本地 session token、同源事件桥、常驻 stop 与隐私 schema 约束的首次使用系统；技术完成状态为 `AUTHORIZED_CHILD_FIRST_USE_READY`。
为什么：自动化可以证明路由、事件、隐私、停止和导出工具可用，但不能代替真实儿童第一次接触，也不能给出学习、接受或推广结论。
依据：`child-first-use-observation` Skill、STEP 04 observation schema、BroadcastChannel/localStorage bridge 与 START/FINISH fail-closed gate。
影响范围：只新增隐藏的 parent observer 与 guarded child route；正式 observation 最多一局加一次自发 replay，真人数据不进入 Git、不上传、不录音录像。
明确没有做什么：没有执行真实儿童 session，没有生成儿童结果，没有自动 PASS/FAIL/PROMOTE，没有加入默认大厅或扩建完整墨迹森林。
何时重新评估：家长返回 identity-bound 的真实 `STEP-04_CHILD_FIRST_USE_RETURN_TO_CHATGPT.zip` 后，另行做人类解释与三态决定。

## D-021 真实 first-use 支持 changed-only 后进入私人世界候选

日期：2026-08-09
决定：以 raw observation SHA-256 `EC04FECD4B04F294E7ED62139EBEE386F6B27B3FBC198EBCF3F6CD98341A86D8` 和 child return package SHA-256 `FEE13257ECF3402CDB85D6153D08FCF9A3082CD208EE88B10BABA8978E1F6612` 锁定真实证据，作出 provisional decision `PROMOTE_TO_PRIVATE_WORLD_ENTRY_AFTER_CHANGED_ONLY_FIX`。
为什么：一局完成、舒适观察、无成人介入与立即再玩请求支持把核心汉字魔法作为私人世界第一个入口候选；家长同时指出必须先修的语音上下文缺陷。
依据：56 个连续技术事件、独立 human observation、显式 evidence consistency warning。
影响范围：只允许证据语义纠偏、语音修复、私人 world shell、依赖导航与 changed-only 家长门禁。
明确没有做什么：没有把再玩意图写成实际重玩；没有宣称学习、保持、普适可用、剩余八字、完整墨迹森林、美术或默认入口已验证。
何时重新评估：家长完成 STEP 05 identity-bound changed-only review 后。

## D-022 语音目标必须来自当前显式 UI 上下文

日期：2026-08-09
决定：普通故事区仅在 phase whitelist 已形成字符时提供 replay；魔法书只读显式页 ID；Ink Echo 使用专用 Boss target；不再以 `currentEncounterId` 推断可朗读字。
为什么：状态机在非战斗阶段预置下一遭遇，隐式读取会提前泄漏答案，正是实际 first-use 家长报告的问题。
依据：parent note、phase/currentEncounter mismatch regression、accepted `spokenPhrase` contract。
影响范围：仅 Golden Slice UI voice context 与对应测试；可见拼音、自动朗读白名单、内容、simulation 与 save 不变。
明确没有做什么：没有改动 encounters、abilities、boss、Theme C、manifest 或加入新语音素材。
何时重新评估：仅在 changed-only 家长试听发现同一上下文修复仍不清楚时。

## D-023 私人世界只投影既有永久进度，经典大厅保持次级且默认不变

日期：2026-08-09
决定：新增 opt-in `?world=my-game-world`，以既有 Golden Slice schema v3/key 投影营地与四字；经典十游戏通过 `?hub=classic&from=world` inner wrapper 保留；默认 `/` 继续直接挂载原 hub。
为什么：世界持续变化是首次 run 的长期反馈，而成人式目录不应成为儿童首屏；同时不得复制进度或破坏其他游戏。
依据：north star、真实 first-use provisional decision、save-systems、game-ui-frontend。
影响范围：新 world/review apps、查询路由与 Golden Slice 完成返回链接；STEP 02 partial migration 只显示实际已有条目。
明确没有做什么：没有建立账户、儿童姓名、远程追踪、第二存档、生产素材、默认世界或完整森林。
何时重新评估：只有家长在 STEP 05 明确 `authorizeDefaultWorldEntry = YES` 后，另开有限默认路由任务。

## D-024 STEP 05 精确授权后晋升默认世界，并固定家庭 origin

日期：2026-08-09
决定：以 SHA-256 `AF3878C88F68344E2EF649774FCE24C46D2312824D91AD274628B85C8A6E0800` 的 STEP 05 feedback 为唯一授权输入；四项均 `ACCEPT`，`authorizeDefaultWorldEntry = YES` 与 `authorizeSecondUseCheck = YES`。因此 `/` 晋升为“我的游戏世界”，`?world=my-game-world` 保留为别名，原十游戏通过 `?hub=classic` 保留；正式家庭 origin 固定为 `http://127.0.0.1:5175/`。
为什么：真实 first-use 后建立的世界持续性需要成为儿童默认入口，而 localStorage 进度严格受 origin 与浏览器 profile 约束。
依据：STEP 05 candidate commit `c46e660396257767692e94d61263b4662a11ccfb`、evidence SHA-256 `EC04FECD4B04F294E7ED62139EBEE386F6B27B3FBC198EBCF3F6CD98341A86D8`、revision `fnv1a:c9271099` 与精确家长反馈。
影响范围：root dispatch、query-only navigation、browser title/theme、classic wrapper、固定 START/STOP launcher 与既有 E2E 显式 classic route。
明确没有做什么：没有复制 catalog、重建存档、修改合字内容、加入新美术、扩剩余八字或建立联网能力。
何时重新评估：只有新的 identity-bound 家长决定才可撤销该授权；origin 变更必须先处理存档连续性迁移风险。

## D-025 second-use 只验证自然返回与世界循环，不给正确目的地

日期：2026-08-09
决定：建立一次短时、本地、identity-bound 的 second-use observer；START 只打开家长 preflight，READY 后才打开与普通 `/` 相同的儿童界面。continuity 必须读取 `127.0.0.1:5175` 下既有完整 canonical save；不满足即 `SECOND_USE_PROGRESS_CONTINUITY_BLOCKED`。第一次去向与返回循环只从 allowlisted 技术事件推导。
为什么：第二次使用的问题是孩子能否认出持续世界、自己选择去向并返回，而不是能否遵从成人指定的森林路径。
依据：child-first-use-observation 的 re-entry 边界、save-systems 的 canonical-state 原则、BroadcastChannel + scoped storage fallback、严格 observation schema。
影响范围：第二次进入 grant、world/classic/forest adapter、parent observer、START/FINISH、synthetic tooling fixture 与本地导出。
明确没有做什么：没有执行真实 second-use，没有给 solver/正确目的地/正确卡牌，没有保存 PII、媒体、原始输入或完整 localStorage，没有自动 PASS/FAIL。
何时重新评估：家长在下一次自然、独立时段返回 `STEP-06_SECOND_USE_RETURN_TO_CHATGPT.zip` 后，只解释该次证据；不得推断长期投入、学习效果、保持度或剩余八字准备度。

## D-026 精确授权撤销真人 Second-Use 的 V1 实施阻塞

日期：2026-08-13
决定：接受精确授权 `HUMAN_AUTHORIZED_SKIP_REAL_SECOND_USE_AND_COMPLETE_V1_ONE_SHOT_01`，完成固定 12 字、三段冒险、Theme C 正式资产、V1 本地存档、机器审核与发布收口；V1 的机器发布不再等待 STEP 06/07 的真实 Second-Use session。
为什么：用户明确要求把“实现一个完整、可直接玩的第一版”与“未来是否做真人儿童验证”拆开，并承担不执行本轮真人 Second-Use 的产品决策；继续把历史观察门禁当成实现阻塞会与最新明确授权冲突。
依据：本次用户指令、第 1 节授权合同、固定 12 字 D-016、simulation 真源 D-017、既有 STEP07.5 `PASS_MACHINE` 基线与 V1 machine-first acceptance contract。
影响范围：本决定覆盖 D-008 及后续 STEP 05–07 中“必须真实试玩后才能继续固定 12 字 V1 实现”的阻塞部分。它只授权当前 V1.0.0 的三章、24 个绑定素材、存档迁移、启动器、机器证据、最终包和 Git 交付。
明确没有做什么：没有执行或声称真人 Second-Use；没有验证乐趣、学习效果、偏好、保持或普适性；没有授权超过 12 字、第四段冒险、STEP 08/09、账号/后端、操纵性留存或公开部署。
机器门禁：只有精确 authorization ID、12 字/3 章负向边界、禁用机制扫描、P1–P8、R1–R3、源冻结、包哈希、Git/远端一致性全部通过，才可标记 `HANZI_MAGIC_BATTLE_V2_V1_PLAYABLE_READY`。
未来儿童验证：`REAL_CHILD_VALIDATION: NO_BY_USER_DIRECTION`。家庭以后可自愿另行决定，且结果不得倒填为本次机器证据。

## D-027 用户 V1 试玩 PASS 后授权连续完成第一章 V2.0.0

日期：2026-08-13
决定：接受精确授权 `HUMAN_AUTHORIZED_CONTINUOUS_V1_TO_V2_CHAPTER_ONE_20260813`。用户已亲自试玩 V1 并明确 PASS；在保留 V1 冻结身份和旧路由的前提下，于同一 `main` 连续完成 M0–M5、第一章 V2.0.0 机器审核、现有 GitHub Pages 更新、commit、push、tag、清理与最终包。
为什么：V1 已达到用户认可的可玩基线；本次目标明确要求把 12 字固定章节扩展为可重玩的完整第一章。继续沿用 D-026 的 12 字、三段、24 素材和“不公开部署”边界会与新授权冲突。
依据：本次一次性用户指令、V1 冻结 commit `43e7841d2190922b6048182cab4b871c55715840`、tag `hanzi-magic-v2-v1.0.0`、D-016/D-017 的内容与 simulation 真源，以及 V1 `PASS_MACHINE` 证据。
影响范围：V2.0.0 正式范围为 36 字、3 英雄、3 区域加最终字核、9 怪物行为、18 可选能力加 3 固有能力、4 首领、8 修复、36 页魔法书、V2 存档、正式 Theme C 资产、大厅主入口、启动器和既有 Pages。旧 12 字、三段、24 素材只保留为 V1 历史范围。
开发门禁：M0–M5 逐阶段 `PASS_STAGE`；最终至少 30,000 个确定性 seeds、18 次浏览器机器通关、完整内容/手牌/存档/几何/可访问性/资源/路由/Pages 验证与 source-bound reviewer 收口。
明确没有做什么：没有执行或声称真人儿童验证；没有把用户个人试玩当成儿童学习证据；没有授权后端、账号、云端儿童追踪、Godot、第二种局外货币、排行榜、抽卡、FOMO、惩罚性损失或羞辱性失败语言。
真人边界：`REAL_CHILD_VALIDATION = NO_BY_USER_DIRECTION_AND_NOT_A_DEVELOPMENT_GATE`。机器结果只能证明合同内软件行为；未来儿童观察必须由家庭另行决定并保持独立证据身份。
何时重新评估：达到 `HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE_PLAYABLE_READY` 后即停止；任何第二章、超过 36 字或新的公开产品范围都需新授权。

## D-028 第一章 36 字以三层来源链和唯一解变体冻结

日期：2026-08-13
决定：在保留 V1 十二字 identity-bound carry-forward 的前提下，新增清、晴、松、河、海、洋、安、闪、你、他、好、唱、家、苗、菜、音、早、笔、尘、国、图、圆、问、闭。三区各 12 字；总体结构为 14 左右、12 上下、5 全包围、5 半包围；熟悉度为 28 熟悉、8 近熟悉。
为什么：这些字同时通过规范身份与固定词语读音、本地组合/公式/视觉提示、可读结构与五卡唯一解；用早、图、圆替代更抽象或可能引发不必要社会语义的候选后，仍保持精确结构覆盖和儿童可读词义。
依据：Unicode 17.0.0 Unihan、教育部《通用规范汉字表》上位范围、本地 `game-data.ts`、`formula-audit.ts`、36 个 visual hints、108 手牌全枚举审计、5,000 seed 的 180,000 次合字覆盖及六张结构证据表。
影响范围：`chapter-one/characters.ts` 成为第一章 36 字 runtime 真源；每字固定读音、词、短义、槽位、魔法、来源、风险、资产键和 revision identity；runtime 只能从该 manifest 生成遭遇。
明确没有做什么：没有把上位来源解释成字源或年龄验证；没有把机器状态写成家长/儿童接受；没有让 ImageGen 生成汉字；没有运行时从 382+ 母库随意抽字。
何时重新评估：仅当来源、字形、固定语境读音、结构槽或唯一解出现具体证据缺陷时；任何替换都必须重跑完整 M2 来源、求解、渲染和 coverage 门禁。

## D-029 三英雄与 18 项选择能力冻结为无答案改写的纯状态构筑

日期：2026-08-13
决定：第一章固定光语魔法师、森语魔法师、墨点伙伴师三位英雄，各有一个稳定存档 ID、世界标记和固有能力；固定 18 项可选能力，每局精确三次三选一，儿童界面只保留固有能力加三项选择共四个徽记。
为什么：英雄与短构筑可以让同一套合字核心产生可理解的自主选择和重玩变化，同时不依赖货币、随机稀有度、排行榜、连胜或惩罚性留存。
依据：`chapter-one/builds.ts` 的 exact IDs、纯状态 run generator、每英雄 10,000 seeds 共 30,000 seeds/360,000 遭遇、18/18 能力触发矩阵，以及三英雄 × 鼠标/键盘/触控共九条完整浏览器路径。
儿童价值：选择英雄与三项能力能形成短、可读、可重复的个人路线；预告、撤回、可读性和恢复反馈减少意外惩罚。
汉字学习价值：所有能力只作用于结构提示、部件可读性、操作恢复、读音/词义重放和世界反馈；不改写正确部件，不把错误汉字变正确，也不自动完成整字。
明确没有做什么：没有加入概率、稀有度、价格、最佳推荐、自动解题、分数、排名、连胜或详细行为追踪；M3 的程序化角色图只是 M5 正式美术前的可测试占位，不作为最终资产通过。
验证路径：每次新能力或英雄改动必须重跑纯 simulation coverage、答案不变量单测与至少对应的浏览器输入路径；真实儿童偏好仍非本轮机器门禁。
何时重新评估：仅当能力出现答案改写、软锁、不可恢复干扰、徽记超限、身份冲突或正式美术无法清楚区分三位英雄时。

## D-030 V2 存档与营地以独立 schema v5 延续 V1 而不改写冻结源

日期：2026-08-13
决定：V2 第一章使用独立本地键与整数 schema v5，保存 36 字发现、8 个营地修复、英雄、设置、当前安全 run 摘要、已见能力和最小聚合事件。第一次读取 checksum-valid V1 schema v4 时，迁移 12 字与精确 3 个修复，把原始字节等值复制到迁移源键，并保持 V1 主键不变。
为什么：V2 需要扩展持久世界，又必须让冻结 V1 旧路由继续读取自己的既有存档；分键迁移能避免新结构破坏历史入口，也能在损坏或未来版本下安全恢复。
儿童价值：营地中的八个对象会因真实字光发现自然恢复，休息多久都不退步；魔法书以“已遇见/以后会相遇”区分，不显示正确率、分数、错题或排名。
汉字学习价值：36 页均保留完整字、固定读音、熟悉词、短义、结构、部件和字义魔法，并可分别重放朗读、合字与意义反馈；字义图明确不是字源说明。
依据：exact repair/spellbook manifests、八项 M4 单测、六条浏览器证据路径、V1 raw byte equality、checksum/backup/recovery/future read-only、浏览器 reload current-run equivalence、父区二次确认清除和三 viewport 几何检查。
隐私边界：只使用 localStorage；不保存详细按键历史、姓名、媒体、账号、成绩画像或联网事件。清除 V2 不删除冻结 V1 主键和已保存的 V1 迁移源字节。
验证路径：任一 schema、修复规则或魔法书字段变更必须重跑迁移、损坏恢复、future-version、resume、clear 和 36-entry 浏览器路径；真人回看意愿仍不是机器证据。
何时重新评估：仅当 V1 schema 身份变化、V2 字/修复集合变化、存档字段需要新增敏感数据，或 canonical origin 改变时。
