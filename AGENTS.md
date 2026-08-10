# AGENTS.md

## 项目目标

- 这是一个家庭用儿童学习游戏项目。
- 优先支持识字、数学、科学、英语、化学启蒙、亲子互动类游戏。
- 设计和实现应优先考虑儿童使用场景：界面清晰、反馈明确、操作简单。

## 目录规则

- `apps/hub/` 是统一游戏大厅，负责入口、游戏列表、进入游戏和返回大厅。
- `games/` 存放相对独立的小游戏。新增游戏必须放在 `games/新游戏名/`。
- `packages/ui/` 存放共享 UI，例如按钮、面板、卡片和计分展示。
- `packages/game-core/` 存放共享游戏逻辑，例如游戏挂载接口、计分、存档和难度逻辑。
- `packages/data/` 存放共享题库、词库、游戏目录和素材数据。
- `assets/` 存放长期共享的图片和音效源文件。
- `docs/` 存放架构、模板和开发说明。
- 如果某个游戏需要独立规则，可以在该游戏目录下新增局部 `AGENTS.md`。

## 开发规则

- 新增游戏时必须放在 `games/新游戏名/`。
- 不要为了一个游戏复制公共逻辑；优先把可复用能力放入 `packages/`。
- 不要修改无关游戏，除非任务明确要求。
- 每个游戏应尽量保持低耦合，通过 `packages/game-core` 的挂载接口接入大厅。
- 不要为单次使用代码新增抽象。
- 不要引入复杂后端，优先使用前端本地状态或 localStorage。

## 外部辅助规则

- 需要生成图标或图片时，先判断素材所需精细度级别：
  - Level 1：简单图标、占位图、基础 UI 图形，直接生成。
  - Level 2：需要较完整视觉效果、但不要求高度一致或精确约束的游戏插图、美术素材，调用 `imagegen`。
  - Level 3：高度精细、风格关键、角色一致性关键、品牌相关或复杂构图素材，先把完整 prompt 发给用户，由用户拿去给 ChatGPT 生成后再发回。
- 执行任务或安排计划时，先判断是否需要额外的 ChatGPT deep research report。
- 对外部信息依赖高、不确定性高，或涉及儿童教育方法、科学内容准确性、版权、市场、竞品、复杂视觉风格研究的任务，应要求 deep research report。
- 常规本地代码修改、bug 修复、小型 UI 调整、测试和文档更新通常不需要 deep research report。
- 如果需要 deep research report，先给用户一份完整 prompt，说明研究目标、范围、资料要求、约束条件和期望输出。

## 验证规则

- 修改后必须运行项目。
- 检查游戏大厅是否仍能打开。
- 检查已有游戏入口是否仍然可见。
- 检查示例游戏能进入并能返回游戏大厅。
- 如有测试命令，运行测试。
- 当前项目可使用 `pnpm test`；如果本机没有 `pnpm`，可用本地 `node_modules` 中的 Vitest 入口运行同一批测试。

## 安全规则

- 不要删除用户素材。
- 不要移动大量文件而不说明原因。
- 不要引入联网、登录、支付、广告等功能，除非用户明确要求。
- 不要把每个小游戏拆成独立仓库。

## Skill usage audit

Before starting any non-trivial learning-game or product task, Codex must inspect `.agents/skills/SKILL_INDEX.md` and decide whether its routed global skill applies. Ordinary Git/status/stash/branch/commit/push operations do not trigger a learning-game skill unless the request also asks to change or assess gameplay, learning design, child usability, parent co-play, or game UI.

At the start of the response, include a short section:

### Skill usage
- Selected skill(s): `<skill-id>` or `none`
- Skill path(s): the canonical path recorded in `.agents/skills/SKILL_INDEX.md` or `none`
- Reason: one short sentence explaining why the skill applies or why no skill is needed.

If a task uses a skill, Codex must resolve and read the canonical path recorded in `.agents/skills/SKILL_INDEX.md` before planning or editing files. Do not invent a local copy when the routed global skill is unavailable.

At the end of the response, include:

### Skill audit
- Skill(s) actually used:
- Key rule(s) followed:
- Files read from the skill folder:
- Any skill that looked relevant but was not used, with reason:

Do not reveal private chain-of-thought. Provide only an audit summary of selected skills, files read, and rules followed.

## Hanzi Radical Battle V2 guardrail

Before any non-trivial work under `games/hanzi-radical-battle/` or the
`hanzi-radical-battle-v2` initiative, read:

- `.agents/skills/SKILL_INDEX.md`
- `docs/hanzi-radical-battle-v2/00-NORTH-STAR.md`
- `docs/hanzi-radical-battle-v2/00-NORTH-STAR.json`
- `docs/hanzi-radical-battle-v2/03-TRACEABILITY-MATRIX.md`
- `docs/hanzi-radical-battle-v2/04-DECISION-LOG.md`

A new feature may not be implemented unless it maps to the north star,
states its child value, states its hanzi-learning value, and has an
automatic or child-playtest validation path.

Do not introduce Godot migration, backend accounts, cloud child tracking,
daily-login rewards, streak pressure, leaderboards, loot boxes, FOMO timers,
punitive progress loss, or shaming failure language.

## Machine-first game review

For Game-Codex changes, machine review is the default acceptance path. Do not
ask the user to perform routine game UX, visual, accessibility, responsive, or
regression review.

Run the `machine-first-game-review` Skill and produce `PASS_MACHINE`,
`AUTO_REVISE`, or `ESCALATE_HUMAN`.

Use its `DISCOVERY_MODE` before the first mutation and `ACCEPTANCE_MODE` for
source-bound final evidence. Load only the applicable reference for recovery,
lifecycle, or retention/cleanup work.

Escalate only for real-child behavior, value or preference choices,
irreversible privacy or publication decisions, unresolved critical machine
reviewer disagreement, or failure after three repair loops.
