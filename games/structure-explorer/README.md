# 结构探索馆

与汉字书房、英语书房同级的独立结构与原理工具。首页入口 → 目录 `?play=structure-explorer` → 铅笔 `?play=structure-explorer&exhibit=pencil` → 返回目录或首页。

## 使用

点击目录中的铅笔卡片。鼠标、触摸或键盘均可操作；三模式用方向键切换，Tab 离开模式区域。纸面可点击或拖动，也可用滑条移动工具。

首期只有普通木杆铅笔：木壳与笔芯、石墨留下笔迹、橡皮带走部分石墨。后续展品按各自原理设计交互，不预先增加分类或空展品。

网站副本 `public/structure-explorer/pencil.html` 复用原离线成果的 SVG 和科学说明，以独立文档隔离样式；父页根据文档高度调整 iframe，保持整页自然滚动。副本补齐区域键盘导航、点击/触摸、取消与后台停止行为，并修正擦空白纸产生浅灰痕迹的问题。演示不保存数据，离开展品释放文档与动画。

原件来自 Family-Education-Codex 的 `output/family-learning-resource--pencil-anatomy--20261014/index.html`，SHA256 `6252380900898148fc83bda0dc193ab71578c8720c4ac56f3f8b27b15e709fca`，保持不变。科学依据和示意边界见 [sources.md](../../public/structure-explorer/sources.md)。预览图从原 SVG 结构图提取。

浏览器检查：`pnpm exec playwright test --config playwright.structure-explorer.config.ts`。机器检查不代表真实儿童兴趣或学习效果。
