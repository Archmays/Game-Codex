# V3 研究与参考账本

本账本只记录会改变实现或验证的约束。外部来源用于审核和机制参考，不进入儿童运行时，也不替代仓库内可执行 manifest。

## 汉字、课程与来源

- [教育部：义务教育课程方案和课程标准（2022 年版）](https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html)：确认课程标准自 2022 年秋季执行。V3 只把 `p1–p6/j1–j3` 作为 legacy 导航标签，不声称逐字年级对齐。
- [教育部、国家语委：现代常用字部件及部件名称规范](https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/moe_1485/tnull_45766.html)：部件拆分遵循“根据字理、从形出发、尊重系统、面向应用”；儿童文案明确区分部件、偏旁和部首。
- [Unicode UAX #38 / Unihan](https://www.unicode.org/reports/tr38/)：使用 Unicode 17.0.0 `Unihan.zip` 的 `kMandarin` 与编码字段核对字形身份和读音；不把 Unihan 当作教学释义或结构唯一权威。
- [CNS11643 全字库](https://www.cns11643.gov.tw/)：仅在组件字形或 IDS 变体有争议时裁决精确字形，不作为简体课程分级来源。
- [Make Me a Hanzi](https://github.com/skishore/makemeahanzi/tree/bddc96d41bef78427ed0e034e9f7e31d71fd1b92)：固定 commit `bddc96d41bef78427ed0e034e9f7e31d71fd1b92`；`dictionary.txt` 仅作 IDS/部件交叉核对。其 dictionary 与 graphics 许可证边界保持分离，不复制 graphics，也不增加运行时依赖。
- 当前仓库 `formula-audit.ts`、Chapter One manifest、wheel raw/audit/playable 与冻结 hashes 仍是产品真源。历史错误只在派生审核层纠正或隔离。
- [教育部《国语辞典简编本》“安静”](https://dict.concised.moe.edu.tw/dictView.jsp?ID=39717&la=0&powerMode=0) 与 [《重编国语辞典修订本》“眼睛”](https://dict.revised.moe.edu.tw/dictView.jsp?ID=155724&la=0&powerMode=0)：为 Slice B 固定 `ān jìng`、`yǎn jīng` 的字序、读音和普通词义；“花香”由简编本“芳香”词条所载常用语境与仓库内既有熟悉词共同交叉核对。反序只在当前普通词语语境拒绝，不声称抹去专名等其他语境。

## 学习游戏机制

- [Habgood & Ainsworth, 2011](https://eric.ed.gov/?id=EJ922627)：只采用“学习动作进入核心玩法”的机制含义。因此合字、连字脉和排词序本身就是施法，不在游戏外再弹课程测验。
- [Teach Your Monster：三阶段结构](https://www.teachyourmonster.org/teach-your-monster-to-read-overview/) 与 [自动保存说明](https://help.teachyourmonster.org/en/articles/5458465-how-do-i-save-the-game)：提炼短 episode、清晰阶段和安全边界自动保存；不复制内容、界面或资产。
- [Little Alchemy 官方玩法](https://littlealchemy.com/hints/) 与 [百科说明](https://help.littlealchemy2.com/encyclopedia/using-the-encyclopedia)：提炼无惩罚双对象尝试、发现后进入百科并显示关系；V3 仍要求真实结构和真实词序，不使用随意合成。

## 可访问性

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)：使用相关 AA 成功标准验证键盘、焦点、目标尺寸、非颜色反馈、状态消息、reduced motion、错误可逆和无强制时限。
- [Xbox Accessibility Guidelines](https://learn.microsoft.com/en-us/xbox/accessibility/guidelines)：作为游戏可访问性最佳实践，重点采用文字可读性、对比、输入替代、焦点、音频等价信息、破坏性操作和动态效果控制。

## 由研究产生的实现约束

1. 所有可玩字绑定固定 ReadingSense、熟悉词、短义、真实有序槽位和来源；多音字只在固定语境播放。
2. 家族关系必须标明 `semantic-component`、`phonetic-component`、`both`、`standard-variant`、`modern-visual-link-only` 或 `uncertain`；后两类不得升级成共同意义或字源断言。
3. 双字词必须是完整常用词；正序接受，反序在该语境明确拒绝；碎片、成语半截与未知多音语境不得进入 playable。
4. 每个 literacy action 完成后自动保存；只存匿名、最低必要的世界、发现、复习和安全恢复状态。
5. 指针、键盘、触控和点击替代拖动共享同一规则动作；音频始终有可见等价信息，静音可完整通关。
