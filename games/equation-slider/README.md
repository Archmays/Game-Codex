# 算式滑轨

> **当前状态：PLAYABLE / V3。**
> 4 章共 200 关。当前内容版本为 `equation-slider-v3.0.0+slider-pilot-12-r1`；第一章02–10、12重设计棋盘，11仅修正目标文案，01保留。原40个模板及全局初局生成顺序不变，之后应用定点修订；当前物化来源为42个手工编写/修订关、158个生成关。当前说明与证据见 `../../docs/equation-slider/gameplay-pilot-12.md`、`levels/generated-audit.json`；既有V3及Portfolio Evolution发布报告保留为历史证据。

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
- 若相邻 tile 与当前 tile 显示相同值，该尝试不会改变状态或计步；界面解释中央算式不会变化，并引导改走能产生可见数学变化的方向；
- 全部 required tile/target 完成后过关。
- 可见箭头表示“选上方格/选下方格放到中央”；也可以直接点邻格、拖动或用方向键。
- 正常成立不锁输入；“成立但无新增”“新增点亮”“全关完成”分别用图形和文字说明，只有新增或完成使用较强反馈。
- 目标、全部需要点亮的格、双目标各自是否到过始终可见；一级提示只给概念，二级才关注一轨，三级从实时solver给下一步。
- 未平衡的等式尝试显示 `≠`，成立后才显示 `=`。

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
- 原40个金标准模板保留原来源版本；它们最初生成160关，再加原40关并分配全部初局；
- 定点修订后真实来源为42个手工关与158个生成关。源模板ID指原模板及其原版本，不把当前试点关反向作为其他188关的模板；
- 全部纳入 solver、内容审计、Playwright 和 agent/browser playtest。
- 同显示边、可达性及可见路径的当前计数由 `levels/generated-audit.json` 实算；不要求同值相邻移动来完成任何关。

机器可读质量证据见 `levels/generated-audit.json`，人工与浏览器证据见 V3 报告目录。

## 修订与本地记录

保留原 `family-games/equation-slider/progress-v3` 命名空间。只有10个实际换棋盘的关注册可选revision统计；旧完成记录与历史统计保留，当前棋盘的步数/提示统计单独记录，不强制重玩或回到首关。11仅修正文案，因此原棋盘统计仍有效。未来、损坏、未知记录或运行中被Vault/其他页面替换的记录只读；拒读/拒写不阻止当次游玩。Save Vault的37个精确键和原始字节往返合同不变。

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

未来如明确授权真人儿童观察，可按 `10-child-playtest-checklist.md` 重点确认同显示移动的解释是否易懂、一级提示理解、窄屏触控和 5–10 分钟持续使用；结果不得由 agent 试玩代替。

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
