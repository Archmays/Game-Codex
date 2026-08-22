# Game-Codex Portfolio 状态

> 本页由 `packages/data/gamePortfolio.ts` 确定性生成，是跨游戏生命周期、世界归属、质量等级、可见性和测试配置的唯一当前状态页。游戏自己的儿童文案仍由各 `GameDefinition` 管理。

## Foundation 基线

- 实际起点：`12c86dc22b7219a23baeb26efbe7eab9fb0a2da2`
- 起点 tracked 文件：`708232522` bytes
- Portfolio / all definitions：`9/9` 保留
- 经典大厅：`6` 当前独立入口
- 数学世界：`5/5` 自由开放站点
- 历史治理：本阶段不重写 Git 历史、不强推、不移动或覆盖 tag
- 真人儿童验证：`NO_BY_USER_DIRECTION_AND_NOT_A_DEVELOPMENT_GATE`

## 当前组合

| 游戏 | 稳定 ID | 目标世界 | 产品角色 | 等级 | 生命周期 | 当前独立可见 | 目标独立可见 | 当前 route | save namespace | test profile |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 汉字魔法战 | `hanzi-radical-battle` | 中文世界 | 旗舰 | S | `active-maintenance` | 是 | 是 | ?play=hanzi-magic-complete&from=hub | `family-games/hanzi-magic-complete/v3`<br>`family-games/hanzi-magic-v2/chapter-one`<br>`family-games/hanzi-magic-v2/wheel-workshop/v1`<br>`family-games/hanzi-radical-battle-v2/golden-slice/state` | `s-hanzi-release` |
| 算式滑轨 | `equation-slider` | 数学世界 | 旗舰 | S | `active` | 是 | 是 | 经典大厅内嵌 | `family-games/equation-slider` | `s-equation-release` |
| 数学世界 | `math-lab` | 数学世界 | 核心世界 | A | `active` | 是 | 是 | ?world=math-world&from=hub | `family-games/math-world/v1`<br>`math-battle-web/save-v1` | `a-core-world` |
| 英语世界 | `english-spell-battle` | 英语世界 | 核心世界 | A | `active` | 是 | 是 | ?world=english-world&from=hub | `family-games/english-spell-battle`<br>`family-games/english-world/v2` | `a-core-world` |
| 目标工坊 | `make-target` | 数学世界 | 独立谜题 | B | `active` | 是 | 是 | 经典大厅内嵌 | `family-games/make-target` | `b-independent-puzzle` |
| 时钟塔 | `clock-reader` | 数学世界 | 模块 | C | `active-module` | 否 | 否 | 经典大厅内嵌 | `family-games/clock-reader` | `c-module` |
| 阵列工坊 | `multiplication-adventure` | 数学世界 | 模块 | C | `migrated-module` | 否 | 否 | 经典大厅内嵌 | `family-games/multiplication-adventure` | `c-module` |
| 记忆配对 | `memory-card` | 共享模块 | 模块 | C | `active-module` | 是 | 是 | 经典大厅内嵌 | `family-games/memory-card`<br>`family-games/memory-match/v1` | `c-module` |
| 声韵试炼 | `pinyin-magic-battle` | 中文世界 | 模块 | C | `migrated-module` | 否 | 否 | ?play=hanzi-magic-complete&view=pinyin | `family-games/pinyin-magic-battle`<br>`family-games/chinese-support/pinyin/v1` | `c-module` |

## 项目阶段真源

| 阶段 | 状态 | 发布 tag / route | 摘要 |
| --- | --- | --- | --- |
| Foundation | `COMPLETE` | — | Portfolio 真源、分级门禁、安全维护事务、CI 与 Pages 组合验证。 |
| Math World | `COMPLETE` | `math-world-v1.0.0`<br>`?world=math-world` | 数感实验城与五个自由开放站点。 |
| Chinese Consolidation | `COMPLETE` | `chinese-consolidation-v1.0.0`<br>`?play=hanzi-magic-complete` | 墨迹森林、声韵试炼与字光配对完成收拢。 |
| English V2 | `COMPLETE` | `english-world-v2.0.0`<br>`?world=english-world` | 词光岛五个区域、词光册、句子任务与 English Memory。 |
| Play Readiness | `COMPLETE` | `game-codex-play-ready-v1.0.0`<br>`?world=my-game-world` | 首用、反馈、返回、存档保险箱、无障碍、性能与长期家庭使用准备。 |
| Natural-use Observation | `PENDING` | `game-codex-observation-kit-v1.0.0`<br>`?world=my-game-world&parent=observation` | 家长主动、本机最小化的 Observation Kit 已就绪；一条真实交互证据已完成修复闭环，后续仍只随自然使用证据推进。 |

- 当前收敛阶段：`play-readiness`
- 三个正式世界：`chinese / math / english`
- 真实儿童验证：`NOT_PERFORMED_AND_NOT_CLAIMED`
- Observation Kit：`READY`
- Natural-use evidence：`ONGOING_WHEN_REAL_EVIDENCE_EXISTS`

## 质量等级

- **S**：汉字魔法战、算式滑轨；核心机制或发布变化才运行各自完整 release gate。
- **A**：数学世界、英文魔法战；核心变化覆盖状态/内容、目标浏览器、响应式、存档、输入、console/network 和返回流程。
- **B**：目标工坊；覆盖可解性、确定性题库、提示/恢复、输入、route 和 save。
- **C**：时钟、乘法、记忆、拼音；覆盖内容、mount、一次主交互、exit、双视口、焦点、console/asset/network。

## 下一步边界

`NEXT: Continue normal family use; export a parent-created observation bundle only when new useful evidence naturally exists.`

Observation Kit ready；Natural-use evidence not yet collected；No scheduled human review required。不自动启动大型 V3/V4 或第四世界；只有真实自然家庭使用证据出现后，才进入小范围观察修订。
