# 算式滑轨重构 V3｜旧实现 Playwright 红灯结果

## 目的

在修改 `games/equation-slider` 运行时代码之前，先证明浏览器门禁能够检测 WEB 审计和运行基线中的缺陷。

## 基线与命令

- 运行日期：2026-07-23
- 代码基线：`b2c9379d3c6067f033685037c96af01040f90956`
- 浏览器：Playwright Chromium
- 配置：单 worker、本地 Vite `127.0.0.1:4173`、失败时 screenshot/trace
- 测试文件：`tests/e2e/equation-slider.spec.ts`

```powershell
pnpm test:e2e:equation-slider
```

## 结果

```text
Total: 23
Failed: 21
Passed: 2
Exit code: 1
Duration: 2.4m
```

两个旧版已通过项目：

1. 离开并重进关卡后，单次箭头没有观察到重复 listener 提交。
2. `prefers-reduced-motion: reduce` 下，旧版不会等待成功动画解锁。

其余 21 项红灯，证明测试不是“为了新实现而永远绿”的空门禁。

## 代表性红灯

| 合同 | 旧版实际 | 新门禁期望 |
| --- | --- | --- |
| 教程显示正式棋盘 | `0` 个 `[data-equation-board]` | `1` |
| 教程不能用静态下一步替代 | `1` 个“下一步”按钮 | `0` |
| 首关 movable reel | `0` 个稳定 `data-reel-id` | `2` |
| 首关 fixed operator | `0` 个 `data-fixed-token` | `1` |
| 首关正式 tile | `0` 个 `data-tile-id` | `6` |
| 三 reel 正式 tile | 无正式 identity | `9` 且唯一 |
| 五 reel 正式 tile | 无正式 identity | `15` 且唯一 |
| control identity | `0` 个 `data-control-direction` | 首关 `4` 个 button |
| pointer preview | 视觉 tile 由 9 增至 27 | 首关始终 6 |
| pointercancel | 旧版运行基线留下 27 tile/18 button tile | 恢复 6/0 |
| lostpointercapture | 旧 selector/DOM 合同无法恢复稳定结构 | 无 dragging、6 tile、0 button tile |
| 初始 coverage | 无稳定 formal tile/progress identity | `0/6` |
| 390×844 | 主要操作在首屏外 | 目标、完整棋盘、主要操作均在首屏 |
| reel touch-action | `pan-x` | reel 手势建立后不滚页的明确合同 |
| 首关输入结果 | 旧首关仍为 `4 + 4` 与重复 operator reel | V3 首步得到 `4 + 2` |

## 覆盖范围

红灯组已实际包含：

- 教程 hit test 与真实状态推进；
- 6/9/15 tile 数；
- control/tag/descendant 合同；
- tile ID 唯一与 pointermove 集合稳定；
- 连续 100 次混合移动；
- pointercancel；
- lostpointercapture；
- 离开/重进 listener；
- 初始点亮；
- fixed operator coverage 排除；
- 390×844 首屏；
- reel/page scroll 边界；
- reduced motion；
- mouse drag、touch pointer、neighbor tile click、可见箭头、键盘。

## 临时产物边界

Playwright 为 21 个失败生成了 `test-results/equation-slider/**` screenshot、error context 与 trace。它们只用于开发诊断，不作为提交物；正式 before 截图与本报告是持久证据，临时 trace 会在 closeout 前删除。

结论：`OLD_IMPLEMENTATION_RED_CONFIRMED`
