# 汉字内容规则

1. 合字本身就是施法：玩家必须把部件放到真实结构位置，不能用答题包装替代核心动作。
2. 使用面向简体中文的正确字形，并在目标浏览器与字体栈中检查渲染。
3. 准确区分 `部件`、`偏旁` 与 `部首`；记录实际承担的结构或索引角色。
4. 左右、上下、全包围、半包围、叠置及品字形结构必须绑定有序空间槽位；同时验证部件顺序和位置。
5. 每条 playable record 的 glyph、pinyin、熟悉词、简义、结构、插图与目标字义必须一致。
6. 联想图只标作记忆线索，不虚构字源；形声关系必须标明语义、声旁、兼具、不确定或仅现代视觉线索。
7. 大候选库与 deterministic playable manifest 分离；不因易组合而直接选择生僻字。
8. 新字进入 playable manifest 前必须通过 schema/ID、结构槽位、唯一解与手牌歧义、读音/词义/图像一致性、浏览器字形与 current regression 门禁。
9. 适龄与熟悉度是内容选择问题，不设置固定 12 字或真人试玩开发门禁。机器结果不得冒充实际儿童学习效果。

## 字轮工坊资料边界

- 原始层完整保留 p1–p6、j1–j3 的历史标签、char/word 字段、顺序和错误；不在原位“修好”数据。
- 每条原始记录必须恰有一个 `validated`、`corrected-derived-record`、`quarantined` 或 `not-playable-context-only` 处置。派生纠正必须写明问题代码、证据、说明与可复现 revision hash。
- 只有 `validated` 或再次完整验证的 `corrected-derived-record` 可进入 playable manifest；自指分解、文字标签冒充 glyph、多解、错槽、缺来源或未解决 Sev-1/2 条目一律不得进入。
- 历史逐年级标签只声明 `alignmentStatus: legacy-label-only`。`grades-1-2`、`grades-3-4`、`grades-5-6`、`grades-7-9` 是导航组织原则，不声称逐字来自 2022 国家课标。
- word 模式首版只作熟悉词、固定语境和成功回声候选；`WORD_FRAGMENT` 与 `NON_STANDALONE_LEXEME` 不得显示成独立词。
- 多音字必须绑定明确熟悉词；例如“汗”只在“可汗”语境中以 `hán` 进入可玩层。
- 运行时不导入外部数据库。审核时以临时文件使用 Unicode/Unihan 17.0.0（Unicode-3.0）核对身份/读音，并以固定 commit 的 Make Me a Hanzi `dictionary.txt`（LGPL-3.0-or-later）核对 162 条 char 的根 IDS；其 graphics（Arphic Public License）未下载或使用。CNS11643 只裁决精确字形，教育部《国语辞典简编本》只补充固定词境读音。外部大文件、图形和联网请求均不进入儿童运行时。

任何汉字、结构、读音、词义、熟悉词、插图或 playable pool 变化都使用 `.agents/skills/hanzi-structure-quality/SKILL.md`。
