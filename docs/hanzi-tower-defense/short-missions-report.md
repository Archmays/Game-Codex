# 短局任务变化 · 2026-10-01

本轮问题：孩子已能独立理解现有操作，但短局重复。授权限定为三种任务原型和 B 的一个轻变体；完成实现、模型战斗、真实浏览器输入、回归与本地打包。不推送、不公开发布。

## 任务边界与发现

预检实际根目录 `D:\ChatGPT-Codex-Projects\Game-Codex`，工作区干净。读取根 AGENTS、Skill index、Natural-Use 和当前 README/STEP1 来源。采用 New/substantial 路线，以及 child-first、汉字质量、machine-first review。允许改动仅本游戏 tactics/model/save/index/styles、直接测试/战斗工具和说明；其他游戏、共享玩法、地图、字库、敌人、存档键、旧六短局参数及记录受保护。

核对结果：已有七配方、真实射程/合成预览、键鼠触控语义入口；stone 没有独立护甲减伤。stow 保留整塔及附件，recycle 只修门。retryWave 已使用波前 Checkpoint 恢复经济、冷却、英文奖励和 RNG；本轮扩展同一个 Checkpoint。短局补给在击退第 1/5 只时发放；英文有波末保底。战役 v3 与短局 v1 原始字节保护及旧 ID 延续。

已知发现与处置：重复感是本轮唯一产品问题，增加名额取舍、残局修复、背包目标；不重复开发教学/合成提示/射程。新挑战参数必须进入 checkpoint 与严格校验；选包/目标替换整局准备状态，避免刷材料。机器验收与真实孩子趣味验收分开。

停止条件：三个原型、声明的一处预部署位置变体、要求的策略和输入/存档检查完成，交付本地入口与包。不得扩展下一批。

## 新规则

- `qinglan-elite` 少塔精兵：最多三塔，全部八塔位保留；地图/预告可见后选择熔岩包或林间包。未选择不能开战；第一波前换包全量重置，战斗后不能换。
- `qinglan-repair` 接手残局：火山在入口、林在城门、氵在末弯；少量补料。可以移整塔，也可以合成改变构成。变体只把初始林由塔位8移到塔位6。
- `qinglan-packs` 带着行囊出发：选火＋山各2，或木＋氵各3。只数背包基础字核，部署或合成不算保留；使用资源的预览明确数量后果。守城与行囊分别反馈。原候选目标会由固定补给自动补齐，实战后收紧到当前数量，避免空目标。

## 验证与交付

模型验收涵盖三塔上限、非法部署保料、选包全量重置/无重复授予、战中禁换、预置塔身份/冷却/英文附件随移动与收回、行囊只数基础背包、回收修门后的数量、完整重整与刷新、旧六局/战役、损坏和跨页存档保护。额外发现损坏存档 main/retry 检查点选择不一致会换题，已修复并用三场景反例测试原始字节保护。包、目标和变体进入原 Checkpoint；不建立第二套快照。

实际 Chromium 输入：A/C 桌面仅用 Tab、方向键、Enter/Space 和 Escape；B桌面鼠标；三局另各有390触控模拟完整三波。均从现有世界入口进战术列表，选择、布塔、合成、开波、暂停/继续、重整、刷新、通关、保参再试和返回。A第四塔实测保留选中状态和库存；A自然失败后重整修阵继续；B换变化、移林塔；C选择两目标分别通关。使用现有公开 2× 按钮缩短等待，不注入状态、不改时钟，不读取未来随机。零页面错误、零外部请求；同源 blob 图像请求单独计数。

代表尺寸：360×740、390×844、768×1024、1024×768、844×390、1440×1000；新关键控件尺寸、互不相交和内部采样 hit-test 通过；旧合同还覆盖1024×1366、1366×1024、740×360。额外键盘 Space/Enter 检查 B 变体以及 C 目标的焦点保持、方向键和 Tab 出区。触控为浏览器模拟，不是实体设备。未测 Firefox、Safari、真实手机、屏幕阅读器和真实孩子。

### 实战策略记录

以下塔位编号从1开始。所有策略只使用可见材料、固定预告和公共操作；无英文装备也能完成。A/C在第一波前合成/部署，后两波保持塔阵并保留真正获得的补给，不依赖战中临界帧。B第一波先保持接手原阵，第二波前调整，第三波沿用。完整18条的核ID、合成输入/时机、波间操作、逐波血量/击杀/库存/附件/目标和结束状态保存在 `short-missions-balance.json`。

| 挑战与选择 | 第一波/修复后的构成 | 合成与波间操作 | 结束 |
|---|---|---|---|
| A 两包均可·清群接力 | 火山1、林2、沐4 | 火+山，木+木，氵+木；波间不变 | 16血，0漏 |
| A 两包均可·重击控制 | 炎1、山林2、沐4 | 火+火，木+木后山+林，氵+木；波间不变 | 16血，0漏 |
| A 两包均可·只合成一塔 | 山林1、基础火2、基础氵4 | 木+木后山+林；保留基础火/氵，波间不变 | 13血，1漏 |
| A 两包均可·两塔合成 | 火山1、林2、基础氵4 | 火+山，木+木；波间不变 | 13血，1漏 |
| A 熔岩包专有 | 火山1、火山2、沐4 | 两份火+山与氵+木 | 16血，0漏 |
| A 林间包专有 | 山林1、沐2、沐4 | 木+木后山+林，两份氵+木 | 16血，0漏 |
| B 原阵/变体·移动 | 初始火山1/林8或6/氵7；第二波林到2 | 收回整林再部署，身份/冷却不变，0合成 | 10血，2漏 |
| B 原阵/变体·改构成 | 初始同上；第二波火山1/山林2/沐4 | 收回林/氵；山+林、氵+木，重新部署 | 16血，0漏 |
| C 火山目标·熔岩控制 | 火山1、林2、沐4 | 保留其余基础火/山及补给 | 16血，火3/山2，目标完成 |
| C 火山目标·根岩控制 | 炎1、山林2、沐4 | 保留基础火/山及补给 | 16血，火2/山2，目标完成 |
| C 木氵目标·火力接力 | 火山1、炎2、林4 | 留木1/氵2与之后补给 | 16血，木3/氵4，目标完成 |
| C 木氵目标·根岩基础 | 炎1、山林2、基础火4 | 留木1/氵2与之后补给 | 16血，木3/氵4，目标完成 |

对照：A三基础火/木/氵会在第一波失守；重整精确恢复，再合成/调整位置后完整三波获胜。B原阵三个塔不动仍能守住，终7血/漏3；说明第一波有恢复余地，不需要先输。C用光开局目标材料仍能满血守城，但火/山仅1/1或木/氵仅2/2，行囊未完成；继续使用真实奖励再合成也能分别影响目标。两个目标都有多解，未做材料锁定、强制重玩或持久进度惩罚。

### 检查命令

```powershell
pnpm exec vitest run tests/hanzi-tower-defense.test.ts tests/hanzi-tower-defense-step4.test.ts tests/hanzi-tower-defense-step5.test.ts tests/hanzi-tower-defense-resonance.test.ts tests/hanzi-tower-defense-placement.test.ts tests/hanzi-tower-defense-short-missions.test.ts tests/hanzi-tower-defense-short-missions-balance.test.ts --no-file-parallelism
pnpm exec tsx tools/hanzi-tower-defense/short-missions-balance.ts --write
pnpm exec playwright test --config playwright.short-missions.config.ts
$env:TD_EVIDENCE_DIR='tmp/tasks/SHORT-MISSIONS/legacy-browser'
pnpm exec playwright test --config playwright.hanzi-tower-defense.config.ts --grep '@step5-mechanism|@step5-save|@step5-layout|STEP4 regions, native activation' --workers=3
pnpm run build
powershell -NoProfile -ExecutionPolicy Bypass -File tools/hanzi-tower-defense/package-short-missions.ps1
```

最终源码验收与打包结果见随包 `evidence/VERDICT.json`、`evidence/SOURCE_FREEZE.json`。旧六局保持12构筑全三波模型回归，战役原六波/两张八波地图保持现有模型回归；旧浏览器子集7通过/3按既有profile分工跳过。新浏览器完整三局与恢复/几何10项通过，额外键盘检查单独运行。不更新视觉baseline制造通过；截图由独立视觉/儿童界面review检查，无P1/P2未解决问题。

最初浏览器回合修了测试文本匹配和同源blob分类；另一回合被开发热更新干扰，丢弃其验收，固定产品源码后完整重跑通过。这些属于测试/执行修正，不列作旧产品问题。

### 启动与交付

项目入口：双击 `tools\my-game-world\START_MY_GAME_WORLD.cmd`，继续相同浏览器/profile与 `http://127.0.0.1:5175/` 来源。顶部“战术短局”新三局排在前面。直接访问方式见游戏 README。

本地包 `handoffs/hanzi-short-missions/SHORT_MISSIONS_LOCAL.zip`：解压双击 `START_SHORT_MISSIONS.cmd`（需本机已有Node.js，不下载依赖）；保留原游戏世界供返回。本包只静态服务本机5175，不覆盖运行中的其他服务器。不要双击 runtime/index.html。包含运行构建、清单、报告、模型证据和关键截图；无家庭存档/真人资料。ZIP与SHA256在任务清理前后核对。

改动文件：本游戏 `tactics.ts`、`model.ts`、`save.ts`、`index.ts`、`v1.css`、`README.md`；本轮报告；新模型/策略测试、战斗脚本、浏览器配置/用例、本地打包/启动工具；旧STEP5测试/工具仅把原六局遍历绑定 `LEGACY_SCENARIO_IDS`。没有修改 `content.ts`、`maps.ts`、其他游戏或共享组件。

关键截图：随包 `evidence/qinglan-elite-keyboard-ready.png`、`qinglan-repair-touch-ready.png`、`qinglan-packs-touch-ready.png` 及对应 won/viewport。全部是合成浏览器验证，无真人孩子。

机器结论只表示本轮规则、战斗模型、浏览器交互和保存合同通过。自然试玩关注：是否主动选另一包、尝试另一种修阵、愿意再玩，以及从哪里又开始觉得重复。未声称趣味、学习、保留或家长接受。本轮收口，不增加地图、字库、敌人、每日任务、排行榜或养成系统。
