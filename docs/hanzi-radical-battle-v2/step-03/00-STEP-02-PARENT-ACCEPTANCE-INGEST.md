# STEP 02 家长决定正式吸收

## 身份与完整性

- Canonical feedback：`artifacts/hanzi-radical-battle-v2/step-02/review/STEP-02_PARENT_REVIEW_FEEDBACK.json`
- Downloads 副本：`%USERPROFILE%/Downloads/STEP-02_PARENT_REVIEW_FEEDBACK.json`
- 两份文件 SHA-256：`4236AAF0E81F4FE94F48B5CF8EEB89F44900DD52473E91ABA8CC4DB0E7EC3C6B`
- Review identity：`pilot-ming-left-right` / `step02-candidates-v2` / Round 1
- 原始 feedback 保持不变；本文只记录 STEP 03 的吸收结果，不改写家长原话或旧 revision identity。

## 正式输入

```text
corePilot = ACCEPT
visualDirection = C
15/15 candidates = ACCEPT
7/7 storyboard blocks = ACCEPT
authorizeStep03 = YES
```

这些决定授权本任务制作 STEP 03 黄金样板候选，但不等于家长已接受 STEP 03 新实现，更不等于儿童已试玩、理解或接受。

## 15 字 carry-forward

| itemId | glyph | STEP 02 revisionHash | STEP 03 disposition |
| --- | --- | --- | --- |
| `ming` | 明 | `fnv1a:91d99b0b` | ACCEPT carried forward；进入 final 12 与首次 run |
| `lin` | 林 | `fnv1a:562efac7` | ACCEPT carried forward；进入 final 12 与首次 run |
| `hua` | 花 | `fnv1a:5a7b928b` | ACCEPT carried forward；进入 final 12 与首次 run |
| `cao` | 草 | `fnv1a:ed736683` | ACCEPT carried forward；进入 final 12 |
| `xing` | 星 | `fnv1a:e3a17e77` | ACCEPT carried forward；进入 final 12 与首次 run |
| `kan` | 看 | `fnv1a:4dd9a43c` | ACCEPT carried forward；进入 final 12 |
| `yuan` | 园 | `fnv1a:d877660f` | ACCEPT carried forward；进入 final 12 |
| `hui` | 回 | `fnv1a:181b4d65` | ACCEPT carried forward；进入 final 12 |
| `bao` | 包 | `fnv1a:6e93abf3` | ACCEPT carried forward；进入 final 12 |
| `feng` | 风 | `fnv1a:710ed1d2` | ACCEPT carried forward；进入 final 12 |
| `mao` | 猫 | `fnv1a:157a5a1f` | ACCEPT carried forward；进入 final 12 |
| `pao` | 跑 | `fnv1a:651c8127` | ACCEPT carried forward；进入 final 12 |
| `qing-clear` | 清 | `fnv1a:588d89c5` | ACCEPT carried forward；accepted-deferred |
| `qing-sunny` | 晴 | `fnv1a:72c800c8` | ACCEPT carried forward；accepted-deferred |
| `song` | 松 | `fnv1a:65666e75` | ACCEPT carried forward；accepted-deferred |

延后不表示拒绝。STEP 03 final 12 是对已接受候选的有界选择；首次儿童候选 run 固定只使用 `ming`、`hua`、`lin`、`xing`，其余八字只进入成人 manifest 浏览和未来储备。

## 七格 storyboard carry-forward

| itemId | STEP 02 revisionHash | STEP 03 handling |
| --- | --- | --- |
| `story-camp` | `fnv1a:74bbd42b` | unchanged intent carried forward；营地目标扩展受影响项进入 STEP 03 审核 |
| `story-first-battle` | `fnv1a:95155b1d` | accepted core interaction carried forward；扩展节奏/音画进入 STEP 03 审核 |
| `story-second-battle` | `fnv1a:8e589390` | accepted storyboard carried forward；新实现必须审核 |
| `story-three-choice` | `fnv1a:8f9c3dbe` | accepted storyboard carried forward；新实现必须审核 |
| `story-small-boss` | `fnv1a:7199a093` | accepted storyboard carried forward；新实现必须审核 |
| `story-return-repair` | `fnv1a:939d3986` | accepted intent carried forward；四字扩展必须审核 |
| `story-spellbook` | `fnv1a:fe1633f6` | accepted intent carried forward；四页扩展必须审核 |

## STEP 03 changed-only 规则

- Round 1 审核所有 STEP 03 新实现，以及因完整短局、主题 C 生产候选、音频、存档或响应式扩展而受影响的项目。
- STEP 02 原样未变且已 ACCEPT 的 identity 明确折叠为 carried-forward，不要求重复决定。
- Round 2+ 只显示 `REVISE`、`REJECT`、dependency affected、new；未变且 ACCEPT 的项保留 stable item ID、revision hash、notes 与 `importedRound`。
- revision hash 或依赖身份不匹配时禁止静默 carry-forward。

## 本步骤结论边界

当前授权允许实现并技术验证 `GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW`。它不授权默认大厅推广、真实儿童首次使用、正式 sprite strip、V2 core promotion 或完整墨迹森林。
