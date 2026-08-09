# STEP 03 测试与证据

## 最终技术结论

STEP 03 已经达到 `GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW`。这个结论只说明候选可交家长终审；不表示家长已接受、儿童已试玩/理解/接受，也不授权推广或扩建完整“墨迹森林”。

## 最终命令矩阵

| 命令 | 结果 | 覆盖 |
| --- | --- | --- |
| `pnpm run validate:hanzi-v2-foundation` | PASS · 1 file / 12 tests | 引擎、北极星、Skill 路径/hash、禁用机制、traceability |
| `pnpm run test:hanzi-v2:step03` | PASS · 9 files / 28 tests | manifest、手牌求解、状态机、能力、Boss、save、copy、review、guardrail |
| `pnpm run validate:hanzi-v2:step03` | PASS | foundation 12/12 + STEP 03 28/28 + TypeScript |
| `PLAYWRIGHT_PORT=4175 pnpm run test:e2e:hanzi-v2:step03` | PASS · Chromium 6/6 | 大厅回归、首 spell 预算、三能力完整 run、恢复/迁移、响应式/输入、九页终审/53 字段导出 |
| `pnpm test` | PASS · 37 files / 255 tests | 全仓单元回归，包含 V1、STEP 02 与其他游戏 |
| `pnpm build` | PASS · 181 modules | TypeScript + Vite production build；V2 child/review 保持 lazy chunks |
| `pnpm run capture:hanzi-v2:step03` | PASS · 20/20 WebP | 可见控件流、三能力、响应式、reduced motion、review 页 |

`pnpm test` 首次暴露一个静态门禁冲突：STEP 03 运行时文件携带“禁词列表”字符串，被 STEP 02 全 V2 源码扫描识别为儿童文案。该列表已从运行包移除，禁词检查保留在专用测试中；相关 9/9 定向断言和全仓 255/255 重跑通过。

## 真实浏览器试玩

实现者在真实 Chromium 中从可见入口完整走过默认护字光路线，并用同一组可见儿童控件分别走过星光路标与墨点回声。capture runner 再以移动端、平板、静音和 reduced-motion 路径重现关键状态。

实现者观察：

- 第一眼是夜光营地、角色和可出发的世界，不是 dashboard。
- board、世界与怪物同时可读；五张牌在 390×844 竖屏为 3+2，没有水平溢出。
- “明”先完整成字，再显示读音/熟悉词/光与营地变化；强光没有遮住字形。
- “花”把操作从左右槽改为上下槽，且开花后保留呼吸观察，不是第一战换皮。
- 三能力在进入 Boss 后马上有可见差异，但都没有选牌、代放或自动成字。
- Boss intent、两个墨印和短暂槽遮罩可读；没有 HP 条、伤害数字或 Game Over。
- 回营后灯、花径、两树和星路都保留；魔法书可见四页和重播/朗读入口。
- reduced motion 仍保留入槽、完整字、词义和结果；mute 后文字与画面路径仍完整。
- Theme C 没有纯黑或闪烁，汉字区对比足够；其整体暗度和三能力是否被儿童视为“唯一最佳”仍是家长/真人观察项，不由技术 PASS 代替。

## 截图与运行报告

代表图索引在 `artifacts/hanzi-radical-battle-v2/step-03/screenshots/SCREENSHOT-INDEX.md`。最终 capture report：

- `screenshotEntries = 20`
- `failure = null`
- `consoleErrors = []`
- `pageErrors = []`
- `remoteRequests = []`
- 20 张代表图全部是有效 RIFF/WEBP，不是 DOM PASS 文字占位。
- 原始 PNG、capture report 和 traces 保留在 `artifacts/`；Git 只保留压缩代表图和索引。

## START / FINISH / observer 工具证据

- 实际运行 `START_STEP_03_REVIEW.cmd -NoBrowser`：Node `v24.16.0`、pnpm `11.5.2`，没有执行 install；`http://127.0.0.1:5174/?review=hanzi-v2-step03` 返回 HTTP 200。记录的 PID 随后通过任务 common tool 安全停止，5174 无 listener。
- guardrail test 通过真实 `FINISH_STEP_03_REVIEW.cmd` 运行临时 identity-matched fixture，在非 canonical 输出根生成 ZIP；同时拒绝 identity mismatch，不写 canonical feedback。
- 实际运行 `START_CHILD_FIRST_USE_OBSERVER.cmd -NoBrowser`：因 canonical STEP 03 feedback 不存在而以 exit 1 默认 `DENY`，未打开 child route 或 observation sheet。

## 独立只读验收

独立 Terra/xhigh pass 阅读 diff、规则、review 合同、测试和 20 张 WebP，并回答了 20 个验收问题。它首次找到 review iframe 在连续应用 mute/reduced-motion 时的存档竞态（Sev-2）。同任务修复为同源、review-only、白名单 action 的 `postMessage` control bridge，只在子页实际应用后 ack；E2E 读回 schema v3 中的两个设置值。独立复核 1/1 PASS 后更新为：

- Sev-1：0
- Sev-2：0（已修复并复验）
- 建议状态：`GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW`

完整独立结论随技术回传包保留。
