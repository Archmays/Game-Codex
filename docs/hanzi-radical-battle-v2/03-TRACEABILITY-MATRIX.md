# Traceability Matrix

状态：`CORE_SPELL_PILOT_READY_FOR_PARENT_REVIEW`。`PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` 只表示 STEP 02 的一个 60–90 秒技术 Pilot 已实现并等待成人逐项判断，不表示黄金样板完成，更不表示儿童已理解或接受。每个未来功能仍必须先有一行，说明其儿童价值、汉字学习价值，以及自动或真人验证路径。

| 功能 | 对应北极星原则 | 参考案例 | 儿童价值 | 汉字学习价值 | 自动验证 | 真人试玩观察 | 当前状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 游戏世界首页 | 第一眼是世界与冒险；两次点击内开始 | Teach Your Monster、MathTango | 产生“去我的世界”而非“上课”的预期 | 不让课程目录遮住合字动作 | 路由、主按钮、两步内到可玩状态；儿童首屏禁用指标扫描 | 是否主动进入；第一描述是冒险还是练习 | `PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` |
| 字灵营地 | 结束时看见永久世界变化 | Teach Your Monster、MathTango | 有属于自己的安全起点和回归理由 | 新字与世界修复建立可回忆联系 | 初始/修复状态 ID、存档回载、截图差异 | 是否注意哪个物件改变；是否愿意回来看 | `PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` |
| 墨点精灵 | 少量提示即可理解；角色陪伴 | Endless 系列、Teach Your Monster | 用世界内角色给即时而非成人式说明 | 指向部件与结构槽，不替孩子答题 | 4 秒提示触发/操作即收起；提示层级测试 | 是否跟随一次提示后能独立行动；是否需要家长代读 | `PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` |
| 五张手牌 | 范围小、选择清楚、触控简单 | Pin it、Slay the Spire（仅有限选择） | 既能挑选又不过载，手机也可点 | 让部件成为可操作对象；干扰项可探索但不歧义 | 固定 5 张、目标部件齐全、44px 目标、键盘焦点 | 是否能找到部件；是否误把牌当答案按钮 | `PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` |
| 结构槽位 | 部件进入真实位置就是施法 | Pin it、Hanzi Writer | 操作结果直观、可撤回、无惩罚 | 同时验证顺序和左右/上下/包围空间位置 | slot/component ID 合法性、结构快照、错误位置不提交 | 是否理解部件“放哪里”而非只选“哪个字” | `PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` |
| 合字动画 | 动画必须显出真实结构 | Hanzi Writer、Game Studio | 第一次魔法有足够吸引力且不遮信息 | 从部件到整字的关系可见，不瞬间偷换 | 事件顺序、总时长、减少动画分支、关键截图 | 第一次成字是否关注/兴奋；能否指回两个部件 | `PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` |
| 字义魔法 | 汉字自身变成魔法，而非答题后无关攻击 | Endless Alphabet、Pin it | 魔法效果与选择有意义、容易记 | 字形、读音、熟悉词、意义和效果绑定 | manifest 交叉引用、读音/词/效果存在、视听顺序 | 是否能复述字或词；是否把效果和字义联系起来 | `PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` |
| 三选一 | 想继续来自自主选择与能力差异 | Slay the Spire、Brotato | 一次清楚、有后果的自选能力 | 选择改变下一次合字反馈，不替代合字 | 恰好 3 项、无稀有度/价格、选择立即写入状态 | 能否指出选了什么、预期会怎样 | `SPECIFIED_NOT_IMPLEMENTED` |
| 小首领 | 3–5 分钟完整起承转合；不加新系统 | Brotato 短波次、Slay the Spire 有界战斗 | 有高潮并看见自己的选择生效 | 连续应用已见结构，验证迁移而非记单题 | 两阶段状态、选择效果触发、撤退不丢永久进度 | 是否理解目标；困难时是想重试还是失去兴趣 | `SPECIFIED_NOT_IMPLEMENTED` |
| 营地修复 | 掌握与世界永久变化带来回归期待 | MathTango、Teach Your Monster | 努力改变自己的世界，不靠登录奖励 | 新字成为修复媒介，强化意义记忆线索 | 修复状态持久化、重载一致、前后截图 | 是否主动注意/指认变化；是否想修下一处 | `PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` |
| 魔法书 | 新汉字进入自己的收藏；本地永久保存 | Endless 系列低压探索、Game Studio | 可回看发现，无分数和排名 | 同一条目重现字形、结构、读音、熟悉词和意义 | schema、唯一 ID、回载、静音可理解、内容引用 | 是否主动打开；能否认出刚获得的字 | `PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` |
| 安全失败 | 失败/撤退不羞辱、不惩罚永久进度 | Endless 系列低压边界、child-first Skill | 愿意探索和再试，不怕失去 | 保留发现，让反馈指向位置而非评价儿童 | 禁用文案扫描、资源不减少、重试/回营两路径 | 表情/语言是否受挫；是否理解下一步；是否愿意再试 | `PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` |
| 本地存档 | 只保存在本地、最少匿名记录 | Game Studio、save-systems | 世界变化可回来继续，隐私边界清楚 | 保存魔法书与 approved ID，不保存“成绩画像” | 版本、校验、迁移、损坏回退、无网络/账号依赖 | 家长能否找到清除入口；儿童重开后是否认出变化 | `PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` |
| 减少动画 | 反馈明确但不过度刺激；声音可选 | Game Studio、game-feel、audio-design | 对运动敏感或静音场景仍可玩 | 结构信息在精简动画中不丢失 | 设置持久化、无强摇晃/闪烁、静音流程、精简事件顺序 | 是否更舒适；是否仍看懂部件如何成字 | `PILOT_IMPLEMENTED_PENDING_PARENT_REVIEW` |

## 新功能准入模板

在表格新增一行前先回答：

1. 它是否让黄小越更像是在玩，而不是做练习？
2. 它是否让合字本身仍是核心，而不是被奖励系统遮住？
3. 它是否能在少量家长解释下被理解？
4. 它是否避免焦虑、操纵、羞辱与强迫性留存？

任一为“否”或无法说明：不得进入实现。发生真实决策时再更新决策日志；不要为形式添加空行或假证据。
