# STEP4：全输入适配与集中试玩版

2026-09-08。接续 `main` 的 `b22e8e0`；在既有架构和共鸣实现上完成本轮。下列本地机器验证已完成；同一提交的线上身份与交互结果写入本机发布回读记录。

## 试玩入口

- [本次试玩](https://archmays.github.io/Game-Codex/?playtest=step4)：首页可达，列三章／三地图、版本、稳定 ID 和操作提示；手填反馈仅主动保存在本机，可导出转义后的 Markdown。
- [字间行者原入口](https://archmays.github.io/Game-Codex/?play=hanzi-word-adventure)、[字阵守城原入口](https://archmays.github.io/Game-Codex/?play=hanzi-tower-defense)。
- [算式滑轨](https://archmays.github.io/Game-Codex/?world=math-world&station=slider)、[目标工坊](https://archmays.github.io/Game-Codex/?world=math-world&station=target)、[独立配对兼容入口](https://archmays.github.io/Game-Codex/?play=memory-card)。配对未增加首页或 Classic 产品卡。

## 实际变更

字间行者共三章十五房，原首章五房布局与规则保留。`homeward/r1–r5`、`lamplight/light-1–light-5`、`confluence/woven-1–woven-5` 均可直选。只新增日＋月↔明及明照影路这一机制族；第三章组合光、桥木／林、一件携带额度、门风及有限“不”。可见光范围、遮挡、影格碰撞和原子拒绝共用纯规则，失光不能吞材料或把人留在非法格。两房保留不同策略的有效解，搜索仍有40,000状态边界。

字阵守城共三图二十二波：`qinglan-pass` 原六波，`twin-bends` 双路八波，`beacon-keep` 首领八波。仅新图启用木＋林→森、森＋林→森林与森林↔forest，合计11中文字核、7配方、3共鸣。森／森林按规范结构或词序呈现；多目标上限、主次伤害与冷却来自模型，forest 只把最多目标从3增至4。跨路寻敌比较剩余路程；唯一首领最多两次可见预告呼援，无字种免疫。

按随后明确反馈，青岚关3／7／8号位靠近有效路段，6号位少量避让。编号、旧路径、六波、掉落及塔基础数值不变。3／7／8的火塔路段覆盖由277.5／151.7／187.3增至387.5／391.1／387.3；同资源单火首波击败由2／1／1增至3／8／3。6号位覆盖约减3%，同一首波击败仍为2。覆盖长度不被当作总体玩家胜率。

顶部新增本页1×／2×速度，键盘、鼠标、触屏使用同一原生按钮；保持0.05秒固定模型步长，暂停／隐藏仍不推进。切图、重置、重玩或刷新回到1×，速度不写入检查点。完整新图验收使用默认1×，独立短用例才验证产品2×。

## 输入和共享界面

长期规则写入根 `AGENTS.md`，详细动作和路线见 [input-contract.md](input-contract.md)。共享代码只管理焦点、区域导航和输入生命周期，游戏规则仍由各自操作入口处理。

| 表面 | 键盘关键操作 | 鼠标／触屏及恢复 |
| --- | --- | --- |
| 首页、Classic、数学世界、试玩页 | Tab／Shift+Tab、原生确认、可见焦点 | 单一语义入口、返回、自然滚动 |
| 设置、弹窗、Vault、反馈 | 有界弹窗焦点、Esc关闭；输入框与IME不触发游戏 | 点击／触控、导出与恢复、空反馈无记录 |
| 字间行者 | 方向／WASD、Shift+方向查看、Space/E明确主动作、X/C/Z、拆分与下一房 | 邻格走、物件查看、明确落字选择；提示、撤销、章内重置 |
| 字阵守城 | 材料／塔位／英文分区导航，Enter/Space、P、Esc | 选料→目标→确认；独立射程查看；拖动和点击替代、暂停／重玩 |
| 滑轨 | 原上下方向、跨轨导航、Esc取消拖动 | 原拖动和点击共用规则；提示、撤销、换关焦点 |
| 目标工坊 | 卡片／运算区箭头、依次选左右数、显式交换 | 减／除仍有序；确认、提示、撤销与返回 |
| 独立配对 | 响应式网格箭头、Enter/Space翻牌、Tab退出 | 点击翻牌、误配恢复、重开；计时重绘保留帮助焦点 |

主要动作约48–56 CSS px，其余至少44。覆盖360／390手机、768／1024平板横竖、桌面、低高度、旋转、DPR、缩放与混合输入；没有按UA锁定设备模式。Chromium、可用Firefox／WebKit均有真实按键关键流程。键盘主回放没有用脚本聚焦或点击替代导航。

## 保存与保护范围

冒险使用v2，每章独立Journey和可用撤销；塔防使用v3，每图独立检查点、材料实体、英文归属与领取记录。只有新键不存在且旧值合法时复制，旧原始字符串保留；坏／未来新值不被旧值覆盖。每次写入前比对挂载时所见原文，防止旧页面覆盖后来的恢复或写入。Vault精确登记43键、42项可导出，包含新游戏键和反馈键；不清任何旧存档。

新游戏、继续游戏和所选章／图重置均有明确入口；已有内容重置须确认范围，其他槽保留。深链接只选择目的地，不重置。塔防战中换图明示回到波前检查点，整波经济状态一起回滚。原数学题库、求解器、运算意义、奖励和进度模型未改；旧语言运行时与被退役数学模块仍不恢复。

## 六顶帽复查与实改

谜题及战斗复查详见 [冒险设计记录](hanzi-word-adventure/step4-design.md) 和 [守城设计记录](hanzi-tower-defense/step4-design.md)。输入复查至少完成以下一轮实际修订：

| 视角 | 问题与落地 |
| --- | --- |
| 白帽／事实 | 逐项保留原滑轨方向与目标工坊左右数语义；为WebKit原生链接补显式tabindex=0，未改浏览器偏好 |
| 红帽／感受 | 误配计时、章节和关卡重绘曾丢焦点；保留配对帮助开合／焦点，内部换关聚焦轨道，首次进入则保留数学世界标题焦点 |
| 黑帽／风险 | 原生按钮Space不能同时驱动世界；拦IME与重复确认，滑轨Esc取消未完成拖动；HTML原生DnD的正常pointercancel交接与真正dragend／失焦取消分开 |
| 黄帽／价值 | 区域只有一个Tab入口，材料、塔位、英文与卡片可用方向键快选；指针可随时混用 |
| 绿帽／替代 | 所有必要拖动有点选入口；冒险可明确选落字处，塔防可只看射程而不改变选料 |
| 蓝帽／收口 | 失败先缩小定位再改原因；测试夹具只保留青岚原两共鸣，不放宽坏存档验证；重测试顺序执行，源码修改与验收不并行 |

参照范围限于W3C键盘／拖放／指针取消指引、[HTML拖动生命周期](https://html.spec.whatwg.org/multipage/dnd.html#drag-and-drop-processing-model)、Baba Is You、A Monster's Expedition与Ironhide官方作品说明。未复制关卡、代码或素材。新字及义项定向核对汉典与Oxford；现代拆合和光魔法明确为游戏规则。

## 验证记录与身份

证据统一保存在 `tmp/tasks/GAME-CODEX-STEP4/`，旧任务截图和报告保留。各次失败、缩小定位与通过日志分开留存；最终报告只采用已完成的对应检查。

本地结论为 **PASS_MACHINE_LOCAL**。下面列最终有效结果；配置中不适用于该设备的用例明确跳过，未把跳过、旧失败或测试夹具当作普通操作通过。

| 检查 | 实际结果 | 任务目录内证据 |
| --- | --- | --- |
| 全量单元／内容／存档／输入事务 | 38文件、504项全部通过；塔防133项、冒险47项 | `logs/unit-final.txt` |
| 十五房搜索与逐动作回放 | 全部可解；最多10,002状态、60动作，未扩大40,000边界；另有替代解与死锁撤销 | `adventure/room-search.json`、`logs/adventure-solver.txt` |
| 冒险完整浏览器 | 20通过、2设备专用跳过；纯键盘与触控十五房、鼠标新章／替代解、重置／继续 | `logs/adventure-final.txt` |
| 新地图完整普通战斗 | 4场通过：两图各键盘森林／火山及触控无英文火山／山林；默认1×、无状态／时钟注入，全部16耐久／0漏怪 | `logs/tower-new-natural-final.txt`、`tower/*-natural.json`、`tower/new-natural-final/` |
| 青岚旧关完整普通战斗 | 4场原六波通过；原断言保留 | `logs/tower-old-natural.txt`、`tower/battle-*.json`、`tower/natural-*.json`、`tower/old-natural/` |
| 新旧地图模型与新配方 | 旧24组、新8组自然全通；两配方单靶／移动群／真实首波比较及 forest-only 八波对照 | `tower/balance.json`、`tower/forest-isolation/model-balance.json` |
| 五游戏首页→循环→恢复／返回 | Chromium桌面／手机、Firefox、WebKit合计24主流程通过；纯键盘、纯鼠标、纯触控，生产包验证 | `logs/input-production-final.txt` |
| 设备／混用／取消／长按 | 17项通过，7尺寸、旋转低高度及可用三浏览器；之后滑轨焦点与Esc受影响9项再次通过 | `logs/input-geometry-supplement.txt`、`logs/input-slider-focus-fixed.txt` |
| 塔防输入／射程／速度 | 分区导航、原生拖放／点选替代、Esc及迟到drop、双图重置、旧配方矩阵通过；速度／青岚塔位4项通过，1×／2×实测约1.96／1.99，暂停零推进 | `logs/tower-controls-spacing.txt`、`logs/tower-native-drag-fixture-fixed.txt`、`logs/tower-original-controls-remaining.txt`、`logs/tower-speed-placement-first.txt` |
| 数学保护与原门禁 | 滑轨既有55项覆盖；数学世界三尺寸102通过、9适用性跳过；模型／题库／求解／奖励／进度与锁文件无差异 | `logs/math-slider-*.txt`、`logs/math-world-*.txt` |
| 共享发布门禁 | 生产smoke14、命中4、滚动4、readiness／Vault／a11y28通过；natural-use5通过1适用性跳过；隐私8单测＋89运行时文件无禁止传输；构建及静态登记通过 | `logs/production-smoke.txt`、`logs/hittest-production.txt`、`logs/scroll-production.txt`、`logs/readiness-trial-route-fixed.txt`、`logs/natural-use-final.txt`、`logs/privacy-final.txt` |
| 实际画面与录像 | 4组桌面／手机PNG及ARIA实看后原字节无更新复核通过；冒险19.8秒及塔防19.84秒视频已实际解码抽帧审看 | `visual-lit-candidates/accepted.json`、`visual-no-update/`、`clips/adventure.webm`、`clips/tower.webm` |
| 发布核验脚本本地演练 | 普通键盘／触控合明、持光进入影格、五次撤销；合森林、部署／实际击败、2×／暂停／切图回1×及受保护入口全部通过；此处使用明确的本地构建标记 | `release-preflight-root/verification.json` |

forest的增益具有敌群条件。仅装备forest的完整合法波次中，烽台关有68次额外第四目标命中，耗时273.65秒，对照无英文275.15秒；双岔湾该摆位额外命中0，耗时同为278.80秒。早期260／618统计包含全部森林发射，不能当额外分枝；全部英文的速度收益也不能只归因forest。工具字段已更名并增加准确的第四目标计数，旧证据保留。森林单靶低于等价值前体；真实第一波某些摆位也更慢，详见守城设计记录中的四组对照。

关键运行时代码从视觉验收到最终完整浏览器保持一致，规范化运行时SHA-256为 `144c083914070d019b64a688aba71a22966c98d51a1d1fa1d1f50542a855bc89`。完整战斗前后源树身份均为 `9ad36e2aab12d69c3a2b83af88790c305acc56f4aec06cbfd1b082404092fca5`；随后只修正模型证据统计及报告，最终504项测试覆盖修正后的工具。源码身份采用既有规范化算法记录，截图与ARIA采用原字节SHA-256，未更新期望、掩盖画面或以DOM检查替代实看。

最终提交身份以本报告所属提交和Pages的 `data-build-commit` 为准，准确SHA在交付消息及本机 `final-release.json` 给出。既有CI／Pages流程保留并加入本轮输入、新图与十五房门禁；发布后 `online-final/verification.json` 绑定准确SHA，只有在同SHA普通键盘／触控中重新执行光合成与撤销、森林合成／部署／实际攻击、1×／2×与换图恢复，并回读受保护入口，才记 `PASS_MACHINE_RELEASED`。报告不写自引用提交SHA，也不把仅CI成功当线上交互通过。

首轮提交 `209d7a5` 的 CI 与 Pages 均在同一双岔湾纯键盘脚本耗尽整场20分钟预算，其他守城用例59通过、12适用性跳过；CI已到第8波，较慢的Pages机器停在第6波选料，失败截图仍为耐久16的正常波间状态。该轮没有发布。修正仅涉及测试导航：使用已有左右／Home／End、以Esc取消并断言选择清空，刷新后先用真实Tab重新进入游戏上下文。三浏览器12条键盘主流程通过，双岔湾完整八波在原20分钟上限内以13.3分钟通过、16耐久／0漏怪。新记录在 `logs/input-shortest-key-navigation.txt`、`logs/tower-keyboard-resume-fixed.txt` 与 `tower/keyboard-resume-fixed/`。为容纳已观察到的CI导航耗时差异，最终整场键盘脚本预算为有界30分钟，触控仍20分钟；单次操作15秒、单波120秒及所有波次／布局／焦点／经济／胜利断言保留。游戏代码、1×时钟、规则数值和运行时身份均未改变；后续提交重新走既有完整发布门禁。

提交 `585bd8a` 的 Pages 全部门禁通过并已部署，同SHA的线上键盘／触控光路、撤销、森林独立击败、速度／暂停／切图和受保护入口也通过。该提交的另一条CI有59项守城通过、12适用性跳过，唯一失败是速度综合用例在最后返回首页时耗尽整场120秒；倍率、暂停、刷新及切图恢复断言此前均已通过。修正仅将该综合脚本的整场预算设为有界5分钟，增加15秒操作限制和倍率诊断输出，全部行为与倍率阈值保留。定向桌面／触控两项再次通过，倍率分别约1.975／1.982，暂停推进为零，见 `logs/tower-speed-ci-budget.txt`、`tower/speed-ci-budget/`。该次失败日志和已完成的线上证据保留，最终发布提交继续沿原门禁核验。

机器与模拟设备验证不代表真实儿童好玩、学习有效或留存，也不冒充实体手机验证。本轮未接麦克风、云服务、账号、货币、遥测或空SDK；后续持续语音须另行明确授权。本轮不默认制作ZIP。
