# 参考案例与 Skill 审计

核验日期：2026-08-09。账本含 18 条参考条目，另有 1 个外部 Skill 来源，共 19 个独立来源入口。产品页只证明产品自述和可观察机制，不证明学习效果；研究结论不外推到约 6 岁汉字学习；本阶段没有复制任何第三方品牌、角色、关卡、美术、音频、产品数据或游戏代码。

## 参考案例账本

| 名称 | 一手来源 | 成功点 | 对本项目的原创转译 | 明确不借鉴 | 证据强度 | 许可证（代码 / 数据 / 素材） | 当前决策 | 后续验证 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 当前汉字魔法战 V1 | [项目 README](../../games/hanzi-radical-battle/README.md)、[实现](../../games/hanzi-radical-battle/index.ts)、[数据](../../games/hanzi-radical-battle/game-data.ts)、[测试](../../tests/hanzi-radical-battle.test.ts) | 已有大量组合、牌组和本地大厅接入，证明汉字组合主题已落地 | 将 382+ 组合保留为候选母库，另建最多 12 字的审定 manifest；抽离纯规则与可保存状态 | 不直接沿用 7 手牌、课程式信息架构、规则与 DOM 混在单一 mount 函数、以及“败北/还需要练习”文案 | 项目代码与自动测试 | 项目自有；本步骤不复制或改写游戏内容 | 借鉴基线，V1 实现冻结 | 未来自动比对 manifest；成人逐字审核；儿童观察核心动作 |
| Pin it | [Apple App Store](https://apps.apple.com/tw/app/pin-it-learn-chinese/id1606613346) | 其自述的核心动作是按读音、意义、结构提示拖放部件形成汉字，学习动作与操作较接近 | 五张字灵手牌进入真实结构槽位，完成字即完成施法 | 不复制名称、界面、题目、账号/API、课程层级；“research-based”不写成效果已验证 | 产品/开发者自述 | 未公开复用许可；产品代码、数据、素材均视为专有或未授权 | 借鉴动作原则，不直接复用 | 结构数据测试 + 黄小越能否无需长说明完成首字 |
| Hanzi Writer | [官方许可证页](https://hanziwriter.org/license.html) | 将字符笔画/字形数据与渲染代码分开授权，适合作为未来字形动画实现参考 | 若后续选用，单独锁定代码版本和字符数据版本，用于结构形成后的规范字形呈现 | 不在未审内容、字体和数据许可前直接导入；不把描红替代合字核心 | 官方开源许可证说明 | 代码 MIT；字符数据 Arphic Public License；未单独授权的示例素材不取用 | 暂缓到可玩字 manifest 确定后 | 许可证清单、字形渲染截图、浏览器字体/字形核验 |
| Make Me a Hanzi | [官方 GitHub](https://github.com/skishore/makemeahanzi)、[COPYING](https://github.com/skishore/makemeahanzi/blob/master/COPYING) | 超过 9000 字的字典与笔画图形分离，并明确来源差异 | 仅作为未来母库候选；通过独立派生步骤产生小型可玩 manifest | 不随机把大库或生僻字送入低龄卡池；不把图形授权套到字典或反之 | 开源数据实现与许可证 | `dictionary.txt` LGPL-3.0-or-later；`graphics.txt`/动画 SVG 为 Arphic Public License；仓库工具代码需逐文件判断 | 暂缓直接引入 | 成人逐字筛选、许可证物料表、数据一致性和渲染测试 |
| Teach Your Monster to Read | [官方产品概览](https://www.teachyourmonster.org/teach-your-monster-to-read-overview/) | 自选怪物、连续世界与小型活动把练习包在冒险身份里 | 让黄小越以汉字魔法师身份从营地出发，修复物件成为可见长期结果 | 不复制怪物、岛屿、故事、任务或美术；不声称其阅读效果可迁移到汉字 | 产品自述 | 代码、内容、角色、美术与音频未授予本项目复用 | 借鉴世界身份与可见进程 | 试玩观察是否主动进入世界、是否注意修复变化 |
| Endless Alphabet | [Apple App Store](https://apps.apple.com/us/app/endless-alphabet/id591626572) | 产品自述以互动字母/单词拼图和释义动画提供低压体验，无分数、失败或时限 | 正确合字后让完整汉字、熟悉词与意义共同变成短魔法反馈 | 不复制角色、单词题、动画、美术和品牌；无失败不等于无清晰反馈 | 产品自述 | 专有/未授复用；仅作机制观察 | 借鉴低压反馈与意义显现 | 儿童是否理解魔法与字义有关；无效组合后是否愿意重试 |
| Endless Numbers | [Apple App Store](https://apps.apple.com/us/app/endless-numbers/id804360921) | 产品自述把数、数量和等式放进可操作的短互动，并避免高分和失败压力 | 每个结构槽位都可直接操作，成功后给具体状态变化而非分数墙 | 不复制角色、关卡、视觉、声音或内容；不采用无限内容扩张 | 产品自述 | 专有/未授复用；仅作机制观察 | 借鉴短互动和低压恢复 | 触控可用性、静音可理解性、减少动画检查 |
| MathTango | [Apple App Store](https://apps.apple.com/us/app/mathtango-math-games-for-kids/id6475483877) | 产品自述用岛屿/星站、任务、角色和物件承载数学活动 | 用营地与墨迹森林变化承载汉字动作，样板只保留一次修复 | 不复制世界、角色、任务、订阅或“never-ending missions”；不以奖项证明学习效果 | 产品自述 | 专有/未授复用；仅作机制观察 | 借鉴世界承载，不借无限任务 | 黄小越是否先感知冒险而非练习；家长区是否不抢首屏 |
| Ninjacha | [官方产品页](https://ninjacha.com/) | 页面展示短局、不同挑战形式与可重玩的变化 | 每局只在已审定的字、两类怪物和一次三选一中产生轻微变化 | 禁用每日挑战、排行榜、全球比较、评级、对战、FOMO 和竞争压力 | 产品自述 | 专有/未授复用；仅作机制观察 | 只借短局变化；竞争/日常机制禁止 | 门禁扫描禁用词；儿童是否因能力选择而非压力想再试 |
| Brotato | [官方 Steam 商店页](https://store.steampowered.com/app/1942280/Brotato/) | 产品页明确 20–90 秒波次、角色/物品组合差异和难度可调 | 3–5 分钟内用两场短战、一次三选一形成“下次换能力”的期待 | 不复制射击、武器、商店、货币、角色、敌人、美术或大量构筑 | 产品商店自述 | 商业专有；无代码/数据/素材复用许可 | 借鉴短波次节奏和可调难度 | 计时回放、第一次施法时间、三选一理解观察 |
| Slay the Spire | [Mega Crit 官方 press kit](https://www.megacrit.com/press-kits/slay-the-spire/) | 官方说明角色牌组差异、选择、遗物与程序化关卡带来不同局面 | 样板只保留一次边界清楚、能改变下一战的三选一 | 不复制卡牌、角色、遗物、敌人、数值经济、地图或品牌；不做大牌库 | 产品官方自述 | 商业专有；press kit 不构成游戏内容复用许可 | 借鉴有意义的有限选择 | 三个选项是否可用图标/短句区分；孩子能否说明为何选择 |
| DragonBox：设计型研究 | [ASU 同行评审记录与 DOI](https://asu.elsevierpure.com/en/publications/a-design-based-approach-to-playful-algebra-learning-with-dragonbo/)，DOI [10.1007/s40751-026-00195-2](https://doi.org/10.1007/s40751-026-00195-2) | 研究同时报告愉快、连接既有知识的可能与游戏内参与未必充分发展代数知识的边界 | 把“合字动作是否真的显出结构与字义”作为独立儿童观察问题，不因孩子投入就宣称学会 | 不把参与度、完成量或产品宣称当作学习证据；不外推年龄/学科 | 同行评审、已接受待刊的设计型研究 | 论文受出版者版权约束；只引用结论，不复制文章或产品内容 | 借鉴审慎评估框架 | 分开记录投入、操作理解、汉字结构理解和成人适龄判断 |
| DragonBox 12+：进度关联研究 | [Wiley DOI 10.1111/bjet.13304](https://doi.org/10.1111/bjet.13304)、[ERIC 记录](https://eric.ed.gov/?id=EJ1380171) | 研究把游戏进度与后续表现的关系置于先验知识和干预次数等背景中 | 本项目只收集最少本地事件，避免把完成局数解释成识字效果 | 不将七年级代数结果外推到 6 岁汉字；不以相关关系替代本项目试玩 | 同行评审研究 | 论文版权由出版方/作者条款管理；只作研究边界引用 | 借鉴测量边界 | 未来如测学习需另设前后测与成人方案；本样板只观察可理解性 |
| OpenAI Game Studio | [OpenAI 官方仓库](https://github.com/openai/plugins/tree/main/plugins/game-studio) | 2D 默认 Phaser，规则/可保存状态与渲染分离，Scene 薄化，密集文本留在 DOM，浏览器截图验证 | V2 规划按 simulation/content/input/asset manifest/Phaser view/DOM UI 分层 | 不采用无关 3D、R3F 或原始 WebGL 路线；不复制未使用插件 | 官方开源实现 + 本机安装实证 | 插件 MIT；未使用外部素材 | 已使用本机启用的 0.1.2；不重复 vendor | 路径存在测试；未来单元测试模拟层 + 浏览器/截图验收 |
| Phaser 官方示例 | [Phaser Examples](https://phaser.io/examples/v3/) | 可查阅 Scene、输入、动画、相机与对象生命周期的最小实现方式 | 只借明确 API 用法，包装在 V2 view/adapter 层 | 示例素材若许可不清楚则不复制；不把示例规则直接变成产品架构 | 官方实现示例 | Phaser 引擎代码 MIT；示例素材无统一可复用结论，视为不取用 | 借鉴实现方式 | 锁定 Phaser 3 主版本，真实浏览器测试受影响状态 |
| Phaser Vite/TypeScript 模板 | [官方 GitHub](https://github.com/phaserjs/template-vite-ts) | 展示 Vite + TypeScript 的入口和 Phaser 项目组织 | 保持当前已有工具链，不复制模板，只比较入口与 Scene 边界 | 不运行或复制模板的遥测/日志辅助；不因模板更新迁移 Phaser 主版本 | 官方开源仓库 | MIT；模板附带素材仍逐项判断 | 架构参考，当前 runtime 不变 | package 主版本门禁、build、浏览器启动 |
| RexRainbow Phaser plugins/notes | [官方 GitHub](https://github.com/rexrainbow/phaser3-rex-notes) | 提供 Phaser UI/行为插件与大量笔记，可降低特定控件实现成本 | 只有原生 Phaser/DOM 明显不足且有 traceability 行时，才逐个评估插件 | 不整包加入、不复制示例素材、不让插件持有核心规则 | 开源实现 | 仓库/package MIT；示例素材仍需逐项确认 | 暂缓依赖；参考优先 | 未来逐插件许可、包体、触控与维护性验证 |
| Ancient Beast | [官方 GitHub](https://github.com/FreezingMoon/AncientBeast) | 成熟浏览器回合制项目可用于观察内容、战斗状态、UI 与渲染边界 | 只研究模块分工和状态流，V2 仍用原创规则、类型和结构 | 不复制任何代码、名称、标志、单位、美术或音频 | 成熟开源实现 | 代码 AGPL-3.0；美术/音频 CC-BY-SA-4.0；名称/标志为商标 | 仅研究架构，禁止直接复用 | 未来架构评审只引用概念，不产生派生代码 |

## OpenAI Game Studio 身份核验

- 本机配置中 `game-studio@openai-curated` 已启用，缓存插件版本为 `0.1.2`，许可证为 MIT。
- 实际读取并用于本基线的 Skill：`game-studio`、`web-game-foundations`、`phaser-2d-game`、`game-ui-frontend`、`sprite-pipeline`、`game-playtest`。
- 实际读取的必要 references：`engine-selection.md`、`phaser-architecture.md`、`frontend-prompts.md`、`playtest-checklist.md`。
- 官方源仓库 `openai/plugins` 固定核验 commit：`11c74d6ba24d3a6d48f54a194cd00ef3beea18f9`。本机 manifest、上述 6 个 Skill 与 4 个 references 的 SHA-256 均与该 commit 内容一致。
- 因插件已安装并可读，项目没有创建 `.agents/skills/vendor/openai-game-studio/`，避免双份漂移。

## 外部 gamedev Skills 安全审查

来源：[gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)，固定 commit `2bea8297d9f09d90d6720c0334221417f7c9a928`，Apache-2.0；上游 `LICENSE` 与 `NOTICE` 已原样保留。仓库快照（2026-08-09）为 437 stars、35 forks、未归档；流行度不是安全证明。

审查范围严格限制为 4 个 Skill 及 3 个直接引用文件：

- `game-feel/SKILL.md` 与 `references/feedback-recipes.md`
- `audio-design/SKILL.md` 与 `references/adaptive-music.md`
- `save-systems/SKILL.md` 与 `references/versioning-and-migration.md`
- `prototype-fast/SKILL.md`

逐文件检查未发现网络请求、凭据/令牌读取、环境窃取、混淆/base64 载荷、安装命令、提权、持久化或隐藏指令。命中项仅为说明文字中的 write/delete，以及保存系统示例中的本地文件写入。风险定级为 **MEDIUM / 可限域引入**：原因是若机械执行，Godot/Unity/文件系统示例可能与当前 Phaser + localStorage 架构不匹配，强震动/闪烁反馈也可能不适合儿童。控制措施是只 vendor 审查过的文件、由本索引限定 Phaser/DOM/localStorage 转译、减少动画、静音可理解性和真实儿童观察。

`prototype-fast` 在本项目解释为 **Minimum Lovable Prototype**：范围极小、只回答一个可观察问题，但第一次魔法、角色、怪物、一次选择、营地变化以及必要视听反馈必须达到能判断黄小越是否被吸引的可信程度；纯灰盒不能作为儿童吸引力结论。

## Skill 采用结果

| 类型 | Skill | 状态 | 身份/许可证 |
| --- | --- | --- | --- |
| 项目专用 | `child-first-learning-game` | 已创建并校验 | 项目自有，STEP 01 |
| 项目专用 | `hanzi-structure-quality` | 已创建并校验 | 项目自有，STEP 01 |
| 全局 | `family-education-game-autopilot` | 已读取并用于基线阶段约束 | 本机全局 Skill |
| 官方插件 | Game Studio 6 个相关 Skill | 已读取并路由，不复制 | OpenAI 0.1.2，MIT，commit `11c74d6...` |
| 精简 vendor | `game-feel`、`audio-design`、`save-systems`、`prototype-fast` | 已逐文件审查并固定 | Apache-2.0，commit `2bea829...` |

没有安装其余约 62 个外部 Skill，没有引入 Godot、Unity、Unreal、Steam 发布或其他无关工作流。
