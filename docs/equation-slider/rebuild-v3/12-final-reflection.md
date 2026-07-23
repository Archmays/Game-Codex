# 算式滑轨 V3｜三轮最终反思

## 使用边界

本文件记录 2026-07-23 重构过程中已经观察到的问题、已经实施的修订和对应的针对性重测。它不是 Gate D、GitHub Pages 或真人儿童验证的替代品；最终完整门禁、production preview、Pages 工作流与线上 URL 由 `11-final-acceptance-report.md` 记录，本文不提前宣告这些项目通过。

## 第一轮｜数学、关卡数据和算法

### 检查

本轮逐项检查 evaluator、solver、fixed/movable slot、coverage、40 关手工金标准、200 关总目录、tile 值分布、`0`/`1` 使用、重复、三级提示、difficulty 和存档迁移。

### 发现

1. 旧实现把显示结构、可移动结构和覆盖进度混在一起，重复的 `0`、`4` 与 operator 选择容易产生“只是在滚动数字”的题感；只学习加法时仍提供 movable operator 也没有数学决策价值。
2. coverage 若按可见值而不是 tile identity 记录，会把两个同值但不同位置的 tile 错当成同一个学习对象；multi-target 与 equality 若按数组位置或结果数值合并，也会丢失目标身份。
3. 只验证 schema 字段存在还不够：若发布的 `minimumMoves`、valid arrangement 数、difficulty 或覆盖指标与 solver 当前输出不一致，目录会携带过期分析。
4. 重复值并未完全消失。当前目录有 108 条重复值 reel，涉及 82 关；216 个重复值 tile identity 全部可由至少一个成立关系覆盖，但其中 45 关允许一次“中央数学显示不变、tile identity 改变”的移动。这在算法上不是孤立 tile，却可能在儿童看来像无意义移动。
5. 老存档不能直接授予 V3 关卡完成或教程完成；否则新规则下尚未玩过的内容会被误标为已掌握。

### 修订

- evaluator 只处理结构化 token，明确拒绝除零、非整除和负的中间结果，并分别验证等式两侧。
- V3 schema 明确区分 `fixed-token` 与 `movable-reel`。Chapter 1 的 `+` 为 fixed token；每条 movable reel 恰好三个 tile，ID 全局稳定且唯一，number/operator reel 均拒绝三个值全同。
- solver 枚举真实 reel arrangement，以 tile ID 和显式 target ID 计算覆盖；每关必须可解、无孤立 required tile、无缺失 target，并有唯一最小覆盖集合。关卡定义、solver 输出和审计结果均保持确定性。
- 发布时重新计算并核对 `minimumMoves`、correct/valid arrangement、coverage 与 difficulty 指标；任一手写或缓存指标漂移均 fail closed。
- 40 个手工金标准作为模板事实源，确定性物化另外 160 关。最终目录为 4 章 × 50 关、20 个站区 × 10 关；模式分布为 130 个 target、30 个 multi-target、40 个 equality，movable reel 数分布为 2/3/4/5 条分别 60/100/25/15 关。
- 全量 number tile 范围为 1–36：`0` 为 0 次，`1` 为 28 次（约 1.81%）。`4` 为 200/1545（约 12.94%），与 `3`、`5`、`6` 同属常用基础数带，而不是唯一高频值。Chapter 1 的目标、有效结果和数字 tile 均不超过 20。
- 重复审计同时检查 exact duplicate、near duplicate、同站相邻重复、canonical pattern 过度使用，以及重复值 tile 的可覆盖性。当前 exact duplicate、near duplicate、同站相邻重复和不可覆盖重复 identity 均为 0。
- 提示固定为概念、位置、方向三级，并从当前 board state 重新求 continuation；玩家走过计划外的正确路线后，不复用失效的预写步骤。无安全 continuation 时提示 fail closed。
- V3 使用独立的 save version 2 进度。旧版完成和教程状态仅作为只读 legacy archive 保留，不授予 V3 完成；只迁移安全的声音偏好，升级说明在确认前持续可见，未来版本存档不会被旧客户端覆盖。

### 重测

- `pnpm levels:generate` 与 `pnpm levels:check` 已针对性通过，四章 JSON 和 `generated-audit.json` 可由同一 40 关模板逐字节重建；目录哈希为 `fnv1a32-2b6c450b`。
- catalog、generation、levels、level-audit、schema、solver、evaluator、feedback、progress 与 progression 的 Vitest 覆盖了 200 关数量、确定性、值分布、唯一最小覆盖、指标篡改、提示 continuation 和迁移边界。
- reducer 的 1000 次确定性混合动作测试持续检查 index、状态枚举、覆盖集合、move count 和不可变性。
- 40 个 gold level 已有逐关浏览器合同测试，25 关 UI-only agent 试玩也跨越所有章节；它们属于局部浏览器证据，最终汇总仍以 Gate D 报告为准。

### 本轮结论与残余风险

关卡目录已经从“能算出答案”提升到“schema、solver、身份覆盖、生成谱系和分布均可审计”。仍不能把“216/216 重复 identity 可覆盖”解释为儿童一定理解：45 关的可见值不变移动必须在真人观察中确认是否造成困惑；若儿童把它理解为纯打乱，应优先调整这些 reel 或完成语言。

## 第二轮｜交互、UI 和无障碍

### 检查

本轮逐项检查教程、pointer、可见 controls、DOM 不变量、页面滚动、`390×844`、5-slot 高阶题、keyboard、ARIA、reduced motion、audio 与 destroy cleanup。

### 发现

1. 旧教程是阻挡正式棋盘的静态流程，靠“下一步”推进；它没有证明儿童能在真实首关完成一次 reel 操作。
2. 旧 pointer preview 会替换并复制 DOM，首关视觉 tile 曾由 6 个膨胀到 27 个，control 内还出现 tile 后代；预览、取消和丢失 capture 都缺少稳定身份合同。
3. 初版响应式修订仍发现部分手机触控目标只有 40–43 px；`390×844` 首屏和 5-slot 题需要分别验证，不能由桌面截图代替。
4. 错误反馈曾使用移动前状态，导致文字描述旧算式；声音按钮最初只是偏好开关，没有实际声音；站区/章节 checkpoint 数据存在但没有进入完成 UI。
5. active drag 期间若另一输入 adapter 同时提交，会产生竞态；表达式若自身使用 `aria-live`，pointer preview 又会造成逐帧朗读噪音。

### 修订

- 教程直接挂在正式 `es-1-01` 棋盘上：目标为 6，初始式为 `4 + 5 = 9`，玩家必须真实把右侧 `2` 移到中央后才进入 coverage 提示；棋盘不 `inert`，没有静态“下一步”替代，跳过入口始终保留。
- 所有 drag、相邻 tile、上/下按钮和键盘箭头进入同一个 board transition。pointer 只保留一个 active pointer，14 px 后进入 drag，35% tile 高度或速度阈值才提交，长 swipe 也只移动一格；`pointercancel` 与 `lostpointercapture` 恢复预览。
- render model 每帧复用同一组正式 tile：每条 reel 正好三个 `data-tile-id`，按钮没有 tile 后代，fixed token 不伪装成 reel。100/120 次浏览器交替动作与 pointer preview 测试持续检查节点数、ID 集合、control 数和棋盘高度。
- board state 增加 `ready / dragging / feedback-lock / complete` 串行状态和动作来源；dragging 时拒绝 direct adapter，完成后拒绝 undo/reset，只有 replay 创建新 session。对应 reducer 并发回归已通过；浏览器并发用例已纳入 release spec，最终状态仍须由 Gate D 汇总。
- reel 手势命中区与页面滚动分离；页面其他区域仍可滚动。手机样式把主要触控目标提升到至少 44×44 px，并为窄屏 reel 使用 48 px 级别命中区。
- UI 只保留目标、中央式、coverage、棋盘和撤销/提示/重置的主层级；内部英文技能标题改为儿童可读的中文站区说明。完成 UI 按普通关、休息点、站区和章节显示短 checkpoint，不再每关强迫长反思。
- 反馈改为读取提交后的 state，并区分新 target、新 tile、重复成立和完整完成。表达式本身不再逐帧 `aria-live`；克制的反馈区与独立 live region 承担状态播报。
- fixed token、reel、当前位置、三个可选值、选中状态和是否点亮都有明确语义；真实 Tab、Enter、Arrow key 路径可完成、重玩、下一关和返回，不依赖 pointer。
- `prefers-reduced-motion: reduce` 时不等待反馈动画解锁；声音按钮使用 Web Audio 合成短促的移动/成功/完成提示音，选择可持久化。destroy 会取消 pointer、listener、异步请求和音频上下文，离开再进入建立一个新 session。

### 重测

- 旧实现的 Playwright 基线为 23 项中 21 项失败、2 项通过，明确证明教程、DOM、pointer、coverage 和手机首屏门禁能捕捉旧缺陷，而不是只为新实现设计的恒绿测试。
- 修订后，Gate A 的教程、6/9/15 tile、四类输入、pointer cancel、lost capture、滚动边界、reduced motion、离开重进和 `390×844` 首屏用例已做针对性浏览器回归。
- 首轮视觉回归发现 40–43 px 目标后继续修订，原有 11 个响应式场景随后通过；新增的首关初始、首次点亮与部分覆盖截图场景用于补足状态证据，最终截图集由 Gate D 复核。
- release 浏览器用例已覆盖提交后反馈、完整键盘路径、rest/station/chapter checkpoint、真实 AudioContext 调用、存档声音偏好和 destroy 导航。active-drag 串行化在 reducer 层已闭环，真实浏览器并发仍保留为最终发布门禁中的显式用例，本文不提前标为最终 PASS。

### 本轮结论与残余风险

交互已从 DOM 驱动的视觉替换改为单一不可变状态驱动，旧版最危险的教程阻挡、节点膨胀和多入口分叉已被合同化测试覆盖。尚未用真实屏幕阅读器、真实儿童手指或线上手机网络环境完成验证；这些缺口不能用 Chromium 自动化代称已通过。

## 第三轮｜教育性和趣味性

### 检查

本轮逐项检查：首关不读长说明能否开始、reel 移动是否有数学意义、是否仍大量出现 `0`/`4`/重复数、每章 50 关是否真实变化、提示是否是支架、回顾是否打断节奏、是否仍有纯打乱、是否存在压力或成瘾机制、下一关节奏，以及 UI-only agent 试玩发现。

### 发现

1. 短 coach 已能让自动化 agent 在正式棋盘完成教程首步，但这只证明操作路径可执行，不能证明儿童不读说明也理解目标、中央黄色区域或点亮规则。
2. 目录已移除 `0`，并把 Chapter 1 的 operator 固定为 `+`；不过重复值 identity 仍可能让一次操作看起来“数字没变”。数学上它服务完整覆盖，体验上却可能被理解成无聊的纯打乱。
3. 50 关若只改 ID、数值或 target 会产生机械感。当前目录虽有站区、模式、reel 数、技能、scaffold 与运算进阶变化，自动重复审计也为 0，但这些指标仍不能替代持续游玩的主观感受。
4. agent 试玩为了验证 continuation，刻意大量使用三级提示。它能证明提示从当前 UI 状态可执行，却不能证明一级提示对儿童足够、三级提示不会变成代做，或孩子愿意继续。
5. 每关强制长回顾会打断节奏；相反，完全没有停顿又会丢失对数学关系的回看机会。

### 修订

- 首关先呈现一个短目标和一个真实操作，不要求先读长说明；成功后只解释点亮与继续寻找不同关系。
- movable reel 必须改变数学值、可覆盖 identity，或二者；没有三个值全同的装饰性 reel。只有“选择运算符”本身是学习目标时才使用 movable operator。
- 四章的任务从 20 以内组成、加减关系、乘除因数关系推进到等式与跨章迁移；每章 5 个站，按 guided、supported、independent、review、transfer 变化。2/3/4/5 reel 和 target/multi-target/equality 共同提供结构变化，而不是只换皮。
- 三级提示按需展开：先概念，再位置，最后才给一格方向；每次从当前状态重算，错误路线后仍能继续。提示次数只用于回顾，不设惩罚。
- 普通完成卡保持短促；只在休息点、站区或章节结束显示额外一句关系回顾。下一关、再玩一次和返回地图都保持可见并支持键盘。
- 没有倒计时、生命、连胜、随机奖励、排行榜、付费、广告或自动连播；move count 与 hint count 不用于给儿童贴“快/慢”或“聪明/不聪明”的标签。
- 对重复值 identity 不做粉饰：已把 45 个可能出现“值不变移动”的关卡列入真人儿童观察重点，准备根据实际困惑调整 reel、点亮说明或关卡覆盖合同。

### 重测与 agent 试玩

- UI-only agent 只读取可见 DOM、反馈、coverage 和三级提示，通过 control、相邻 tile、keyboard 与 mouse drag 完成正式教程和 25 关；样本覆盖四章、所有章末关、target/multi-target/equality、2–5 reel，并在 4 关先走错误路径。整个流程没有调用 reducer、注入完成状态或使用控制台兜底。
- 25 关试玩共提交 226 次移动，连同教程首步为 227 次；用于求 continuation 的 221 个决策刻意走到第三级提示。这个结果证明“当前可见状态 → 提示 → 可执行一步 → coverage 完成”的闭环可运行，也暴露出 agent 运行是高度提示驱动的，不能据此声称关卡可独立完成或具有儿童趣味性。
- 错误路线后的反馈与继续操作、普通完成、checkpoint、下一关和返回路径均被浏览器用例覆盖。自动化约 55 秒的执行时间只是机器速度，不是儿童完成时长、难度或投入度证据。

### 本轮结论与残余风险

V3 已去除压力型和成瘾型机制，并用真实关系、分层提示与阶段 checkpoint 代替纯速度或纯打乱目标。最大未知仍是儿童是否理解 tile identity coverage，尤其是 45 个可见值不变移动，以及孩子是否在 5–10 分钟后仍愿意继续。只有按 `10-child-playtest-checklist.md` 完成去身份化真人观察后，才能决定是否需要调整重复值 reel、提示语言、回顾频率或下一关节奏。

## 最终诚实边界

本反思支持后续 Gate D 与网页端交接，但不替代 `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm test:e2e`、`pnpm build`、production preview、Pages workflow 和实际线上手机检查。以上发布证据必须由最终验收报告独立记录。

`Child validation: NOT YET PERFORMED`
