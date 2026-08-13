# Traceability Matrix

状态：历史 STEP 01–07 决定与证据继续保留。2026-08-13 的精确授权 `HUMAN_AUTHORIZED_SKIP_REAL_SECOND_USE_AND_COMPLETE_V1_ONE_SHOT_01` 允许在不等待真人 Second-Use 的前提下完成固定 12 字 V1；机器发布与未来可选儿童验证已拆分。每个新功能仍必须说明儿童价值、汉字学习价值及自动验证路径，并且不得从机器证据推断真人结果。

| 功能 | 对应北极星原则 | 参考案例 | 儿童价值 | 汉字学习价值 | 自动验证 | 真人试玩观察 | 当前状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 游戏世界首页 | 第一眼是世界与冒险；两次点击内开始 | Teach Your Monster、MathTango | 产生“去我的世界”而非“上课”的预期 | 不让课程目录遮住合字动作 | 隐藏 child route、主按钮、两步内到可玩状态；儿童首屏禁用指标扫描 | 是否主动进入；第一描述是冒险还是练习 | `STEP02_ACCEPTED_CARRIED_FORWARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 字灵营地 | 结束时看见永久世界变化 | Teach Your Monster、MathTango | 有属于自己的安全起点和回归理由 | 四个新字与形状/功能/颜色变化建立可回忆联系 | 初始/四项修复 state ID、存档回载、截图差异 | 是否注意哪个物件改变；是否愿意回来看 | `STEP02_ACCEPTED_CARRIED_FORWARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 墨点精灵 | 少量提示即可理解；角色陪伴 | Endless 系列、Teach Your Monster | 用世界内角色给即时而非成人式说明 | 指向部件与结构槽，不替孩子答题 | 4 秒提示触发/操作即收起；≤16 字；分层提示与回声路线测试 | 是否跟随一次提示后能独立行动；是否需要家长代读 | `STEP02_ACCEPTED_CARRIED_FORWARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 五张手牌 | 范围小、选择清楚、触控简单 | Pin it、Slay the Spire（仅有限选择） | 既能挑选又不过载，手机也可点 | 让部件成为可操作对象；干扰项可探索但不歧义 | 每场固定 5 张；全量两/三牌母库求解；实例 ID；44px/键盘 | 是否能找到部件；是否误把牌当答案按钮 | `STEP02_ACCEPTED_CARRIED_FORWARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 结构槽位 | 部件进入真实位置就是施法 | Pin it、Hanzi Writer | 操作结果直观、可撤回、无惩罚 | 首战左右、次战上下、Boss 两结构综合迁移 | 单一 board 真源；slot/component instance ID；撤回/cancel/retry 快照 | 是否理解部件“放哪里”而非只选“哪个字” | `STEP02_ACCEPTED_CARRIED_FORWARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 合字动画 | 动画必须显出真实结构 | Hanzi Writer、Game Studio | 四次大事件有可信反馈且不遮信息 | 从部件到整字的关系可见，不瞬间偷换 | simulation 先决；事件顺序/预算/reduced-motion/四字截图 | 第一次成字是否关注；能否指回两个部件 | `STEP02_ACCEPTED_CARRIED_FORWARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 字义魔法 | 汉字自身变成魔法，而非答题后无关攻击 | Endless Alphabet、Pin it | 光、花、树林与星路直接改变世界 | 字形、读音、熟悉词、意义和效果一一绑定 | final manifest、formation→meaning→world event 顺序、静音截图 | 是否能复述字或词；是否把效果和字义联系起来 | `STEP02_ACCEPTED_CARRIED_FORWARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 三选一 | 想继续来自自主选择与能力差异 | Slay the Spire、Brotato | 三个无最佳暗示的玩法选择在 Boss 立即可见 | 选择改变支持/提示/重听，不替代合字 | 恰好三项；两阶段效果事件；无自动完成/数值/推荐 | 能否指出选了什么，并认出它在 Boss 中生效 | `STEP02_ACCEPTED_STORYBOARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 小首领 | 3–5 分钟完整起承转合；不加新系统 | Into the Breach intent、Brotato 短波次 | 可预读、无 HP grind 的两层高潮 | 林复用左右；星复用上下；只综合已教结构 | 林→星状态、intent、0.8–1.5s 轻遮罩、阶段安全重试、能力事件 | 是否理解下一步；困难时想换方法还是失去兴趣 | `STEP02_ACCEPTED_STORYBOARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 营地修复 | 掌握与世界永久变化带来回归期待 | MathTango、Teach Your Monster | 灯、花、守护树、星路持久改变营地 | 四字各自以意义修复世界，形成回忆线索 | 四修复 key、至少两类可见变化、重载一致、前后截图 | 是否主动指认每项变化；是否归因于对应字 | `STEP02_ACCEPTED_CARRIED_FORWARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 魔法书 | 新汉字进入自己的收藏；本地永久保存 | Endless 系列低压探索、Game Studio | 四页可回看、重播、朗读，无分数和排名 | 重现字形、拼音、词义、结构、部件、意义魔法和发现顺序 | 4 exact IDs；replay formation/meaning/read adapter；回载/清除 | 是否主动翻页、重播或认出刚获得的字 | `STEP02_ACCEPTED_CARRIED_FORWARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 安全失败 | 失败/撤退不羞辱、不惩罚永久进度 | Endless 系列低压边界、child-first Skill | 愿意探索和再试，不怕失去 | 保留已发现字和已完成 Boss 阶段，反馈只指向结构 | 禁用文案；safe_retry；阶段恢复；刷新不恢复动画中间态 | 表情/语言是否受挫；是否理解下一步；是否愿意再试 | `STEP02_ACCEPTED_CARRIED_FORWARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 本地存档 | 只保存在本地、最少匿名记录 | Game Studio、save-systems | 世界变化可回来继续，隐私边界清楚 | 保存发现/修复/选择，不保存成绩画像 | STEP02 迁移、版本/校验/损坏回退、safe-boundary restore、无网络 | 家长能否导出/清除；儿童重开后是否认出变化 | `STEP02_ACCEPTED_CARRIED_FORWARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 减少动画 | 反馈明确但不过度刺激；声音可选 | W3C、Game Studio、game-feel、audio-design | 运动敏感或静音场景仍可玩 | 结构、完整字、读音文字和结果在替代分支不丢失 | bus/mute/duck/cleanup；reduced motion；visual fallback；设置持久化 | 是否更舒适；静音是否仍懂；设备 TTS 是否可接受 | `STEP02_ACCEPTED_CARRIED_FORWARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 第二战“花”迁移 | 教一个结构后换结构迁移 | Pin it、level-design、正字法研究 | 花开并让道路恢复，避免重复感 | 从“明”的左右结构迁移到“花”的上下结构；不提前泄题 | 5 牌唯一解、首次提示只指上下、分层提示、完成后呼吸段 | 是否主动改变放置策略；是否把花开归因于“花” | `STEP02_ACCEPTED_STORYBOARD / STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 节奏与呼吸 | 3–5 分钟完成一条短冒险 | level-design、PBS KIDS playtest | 施法快、转场可跳、世界变化有观察时间 | 每次结构/词义有停留，不被下一层 UI 立即遮住 | 强制等待预算、首 spell 最短路径≤60s、无倒计时 | 实际局长、停看位置、是否因转场失去兴趣 | `STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 本地最小试玩事件 | 最少匿名记录只辅助观察 | UNICEF RITEC、child-first Skill | 不建立儿童画像或远程追踪 | 只记录流程卡点，不称成绩 | 精确 schema、localStorage only、家长导出/清除、无 remote request | 观察者把事实与解释分开，不从事件推断学习效果 | `STEP03_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 家长 STEP 03 终审 | 技术 PASS 与人类接受分离 | project review contract | 成人可按新/受影响项作清楚决定 | final 12、结构/词义/音画可逐项核验 | feedback/review identity SHA、changed-only freeze | 家长已完成全部必填；唯一 audio `REVISE`；child-first-use `YES` | `STEP03_PARENT_ACCEPTED / AUDIO_REVISED` |
| 拼音显示与 TTS 分离 | 声音可选且不承担规则 | audio-design、家长 changed-only feedback | 拼音仍看得见；静音也可完整操作 | 朗读只连接字形与 accepted 熟悉词，不把拼音当口语内容 | 四句 exact、12 字无 Latin、同一数据源、mute/silent fallback | 家长每次 session 在实际设备试听或合法选择静音 | `STEP04_IMPLEMENTED / DEVICE_PREFLIGHT_REQUIRED_PER_SESSION` |
| 儿童首次使用门禁 | 未经家长 READY 不启动真实观察 | PBS KIDS、child-first-use-observation | 保护隐私、安全、第一次接触与随时停止 | 只观察真实结构使用，不模拟儿童结果 | session token、source freeze、preflight、schema、PII denylist、START/FINISH | 仅在家长现场授权后由真实孩子与观察者完成 | `AUTHORIZED_CHILD_FIRST_USE_READY / REAL_OBSERVATION_NOT_RUN` |
| 同源家长观察器 | 技术事件与人类解释分层 | game-playtest、save-systems | 成人只提供技术支持，不看到答案或 solver | 观察内置机制是否被看见，不写“学会” | BroadcastChannel + storage fallback、sequence/dedupe/reconnect、stop、local export | 家长记录中文 enum、介入代码、well-being 与可拒绝选择 | `STEP04_IMPLEMENTED / HUMAN_EVIDENCE_PENDING` |
| 真实 first-use 证据对账 | 真实儿童证据先于产品晋升；事实与解释分开 | child-first-use-observation、game-playtest | 一次真实使用的舒适度与继续意愿可被诚实保留 | 只记录实际进入四次合字流程，不推断掌握或保持 | raw SHA 锁定、事件时间线、reach/replay 纯推导、v1→v2 warning | 家长观察与技术事件分栏；无成人介入；立即再玩请求不等于实际重玩 | `REAL_EVIDENCE_RECONCILED / NO_LEARNING_CLAIM` |
| 显式语音上下文 | 声音可选且不泄漏答案 | audio-design、child-first-learning-game | 非战斗阶段不会意外提前说出下一字 | 只朗读已明确形成/发现的字；Ink Echo 仍为显式 Boss 支持 | phase whitelist、mismatch、spellbook、Ink Echo、pinyin-free utterance 测试 | STEP 05 changed-only 家长试听 | `CHANGED_ONLY_FIX_IMPLEMENTED / PARENT_REVIEW_PENDING` |
| 私人游戏世界候选 | 第一眼是世界与冒险；经典目录次级 | child-first-learning-game、game-ui-frontend | 营地变化可持续看见，三对象即可理解 | 四字收藏与修复状态直接投影既有进度，不造第二套成绩 | no/partial/repaired/corrupt save、copy/privacy、三 viewport、no network | 家长 changed-only 审核；默认入口须另行授权 | `PRIVATE_WORLD_ENTRY_CANDIDATE_READY_FOR_PARENT_REVIEW` |
| 世界导航与经典百宝箱 | 两次点击内开始；既有游戏不受损 | game-ui-frontend、save-systems | 可在世界、森林、魔法书、经典游戏间返回 | 导航不改变合字规则或永久进度语义 | exact routes、10-game regression、complete→world、context gate | 家长核验三条导航链 | `STEP05_IMPLEMENTED / DEFAULT_ROUTE_UNCHANGED` |
| STEP 05 changed-only 家长门禁 | 技术 PASS 与人类授权分离 | child-first-learning-game、child-first-use-observation | 成人可只看真实使用后变更，不重审全部儿童流程 | 冻结合字内容；仅音频、世界壳与依赖导航可决定 | fixed export、identity/schema/PII validation、Round 2 carry-forward test | 四项决定与两个授权均需真实家长填写 | `PARENT_REVIEW_REQUIRED` |
| 默认世界入口 | 儿童第一屏是已建立的世界，经典目录仍可达 | child-first-learning-game、game-ui-frontend | 回来先看到营地修复与三个可选物件，不出现教师目录 | 明花林星与营地变化继续投影唯一 canonical save | `/`、world alias、classic query、priority、title/theme、Pages 子路径 E2E | 家长已明确授权默认入口；实际 second-use 尚未进行 | `DEFAULT_WORLD_ENTRY_PROMOTED` |
| 固定家庭本地 origin | 同一浏览器同一 origin 才能延续真实进度 | save-systems、child-first-use-observation | 上次修复不会因换 host/port 看似消失 | 只读验证 schema v3 存档，不迁移、不补造 | `127.0.0.1:5175` launcher、PID/root/port 验证、missing/corrupt/private-mode fail closed | 家长按固定 START/STOP 使用原 profile | `CANONICAL_ORIGIN_ESTABLISHED` |
| 第二次进入 / 返回世界观察 | 不指定正确去向，观察认出世界与返回循环 | child-first-use-observation、game-playtest | 孩子可自由选择森林、字灵书或百宝箱；随时结束 | 只记录流程与相对状态，不把选择解释为学习效果 | 短期 identity-bound grant、跨页 event bridge、只读 derived actions、stop/privacy、synthetic fixture | 只允许下一次自然独立时段；真人结果尚不存在 | `SECOND_USE_READY / REAL_SESSION_NOT_RUN` |
| V1 三段固定冒险 | 完整起承转合但不扩大字量 | level-design、puzzle、child-first-learning-game | 每段 3–5 分钟，可中途退出，从营地继续 | 12 字按左右、上下、全包围、半包围形成三次迁移 | exact 3×4 manifest、deterministic simulation、P1/P2/P8 | 未来可选；不是机器发布门禁 | `V1_IMPLEMENTED / MACHINE_PLAYTHROUGHS_PASS` |
| 12 字位置字形与手牌 | 真实结构位置就是施法 | hanzi-structure-quality、puzzle | 卡片、槽位和合字外形一致，失败温和可撤回 | 看用 `龵` 显示/手语义映射；跑用 `⻊` 显示/足语义映射；园回嵌套；包风开口；林实例分离 | 12×5 手牌、2/3 部件母库全量求解、结构与键盘门禁 | 未来可选观察理解度，不替代自动字形检查 | `V1_CONTENT_SOURCE_BOUND` |
| Theme C V1 正式视觉 | 世界修复与字义反馈直接可见 | game-ui-frontend、sprite-pipeline、imagegen | 第一屏、角色、怪物、能力、魔法和修复形成同一故事世界 | 每字有唯一 meaning-magic 资产，代码叠加正确字，不讲字源 | 24 runtime 资产存在/hash/alpha/缩放/相对 base，视觉 baseline 两轮稳定 | 未来可选偏好观察，不宣称已偏好 | `16_SELECTED_BOUND / 8_IMAGEGEN_ACTIVE` |
| V1 本地存档与恢复 | 永久变化可回来继续且隐私最小 | save-systems | 中途离开不丢字光，损坏时安静回到安全节点 | 已发现字、三章修复和能力历史不回退 | schema v4、v3/STEP02 迁移、backup/recovery/checksum/future read-only、无 PII | 家长区可解释并二次确认清除 | `V1_SAVE_IMPLEMENTED` |
| V1 机器发布授权 | 技术完成不等于真人验证 | machine-first-game-review、child-first-use-observation | 可直接玩完整 V1，同时保留诚实验证边界 | 发布只证明内容、状态、存档和交互按合同运行 | exact authorization positive/negative tests、R1/R2/R3、P1–P8、source freeze、Git parity | `NO_BY_USER_DIRECTION`; 以后另行选择 | `V1_MACHINE_RELEASE_CANDIDATE_COMPLETE` |

## 新功能准入模板

在表格新增一行前先回答：

1. 它是否让黄小越更像是在玩，而不是做练习？
2. 它是否让合字本身仍是核心，而不是被奖励系统遮住？
3. 它是否能在少量家长解释下被理解？
4. 它是否避免焦虑、操纵、羞辱与强迫性留存？

任一为“否”或无法说明：不得进入实现。发生真实决策时再更新决策日志；不要为形式添加空行或假证据。
