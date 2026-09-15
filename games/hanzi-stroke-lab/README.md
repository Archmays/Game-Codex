# 汉字书房

## 工具目标

直接查阅汉字、在本机手写找字、播放实际笔顺并逐笔定位。独立工具 ID：`hanzi-stroke-lab`，不计入三个主游戏。

## 适合对象

需要查字的儿童与成人。不会读的字可手写查询，没有分数、关卡或强制练写。

## 使用说明

- 输入最多 48 个 Unicode 字符；汉字保持顺序和重复位置，非汉字有过滤说明。未知字保留原字及码点。
- 手写画布接受鼠标、触摸、笔。停笔后本地 Worker 内的 `hanzi_lookup` WASM 产生最多十个候选，点击才选择。撤销、清空、取消与离开都阻止过期结果复活。
- 播放、暂停/继续、重新开始、速度、完整字形、上一笔/下一笔和点击逐笔缩略图共用同一份路径及中线。轮廓用虚线、已写用实心，当前笔有文字序号。
- 最近查看最多 24 个、收藏最多 128 个，只使用 `family-games/hanzi-stroke-lab/v1`。不保存轨迹。未来版本和损坏记录原值不覆盖；无法保存时仍可查字。
- 田字格开关用于查看笔顺。画布保留固定定位参考线。

## 数据与边界

9,574 个字形条目有笔顺，含少量部件；9,507 个识别候选；67 个笔顺字不在识别模型中，候选缺笔顺为 0。12 个部件未收录独立读音。完整集合/差集见 `public/hanzi-stroke-lab/coverage.json`。

字音优先 Unihan 17.0 `kTGHZ2013`，其次 `kXHC1983`，否则 `kMandarin`。不进行语境消歧，不宣称穷尽读音。简繁字形不转换。来源、许可证和复现命令见 [SOURCES.md](../../public/hanzi-stroke-lab/SOURCES.md)。

识别限制以独立合成轨迹实测为准，不保证每次候选包含目标字。实际儿童识别准确率、乐趣、学习效果与长期体验均为 `NOT_CLAIMED`。

## 设备适配

桌面双区，手机“查字／手写／看笔顺”。Tab 跨区；重复列表内部方向键及 Home/End；原生 Enter/Space；键盘画笔按钮进入画布模式，方向键移动、Space 落笔/抬笔、Esc 取消并退出、Tab 离开。真实触屏硬件未参与自动验收，触摸证据为浏览器模拟。

## 当前完成度

实现与验证详情、反思修复、识别排名及发布状态见 [最终报告](../../docs/hanzi-stroke-lab-report.md)。

## 接入方式

- 首页中文工具入口或 `?play=hanzi-stroke-lab`；query-only 导航支持项目子路径。
- 继续使用 `tools/my-game-world/START_MY_GAME_WORLD.cmd`，固定 `http://127.0.0.1:5175/`。
- 字库索引、Worker/WASM 和每字 JSON 从同源加载，无外部 CDN、API、账号、后端或 Service Worker。首页只包含轻量定义，运行时代码按路由载入。
- 当前 DOM、SVG 坐标和路径均为矢量，不依赖位图缩放，缩放、DPR 和旋转不清空已完成轨迹。未完成指针笔画取消后不提交。

## 验证命令

`pnpm test`、`pnpm build`、`node tools/hanzi-stroke-lab/verify-data.mjs`、`node tools/hanzi-stroke-lab/verify-recognition.mjs`、`pnpm exec playwright test --config playwright.hanzi-stroke-lab.config.ts`。

## 后续边界

本批结束后停止。无自动扩展、长期任务、儿童账号、打卡、追踪或其它游戏改造。
