# V2.0.0 第一章参考账本

研究时间：2026-08-13。范围仅用于第一章的短局结构、选择表达、教学交互、运行时和字表来源；不复制第三方角色、美术、关卡、文案或数值。

| 参考 | 直接观察 | 本项目借用 | 明确不借用 | 落地决定 |
| --- | --- | --- | --- | --- |
| [Brotato 官方 Steam 页](https://store.steampowered.com/app/1942280/Brotato/) | 短波次、局内构筑和角色差异让短局持续变化 | 清楚的短遭遇、英雄差异、每局三次有限选择 | 弹幕密度、速度压力、数值堆叠和面向成人的暴力表达 | 故事局 10–14 分钟；自由冒险由 seed 生成短节点，能力不改汉字答案 |
| [Slay the Spire 官方 Steam 页](https://store.steampowered.com/app/646570/Slay_the_Spire/) | 动态构筑与风险/安全路线让选择影响后续 | 世界内二选一路径、三选一能力、可预读敌人意图 | 卡牌稀有度赌博、复杂遗物经济、长文本与成人难度 | 每区域一次短标签路径；无稀有度抽取，无排行榜/连胜/每日任务 |
| [Dicey Dungeons 官方设计日志](https://diceydungeons.com/blog/2019/05/20/version-17.html) 与 [官方 Steam 页](https://store.steampowered.com/app/861540/Dicey_Dungeons/) | 同一核心规则可由不同角色的一个鲜明修饰产生变化 | 三位英雄各有一个可见、可解释、可测试的固有能力 | 随机骰值决定正确答案、复杂状态叠层 | 英雄改变提示、护盾或重排机会，不改变结构槽和唯一正确组合 |
| [DragonBox 方法](https://www.dragonbox.com/about/story-story)、[产品页](https://www.dragonbox.com/) 与 [教育者页](https://dragonbox.com/educators) | Engage → Explore → Reflect → Apply；数字操作物本身承载学习 | 先玩再在魔法书回看；部件是可操作对象，反思不抢首屏 | 把冒险拆成课程目录、测验、正确率看板 | 合字即施法；完整字形成后才显示拼音、词和短义，魔法书承担低压回看 |
| [Metamorphabet 官方 App Store 页](https://apps.apple.com/us/app/id858010121) | 直接触碰、拖动与旋转让字母变化可见且 playful | 点击、拖放、键盘三种等价输入；成字到字义魔法的连续变形 | 依赖无法核验的生成文字或把装饰动画当正确结构 | 结构和完整汉字由代码字体层渲染；生成美术只承载世界/意义，不承载字形真源 |
| [Phaser Scene](https://docs.phaser.io/phaser/concepts/scenes)、[Loader](https://docs.phaser.io/phaser/concepts/loader)、[Input](https://docs.phaser.io/phaser/concepts/input)、[Scale Manager](https://docs.phaser.io/phaser/concepts/scale-manager) | Scene 有独立生命周期；Loader 队列资源；统一输入；Scale 支持 FIT/resize | 薄 Scene、区域资源按需加载、统一 pointer/keyboard、响应式画布 | 在 tween/audio/Scene 回调中保存规则或预载整章全部素材 | 纯 simulation 是规则真源；DOM 负责文字和结构 board；Scene 只消费快照并清理监听器 |
| [Unicode UAX #38 / Unihan](https://www.unicode.org/standard/reports/tr38/) 与 [最新 UCD](https://www.unicode.org/Public/UCD/latest/ucd/) | Unihan 提供字符级读音/释义字段与稳定 code point 身份 | 给 36 字记录 Unicode 身份和普通话读音核对来源 | 用 Unihan 推导字源、儿童熟悉度或唯一结构分析 | 拼音还需与本地人工候选逐字绑定；`etymologyClaim` 固定为 `null` |
| [教育部《通用规范汉字表》说明](https://www.moe.gov.cn/jyb_xwfb/xw_fbh/moe_2069/moe_2590/moe_2914/moe_2912/tnull_50831.html) 与 [发布信息](https://www.moe.gov.cn/jyb_xwfb/xw_fbh/moe_2069/s7135/s7562/s7569/201308/t20130827_156353.html) | 一级字表覆盖基础教育和一般生活高频用字 | 作为简体常用字范围的上位来源 | 仅凭频率声称适龄或已认识 | 正式字仍必须同时通过本地组合母库、公式审计、视觉提示和可读词义门禁 |

## 汇总决策

1. 重玩来自 seed、路线、英雄和有限能力选择，不来自签到、排名、稀有度赌博或失败损失。
2. 三位英雄只为同一合字规则加一个清楚修饰；九种怪物行为不能改变正确答案。
3. 结构、部件、完整汉字与文字全部由受审数据和代码渲染；ImageGen 只生成不含文字的 Theme C 世界美术。
4. 第一章故事结尾不以 36 字全收集为条件；36 页魔法书是可选发现目标。
5. 36 字来源链为：本地母库组合 + accepted formula audit + visual hint + Unicode/MOE 上位核对 + 机器唯一解/渲染证据。任何一环缺失则不进入 manifest。
