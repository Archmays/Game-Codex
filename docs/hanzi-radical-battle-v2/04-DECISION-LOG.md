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
