# 世界盒子 · 窗边有风 v0.1.0

## 游戏目标

把八件小物放回开放式木制窗边角落，发现开窗带来的联动。无评分与拼装顺序要求。

## 适合对象

喜欢拼装和微缩玩具的家庭；可独立探索，也可亲子共玩。

## 玩法说明

首个八件可玩样板，入口 `?play=world-in-a-box`。固定家庭地址 `http://127.0.0.1:5175/`，沿用根目录启动器。左右窗扇可互换，归位时使用对应铰链方向；所有接口在固定背景上，拼装次序自由。风铃须转到窗外才能看到。

点选物件再点可见接口；方向键在托盘/可见接口内移动，Tab 跨区域，Enter/Space 确认，Escape 取消。相机和所有机关有可见按钮。帮助可开关，主动提示会显示观察方向而不代放。撤销仅收回本次最近手动放置；重来需确认。

存档复用 `createLocalStorageStore('world-in-a-box')` 的 `v1` 匿名槽，保存已放件、开窗、帮助及静音。没有账号、姓名或联网记录。关闭所有窗扇/撤销唯一开启窗扇后联动停止；后来安装的窗帘、叶片、书页和风铃立即响应现有风状态。

## 制作

Blender 4.5 LTS：`blender --background --factory-startup --python-exit-code 1 --python games/world-in-a-box/blender/build_scene.py`。先带 `-- --samples` 生成代表样件，同一组函数复用于成品。固定种子 190926；PBR 木纹为原创图像纹理，打包进 GLB 与 blend。运行资源在 `public/assets/world-in-a-box`；正式源文件在 `blender/window-breeze.blend`。坐标、接口、枢轴同源，glTF 自动转 Y-up。

普通构建和运行只需本地导出资产，完全不调用 Blender。Three.js 经游戏路由动态加载；音效由本地 Web Audio 合成，不需要远程字体、解码器或音频。静态包需 HTTP 服务；不声明 `file://` 支持。

机器验证及边界见 `docs/world-in-a-box/step01-r2-report.md`。无物理手机和真人儿童结论。

## 涉及知识点

形状匹配、三维视角、遮挡与可逆因果。机关是木制玩具表现，不是空气动力学模拟。

## 设备适配

键盘、鼠标、触屏共享同一动作；手机/平板横竖屏与桌面浏览器。设备模拟与实际物理设备结论分开。

## 当前完成度

单场景 v0.1.0 可玩样板；具体机器验证以报告为准。

## 后续改进建议

本轮到此停止；真人使用反馈、其他场景和扩展系统均不自动启动。

## 接入方式

根目录 `pnpm run play:my-game-world`，进入 `?play=world-in-a-box`；静态输出用 `pnpm build`，源 blend 不进入 dist。
