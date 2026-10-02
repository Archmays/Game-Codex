# 全项目可维护性重构进度

## 边界 / 基线
- A–J 全部实施；禁止提交、推送、发布。main / e8d000b7d5e02dd8c791f8fa795bddd5ba56079d；开工工作树干净。
- Shared/high-risk 路线。基线、源身份、日志、截图统一在 tmp/tasks/maintainability-20261002/；保护内容/关卡/素材/规则/存档/路由。
- 家庭 127.0.0.1:5175、用户真实浏览器及存档未操作。测试使用隔离 origin/context。
- 基线 pnpm test：52 文件/649 测试通过；build 通过，既有大 chunk 提示。

## A–J 实施结果
| 项目 | 实际结果 |
| --- | --- |
| A 字阵守城 | 挑战、工作台、HUD、动作、输入、scene 和组装分开。37 原函数规范化语义对比相同；0.05 秒步长、随机数、旧六关/新三短关及波前恢复不改。修复重构中 dragend 提前捕获占位回调，有实际回调测试。 |
| B 算式滑块 | board-view/panels/input/controller 分离，稳定面板节点防止重绑事件；200 关与 evaluator/solver/reducer/进度保留。 |
| C 字间行者 | 面板、输入、Worker 搜索、暂停和 scene 桥接拆开；请求代次、取消、过期消息和销毁回调有行为测试；规则/房间/求解器保留。 |
| D 世界盒子 | 各 runtime 保有场景流程，本地手势/暂停/资源生命周期复用；明确 RAF/事件/音频/几何/材质/纹理所有权。Frozen 滚动取消手势补齐；GLB/节点/布局不改。 |
| E 奇物事务所 | 地标/选择/面板/行动协调/生命周期分开，原 Intention 再校验与整体取消保留；WebGL 构造失败现在进入原失败反馈并可返回。 |
| F 两书房 | 各自 workbench 组装 shelf/card 或 writing/dialog/input；48 原函数语义对比相同。原笔画、识别 Worker、英语笔顺/时间线/四线格及各自键位不改；英语后台时间修复保留并新增3个时钟测试。 |
| G 共享设置 | 原偏好下移 packages/preferences/world-home，应用兼容导出；make-target 不再依赖 apps，旧 key/schema/扩展字段保留。 |
| H 清单与加载 | 保持不同用途清单，继续一致性校验；tower/adventure 轻量定义隔离 Phaser；AST 元数据读取支持独立文件和别名，生成说明注明来源。 |
| I 存储 | 先隔离复现未来版/损坏JSON/损坏v1覆盖，再加入状态分类、原文竞争保护和失败返回；临时继续与设置/Vault恢复入口不自动重置。game-core去掉重复探测，在实际操作处捕获失败。 |
| J 工具 | 独立 tools 类型检查、场景深度检查与书房命令、隔离测试端口、维护路径说明；修正10个无效reducedMotion配置。隐藏面板可见性和Classic精确5产品测试修正，未降低断言或更新截图。 |

## 最终验证 / PASS_MACHINE
以下证据均在 `tmp/tasks/maintainability-20261002/`。最终 `pnpm test` 于 20:08 执行：63文件/685测试通过；随后 `pnpm typecheck` 和 `pnpm build` 通过。构建只有既有大chunk提示。

| 最终检查命令 / 范围 | 结果 | 原始证据 |
| --- | --- | --- |
| test / typecheck / build | 685单测、应用及工具类型、构建通过 | final-unit.log / final-typecheck.log / final-build.log |
| test:e2e:hanzi-tower-defense | 原110项完整覆盖：87通过/23原有设备专用skip。含自然6/8波、旧六短关及新三短关、波前恢复、键鼠触摸、异常存档 | tower/initial-coverage.json、tower-final.log、desktop-parallel.log、touch-parallel.log |
| test:e2e:equation-slider / :release / :visual | 30+13+12通过 | puzzles/ 最终日志及截图 |
| test:e2e:hanzi-word-adventure | 25通过/3原有设备skip，完整20房间与提示/返回/存档 | puzzles/ 最终日志 |
| test:e2e:world-in-a-box -- --preview | 14/14脚本：11生产构建，3同源版本源码检查，模式明确记录；7/8种配置及故障矩阵 | scenes/final/world-in-a-box/*.json |
| test:e2e:oddity-puzzles -- --preview；test:e2e:oddity-legacy | 8种配置完整三关、生命周期7场景、实际v0.1旧包产生的原文存档兼容通过 | scenes/final/oddity-puzzles/ |
| 四场景直接mount/destroy所有权检查 | 每场景3次，共12次；双destroy后0RAF/观察器/游戏监听，所有AudioContext关闭，pageerrors=0 | scenes/mount-lifecycle.json及复现脚本 |
| test:e2e:english-study / test:e2e:hanzi-stroke-lab | 英语28+生命周期7通过；汉字143通过/25原有设备skip+生命周期8通过；Chromium/WebKit及各配置设备 | study/ 最终日志 |
| test:e2e:math-world / test:visual:math-world | 功能102通过/9原有skip；视觉6通过/3原有skip | final-math-browser.log；puzzles/final-math-visual.log |
| test:portfolio:smoke / test:e2e:storage / test:save-vault | 浏览器16 / 4 / 2通过；存档未来版/损坏/权限配额、刷新、原文导出及恢复 | final-portfolio-browser.log / final-storage-browser.log / final-vault.log |
| test:e2e:hittest:representative / test:e2e:scroll-reachability:representative | 4 / 4通过；18个manifest表面、实际命中与滚动；静态交互/滚动契约通过 | final-hittest.log / final-scroll.log / final-integrity.log |
| portfolio:check / levels:check / validate:hanzi-tower-defense / validate:hanzi-word-adventure | 清单一致、200关生成一致、确定性策略/房间求解通过 | final-portfolio.log / final-levels.log / final-balance.log / final-rooms.log |
| test:privacy:natural-use-kit | 既有隐私测试通过，运行代码禁止采集匹配0 | final-privacy.log |

没有新增skip、删除失败测试、放宽44px或降低截图阈值。现有skip按原约定划分键盘/触屏、故障或Vault代表设备；它们不表示未执行的设备组合已经通过。

## 失败处置与最终身份
- 隔离复现的memory覆盖风险有修复前失败日志 `memory-reproduction.log`；最终原文保护/配额/恢复回归通过。重构中dragend占位绑定及恢复说明复用帮助区的焦点问题已修复并回归。
- 测试前提修正：滑块稳定隐藏面板改用实际可见性判断，保留尺寸要求；Classic过期4数量改为当前5个精确ID；场景3项源码钩子检查由4197运行，其余11项验证生产构建。未把纯静态预览的模块缺失当作通过。
- 数学历史截图3项在开工HEAD同样失败。HEAD与最终原spec actual的像素及PNG SHA256全部相同；人工及独立语义审阅后，仅复制这3张HEAD actual作为正确基线，随后完整no-update回归通过。没有使用批量update。原失败记录：final-math-visual.log、puzzles/head-math.log；源/旧/新hash：puzzles/snapshot-copy-hashes.json。
- B/C桌面与390四图逐像素相同，两书房及Classic启动图相同；字阵原入口重建基线与最终代表图相同。三维场景语义/布局对照通过，不把动态时钟和动画截图称为逐像素相同。
- 9,911个受保护文件无差异：内容/200关/房间/挑战规则、GLB与素材、成熟模型/笔画/识别引擎、存档身份清单及锁文件保持。运行代码从浏览器矩阵启动到最终构建无变化。
- 最终全源/QA SHA256：`391d818615905e2f2d7e1adba7cf51a5c190c3326b167281edc4424060434be9`（10,213输入文件）；runtime SHA256：`f19637b0dc16f306e043a517147bbc53c1f54a0b926fae140ff6b947e1c9e949`。算法/逐文件清单在 final-source.json / final-source-lines.txt；运行连续性及构建字节见 source-continuity.json。
- 首页/Classic启动JS encoded bytes实测471,264→67,539，原提前加载的Phaser 341,710字节移除。未改变实际游戏引擎与玩法。

## 收尾与边界
child-first、视觉/可访问性、存档/Worker/单次输入对抗审阅分别完成，无未解决阻断。没有跨物理设备或真实儿童使用结论；部分生命周期负例为明确的合成事件，未冒称系统BFCache实测；系统语音继续按设备能力降级。

保持main和原HEAD；61个已跟踪修改、70个新增文件，全部本轮授权范围，未暂存/提交/推送/发布。自建测试服务已停止；家庭5175未操作。20处确认不再需要的本轮scratch已按4份明确清单回收，复现脚本、原始验证与代表截图保留。没有剩余实施项。未来五类修改位置与命令见 [架构维护说明](architecture.md#当前维护入口)。

后续 Git 授权：用户于 2026-10-02 明确要求 commit and push；上文“未提交/推送”记录的是实施验收时状态。本次提交沿用已验证源码，不重写历史或修改部署工作流。
