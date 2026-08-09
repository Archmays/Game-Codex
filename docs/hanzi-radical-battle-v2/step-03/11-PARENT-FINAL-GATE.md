# STEP 03 家长最终门禁

## 结论状态

当前没有家长最终通过结论。本步骤的最高技术状态仍是：

```text
GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW
```

它不是 `PROMOTED`、不是儿童接受、不是默认大厅入口，也不授权完整墨迹森林、正式 sprite strip、云端记录、账号或遥测。

## 家长填写前的核对

家长应在本地审核应用中完成 9 个标签，并确认导出 JSON 同时满足：

- `initiativeId` 是 `hanzi-radical-battle-v2`，并且 `goldenSliceIdentity` 与当前候选精确一致；
- 所有新/受影响 item 都有稳定 item ID、当前 revision hash、正式决定和文字反馈；
- 12 个 Manifest 字均有独立 `characterId`、revision hash、决定和文字反馈；
- 三能力与八项 Theme C 资产均各自有 `ACCEPT` / `REVISE` / `REJECT`；`audioDecision` 使用专用四值枚举；
- 固定顶层字段完整：`goldenSliceDecision`、`manifestDecision`、`abilityDecisions`、`bossDecision`、`assetDecisions`、`audioDecision`、`authorizeChildFirstUse`、`generalNotes`；
- `reviewMeta.completed = true` 且 `missingRequiredDecisionIds` 为空；
- 必填反馈不含儿童或家庭个人信息。

这些是“审核记录完整”的条件，**不是**内容质量的自动结论。家长仍需亲自判断：

1. 合字动作是否仍是施法本身，而不是答题后的奖励；
2. 最终 12 字是否适龄、读音/词义/结构是否一致；
3. 能力、首领和世界变化是否清楚且低压力；
4. Theme C、声音、静音和减少动态是否舒适、可理解；
5. 是否愿意只在既定本地、无个人信息观察协议下考虑一次真实儿童首次使用。

## 决定的含义

| 字段或结果 | 含义 | 不代表什么 |
| --- | --- | --- |
| 任一 `REVISE` | 记录明确修改需求；相关运行时变化后应产生新 revision 并进入 changed-only 审核 | 不等于已通过 |
| 任一 `REJECT` | 当前候选不适合按该项继续；保留原反馈和证据 | 不等于孩子失败 |
| `authorizeChildFirstUse = "NO"` | 儿童 observer gate 关闭 | 不影响已保存的本地成人审核草稿 |
| `authorizeChildFirstUse = "NOT_YET"` | 仍需更多家长判断、修订或技术证据；observer gate 关闭 | 不等于默认同意 |
| `authorizeChildFirstUse = "YES"` | 仅允许 guard 检查是否可按既定本地观察协议启动一次真实儿童首次使用 | 不等于儿童已接受、发布到大厅或 V2 推广 |

`YES` 不能覆盖 `REVISE` / `REJECT` 的具体范围；它也不能绕过 identity、隐私、停止条件或观察者门禁。终审状态始终只可为 parent review，不由技术测试给出通过结论。

## 对 child-first-use 的精确交接

`child-first-use/00-READ-ME-FIRST.md` 的 observer launcher 只应读取 schema-valid 的固定字段：

```text
authorizeChildFirstUse = "YES"
```

并同时比对精确的 Golden Slice review identity。缺失、`NO`、`NOT_YET`、损坏 JSON 或任何 identity 不匹配都必须保持 launcher 关闭。launcher 本身不得猜测、补写或把内部 per-item decisions 转换为 `YES`。

即使 `YES` 已记录，后续观察也必须遵守 [12-CHILD-FIRST-USE-PREPARATION.md](12-CHILD-FIRST-USE-PREPARATION.md) 的隐私、停止和本地包边界。只有真实观察完成并由家长另行解释后，才可能讨论 `PROMOTE`、`REVISE` 或 `STOP_AND_RETHINK`；本文件不作该结论。
