# 算式滑轨重构 V3｜交互与状态合同

## 目标

建立一个可以被单元测试、E2E 和人工试玩共同验证的单一核心循环：

> 移动一个真实 reel → 中央表达式立即变化 → 命中目标后点亮本次使用的新 tile → 继续寻找不同成立关系 → 完成本关。

不得再让 DOM、动画副本、教程示意图或历史节点成为游戏状态。

## V3 level schema 的结构原则

表达式由两类 slot 组成：

```ts
type ExpressionSlot =
  | { kind: "movable-reel"; reel: ReelDefinition }
  | { kind: "fixed-token"; token: ArithmeticToken };
```

### Movable reel

正式发布关卡中：

- 每个 movable reel **恰好 3 个 tile**；
- 三个 tile ID 必须唯一；
- 每个 tile 在棋盘 DOM 中正好出现一次；
- number reel 的三个值不能全部相同；
- operator reel 至少包含两个不同 operator 值；
- 一个 reel 的移动必须改变数学值、可覆盖 tile，或二者；不允许纯装饰性可交互 reel。

### Fixed token

- 用于早期单一运算关，例如固定 `+`；
- 不参与移动；
- 不计入 coverage；
- 不伪装成 reel；
- 不显示上下按钮；
- 有明确 `aria-label`。

### 为什么需要 fixed operator

Chapter 1 若只学习加法，创建 `[+, +, +]` operator reel 会让孩子移动一个数学意义完全不变的列。V3 必须用固定 `+`，把注意力放在数的组合上。只有在比较运算符本身是学习目标时，才出现 movable operator reel。

## Board state

建议状态等价于：

```ts
interface BoardState {
  readonly indexes: readonly number[];
  readonly coveredTileIds: ReadonlySet<string>;
  readonly completedTargetIds: ReadonlySet<string>;
  readonly moveCount: number;
  readonly status: "ready" | "dragging" | "feedback-lock" | "complete";
}
```

硬性要求：

- level definition 不可变；
- `indexes.length` 等于 movable reel 数；
- 每个 index 始终为 `0 | 1 | 2`；
- move reducer 是所有输入方式的唯一状态入口；
- undo 保存纯状态 snapshot；
- reset 精确恢复 fixed initial state；
- coverage 只存 tile ID；
- render 不修改 level/reel/tile 数组；
- 退出关卡后 timer、pointer capture、listener 和异步写回全部清理。

## DOM 不变量

每一帧、每一种输入方式都必须满足：

- `formalTileCount = movableReelCount × 3`；
- 每个 `data-tile-id` 唯一；
- 每个 reel 恰好 3 个 `[data-tile-id]`；
- control button 不得包含 tile；
- tile 不得包含 control button；
- pointer preview 前后 tile ID 集合完全相同；
- 连续 100 次移动后节点数不增长；
- board bounding box 高度变化不超过 2 CSS px；
- 不使用永久 clone；
- 如动画必须有临时 clone，必须：
  - `data-animation-clone="true"`；
  - `aria-hidden="true"`；
  - 不带正式 `data-tile-id`；
  - 动画完成、取消和 destroy 时立即删除。

## 输入合同

每个 movable reel 支持：

1. 垂直 pointer drag/swipe；
2. 点击上方 tile，把它移到中央；
3. 点击下方 tile，把它移到中央；
4. 可见的上/下辅助按钮；
5. reel 聚焦后的 `ArrowUp` / `ArrowDown`。

所有入口调用同一 `commitMove(reelId, direction)`。

### Pointer Events

必须处理：

- `pointerdown`
- `pointermove`
- `pointerup`
- `pointercancel`
- `lostpointercapture`

行为：

- 只接受单一 active pointer；
- mouse 仅接受主键；
- 12–16 px 后进入 drag；
- 预览最多一格；
- 超过约 35% tile 高度或明确速度阈值才提交；
- 不到阈值吸附回原位；
- 一次手势只生成一个 undo snapshot；
- `pointercancel` 恢复起点；
- 不允许一次 swipe 跨两格；
- 只在 reel 命中区抑制纵向页面滚动；
- 页面其他区域可以正常滚动。

## 教程合同

### 禁歊

- 全屏 modal 阻挡棋盘；
- 把正式棋盘设为 `inert` 后声称可以拖动；
- 静态 diagram；
- 只点“下一步”即可完成；
- 自动代替玩家移动；
- 文字说明超过一个短句后仍没有操作。

### 首关金标准

Chapter 1 Level 1 使用：

- 固定 operator：`+`
- 目标：`6`
- 左 number reel：`[1, 2, 4]`
- 右 number reel：`[5, 4, 2]`
- 初始中央式：`4 + 5 = 9`
- 第一步：把右 reel 的 `2` 移到中央，得到 `4 + 2 = 6`
- 其余成立关系：
  - `1 + 5 = 6`
  - `2 + 4 = 6`

三组关系覆盖两个 reel 的六个 tile。

### 步骤

1. “让中央算式得到 6。”
2. 锚定右 reel 的 `2`：“把 2 移到中央。”
3. 玩家真实操作后点亮当前两个 number tile。
4. 提示：“正确关系会点亮用到的数字。把六个数字都点亮。”
5. 取消强制 spotlight，允许自由完成。

coach mark：

- 不覆盖目标；
- 除自身按钮外 `pointer-events: none`；
- 教程进度监听真实 state；
- 鼠标、touch pointer、点击和键盘都可完成；
- “跳过”始终存在。

## 成功与完成

命中目标时：

- 点亮当前 arrangement 中尚未覆盖的 movable tile；
- fixed token 不计数；
- 显示短反馈；
- 不扣生命；
- 不强制倒计时。

命中目标但没有新 tile：

- 明确说明“算式成立，但这些数字已经亮了”；
- 提醒寻找新组合；
- 不把它当错误。

只有全部 required tile 和 required target 完成时才过关。

## 提示合同

三级支架：

1. 概念：找怎样的关系；
2. 位置：关注哪个 reel/tile；
3. 方向：执行哪一步。

提示必须从当前状态由 solver 计算，保证：

- 下一步可执行；
- 会接近未完成 coverage；
- 不依赖已过期 canonical plan；
- 玩家走了计划外正确路线后仍可完成。

## 页面信息层级

手机和桌面统一优先级：

1. 返回、关卡、声音；
2. 目标、当前式、coverage；
3. 棋盘；
4. 撤销、提示、重置；
5. 折叠学习说明。

不再用三张大卡常驻显示移动次数、提示次数等次要数据。

## 响应式门禁

视口：

- 360×800
- 390×844
- 768×1024
- 1024×768
- 1440×900

硬要求：

- 无横向溢出；
- 390×844 首屏看得到目标、完整首关棋盘和主要操作；
- 主要触控目标至少约 44×44 px；
- safe area 正确；
- 表达式数字变化不造成明显 layout shift；
- 页面可滚动，reel 手势不误滚；
- reduced motion 下无需等待动画解锁。

## 无障碍

- 全流程键盘可完成；
- 清楚焦点；
- tile 的 label 包含 reel、值、当前位置、是否已亮；
- feedback 使用克制 `aria-live`；
- 不逐帧朗读；
- 点亮不只靠颜色；
- 声音可关闭并保存；
- fixed token 和 movable reel 在语义上明确区分。
