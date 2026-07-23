# 算式滑轨重构 V3｜源码根因审计

## 严重程度

- `P0-01`：教程宣称可拖动，但阻止了真实棋盘交互。
- `P0-02`：pointer preview 将上下按钮错误改造成 tile 容器，导致每列从 3 个视觉 tile 膨胀到 9 个。
- `P0-03`：2-tile reel 被强制投影成 3 个位置，同一 tile ID 在同一 reel 内重复显示。
- `P1-01`：第一关数学内容高度重复，移动 operator reel 不改变数学意义。
- `P1-02`：页面信息层级把核心棋盘压到目标、统计、算式和教程之后。
- `P1-03`：测试体系没有浏览器层，无法阻断上述缺陷。

## P0-01｜教程为什么无法拖动

### 源码证据

`games/equation-slider/index.ts` 的 `appendTutorial()`：

1. 遍历 `root.children`；
2. 将每个既有 `HTMLElement` 设置为 `inert = true`；
3. 创建全屏 `.equation-slider__modal-backdrop`；
4. 在 modal 中放入一个纯展示用 `.equation-slider__tutorial-diagram`；
5. 教程按钮只执行“下一步”或“跳过/完成”。

教程示意图：

- `aria-hidden="true"`；
- 没有 pointer handler；
- 没有和正式 `indexes` 状态绑定；
- 没有通过真实移动完成步骤的判定。

CSS 又将 backdrop 设置为 fixed、`z-index: 50`、覆盖全屏。

### 结论

教程不是“可操作教程”，而是阻挡正式棋盘的三页说明卡。底层棋盘被 `inert`，上层 diagram 又不可交互，因此截图中无法拖动是代码的确定行为，不是偶发浏览器问题。

### 禁止的伪修复

- 只删除 `inert`，但仍让全屏 backdrop 截获事件；
- 在静态 diagram 上增加假的拖动动画；
- 保留“下一步”作为完成操作的唯一条件；
- 自动移动正式棋盘后声称孩子已经操作；
- 只把文案改成“请点击下一步”。

### 正确方向

教程必须锚定正式棋盘：

- 正式棋盘始终可见；
- coach mark 不覆盖目标命中区；
- 教程进度由真实 board state 变化驱动；
- 拖动、点击、箭头和键盘均能完成同一步；
- 跳过只是可选出口，不是主要完成方式。

## P0-02｜为什么拖动后会从 3×3 变成 3×9

### 源码证据链

`createReelControl()` 为同一 reel 创建三个元素：

1. 上按钮 `up`；
2. 中间 `.equation-slider__reel-window`；
3. 下按钮 `down`。

三个元素都被写入相同的：

```text
data-reel-index="<reelIndex>"
```

拖动时：

1. `updatePointerDrag()` 更新 `indexes`；
2. 调用 `refreshBoardPreview()`；
3. `refreshBoardPreview()` 使用：

```text
root.querySelectorAll("[data-reel-index]")
```

4. 它把查询到的每一个元素都传给 `updateReelWindow()`；
5. `updateReelWindow()` 对传入元素执行 `replaceChildren()`，然后追加三个 `.equation-slider__tile`。

### 确定结果

选择器会同时命中：

- 上按钮；
- 正式 reel window；
- 下按钮。

因此一次发生 preview 的真实拖动后：

- 上按钮被替换为 3 个 tile；
- reel window 仍有 3 个 tile；
- 下按钮被替换为 3 个 tile。

每列正好变成 `3 + 3 + 3 = 9` 个视觉 tile，与用户截图完全一致。

### 禁止的伪修复

- 给 reel 容器设置固定高度；
- `overflow: hidden` 裁掉六个 tile；
- 缩小九个 tile；
- 拖动时隐藏上下按钮；
- 只在 CSS 中恢复按钮外观；
- 用延时刷新把错误 DOM 很快盖掉。

### 正确方向

必须同时修复：

- DOM 标识合同；
- selector 作用域；
- state 到 DOM 的单向派生；
- E2E DOM 不变量。

建议：

- `data-reel-index` 只用于 reel root 或只用于 window，不能同时承担三类元素选择；
- 使用更精确的 `[data-reel-window][data-reel-index]`；
- 更进一步，把 preview 写成纯 state reducer + 单一 render，不做“查询所有同名节点再就地改写”；
- 上下按钮使用独立的 `data-control-direction`，不允许被 tile renderer 接收。

## P0-03｜为什么未移动时也显示重复格子

### 源码证据

当前类型允许：

```text
EquationReel.tiles: readonly EquationTile[]
```

solver 验证接受每列 2–3 个 tile。第一关每列只有 2 个 tile。

`updateReelWindow()` 无论 reel 有几个 tile，都生成三个视觉位置：

- previous；
- current；
- next。

对于长度为 2 的循环数组：

- `current - 1` 与 `current + 1` 会落到同一个另一个 index；
- 同一个 tile ID 被同时渲染到 top 和 bottom。

第一关因此显示：

- 左：`0 / 4 / 0`
- 中：`+ / + / +`
- 右：`0 / 4 / 0`

这九个视觉格并不是九个独立 tile；实际只有六个 tile ID。

### 影响

- 视觉进度和 solver 的 tile 覆盖合同不一致；
- 同一个 tile 在屏幕出现两次；
- 儿童无法理解为什么两个相同位置会一起亮或被视为同一块；
- E2E 若只数 `.equation-slider__tile` 会被误导；
- “3×3”只是一种重复投影，不是三行真实棋盘。

### 正确方向

V3 正式关卡采用以下合同：

- 每个 movable reel 固定 3 个不同 tile ID；
- 同一 reel 内 number 值不得全部相同；
- operator reel 只有在“选择运算符”是本关学习目标时出现；
- operator reel 至少包含 2 个不同 operator 值；
- 单一运算关使用 fixed operator token，不创建三个相同的假 reel tile；
- fixed token 不参与 coverage；
- renderer 每个 tile ID 正好渲染一次。

这意味着 V3 需要升级 level schema、solver 输入和 200 关数据，不能只改视图。

## P1-01｜第一关为什么像“只给 0 和 4”

### 数据证据

第一关的全部可见语义值来自：

```text
[0, 4] + [+, +] + [0, 4]
```

生成器允许这一结果，因为：

- Chapter 1 Unit 1 使用包含 0 的 `SMALL_POOL`；
- `selectDiverseRows()` 只要求 number columns 至少有两个不同值；
- 它不要求 operator column 有变化；
- solver 只判断可解、覆盖和结构；
- audit 没有统计所有 tile value 的分布；
- audit 也没有“前 10 关不得出现 0”或“全同 operator reel 拒绝”规则。

### 结论

当前第一关是 solver 意义上的合法题，但不是合格的儿童首关。问题不只是随机运气，而是内容合同允许生成这种题。

## P1-02｜为什么棋盘被压到页面下方

`renderBoard()` 的顺序是：

1. 大标题与两个顶部按钮；
2. 目标大卡；
3. 三张统计卡；
4. 当前算式大卡；
5. guided micro tutorial；
6. 棋盘；
7. coverage 点阵；
8. feedback；
9. hint/support；
10. 四个操作按钮；
11. 学习说明。

手机 CSS 虽压缩尺寸，但没有改变核心顺序。截图所示的长页面是此结构的直接结果。

V3 应把首屏顺序改为：

1. 紧凑返回/关卡/声音；
2. 目标 + 当前式 + 点亮进度；
3. 棋盘；
4. 撤销/提示/重置；
5. 可折叠学习内容。

“移动次数”和“提示次数”可进入完成卡或无障碍说明，不占据三张大卡。

## P1-03｜为什么 agent 没有发现

现有测试运行在 Node 环境，且 `package.json` 没有 Playwright。当前测试能证明：

- evaluator 正确；
- solver 能覆盖；
- 200 份 JSON 符合现有数据合同。

它们不能证明：

- modal 可穿透；
- pointer target 正确；
- 上下按钮没有被替换；
- tile DOM 数不增长；
- touch swipe 可用；
- 手机上的棋盘在首屏；
- 教程可由玩家操作完成。

“运行 `pnpm test` 和 `pnpm build`”不等于玩过游戏。

## 本地 Codex 必须确认的运行时项目

以下静态结论已经足够明确，但 Codex 仍需在旧版基线上保存运行证据：

- `RUNTIME-CONFIRM-01`：教程底层元素的 `inert` 与 hit test；
- `RUNTIME-CONFIRM-02`：pointermove 前后 DOM diff；
- `RUNTIME-CONFIRM-03`：每列 tile 数从 3 变 9；
- `RUNTIME-CONFIRM-04`：重复 `data-tile-id` 或缺少 `data-tile-id`；
- `RUNTIME-CONFIRM-05`：连续拖动后的 event listener、pointer capture 和 layout 稳定性；
- `RUNTIME-CONFIRM-06`：390×844 首屏与滚动距离；
- `RUNTIME-CONFIRM-07`：Pages 生产环境是否和本地一致。
