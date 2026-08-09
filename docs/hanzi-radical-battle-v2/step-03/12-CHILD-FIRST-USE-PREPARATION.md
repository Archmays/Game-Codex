# 儿童首次使用准备（尚未授权）

## 当前状态

```text
PREPARATION_ONLY / NOT_AUTHORIZED_FOR_USE
```

本文件只说明未来可能的、本地的一次真实儿童观察如何被保护。它不记录儿童结果，不生成观察 JSON，也不把 STEP 03 技术候选变成儿童默认入口。

## 关闭优先的 observer gate

在启动 `child-first-use/` 的观察流程前，observer launcher 必须同时确认：

1. 存在 schema-valid 的 `STEP-03_PARENT_REVIEW_FEEDBACK.json`；
2. `initiativeId` 与 Golden Slice identity 精确匹配当前候选；
3. 顶层字段 `authorizeChildFirstUse` 精确等于 `"YES"`；
4. 固定的家长审核字段完整：12 个字符记录、三能力、八项资产与专用音频决定均已验证，且没有被 identity mismatch、缺项或本地损坏覆盖；
5. 家长明确知道这只是一轮本地观察，不是发布或儿童接受。

任一条件不满足时，launcher 必须拒绝打开。不得把 `NO`、`NOT_YET`、空值、旧字段、内部 item decision、截图、测试 PASS 或口头推断当成 `YES`。

## 已有 child-first-use 文件的职责

| 文件 | 未来允许启动后才使用的职责 |
| --- | --- |
| `child-first-use/00-READ-ME-FIRST.md` | 说明 launcher 的关闭优先行为和本地边界 |
| `child-first-use/01-PARENT-OBSERVER-GUIDE.md` | 家长坐在一旁，不教正确槽位；记录可观察行为而不是能力评价 |
| `child-first-use/02-FIRST-USE-OBSERVATION-SHEET.html` | 本地观察表；不得填个人识别信息 |
| `child-first-use/03-FIRST-USE-OBSERVATION-SCHEMA.json` | `STEP-03_CHILD_FIRST_USE_OBSERVATION.json` 的结构约束 |
| `child-first-use/04-STOP-CONDITIONS.md` | 儿童提出停止、不适、隐私/网络/权限暴露、需成人给答案等情况立即停止 |
| `child-first-use/05-RETURN-PACKAGE-CONTRACT.md` | 只允许本地返回受限 JSON 包，不带浏览器存储、截图、照片、音视频或无关文件 |

## 若门禁未来开启的最小流程

1. 使用熟悉设备、舒适亮度与音量；根据孩子需要先选静音或减少动态。
2. 关闭通知和无关页面；不输入名字、年龄、学校、生日、照片、音视频或联系信息。
3. 只说项目观察者指南中的中性开场句，让孩子自行点击、拖动、键盘或触控；不指出部件或槽位答案。
4. 使用 Gate 的逐项清单观察首屏、first spell、second structure、ability、boss、failure、privacy、observer instructions 与 technical device；不把错误次数当分数。
5. 任何停止条件触发即使用中性语言停止；不得要求孩子完成、不把停止说成失败。
6. 仅在家长选择返回时，本地导出 `STEP-03_CHILD_FIRST_USE_OBSERVATION.json`，并先检查其中不含个人信息。

## 观察后的边界

一次观察只能提供有限的、情境化的行为记录。技术验证、家长授权、观察事实、家长解释和儿童接受必须保持为五个独立层次。没有任何单一 JSON、截图、事件日志或 agent 自测能证明儿童理解、喜欢或希望继续。

在真实观察被明确授权、完成、按停止条件解释并由家长另作决定之前，游戏仍保持 `GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW`，不进入默认大厅或下一阶段推广。
