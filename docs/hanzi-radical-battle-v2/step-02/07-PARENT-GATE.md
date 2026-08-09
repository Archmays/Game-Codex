# STEP 02 家长审核门槛

## 门槛目的

本门槛只把技术 Pilot 送入可记录的家长审核，不把任何技术结果升级为儿童证据。当前技术状态固定为：

```text
CORE_SPELL_PILOT_READY_FOR_PARENT_REVIEW
```

不得使用 `CHILD_PLAYTEST_READY`、`PROMOTED`、孩子会喜欢或家长已接受等表述，除非未来有对应的人类证据和明确授权；本步骤目前没有这些证据。

## 家长应作的六类决定

| 审核对象 | 需要决定 | 关键问题 |
| --- | --- | --- |
| 范围与北极星 | 阅读并确认本轮边界 | 是否仍围绕“合字本身就是施法”，而没有扩大成完整游戏？ |
| 核心 Pilot | ACCEPT / REVISE / REJECT | `日/月 → 明 → 明亮之光 → 修灯` 是否因果连续、温和且不像答题领奖？ |
| 15 字候选 | 每字 ACCEPT / ACCEPT_WITH_EDIT / REJECT | 结构、部件角色、拼音、词义、熟悉词、适龄性、图像语义和风险是否可接受？ |
| A/B/C 方向 | A / B / C / MIX / REDO | 哪个方向最支持可读结构与安全冒险氛围，而非抢走注意力？ |
| 七格故事板 | 每格 ACCEPT / REVISE / REJECT | 是否从世界问题自然走向成字与永久变化，且没有压力或羞辱？ |
| STEP 03 | YES / NO / NOT_YET | 是否只允许在另一个明确任务中讨论下一阶段，而不是自动扩建？ |

正式决定应粗粒度；候选卡和故事板的细节用于定位 notes，不要求家长对每个视觉细节作单独的产品架构决定。

## 完整 JSON 的最低条件

`STEP-02_PARENT_REVIEW_FEEDBACK.json` 需要同时包含：

- `schemaVersion = 1` 与 `initiativeId = "hanzi-radical-battle-v2"`；
- `round >= 1`；
- Pilot identity：`anchorCharacterId`、`scenarioId`、`candidateManifestVersion`、`selectedTheme`；
- 核心 Pilot 决定、视觉方向决定、15 个候选决定、7 个故事板决定和 STEP 03 授权决定；
- 每个候选/故事板的稳定 `itemId` 与 `revisionHash`。

FINISH 会报告缺项或非法值，但仍保留并打包原反馈；“能打包”不等于“审核通过”。

## Round 2 的有效 carry-forward

Round 2 只允许将上一轮 `ACCEPT` 且 `itemId + revisionHash` 都未改变的候选字或故事板标为 carried-forward。以下情况必须重新看：

- 文案、结构、来源、图像、风险或实现变化导致 revision hash 改变；
- 依赖的候选字变化（例如 `明` 会影响核心 Pilot、第一战、回营修复与魔法书）；
- 上轮不是 `ACCEPT`，包括 `ACCEPT_WITH_EDIT`、`REVISE`、`REJECT` 或空决定；
- 新增项，或无法确认来源/identity 的项。

有效 carry-forward 会保存上一轮 notes；无效 carry-forward 不能被静默升级为接受。

## 允许的结果与后续边界

### 家长写 `REVISE`、`REJECT`、`NO` 或 `NOT_YET`

保留反馈，限定后续改动到被指出的内容。技术状态仍是 `CORE_SPELL_PILOT_READY_FOR_PARENT_REVIEW`，不进入儿童试玩，不开始 STEP 03。

### 家长写完整决定，并对 STEP 03 写 `YES`

这只记录家长对下一步讨论的意向。它不自动调用下一阶段、不开启儿童试玩、不批准完整黄金样板，也不改变本任务范围。是否启动 STEP 03 仍需要一个新的明确授权任务，重新确认范围、traceability、内容 manifest 和技术门槛。

## 不可替代的人工证据

家长审核不能被单元测试、E2E、截图、JSON schema 或自动导出替代；同样，家长审核也不能替代真实儿童观察。未来若另行授权儿童试玩，必须记录孩子是否能找到第一步、把部件放到空间位置、注意第一次成字和营地修复、理解选择，以及是否需要成人持续代读或代操作。

本 STEP 02 gate 的结论只能是：技术 Pilot 已可供家长审核，仍需家长选择内容与视觉，尚无儿童证据。STEP 03 未授权。
