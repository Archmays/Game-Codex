# 结构探索馆

与汉字书房、英语书房同级的独立结构与原理工具。首页入口 → 目录 `?play=structure-explorer` → 铅笔 `?play=structure-explorer&exhibit=pencil` → 返回目录或首页。

## 使用

点击目录中的铅笔卡片。鼠标、触摸或键盘均可操作；三模式用方向键切换，Tab 离开模式区域。纸面可点击或拖动，也可用滑条移动工具。

- **拆开看**：完整、拆开、纵剖和横剖四种视图；点部件或用“观察部位”选择，自动定位；放大、缩小、四向移动和复位。扩大查看沿用同一个场景，Esc关闭并恢复入口焦点。
- **比一比**：自由试写保留原有笔迹；比较台分别控制笔芯、力度、纸面或遍数，每次只改一个变量。三条结果同时保留，换自由试写的纸不清空比较结果。
- **擦一擦**：从已有痕迹观察擦除，明确点“先画一条线”准备笔迹。自动擦除不会补画黑线。纸面局部示意可用上一步、下一步或滑条观察接触和石墨转移。

短问题与操作、结果紧邻，延伸问题按兴趣展开。笔迹深浅是定性教学模型，机器检查不证明实际儿童理解。

首期只有普通木杆铅笔：木壳与笔芯、石墨留下笔迹、橡皮带走部分石墨。后续展品按各自原理设计交互，不预先增加分类或空展品。

网站副本 `public/structure-explorer/pencil.html` 复用原离线成果的 SVG 和科学说明，以独立文档隔离样式；原结构图提取到 `pencil-structure.svg`，`pencil.js` 管理展品，`pencil-model.js` 按移动距离积分，避免动画采样次数影响单遍笔迹。父页根据文档高度调整 iframe，保持整页自然滚动；扩大观察时临时使用浏览器可见高度，关闭还原。区域键盘导航、点击/触摸、取消与后台停止继续生效。演示不保存数据，离开展品释放文档与动画。

原件来自 Family-Education-Codex 的 `output/family-learning-resource--pencil-anatomy--20261014/index.html`，SHA256 `6252380900898148fc83bda0dc193ab71578c8720c4ac56f3f8b27b15e709fca`，保持不变。科学依据和示意边界见 [sources.md](../../public/structure-explorer/sources.md)。预览图从原 SVG 结构图提取。

检查：`node --test tests/structure-explorer-model.test.js`；`pnpm exec playwright test --config playwright.structure-explorer.config.ts`；`pnpm build`。模型检查覆盖移动分段独立性、变量排序及空白擦除；浏览器覆盖键盘、鼠标、触摸、对比留存、过程步骤与扩大观察。机器检查不代表真实儿童兴趣或学习效果。
