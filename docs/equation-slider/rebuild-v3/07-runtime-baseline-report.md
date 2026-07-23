# 算式滑轨重构 V3｜旧版运行基线报告

## 结论

运行基线：`BLOCKED_FOR_RUNTIME_REBUILD`

本报告在修改算式滑轨运行时代码前完成。WEB 静态审计中的五项核心结论均在真实 Edge/Chromium Pointer Events 环境中得到确认；`pointercancel` 路径还暴露出一个更严重的残留 DOM 缺陷：算式状态虽回到起点，27 个视觉 tile 与被改写的按钮却不会恢复。

## 仓库与环境

- WEB 交接基线：`b2c9379d3c6067f033685037c96af01040f90956`
- 基线时本地 `HEAD`：`b2c9379d3c6067f033685037c96af01040f90956`
- 基线时 `origin/main`：`b2c9379d3c6067f033685037c96af01040f90956`
- 原远端：`https://github.com/Archmays/family-learning-games.git`
- 2026-07-23 按用户明确要求重命名为：`https://github.com/Archmays/Game-Codex.git`
- 本地目录：仓库根目录（未持久化机器绝对路径）
- 分支：`main`
- Node：`v24.16.0`
- pnpm：`11.5.2`
- 浏览器：Microsoft Edge，由 Playwright CLI 驱动
- 本地 URL：`http://127.0.0.1:5173/`
- Pages URL：`https://archmays.github.io/Game-Codex/`

仓库重命名没有改动提交内容或基线 SHA。本地 `origin` 已同步到新 URL；最终验收报告必须继续记录旧名、新名、Pages URL 与最终远端 SHA，供 WEB 端交接。

## 安装与旧测试

```text
pnpm install --frozen-lockfile: PASS（锁文件无变化）
pnpm test: FAIL（142/143 通过）
```

唯一失败是 `tests/game-catalog.test.ts` 要求每个游戏 README 包含 `## 玩法说明`；WEB 交接对 `games/equation-slider/README.md` 的降级重写遗漏了该标题。该失败与 P0 交互根因无关，但属于当前基线真实失败，最终必须修复。

## 复现流程

1. 清空本游戏 localStorage。
2. 从游戏大厅点击“进入轨道站”。
3. 观察自动出现的“三步玩法”。
4. 只点击“下一步”即可从 1/3 前进到 2/3、3/3，再点击“开始点亮”。
5. 进入“加法启程线”第 1 关。
6. 检查初始 DOM、移动端首屏与重复投影。
7. 分别执行鼠标 drag、真实 touch pointer swipe、上/下 tile 区域点击、可见箭头、键盘。
8. 在 pointermove、pointercancel、pointerup 后分别采集 DOM 与布局。
9. 连续完成同一 reel 的 20 次拖动。
10. 退出关卡列表后重新进入，再执行一次移动。
11. 在当前 Pages 页面重复正式 drag。

## RUNTIME-CONFIRM-01｜教程阻断正式内容

状态：`CONFIRMED`

- 教程出现时 `.equation-slider` 的 5 个既有子节点全部 `inert=true`。
- 全屏 `.equation-slider__modal-backdrop` 为唯一未 inert 的同级节点。
- 当前屏幕没有正式棋盘：`boardCount=0`。
- 静态 diagram 内可交互元素数：`0`。
- “下一步”按钮存在，且无需任何 board state 变化即可前进。
- 本地与 Pages 控制台均无 error；这是确定的产品合同缺陷，不是运行时异常。

证据：

- `before/01-tutorial-static-modal-390x844.png`

## RUNTIME-CONFIRM-02｜pointermove DOM 改写

状态：`CONFIRMED`

初始状态：

- `.equation-slider__tile`：`9`
- `[data-reel-index]`：`9`，由 6 个 button 与 3 个 reel window 组成
- button 内 tile：`0`
- 棋盘高度：`274px`

鼠标或 touch pointer 移动超过 12px 后：

- `.equation-slider__tile`：`27`
- button 内 tile：`18`
- 9 个 `[data-reel-index]` 节点各自含 3 个 tile
- 棋盘高度：`454.4375px`

证据：

- `before/02-first-level-initial-390x844.png`
- `before/04-pointermove-expanded-390x844.png`
- `before/05-touch-pointer-expanded-390x844.png`

## RUNTIME-CONFIRM-03｜每列由 3 个视觉 tile 变成 9 个

状态：`CONFIRMED`

三个正式 reel 的每一个在 preview 中都同时改写：

- 上 button：3 tile
- reel window：3 tile
- 下 button：3 tile

因此每列精确变成 9 个视觉 tile；三列合计 27。CSS 没有掩盖该变化，截图中可见棋盘纵向膨胀。

## RUNTIME-CONFIRM-04｜重复投影与 tile identity 缺失

状态：`CONFIRMED`

第 1 关初始棋盘文本为：

```text
0 / 4 / 0
+ / + / +
0 / 4 / 0
```

正式 DOM 中 `data-tile-id` 数量为 `0`，无法建立 tile identity 不变量。旧 schema 每列只有两个 tile，renderer 却固定生成 previous/current/next；上下位置因此必然重复投影同一实际 tile。

## RUNTIME-CONFIRM-05｜连续移动、取消与重进

状态：`REFINED`

连续 20 次真实鼠标拖动：

- 已提交移动：`20`
- 每次 preview 最大 tile 数：`27`
- 每次正常 pointerup 后 tile 数：`9`
- 每次正常 pointerup 后棋盘高度：`274px`
- 最终 button 内 tile：`0`

退出并重新进入：

- 退出前 move count：`1`
- 重进后的本局 move count：`0`
- 重进后点击一次只记录为：`1`
- 未观察到重复 click 提交

但 `pointercancel` 暴露出新增的 P0 证据：

- 算式从 preview 正确恢复到 `4 + 4`
- tile 数仍为 `27`
- button 内 tile 仍为 `18`
- 棋盘高度仍为 `454.4375px`

也就是说，取消只恢复了数组索引，没有恢复被 preview 改写的 DOM。

证据：

- `before/06-pointercancel-expanded-390x844.png`

## RUNTIME-CONFIRM-06｜390×844 首屏层级

状态：`CONFIRMED`

390×844 初始位置：

- 棋盘 top：`557.671875px`
- 棋盘 bottom：`831.671875px`
- 主要操作 top：`961.046875px`
- `.game-stage` client height：`781px`
- `.game-stage` scroll height：`1116px`

首屏只能在底部勉强看见完整棋盘，撤销、重置、提示等主要操作完全在首屏外；header、目标、三张统计卡、当前式和长微教程先占据空间。

证据：

- `before/02-first-level-initial-390x844.png`
- `before/03-first-level-fullpage-390x844.png`
- `before/07-first-level-initial-768x1024.png`
- `before/08-first-level-initial-1440x900.png`

## RUNTIME-CONFIRM-07｜Pages 与本地一致

状态：`CONFIRMED`

仓库重命名后的 Pages URL 可访问，页面仍是旧部署产物。在正式 drag preview 中：

- URL：`https://archmays.github.io/Game-Codex/`
- tile 数：`27`
- button 内 tile：`18`
- 棋盘高度：`454.4375px`

最近三次 Pages workflow 均失败；基线 `b2c9379…` 的失败来自上述 README 契约测试，因此重命名时展示的是更早的旧部署，而不是交接基线的新构建。

证据：

- `before/09-pages-old-deployment-390x844.png`
- `before/10-pages-pointermove-expanded-390x844.png`

## 输入方式结果

| 输入 | 旧版结果 | 结论 |
| --- | --- | --- |
| 鼠标 drag | 表达式改变；preview 27 tile | 可触发，但 DOM 合同失败 |
| touch pointer swipe | `4 + 4` 变为 `0 + 4`；preview 27 tile | 可触发，但 DOM 合同失败 |
| 点击上方 tile 区域 | `0 + 4` 变为 `4 + 4` | 可触发 |
| 可见箭头 | `4 + 4` 变为 `0 + 4` | 可触发 |
| 键盘 ArrowDown | `4 + 4` 变为 `0 + 4` | 可触发 |
| pointercancel | 算式恢复，DOM 不恢复 | P0 失败 |
| 跳过教程 | 可进入地图和关卡 | 可用，但主要教程路径仍为静态说明 |

## 根因结论

| 根因 | 运行结论 |
| --- | --- |
| 教程 `inert` + 静态 diagram | `CONFIRMED` |
| 泛化 `[data-reel-index]` 改写 controls | `CONFIRMED` |
| 2-tile reel 重复 previous/next | `CONFIRMED` |
| 首关 `[0,4] / [+,+] / [0,4]` | `CONFIRMED` |
| Node-only 测试无法发现上述问题 | `CONFIRMED` |
| pointercancel 留下损坏 DOM | `REFINED / 新增 P0 证据` |

旧版运行证据已冻结。下一阶段必须先建立能在该实现上失败的 Playwright E2E，再允许修改运行时代码。
