# 数学世界 · 数感实验城

## 游戏目标

通过五个可自由进入的站点直接操作数学对象：数感实验室、时钟塔、阵列工坊、目标工坊和算式滑轨站。

## 适合对象

- 年龄：6-9 岁。
- 适合亲子共玩：家长可以陪孩子读题、复述数量关系，并观察孩子是否需要提示。

## 玩法说明

世界地图使用语义 DOM，站点按需加载且各自保存进度。探索实验室继续复用原有 Phaser 场景；其儿童表面不再显示总星星、连续天数、今日总数或失误总数。

## 涉及知识点

- 加法、减法和数量调整。
- 多步骤计划。
- 场景化问题理解。
- 内容数据位于 `public/data/levels/` 和 `src/game/domain/`。

## 设备适配

- 支持鼠标和触控。
- 适合手机、平板和电脑。
- 包含图片资源和音效反馈，运行资源位于 `public/assets/` 和 `public/data/`。

## 当前完成度

V1.0.0 已完成。公开 route 为 `?world=math-world`，五个 station deep link 支持刷新与返回。世界壳只保存访问站点和 reduced-motion 选择，不复制模块进度。

## 后续改进建议

- Math Lab 真正实现仍保留在 `src/game/`；后续迁移必须单独评估，不能借世界壳改写核心。
- `math-battle-web/save-v1` 继续容错读取；旧 streak 字段保留但不再更新或驱动界面。

## 接入方式

- 导出：`mathLabGame`。
- Classic 稳定 ID：`math-lab`；canonical route：`?world=math-world&from=hub`。
- 世界活动注册：`games/math-lab/world/activity-registry.ts`。
