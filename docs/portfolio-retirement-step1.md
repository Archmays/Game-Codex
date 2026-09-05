# 第一阶段产品减法

任务：`GAME-CODEX-STEP1-PORTFOLIO-RETIREMENT`。本轮明确授权覆盖旧冻结规则，仅退役时钟塔、阵列工坊和旧数感实验室；不进入第二步玩法重做。当前组合以本报告及 `packages/data/` 为准；`docs/gameplay-coherence/`、`docs/portfolio-evolution/` 的既有发布结论作为历史证据保留。

## 起点与处置范围

- 起始 SHA：`e64ab0fd0810d732c5de274e382a3e99302c9d21`；分支 `main`；起始工作区干净，无需未提交文件备份。
- 远端起点：`82e1276cf5fe0a215ecc1b22e4392fcd62657b8e`；本地已有治理提交完整保留。
- 唯一新增本地基线 tag：`local/portfolio-retirement-step1-baseline-20260905-e64ab0f`，不改写已有 tag，不推送此本地 tag。
- 本地合成验证、截图和诊断集中于忽略目录 `tmp/tasks/GAME-CODEX-STEP1-PORTFOLIO-RETIREMENT/`；不读取家庭浏览器数据库。

| 对象 | 精确路径 / 引用闭包 | 处置及理由 | 旧链接 / 存档保护 |
| --- | --- | --- | --- |
| 时钟塔 | `games/clock-reader/{index.ts,model.ts,README.md}`；`gameCatalog.ts` 静态注册、`world/activity-registry.ts` 动态加载；`src/styles.css` 的 `clock-*` 规则；`tests/math-world-clock.test.ts` 及旧浏览器用例 | 删除专用实现和失效运行断言；模型无其他生产消费者 | `station=clock` 回数学世界；`family-games/clock-reader/progress` 留在 Save Vault |
| 阵列工坊 | `games/multiplication-adventure/{index.ts,model.ts,styles.css,README.md}`；同上两处注册；共享样式中的 `multiplication-*`、`number-block-model`；`tests/math-world-array.test.ts` 及旧浏览器用例 | 删除专用实现和失效运行断言；模型无其他生产消费者；混合 CSS 规则只删退役选择器 | `station=array` 回数学世界；`family-games/multiplication-adventure/progress` 留在 Save Vault |
| 旧实验室挂载 | `src/game/config.ts`；`src/game/content/loadContent.ts`；`src/game/scenes/{BattleScene,BootScene,HudScene,MenuScene,ResultScene,sceneKeys,ui}.ts` | 逐文件核对：仅旧实验室内部依赖和专用测试；删除。`games/math-lab/index.ts` 改为世界壳适配 | `station=lab` 回数学世界；绝不读取、重置或迁移 `math-battle-web/save-v1` |
| 旧实验室模型 / 保存器 | `src/game/domain/battle/{BattleEngine,actionOptions,valueOptions}.ts`；`src/game/domain/content/types.ts`；`src/game/domain/math/{contentValidation,feedback,hints}.ts`；`src/game/domain/progression/progression.ts`；`src/game/save/saveStore.ts` | 无保留游戏的消费者；删除专用模型及 `tests/{action-options,battle-engine,content-validation,feedback-hints,progression}.test.ts`。保留目标工坊、滑轨及汉字模型测试 | 原始存档由独立的精确键清单和 Save Vault 保护，无需保留可运行旧保存器 |
| 实验室运行素材 / 数据 | `public/assets/generated/{helper-trio,river-meadow-bg,target-guardian,math-lab-helper-01,math-lab-helper-02,math-lab-helper-03,math-lab-helper-04,math-lab-helper-05,math-lab-helper-06,math-lab-helper-07,math-lab-stage-bakery,math-lab-stage-garden,math-lab-stage-library,math-lab-stage-market,math-lab-stage-river}.png`；`public/data/levels/add-sub-mvp.json`、`public/data/roles/roles.json`、`public/data/skins/placeholder-internal.json` | BootScene 的精确 / 动态模板加载专用资源；全仓无其他生产引用；删除这些运行衍生资源和数据 | 不把旧题复制进目标工坊；Git 基线可恢复 |
| 原始图像 | `public/assets/generated/target-guardian-source.png` | 原始来源默认保护；核对零运行引用后移至既有 `assets/images/target-guardian-source.png`，校验字节一致，避免继续发布原始图 | 不删除原图，不新增归档代码树 |
| 数学世界壳 | `games/math-lab/index.ts`、`games/math-lab/world/{index.ts,activity-registry.ts,world-save.ts,styles.css}`；`public/assets/math-world/math-world-city-background.webp` | 保留稳定 `math-lab` 身份和现有插画，只保留 slider、target，slider 排前；修复壳存档的未知字段 / 未来版本保护 | 旧 station 可识别但不可加载；旧访问记录与设置保留；退役 lastStation 只做 UI 回落 |
| 共享与受保护材料 | `apps/my-game-world/phaser/`；`games/hanzi-radical-battle/v2/`；`packages/game-core/`；`packages/activity-engines/memory-match/`；`source/`、许可证、历史发布报告、冻结源 | 保留：Phaser 仍被首页和汉字使用；汉字 V3 第一章 / 字轮仍依赖 V2。记忆和拼音薄适配原样保留；英语及保留游戏内容 / 规则 / 保存语义不变 | 家庭启动器和 `http://127.0.0.1:5175/` 不变 |

审计已知问题：旧运行仍可挂载；清单和测试硬编码 9 定义 / 11 模块 / 39 表面；世界壳会过滤历史记录 / 未知字段并可能覆盖未来或损坏存档；当前文档有五站点说明。允许修复范围为上述闭包及直接引用的生成器、清单、页面门禁、说明和必要测试。停止条件为安全退役、受影响检查通过、一次正常提交 / 推送与对应 Pages 状态核查；不新增玩法或关卡。

## 验证与收尾

基线：`pnpm test` 62 文件 / 446 测试通过；`pnpm build` 通过；数学浏览器 12 通过 / 4 个既有项目限定跳过。已有 Phaser 大块体积提示。未发现需回退起点的基线失败。

当前真实清单为 3 个活跃世界产品、7 个挂载定义、8 个世界模块、36 个表面（document 32 / internal 2 / locked 2），由注册关系和生成文档一致性检查确定。37 个精确存档键（36 个可导出，1 个 Vault 内部备份）与起点一致；仅将旧 lab 的保存归属标为历史兼容。原始图像 SHA-256：`7A547C94ACF4760A8974D5AD59DAFFCAF622B57589C6457BB8449D1F3D024219`，移动前后相同。

旧链接仅精确匹配 `?world=math-world&station=lab|clock|array`，用 `replaceState` 回到同一路径的数学世界并显示指定说明；保留 Pages 子路径、其他 query 和 hash。已知汉字 / 英语 play 路由保持优先。实查旧大厅卡片为事件挂载，没有独立的旧游戏 query 别名；`?hub=classic` 仍显示三个世界产品，其数学卡进入两站点地图。无退役独立页、自动开新游戏或历史循环。旧 lastStation 不显示虚假的“继续”；成功进入活跃站点才更新真实访问，保留历史顺序、设置和扩展字段。

| 最终检查 | 实测结果 |
| --- | --- |
| 单元与生产构建 | `pnpm test`：56 文件 / 421 测试通过；`pnpm build`：通过 |
| 当前清单、历史证据、数学、readiness、点击 / 滚动静态门禁 | 全部通过；历史审计保持原发布口径，删除路径用其原 Git 基线核验 |
| 隐私及生成内容 | 225 个运行文件，禁止采集匹配 0；Chinese support 及 English reports 无漂移 |
| 数学最终浏览器矩阵 | desktop 1440、mobile 390、tablet 768：48 通过 / 9 个既有项目限定跳过；新增退役用例 36/36 全运行。额外 mobile 360 同样通过 |
| 生产构建冒烟及点击 | 16/16、14/14 通过；含第一章实际拼字、滑轨移动、目标合并、翻牌及进出返回；字轮独立完成 3 轮 |
| 保留产品及共享流程 | Chinese support 30 通过；English 29 通过 / 19 个既有项目限定跳过；readiness / Save Vault / a11y 8 通过；natural-use 5 通过 / 1 个既有项目限定跳过；滚动 4 通过 |
| 视觉与几何 | 数学 9 通过 / 3 个既有项目限定跳过；组合视觉 2 通过。仅逐张检查后建立 3 张两站点地图和 2 张大厅文案快照，随后无更新验证通过；其他快照不变 |
| 存档与生命周期 | 合成的无记录、旧记录、损坏、未来版本、未知结构、拒读 / 拒写 storage、Vault 导出恢复均通过；退役键和无关哨兵原始字节不变。刷新、前进后退、无效 station、加载中切换、焦点、触控、减少动画、20 次挂载销毁通过 |

同条件默认生产构建比较（字节，JS/CSS/HTML 归入代码；其余归入静态）：

| 类型 | 起点 | 最终 |
| --- | ---: | ---: |
| 代码 | 3,761,253 | 3,665,506 |
| 静态资源 | 143,465,674 | 126,510,286 |
| 总量 | 147,226,927 | 130,175,792 |

Rollup 模块图拒绝旧 lab / clock / array 运行模块；产物关键词与浏览器网络检查无退役运行引用。减少的 19 个静态文件恰为表中的 15 个衍生图、3 个数据和移出发布目录的受保护原图；其余 529 个静态文件 SHA-256 全部不变。这是发布产物变化，不表示 Git 历史缩小。

反向审查结论：`PASS_MACHINE`。共享依赖未误删（保留游戏、Hanzi V2/V3、共享引擎、game-core、source 和锁文件差异为零）；无可加载隐藏旧游戏；精确保存键与原始字节保护成立；所有 Pages 必需门禁仍保留。发现并修复的回归为旧数量断言、历史证据路径检查、隐私扫描器读取已删除文件和预期布局快照差异，均已复验。没有已知阻碍，也没有新增玩法、关卡或第二阶段工作。

收尾按一个普通提交 / 一次推送执行。结束 SHA 为引入本报告的提交，可用 `git log --diff-filter=A -1 --format=%H -- docs/portfolio-retirement-step1.md` 精确查询；避免在提交内自写一个无法自洽的提交哈希。该 SHA、Git tree、LOCAL / PUSH / DEPLOY 实际状态、Actions URL 和线上读取到的构建 SHA 在提交后记录于本任务忽略目录的 `final-delivery.json`，绝不把预期上线写作已验证上线。报告对应的最终证据目录也保留删除计划、存档 / 依赖证明、构建清单、必要日志和最少截图，不生成 ZIP。

回滚只使用本轮提交的 `git revert <本轮提交SHA>` 后正常推送；不得 reset 分支或覆盖后续工作。删除文件可从上述本地 tag 查阅恢复。机器验证不代表真实儿童乐趣或学习效果。
