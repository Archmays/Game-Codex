# 当前状态

| Field | Value |
| --- | --- |
| Version | `V2.1.0` source state after the frozen `V2.0.0` release; no new tag or release |
| Product state | `CHAPTER_ONE_COMPLETE + WHEEL_WORKSHOP_INTEGRATED` |
| Machine release state | `PASS_MACHINE / OPTIONAL_WHEEL_WORKSHOP_READY` |
| Playable characters | `36/36` |
| Heroes | `3/3` |
| Regions | `3/3 + INK_KING_CORE` |
| Selectable / innate abilities | `18/18 + 3/3` |
| Monster behaviors / bosses | `9/9 + 4/4` |
| Camp repairs / spellbook | `8/8 + 36/36` |
| Wheel source library | `9 sets / 162 char + 108 word = 270 raw records` |
| Wheel audit dispositions | `139 validated / 22 corrected-derived / 1 quarantined / 108 context-only` |
| Wheel playable manifest | `36/36 reviewed records` |
| Wheel entry / save | repaired `magic-tree` portal / `family-games/hanzi-magic-v2/wheel-workshop/v1` |
| Parent V1 play acceptance | `PASS` |
| Real child validation | `NOT_PERFORMED_AND_NOT_CLAIMED` |
| V2 release tag | `hanzi-magic-v2-v2.0.0` → `85c0b37179271eb98697befb418d319d6579b5dd` |
| V2 release source tree SHA-256 | `472A2A88E8EFA1469865D3D6C9B87CCAE5AC0D697EA5BFCC81D7819219AC329E` |
| Maintenance main | the commit containing this file; resolve with `git rev-parse HEAD` |

- Pages：<https://archmays.github.io/Game-Codex/?play=hanzi-v2-chapter-one&from=hub>
- Launcher：`tools/hanzi-v2-chapter-one/START_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.cmd`
- Frozen release：`artifacts/hanzi-radical-battle-v2/v2-chapter-one/HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE_V2_COMPLETE_RETURN_TO_CHATGPT.zip`
- Release ZIP SHA-256：`8503D6BF1BF39D33B00E1671702C26B987CBB941C7176B2852A3B0A2A37036AE`

“汉字大转盘”已经退役为独立游戏；原始九级字库保存在 `games/hanzi-radical-battle/v2/wheel-workshop/library/` 的只读来源层，并通过审核层生成可玩清单。字轮工坊是修复现有魔法树后可进入的三字短局，不是第九个营地修复，也不改变第一章 36 字主线。

当前 main 是发布后的维护真源；历史阶段材料由 Git/tags/release ZIP 保存。冻结的 `V2.0.0` tag 与 release ZIP 未修改。日常机器验证结果是技术证据，不代表真人儿童乐趣或学习效果，也不改变 `REAL_CHILD_VALIDATION` 事实。
