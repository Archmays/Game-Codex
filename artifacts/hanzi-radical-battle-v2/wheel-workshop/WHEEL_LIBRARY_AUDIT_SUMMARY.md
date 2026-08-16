# Wheel Library Audit Summary

## Result

- Raw source: 162 char + 108 word = 270 records across 9 preserved grade sets.
- Dispositions: 148 validated; 13 corrected-derived; 1 quarantined; 108 context-only.
- Playable manifest: 36 records (4 per source grade), revision fnv1a:36ec4e11.
- Raw stable JSON SHA-256: 0e47b5d434cff65c9af1a65fad1dcd5a4f6432bf218223213083a43a54af64ac.
- Canonical audit SHA-256: 5a5a8cbfc5fef3e8ace2ff07d0e601ee4f74819a56a48bf914edbe4d48b62f95.
- Playable manifest SHA-256: 25cde568984bbff012bd4b41c89f6d4dc306dc939772248b3a8a3399b2b37ca7.

## Grade and mode counts

| Source grade | Mode | Raw | Validated | Corrected | Quarantined | Context only | Playable |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| p1 一年级 | char | 18 | 17 | 1 | 0 | 0 | 4 |
| p1 一年级 | word | 12 | 0 | 0 | 0 | 12 | 0 |
| p2 二年级 | char | 18 | 18 | 0 | 0 | 0 | 4 |
| p2 二年级 | word | 12 | 0 | 0 | 0 | 12 | 0 |
| p3 三年级 | char | 18 | 16 | 1 | 1 | 0 | 4 |
| p3 三年级 | word | 12 | 0 | 0 | 0 | 12 | 0 |
| p4 四年级 | char | 18 | 9 | 9 | 0 | 0 | 4 |
| p4 四年级 | word | 12 | 0 | 0 | 0 | 12 | 0 |
| p5 五年级 | char | 18 | 17 | 1 | 0 | 0 | 4 |
| p5 五年级 | word | 12 | 0 | 0 | 0 | 12 | 0 |
| p6 六年级 | char | 18 | 17 | 1 | 0 | 0 | 4 |
| p6 六年级 | word | 12 | 0 | 0 | 0 | 12 | 0 |
| j1 初一 | char | 18 | 18 | 0 | 0 | 0 | 4 |
| j1 初一 | word | 12 | 0 | 0 | 0 | 12 | 0 |
| j2 初二 | char | 18 | 18 | 0 | 0 | 0 | 4 |
| j2 初二 | word | 12 | 0 | 0 | 0 | 12 | 0 |
| j3 初三 | char | 18 | 18 | 0 | 0 | 0 | 4 |
| j3 初三 | word | 12 | 0 | 0 | 0 | 12 | 0 |

## Corrected or quarantined char records

- p1.char.008 古: **corrected-derived-record** — 原始层保留“口 + 十”；派生层按古的上十下口结构改为“十 + 口”。 Issues: WRONG_COMPONENT_ORDER, MISSING_SOURCE, GRADE_ALIGNMENT_UNVERIFIED.
- p3.char.000 胆: **quarantined** — 当前内部 accepted 来源链未覆盖这条组合；原始记录保留，但不进入可玩层。 Issues: MISSING_SOURCE, UNKNOWN_STRUCTURE, GRADE_ALIGNMENT_UNVERIFIED.
- p3.char.008 宁: **corrected-derived-record** — 原始层保留“宝盖 + 宁”；派生层使用可显示字形“宀 + 丁”，避免结果字自指。 Issues: CIRCULAR_DECOMPOSITION, RESULT_USED_AS_COMPONENT, NON_GLYPH_COMPONENT_LABEL, WRONG_COMPONENT_ORDER, GRADE_ALIGNMENT_UNVERIFIED.
- p4.char.001 堤: **corrected-derived-record** — 原始层保留“堤 + 土”；派生层改为“土 + 是”。 Issues: CIRCULAR_DECOMPOSITION, RESULT_USED_AS_COMPONENT, WRONG_COMPONENT_ORDER, GRADE_ALIGNMENT_UNVERIFIED.
- p4.char.002 阔: **corrected-derived-record** — 原始层保留“阔 + 门”；派生层采用内部 accepted 公式“门 + 活”的半包围位置。 Issues: CIRCULAR_DECOMPOSITION, RESULT_USED_AS_COMPONENT, WRONG_COMPONENT_ORDER, WRONG_STRUCTURE, GRADE_ALIGNMENT_UNVERIFIED.
- p4.char.003 盼: **corrected-derived-record** — 原始层保留“盼 + 目”；派生层改为“目 + 分”。 Issues: CIRCULAR_DECOMPOSITION, RESULT_USED_AS_COMPONENT, WRONG_COMPONENT_ORDER, GRADE_ALIGNMENT_UNVERIFIED.
- p4.char.004 滚: **corrected-derived-record** — 原始层保留“滚 + 水”；派生层改为简体字形中的“氵 + 衮”。 Issues: CIRCULAR_DECOMPOSITION, RESULT_USED_AS_COMPONENT, WRONG_COMPONENT_ORDER, GRADE_ALIGNMENT_UNVERIFIED.
- p4.char.005 顿: **corrected-derived-record** — 原始层保留“顿 + 页”；派生层改为“屯 + 页”。 Issues: CIRCULAR_DECOMPOSITION, RESULT_USED_AS_COMPONENT, WRONG_COMPONENT_ORDER, GRADE_ALIGNMENT_UNVERIFIED.
- p4.char.006 逐: **corrected-derived-record** — 原始层保留“逐 + 豖”；派生层按走之旁包围位置使用“辶 + 豕”。 Issues: CIRCULAR_DECOMPOSITION, RESULT_USED_AS_COMPONENT, WRONG_COMPONENT_ORDER, WRONG_STRUCTURE, GRADE_ALIGNMENT_UNVERIFIED.
- p4.char.007 渐: **corrected-derived-record** — 原始层保留“渐 + 水”；派生层改为“氵 + 斩”。 Issues: CIRCULAR_DECOMPOSITION, RESULT_USED_AS_COMPONENT, WRONG_COMPONENT_ORDER, GRADE_ALIGNMENT_UNVERIFIED.
- p4.char.008 犹: **corrected-derived-record** — 原始层保留“犹 + 犭”；派生层改为“犭 + 尤”。 Issues: CIRCULAR_DECOMPOSITION, RESULT_USED_AS_COMPONENT, WRONG_COMPONENT_ORDER, GRADE_ALIGNMENT_UNVERIFIED.
- p4.char.009 崩: **corrected-derived-record** — 原始层保留“崩 + 山”；派生层改为“山 + 朋”的上下位置。 Issues: CIRCULAR_DECOMPOSITION, RESULT_USED_AS_COMPONENT, WRONG_COMPONENT_ORDER, WRONG_STRUCTURE, GRADE_ALIGNMENT_UNVERIFIED.
- p5.char.000 鹭: **corrected-derived-record** — 内部旧公式把鹭粗分为 lr；派生审核按目标字形改为上路下鸟。 Issues: WRONG_STRUCTURE, GRADE_ALIGNMENT_UNVERIFIED.
- p6.char.000 毯: **corrected-derived-record** — 内部旧公式把毯粗分为 sur；派生审核按目标字形改为左右结构。 Issues: WRONG_STRUCTURE, GRADE_ALIGNMENT_UNVERIFIED.

## Word-fragment isolation

- j2.word.000 摧枯: retained only as context for 摧枯拉朽; never an independent playable word.
- j2.word.001 拉朽: retained only as context for 摧枯拉朽; never an independent playable word.
- j2.word.002 锐不: retained only as context for 锐不可当; never an independent playable word.
- j2.word.003 可当: retained only as context for 锐不可当; never an independent playable word.
- j2.word.005 一丝: retained only as context for 一丝不苟; never an independent playable word.
- j2.word.006 不苟: retained only as context for 一丝不苟; never an independent playable word.
- j2.word.007 惊心: retained only as context for 惊心动魄; never an independent playable word.
- j2.word.008 动魄: retained only as context for 惊心动魄; never an independent playable word.

## Source and alignment boundary

The authoritative raw source is the Git-blob-bound freeze. Internal accepted formulas and the existing Unicode 17.0 Unihan source chain support identity/reading checks. Unicode data is covered by Unicode-3.0. Make Me a Hanzi's dictionary and graphics license split was reviewed, but no external values, graphics, or runtime requests were imported. Historical source-grade labels remain legacy-label-only; curriculum stages organize navigation and do not claim official per-character grade alignment. Machine review does not establish child fun or learning effect.
