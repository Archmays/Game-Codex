# STEP 03 家长审核应用指南

## 当前边界

本应用的唯一状态是 `GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW`。它提供本地成人审核和固定 JSON 导出，**不是**家长已接受、儿童已试玩、儿童已理解、默认大厅推广或 V2 扩建许可。

入口只供本地审核：

```text
?review=hanzi-v2-step03
```

完整候选预览只供成人从审核页打开或嵌入查看：

```text
?play=hanzi-v2-golden-slice&mode=review
```

两条隐藏路由都不得加入十游戏大厅、`gameCatalog` 或儿童默认入口。

## 建议审核顺序：9 个标签

| # | 标签 | 审核锚点 | 本轮是否需要正式反馈 |
| --- | --- | --- | --- |
| 01 | Scope / Carry-forward | 3–5 分钟、12 字上限、STEP 02 只作可审计前提 | 说明与沿用状态 |
| 02 | 完整 Golden Slice | 从营地到回营、四个 encounter、可操作的 review iframe、节奏证据 | `goldenSliceDecision`、内部 `encounter-structure` |
| 03 | 12 字 Manifest | 每字 ID/hash/决定/反馈；首次 run / manifest-only | `manifestDecision` 与 12 条 `decisions.characters` |
| 04 | 三能力 | 守护光、星光路、墨回声各自独立决定，均不得代放或完成汉字 | `abilityDecisions` |
| 05 | Boss | 林 → 星；可预读干扰、温和恢复、无生命值消耗战 | `bossDecision` |
| 06 | 主题 C / 资产 | 程序化候选与三张固定 seed preview；八种资产逐项决定 | `assetDecisions` |
| 07 | 音频 / 读音 | 实际 local TTS voice、四字重听、mute/reduced-motion/视觉 fallback | `audioDecision` |
| 08 | 儿童 First-Use Gate | 首屏至授权的十项准备清单；不在这里授权 | 内部 `child-use-gate` |
| 09 | 总结 / 导出 | 缺项、changed-only 导入、唯一授权字段、固定文件名 | `authorizeChildFirstUse`、`generalNotes` |

成人应先完整体验一次预览，再填决定和文字反馈。漂亮画面、通过的测试、完整度数字或导出按钮都不能代替对“真实结构归位就是施法”的判断。

## Identity 与固定导出字段

本地草稿键是：

```text
family-games/hanzi-radical-battle-v2-step03-review/draft
```

固定下载文件名是：

```text
STEP-03_PARENT_REVIEW_FEEDBACK.json
```

导出必须绑定当前 `goldenSliceIdentity`：`implementationReviewVersion`、`goldenSliceManifestVersion`、`goldenSliceManifestRevisionHash`、`previewRoute`、`selectedTheme = "C"` 以及 source snapshot hashes。identity 不匹配的旧 JSON 不能被当作当前轮通过证据。

除内部的 stable item ID / revision hash / notes / carriedForward 记录外，导出根对象必须具有以下精确字段：

| 顶层字段 | 来源或含义 |
| --- | --- |
| `goldenSliceDecision` | 完整样板预览的 `ACCEPT` / `REVISE` / `REJECT` |
| `manifestDecision` | 12 条字符记录的粗粒度汇总决定 |
| `abilityDecisions` | `guardian-light`、`star-path`、`ink-echo` 三项能力的决定映射 |
| `bossDecision` | 林 → 星两阶段小首领的决定 |
| `assetDecisions` | `themeC`、`mage`、`companion`、`commonMonster`、`boss`、`camp`、`abilityCards`、`meaningMagic` 的独立决定 |
| `audioDecision` | 仅可为 `ACCEPT CURRENT CANDIDATE`、`NEED RECORDED AUDIO`、`REVISE` 或 `REJECT` |
| `authorizeChildFirstUse` | 仅可为 `YES`、`NO` 或 `NOT_YET`；只决定是否允许按既定本地观察协议请求启动 |
| `generalNotes` | 不含儿童个人信息的必填总体说明 |

`finalizeReviewDraft()` 会从稳定 item/character 记录同步上述正式字段，并拒绝把缺决定、缺文字反馈或 identity 不匹配的草稿标成 `completed`。`completed` 只表示字段完整，绝不表示内容通过或儿童接受。

## Round 1 与 changed-only Round 2+

Round 1 需要逐项审核所有 STEP 03 新实现和受影响项。每个显示的项目必须同时有：

1. `ACCEPT`、`REVISE` 或 `REJECT`；
2. 至少一句具体、非个人化的文字反馈。

Round 2+ 通过导入上一轮同类 JSON 创建。只有下列条件同时满足，旧 `ACCEPT` 才会折叠为 carried-forward：

- stable item ID 存在且唯一；
- revision hash 完全相同；
- 依赖项目没有变化；
- 原反馈文字存在；
- schema/固定 contract identity 兼容，且每个拟沿用记录的 revision hash 精确匹配；最终导出仍必须绑定当前完整 identity。

发生 revision 或依赖变化时，该项和其下游项必须重新出现。Manifest 的字符记录按字符 hash 独立沿用，因此一字变更不要求其余 11 字重审。`child-use-gate` 永远要求本轮重新审核；`authorizeChildFirstUse` 与 `generalNotes` 也永远不会被导入成当前轮决定。`REVISE`、`REJECT`、新增项和 dependency affected 项不得静默沿用。

## 本轮不作出的结论

- 不声称孩子已经理解左右、上下、能力或首领意图。
- 不声称孩子喜欢 Theme C、声音或动画。
- 不把 `YES` 解释为大厅发布、正式推广、完整世界扩建或儿童接受。
- 不写入姓名、年龄、学校、照片、音视频、设备标识、联系方式或任何儿童画像。

儿童首次使用的单独准备与停止边界见 [12-CHILD-FIRST-USE-PREPARATION.md](12-CHILD-FIRST-USE-PREPARATION.md) 及 `child-first-use/` 文件夹。
