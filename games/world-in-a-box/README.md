# 世界盒子 v0.3.0 · 两个小世界

固定家庭地址为 `http://127.0.0.1:5175/`，沿用家庭启动器 `tools/my-game-world/START_MY_GAME_WORLD.cmd`。默认进入原有《窗边有风》，右上角“换盒子”可切换；两个盒子分别保存进度。

- 窗边有风：`?play=world-in-a-box&scene=window-breeze`
- 德累斯顿·河流、桥与大学：`?play=world-in-a-box&scene=dresden-river-campus`

## 德累斯顿

18件分为河边、老城、校园、街区四组，每页最多三件，可以自由换序拼装。接口须在实际允许视角可见；提示只帮助观察，不代放。拼好后可操作黄色电车、轮桨船、SLUB三维剖面、日夜灯光和六组本地实景对照。武汉与德累斯顿的钟由同一设备时间按 IANA 时区计算，德国夏令时自动变化。

电车可在缺桥时沿同岸轨道运行，跨岸前会停下；装桥后按继续。撤桥会先将桥上的电车安全送回老城。船从实际桥孔穿过，可来回游览和靠近已装码头。图书馆展开只是玩具剖面，真实屋顶不会升降。城市距离和交通线均为游戏简化。

键盘使用 Tab 跨区域、方向键在区域内选择、Enter/Space 操作、Escape 取消、Z 撤销；所有动作也有鼠标和触屏按钮。运动旁有就近操作栏，后台或失焦会暂停。城市使用独立的 `dresden-river-campus-v2` 槽，重来不清除旧 `v1`。

模型脚本 `blender/build_dresden.py`，正式源文件 `blender/dresden-river-campus.blend`，导出资产 `public/assets/world-in-a-box/dresden/`。Blender 4.5 LTS 命令与下述旧盒子相同，替换脚本名即可。普通运行不调用 Blender，不请求外部资源。照片作者及许可在当地对照窗和 `photos/credits.json`；事实与简化见 `docs/world-in-a-box/dresden-sources.md`，本轮验证见 `docs/world-in-a-box/step03-report.md`。

## 窗边有风（保留原有八件玩法）

## 游戏目标

把八件小物放回开放式木制窗边角落，发现开窗带来的联动。无评分与拼装顺序要求。

## 适合对象

喜欢拼装和微缩玩具的家庭；可独立探索，也可亲子共玩。

## 玩法说明

首个八件可玩样板，入口 `?play=world-in-a-box`。固定家庭地址 `http://127.0.0.1:5175/`，沿用家庭启动器 `tools/my-game-world/START_MY_GAME_WORLD.cmd`。左右窗扇可互换，归位时使用对应铰链方向；所有接口在固定背景上，拼装次序自由。风铃须转到窗外才能看到。

点选物件再点可见接口；方向键在托盘/可见接口内移动，Tab 跨区域，Enter/Space 确认，Escape 取消。相机和所有机关有可见按钮。帮助可开关，主动提示会显示观察方向而不代放。撤销仅收回本次最近手动放置；重置本关需确认。

存档复用 `createLocalStorageStore('world-in-a-box')` 的 `v1` 匿名槽，保存已放件、开窗、帮助及静音。没有账号、姓名或联网记录。关闭所有窗扇/撤销唯一开启窗扇后联动停止；后来安装的窗帘、叶片、书页和风铃立即响应现有风状态。

## 制作

Blender 4.5 LTS：`blender --background --factory-startup --python-exit-code 1 --python games/world-in-a-box/blender/build_scene.py`。先带 `-- --samples` 生成代表样件，同一组函数复用于成品。固定种子 190926；PBR 木纹为原创图像纹理，打包进 GLB 与 blend。运行资源在 `public/assets/world-in-a-box`；正式源文件在 `blender/window-breeze.blend`。坐标、接口、枢轴同源，glTF 自动转 Y-up。

普通构建和运行只需本地导出资产，完全不调用 Blender。Three.js 经游戏路由动态加载；配乐和音效由制作期原创编配/合成渲染为本地 PCM WAV，运行期只由 Web Audio 解码播放，不请求远程字体、解码器或音频。静态包需 HTTP 服务；不声明 `file://` 支持。

机器验证及边界见 `docs/world-in-a-box/step01-r2-report.md`。无物理手机和真人儿童结论。

## 涉及知识点

形状匹配、三维视角、遮挡与可逆因果。机关是木制玩具表现，不是空气动力学模拟。

## 设备适配

键盘、鼠标、触屏共享同一动作；手机/平板横竖屏与桌面浏览器。设备模拟与实际物理设备结论分开。

## 当前完成度

v0.3.0 两个完整盒子；具体机器验证及实际设备边界以各轮报告为准。

## 后续改进建议

本轮到此停止；真人使用反馈、其他场景和扩展系统均不自动启动。

## 接入方式

根目录 `pnpm run play:my-game-world`，进入 `?play=world-in-a-box`；静态输出用 `pnpm build`，源 blend 不进入 dist。

## STEP03-R2：观察、重置和声音

按住“左转／右转”（鼠标、触屏、Enter 或 Space）连续转动，松开停止。点真实可见接口表面或浮动按钮调用相同放置动作；城市车辆表面也可打开操作。帮助开关和提示先解除跟随，再检查实际遮挡、标签排布和可点击性。帮助关闭可自行观察全部26件。

“重置本关”指当前整个盒子，默认焦点为“继续玩”；确认只收回本盒8/18件并清除旧机关/撤销/提示状态。取消保留观察和有效运动意图；真正后台中断之后车船需主动继续。原 v1 与城市 v2 键保留，新声音偏好单独保存在 `audio-v1` 并登记备份恢复。失败写入有明确反馈。

音乐、音效、环境可分别调至0，原静音偏好兼容。两首原创循环曲分别为76 BPM三拍子约76秒的窗边曲、84 BPM四拍子约91秒的城市曲。生成脚本：`tools/world-in-a-box/render-audio.py`；本地文件和许可：`public/assets/world-in-a-box/audio/manifest.json`。无需乐器库、在线AI或音乐服务。使用 Python、NumPy、SciPy 可重建全部26个音频文件。

实际运行音轨与技术检查见 STEP03 报告。机器PCM检查不等于实际听感确认，也不代表真人儿童喜欢或学习有效。
