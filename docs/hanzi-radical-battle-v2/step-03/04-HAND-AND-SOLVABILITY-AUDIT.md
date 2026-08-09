# STEP 03 手牌与可解性审计

## 审计器

- 真源：`games/hanzi-radical-battle/v2/golden-slice/content/hand-auditor.ts`
- 固定 seed：`hanzi-v2-step03-hand-audit-v1`
- 查询源：现有 V1 母库 `getHanziRadicalCombination`，不用人工目测代替。
- 枚举：每手牌的所有两牌、三牌子集，以及子集内的所有顺序排列。

## 机器结果

| Encounter | 目标 | 卡牌实例 | 2 牌子集／排列 | 3 牌子集／排列 | V1 可成字结果 | 结论 |
|---|---|---|---:|---:|---|---|
| `encounter-ming` | 明 | `ming-ri`, `ming-yue`, `ming-water`, `ming-person`, `ming-speech` | 10 / 20 | 10 / 60 | 仅明 | PASS |
| `encounter-hua` | 花 | `hua-cao`, `hua-hua`, `hua-water`, `hua-person`, `hua-speech` | 10 / 20 | 10 / 60 | 仅花 | PASS |
| `boss-lin` | 林 | `lin-mu-left`, `lin-mu-right`, `lin-water`, `lin-person`, `lin-speech` | 10 / 20 | 10 / 60 | 仅林 | PASS |
| `boss-xing` | 星 | `xing-ri`, `xing-sheng`, `xing-water`, `xing-person`, `xing-speech` | 10 / 20 | 10 / 60 | 仅星 | PASS |

每个 encounter 均满足：

- 恰好 5 张，实例 ID 全部唯一；
- 目标部件、glyph 和 slot 与正式 Manifest 一致；
- 两牌和三牌枚举内存在目标，不存在第二个汉字结果；
- 没有无解手牌；
- “林”的两张“木”按 `lin-mu-left` / `lin-mu-right` 追踪，不以 glyph 冒充实例身份。

## 证据边界

这份 audit 证明当前固定手牌在当前 V1 母库中的机器可解性与无歧义性。它不证明儿童一定会识别部件、也不替代家长终审或未来被明确授权的真实儿童首次使用观察。
