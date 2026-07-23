# 算式滑轨

> **当前状态：BLOCKED / 修复中。**  
> 现有仓库包含 200 份 solver 验证关卡数据，但浏览器版本存在已确认的 P0 缺陷：教程不能操作真实棋盘；真实拖动 preview 会把上下按钮改写成 tile 容器，使每列由 3 个视觉 tile 膨胀为 9 个；2-tile reel 又会在未移动时重复显示同一 tile。当前版本不得作为正式儿童可玩版本。权威重构交接见 `../../docs/equation-slider/rebuild-v3/`。

## 游戏目标

通过移动数字和运算符相关的滑轨，让中央表达式形成目标数学关系，并用不同组合点亮本关要求的方块。V3 将保留数感、四则运算、等式理解和组合推理目标，但会重构早期固定运算符、真实教程、reel schema、关卡内容与浏览器验收。

## 适合对象

- 目标年龄：约 6-10 岁。
- 章节需要按准备度分层。
- 单关目标时长：约 1-4 分钟。
- 不以速度、最少步数、排行榜或连续登录评价儿童。

以上是 V3 产品目标，不代表当前失败版本已经达到。

## 已确认的旧版问题

1. `appendTutorial()` 把正式棋盘设为 `inert`，再显示不可交互的静态 diagram。
2. `refreshBoardPreview()` 查询全部 `[data-reel-index]`，会同时命中上按钮、window 和下按钮。
3. `updateReelWindow()` 把每个命中元素替换成 3 个 tile，因此拖动后每列出现 9 个 tile。
4. 第一关每列只有 2 个实际 tile，但 renderer 强制显示 previous/current/next，同一 tile 被重复渲染。
5. 第一关数据为 `[0,4] / [+,+] / [0,4]`，operator reel 移动不改变数学意义。
6. 当前没有 Playwright 或真实浏览器 E2E，Node/Vitest 无法发现 pointer、modal 和 DOM 问题。

## V3 玩法方向

- 单一运算的早期关使用 fixed operator，例如固定 `+`；
- fixed token 不参与 coverage；
- movable reel 正式内容固定 3 个不同 tile ID；
- operator reel 只在运算符选择是学习目标时出现，并至少含两种不同 operator；
- 教程直接操作正式棋盘；
- 所有输入共享同一 state reducer；
- tile ID 在 DOM 中正好出现一次；
- 正确关系点亮本次使用的新 tile；
- 全部 required tile/target 完成后过关。

具体合同：

- `docs/equation-slider/rebuild-v3/03-interaction-contract.md`
- `docs/equation-slider/rebuild-v3/04-level-quality-contract.md`
- `docs/equation-slider/rebuild-v3/05-test-and-acceptance-matrix.md`

## 内容要求

最终发布仍须达到：

- 4 章；
- 每章至少 50 关；
- 总计至少 200 关；
- 先完成 1 个首关金标准；
- 再完成每章 10 个手工金标准，共至少 40 个；
- 其余关从金标准模板确定性生成；
- 全部通过 solver、内容审计、Playwright 和 agent/browser playtest。

现有 200 关可作为证据和候选池，但允许整体重建，不得因为已有投入而保留错误结构。

## 设备与无障碍目标

V3 必须验证：

- 鼠标；
- touch pointer；
- 点击 tile；
- 可见箭头；
- 键盘；
- 360×800、390×844、768×1024、1024×768、1440×900；
- reduced motion；
- 点亮状态不只依赖颜色；
- reel 手势与页面滚动不冲突。

## 当前完成度

`BLOCKED_FOR_RUNTIME_REBUILD`

已经存在：

- 原创主题；
- evaluator；
- solver；
- 4 章 manifest；
- 200 份旧 schema 关卡；
- localStorage 进度；
- GitHub Pages 接入。

尚未达到：

- 可操作教程；
- 稳定 DOM；
- 真实浏览器测试；
- 合格首关；
- V3 关卡质量合同；
- 25 关 agent/browser playtest；
- 真人儿童验证。

## 接入位置

- 导出：`equationSliderGame`
- 注册：`packages/data/gameCatalog.ts`
- 当前入口：`games/equation-slider/levels/manifest.ts`
- 当前生成器：`games/equation-slider/tools/generate-levels.ts`
- 当前测试：`tests/equation-slider-*.test.ts`
- V3 交接：`docs/equation-slider/rebuild-v3/06-codex-handoff.md`

## 版权与隐私边界

本游戏只保留“移动离散列以构成数学关系”的抽象机制。名称、视觉、文案、题库、代码和音效必须原创，不复制第三方品牌、图标、截图布局、关卡或资产。

不得加入账号、广告、支付、儿童身份资料或联网学习追踪。
