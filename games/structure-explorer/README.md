# 结构探索馆

与汉字书房、英语书房同级的独立结构与原理工具。首页入口 → 目录 `?play=structure-explorer` → 铅笔 `?play=structure-explorer&exhibit=pencil` → 返回目录或首页。

## 使用

点击目录中的铅笔卡片。鼠标、触摸或键盘均可操作；三模式用方向键切换，Tab 离开模式区域。纸面可点击或拖动，也可用滑条移动工具。

- **拆开看**：真实三维铅笔支持拖动旋转、滚轮缩放，触屏单指旋转、双指捏合缩放与平移。BOOM 按装配关系排开两片开槽木材、连续笔芯和两半表面涂层；点击实际几何或部件标签，进入单件大图。笔尖是观察区域；涂层剥离是教学示意。纵剖与横剖用真实几何展示，先用完整铅笔和红色面标出切的位置。辅助旋转、缩放、移动控件集中在折叠区。Esc关闭并恢复打开它的控件焦点，返回时恢复原排列与观察角度。
- **比一比**：自由试写保留原有笔迹；比较台分别控制笔芯、力度、纸面或遍数，每次只改一个变量。三条结果同时保留，换自由试写的纸不清空比较结果。
- **擦一擦**：从已有痕迹观察擦除，明确点“先画一条线”准备笔迹。自动擦除不会补画黑线。纸面局部示意可用上一步、下一步或滑条观察接触和石墨转移。

短问题与操作、结果紧邻，延伸问题按兴趣展开。笔迹深浅是定性教学模型，机器检查不证明实际儿童理解。

首期只有普通木杆铅笔：木壳与笔芯、石墨留下笔迹、橡皮带走部分石墨。后续展品按各自原理设计交互，不预先增加分类或空展品。

`structure-explorer/pencil.html` 是 Vite 的独立构建入口，保持原来的展品 URL 和 iframe 样式隔离；`games/structure-explorer/pencil.js` 管理展品，`pencil-geometry.ts` 定义三维部件，`pencil-3d.ts` 负责渲染、几何拾取与输入。Three.js 随项目打包，无 CDN；木纹本地生成。原 SVG 和预览图保留，三维运行时不再加载原结构 SVG。`public/structure-explorer/pencil-model.js` 按移动距离积分，避免动画采样次数影响单遍笔迹。父页根据文档高度调整 iframe，保持整页自然滚动；扩大观察时临时使用浏览器可见高度，关闭还原。手势取消、失焦、离开与后台停止继续生效，缓存返回可恢复三维画布。演示不保存数据。

原件来自 Family-Education-Codex 的 `output/family-learning-resource--pencil-anatomy--20261014/index.html`，SHA256 `6252380900898148fc83bda0dc193ab71578c8720c4ac56f3f8b27b15e709fca`，保持不变。科学依据和示意边界见 [sources.md](../../public/structure-explorer/sources.md)。预览图从原 SVG 结构图提取。

检查：`node --test tests/structure-explorer-model.test.js`；`pnpm exec playwright test --config playwright.structure-explorer.config.ts`；`pnpm build`。模型检查覆盖移动分段独立性、变量排序及空白擦除；浏览器覆盖桌面、360/390 手机横竖屏、768/1024 平板，实际键盘与鼠标、设备模拟触屏旋转/捏合、几何点击、单件返回、手势取消、对比留存、过程步骤与扩大观察。机器检查不代表真实设备体验、儿童兴趣或学习效果。
