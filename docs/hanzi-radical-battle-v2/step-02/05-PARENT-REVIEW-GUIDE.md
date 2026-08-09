# STEP 02 家长审核指南

## 打开审核工作台

默认大厅不变。使用以下隐藏 URL 打开本地审核页：

```text
http://127.0.0.1:5173/?review=hanzi-v2-step02
```

推荐通过以下启动器打开：

```text
tools\hanzi-v2-step02\START_STEP_02_REVIEW.cmd
```

它会从脚本位置解析仓库根目录，检查 Node 和 pnpm；只在 `node_modules` 缺失时运行 `pnpm install --frozen-lockfile`，然后在隐藏窗口启动严格占用 5173 端口的 Vite。PID、stdout 和 stderr 写入 `tmp\hanzi-v2-step02\`，不调用 Git。若只想启动而不自动打开浏览器：

```text
tools\hanzi-v2-step02\START_STEP_02_REVIEW.cmd -NoBrowser
```

## 审核顺序

审核应用有六个 tab：

1. **范围与北极星**：确认本轮只审 60–90 秒核心法术与审核材料，不审完整 V2。
2. **核心法术 Pilot**：实际走一次“明 = 日 + 月”的五牌、槽位、成字、法术、修灯和字灵书闭环；成人可切换两个结构 preview。
3. **15 字候选**：逐项阅读结构、部件角色、拼音、熟悉词、意义、风险、来源边界和现有本地图；每项作决定。
4. **视觉方向**：比较同一场景的 A/B/C，作 A/B/C/MIX/REDO 决定。
5. **故事板**：查看七格因果链；每格提供反馈锚点，但正式决定保持 ACCEPT/REVISE/REJECT 的粗粒度。
6. **汇总与导出**：检查缺项、导入 Round 1 形成 Round 2、决定是否授权讨论 STEP 03，并下载固定 JSON。

建议先完整试玩 Pilot，再看候选、视觉和故事板，最后填写总体决定。不要让“候选字数量”或“漂亮的方向”替代对核心成字动作的判断。

## 本轮必须留下的决定

导出前，工作台会检查以下必填项：

- `decisions.corePilot.decision`：`ACCEPT` / `REVISE` / `REJECT`
- `decisions.visualDirection.selection`：`A` / `B` / `C` / `MIX` / `REDO`
- 15 个候选字：每项都有 `itemId`、`revisionHash` 和 `ACCEPT` / `ACCEPT_WITH_EDIT` / `REJECT`
- 7 个故事板：每项都有 `itemId`、`revisionHash` 和 `ACCEPT` / `REVISE` / `REJECT`
- `decisions.authorizeStep03`：`YES` / `NO` / `NOT_YET`

请把具体问题写在对应 notes 中。不要录入儿童姓名、出生日期、照片、语音、账号信息或其他私人信息。

## 固定导出与 Round 2

浏览器下载名固定为：

```text
STEP-02_PARENT_REVIEW_FEEDBACK.json
```

JSON 固定包含 `schemaVersion: 1`、`initiativeId: "hanzi-radical-battle-v2"`、round、Pilot identity、稳定 item ID、revision hash、决定、notes 和缺项清单。下载文件本身不等于家长接受，更不等于儿童证据。

Round 2 导入上一轮 JSON 后：

- round 自动递增；
- 只有 **revisionHash 未变** 且上一轮为 `ACCEPT` 的候选字/故事板，才会被标为 carried-forward；
- `revisionHash` 绑定完整审核内容；候选内容变化还会让依赖它的 Pilot／故事板进入“本轮需看”；
- 已改动项、未接受项、`REVISE`、`REJECT` 与任何 hash 不匹配项必须重新审阅；
- 已录 notes 会随有效 carry-forward 保留，不要求重复作同一决定。

## 收尾与回传包

审核完成后运行：

```text
tools\hanzi-v2-step02\FINISH_STEP_02_REVIEW.cmd
```

可选参数：

```text
-FeedbackPath <json path>
-OutputRoot <output directory>
-KeepServer
-NoStopServer
```

默认查找顺序是：

1. `%USERPROFILE%\Downloads\STEP-02_PARENT_REVIEW_FEEDBACK.json`
2. `artifacts\hanzi-radical-battle-v2\step-02\review\inbox\STEP-02_PARENT_REVIEW_FEEDBACK.json`

FINISH 会复制反馈到固定 review 输出，检查 schema 与所有决定，写 `review-summary.md`、Pilot identity、selected theme、候选 manifest、screenshot index、commit SHA，并生成：

```text
artifacts\hanzi-radical-battle-v2\step-02\STEP-02_PARENT_REVIEW_RETURN_TO_CHATGPT.zip
```

即使 JSON 缺项或无效，FINISH 也会保留原反馈并打包，同时在 summary 和控制台列出问题；它不会把不完整审核升级为通过。除非传入 `-KeepServer` 或 `-NoStopServer`，它只会停止 START 记录且仍匹配的 Vite PID。

## 本轮不作出的结论

本轮不能声称儿童已理解结构、喜欢世界、注意到修复，或已准备儿童试玩。当前技术状态只能写作：`CORE_SPELL_PILOT_READY_FOR_PARENT_REVIEW`。STEP 03 仍未授权。
