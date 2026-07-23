# 算式滑轨

> **当前状态：PLAYABLE / V3。**
> 4 章共 200 关已按 V3 schema 重建；正式棋盘教程、统一 board state、稳定三格 reel、40 个手工金标准、160 个确定性生成关、真实浏览器 E2E 与 25 关 UI-only agent 试玩均已完成。完整证据见 `../../docs/equation-slider/rebuild-v3/`。

## 游戏目标

通过移动数字和运算符相关的滑轨，让中央表达式形成目标数学关系，并用不同组合点亮本关要求的方块。V3 覆盖数感、四则运算、等式理解和组合推理；早期关使用固定运算符，后续再引入真实的运算选择。

## 适合对象

- 目标年龄：约 6-10 岁。
- 章节需要按准备度分层。
- 单关目标时长：约 1-4 分钟。
- 不以速度、最少步数、排行榜或连续登录评价儿童。

自动化验收不等于真人儿童验证；真实儿童观察仍按 `10-child-playtest-checklist.md` 后续执行。

## 已根治的旧版问题

1. 教程已改为直接操作正式 `es-1-01` 棋盘，不再 `inert`，也没有静态“下一步”替代。
2. pointer preview 只更新渲染预览，不替换 control 或正式 tile DOM。
3. 每条 movable reel 恰好 3 个唯一 tile ID；任一 tile 在 DOM 正好出现一次。
4. 旧 2-tile 重复投影已移除，生产 manifest 只加载 V3 三格关卡。
5. Chapter 1 使用 fixed `+`；operator reel 只在运算选择本身有学习意义时出现。
6. Playwright 已覆盖真实 mouse/touch pointer、click、箭头、keyboard、取消、滚动、响应式和长期 DOM 稳定性。

## 玩法说明

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

当前发布内容：

- 4 章；
- 每章 50 关；
- 总计 200 关；
- 首关为独立金标准；
- 每章 10 个手工金标准，共 40 个；
- 其余 160 关从金标准模板确定性生成；
- 全部纳入 solver、内容审计、Playwright 和 agent/browser playtest。

机器可读质量证据见 `levels/generated-audit.json`，人工与浏览器证据见 V3 报告目录。

## 涉及知识点

- 20 以内加法与数的组成；
- 减法、相差与加减互逆；
- 乘法分组、整除与乘除互逆；
- 四则运算顺序、等式平衡、多目标与覆盖规划。

## 设备适配

V3 已纳入自动化验证：

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

`PLAYABLE_V3`

已经完成：

- 原创主题；
- evaluator；
- solver；
- 4 章 V3 manifest；
- 200 份 V3 schema 关卡；
- localStorage 进度；
- 真实浏览器交互、响应式和 Pages 发布接入；
- 25 关 UI-only agent 试玩。

尚未执行：

- 真人儿童验证。

## 后续改进建议

按 `10-child-playtest-checklist.md` 做去身份化真人儿童观察，重点确认重复值 tile identity、一级提示理解、窄屏触控和 5–10 分钟持续兴趣；结果不得由 agent 试玩代替。

## 接入方式

- 导出：`equationSliderGame`
- 注册：`packages/data/gameCatalog.ts`
- 当前入口：`games/equation-slider/levels/manifest.ts`
- 当前生成器：`games/equation-slider/tools/generate-levels.ts`
- 当前测试：`tests/equation-slider-*.test.ts`
- V3 交接：`docs/equation-slider/rebuild-v3/06-codex-handoff.md`

## 版权与隐私边界

本游戏只保留“移动离散列以构成数学关系”的抽象机制。名称、视觉、文案、题库、代码和音效必须原创，不复制第三方品牌、图标、截图布局、关卡或资产。

不得加入账号、广告、支付、儿童身份资料或联网学习追踪。
