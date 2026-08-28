# Game-Codex Portfolio 状态

> 本页由 `packages/data/gamePortfolio.ts` 确定性生成，是跨游戏生命周期、世界归属、质量等级、可见性和测试配置的唯一当前状态页。游戏自己的儿童文案仍由各 `GameDefinition` 管理。

## Foundation 基线

- 实际起点：`12c86dc22b7219a23baeb26efbe7eab9fb0a2da2`
- 起点 tracked 文件：`708232522` bytes
- Mount definitions：`9` 保留
- Active child products：`3`
- World modules：`11`
- Compatibility surfaces：`6`
- Shared engines：`2`
- 经典大厅：`3` 活跃产品入口
- 数学世界：`5/5` 自由开放站点
- 历史治理：本阶段不重写 Git 历史、不强推、不移动或覆盖 tag
- 家庭稳定基线：`FROZEN`（`game-codex-family-stable-v1.0.0` / `8b890ff14880bcb576dd1ced37e14e6e3df28af1`）
- 真人儿童验证：`NO_BY_USER_DIRECTION_AND_NOT_A_DEVELOPMENT_GATE`

## 当前组合

| 游戏 | 稳定 ID | 目标世界 | 定义角色 | 产品角色 | 等级 | 生命周期 | 活跃儿童产品 | Classic 卡片 | 规范 route | save namespace |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 汉字魔法战 | `hanzi-radical-battle` | 中文世界 | 活跃儿童产品 | 旗舰 | S | `active-maintenance` | 是 | 是 | ?play=hanzi-magic-complete&from=hub | `family-games/hanzi-magic-complete/v3`<br>`family-games/hanzi-magic-v2/chapter-one`<br>`family-games/hanzi-magic-v2/wheel-workshop/v1`<br>`family-games/hanzi-radical-battle-v2/golden-slice/state` |
| 算式滑轨 | `equation-slider` | 数学世界 | 世界模块挂载 | 旗舰模块 | S | `active-module` | 否 | 否 | ?world=math-world&station=slider | `family-games/equation-slider` |
| 数学世界 | `math-lab` | 数学世界 | 活跃儿童产品 | 核心世界 | A | `active` | 是 | 是 | ?world=math-world&from=hub | `family-games/math-world/v1`<br>`math-battle-web/save-v1` |
| 英语世界 | `english-spell-battle` | 英语世界 | 活跃儿童产品 | 核心世界 | A | `active` | 是 | 是 | ?world=english-world&from=hub | `family-games/english-spell-battle`<br>`family-games/english-world/v2` |
| 目标工坊 | `make-target` | 数学世界 | 世界模块挂载 | 独立谜题 | B | `active-module` | 否 | 否 | ?world=math-world&station=target | `family-games/make-target` |
| 时钟塔 | `clock-reader` | 数学世界 | 世界模块挂载 | 模块 | C | `active-module` | 否 | 否 | ?world=math-world&station=clock | `family-games/clock-reader` |
| 阵列工坊 | `multiplication-adventure` | 数学世界 | 世界模块挂载 | 模块 | C | `active-module` | 否 | 否 | ?world=math-world&station=array | `family-games/multiplication-adventure` |
| 记忆配对 | `memory-card` | 共享模块 | 兼容适配定义 | 模块 | C | `compatibility-only` | 否 | 否 | 无儿童侧独立 route | `family-games/memory-card`<br>`family-games/memory-match/v1` |
| 声韵试炼 | `pinyin-magic-battle` | 中文世界 | 兼容适配定义 | 模块 | C | `compatibility-only` | 否 | 否 | ?play=hanzi-magic-complete&view=pinyin | `family-games/pinyin-magic-battle`<br>`family-games/chinese-support/pinyin/v1` |

## 分层组合真源

- 活跃儿童产品：`hanzi-radical-battle` / `math-lab` / `english-spell-battle`
- Classic 投影：`hanzi-radical-battle` / `math-lab` / `english-spell-battle`

| 世界模块 | Host 世界 / 产品 | Mount 定义 | Runtime owner | 质量档 | Runtime save | 规范 route | 引擎 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 墨迹森林主故事 | 中文世界<br>`hanzi-radical-battle` | `hanzi-radical-battle` | `hanzi-radical-battle` | `s-hanzi-release` | `family-games/hanzi-magic-complete/v3`<br>`family-games/hanzi-magic-v2/chapter-one`<br>`family-games/hanzi-magic-v2/wheel-workshop/v1`<br>`family-games/hanzi-radical-battle-v2/golden-slice/state` | ?play=hanzi-magic-complete | game-owned |
| 声韵试炼 | 中文世界<br>`hanzi-radical-battle` | `hanzi-radical-battle` | `hanzi-radical-battle` | `s-hanzi-release` | `family-games/hanzi-magic-complete/v3`<br>`family-games/hanzi-magic-v2/chapter-one`<br>`family-games/hanzi-magic-v2/wheel-workshop/v1`<br>`family-games/hanzi-radical-battle-v2/golden-slice/state` | ?play=hanzi-magic-complete&view=pinyin | game-owned |
| 字光配对 | 中文世界<br>`hanzi-radical-battle` | `hanzi-radical-battle` | `hanzi-radical-battle` | `s-hanzi-release` | `family-games/hanzi-magic-complete/v3`<br>`family-games/hanzi-magic-v2/chapter-one`<br>`family-games/hanzi-magic-v2/wheel-workshop/v1`<br>`family-games/hanzi-radical-battle-v2/golden-slice/state` | ?play=hanzi-magic-complete&view=memory | `memory-match` |
| 数感实验室 | 数学世界<br>`math-lab` | `math-lab` | `math-lab` | `a-core-world` | `math-battle-web/save-v1` | ?world=math-world&station=lab | game-owned |
| 时钟塔 | 数学世界<br>`math-lab` | `clock-reader` | `clock-reader` | `c-module` | `family-games/clock-reader` | ?world=math-world&station=clock | game-owned |
| 阵列工坊 | 数学世界<br>`math-lab` | `multiplication-adventure` | `multiplication-adventure` | `c-module` | `family-games/multiplication-adventure` | ?world=math-world&station=array | game-owned |
| 目标工坊 | 数学世界<br>`math-lab` | `make-target` | `make-target` | `b-independent-puzzle` | `family-games/make-target` | ?world=math-world&station=target | game-owned |
| 算式滑轨站 | 数学世界<br>`math-lab` | `equation-slider` | `equation-slider` | `s-equation-release` | `family-games/equation-slider` | ?world=math-world&station=slider | game-owned |
| 词光岛五区域 | 英语世界<br>`english-spell-battle` | `english-spell-battle` | `english-spell-battle` | `a-core-world` | `family-games/english-spell-battle`<br>`family-games/english-world/v2` | ?world=english-world | game-owned |
| 词光册 | 英语世界<br>`english-spell-battle` | `english-spell-battle` | `english-spell-battle` | `a-core-world` | `family-games/english-spell-battle`<br>`family-games/english-world/v2` | ?world=english-world&view=journal | game-owned |
| English Memory | 英语世界<br>`english-spell-battle` | `english-spell-battle` | `english-spell-battle` | `a-core-world` | `family-games/english-spell-battle`<br>`family-games/english-world/v2` | ?world=english-world&view=memory | `memory-match` |

| 兼容表面 | 用途 | route |
| --- | --- | --- |
| 游戏百宝箱 | `alternate-launcher` | ?hub=classic |
| 墨迹森林 V2 | `legacy-route` | ?play=hanzi-v2-chapter-one |
| 墨迹森林 V1 | `legacy-route` | ?play=hanzi-v2-v1 |
| 英文魔法战旧版拼写练习 | `legacy-route` | ?play=english-spell-battle-legacy |
| 记忆配对旧定义 | `definition-adapter` | 无儿童侧 route；仅保留定义适配 |
| 声韵试炼旧入口 | `legacy-route` | ?play=pinyin-magic-battle |

| 共享引擎 | 路径 | 消费者 |
| --- | --- | --- |
| `memory-match` | `packages/activity-engines/memory-match` | `chinese-memory`<br>`english-memory`<br>`memory-card` |
| `game-core-local-storage` | `packages/game-core` | `hanzi-radical-battle`<br>`equation-slider`<br>`math-lab`<br>`english-spell-battle`<br>`make-target`<br>`clock-reader`<br>`multiplication-adventure`<br>`memory-card`<br>`pinyin-magic-battle` |

## 项目阶段真源

| 阶段 | 状态 | 发布 tag / route | 摘要 |
| --- | --- | --- | --- |
| Foundation | `COMPLETE` | — | Portfolio 真源、分级门禁、安全维护事务、CI 与 Pages 组合验证。 |
| Math World | `COMPLETE` | `math-world-v1.0.0`<br>`?world=math-world` | 数感实验城与五个自由开放站点。 |
| Chinese Consolidation | `COMPLETE` | `chinese-consolidation-v1.0.0`<br>`?play=hanzi-magic-complete` | 墨迹森林、声韵试炼与字光配对完成收拢。 |
| English V2 | `COMPLETE` | `english-world-v2.0.0`<br>`?world=english-world` | 词光岛五个区域、词光册、句子任务与 English Memory。 |
| Play Readiness | `COMPLETE` | `game-codex-play-ready-v1.0.0`<br>`?world=my-game-world` | 首用、反馈、返回、存档保险箱、无障碍、性能与长期家庭使用准备。 |
| Natural-use Observation | `ACTIVE` | `game-codex-observation-kit-v1.0.0`<br>`?world=my-game-world&parent=observation` | 普通家庭使用已开始；Observation Kit 保持家长主动、本机最小化、默认零记录，只在自然出现的真实证据需要时使用。 |

## 明确授权的有界开发周期

| 周期 | 触发 | 状态 | 起点 / 发布 tag | Natural-use 影响 | 真人儿童验证 |
| --- | --- | --- | --- | --- | --- |
| Portfolio Evolution | `EXPLICIT_USER_AUTHORIZATION` | `RELEASE-BOUND` | `73ae9d6be140c9e8294781b9f8e6ed296590c438`<br>`game-codex-portfolio-evolution-v1.0.0` | `ONGOING_NOT_CLOSED` | `NOT_PERFORMED_AND_NOT_CLAIMED` |
| World Coherence and Gameplay Lift | `EXPLICIT_USER_AUTHORIZATION` | `RELEASE-BOUND` | `90eb3b242b38b1d7a8cd98c8e0cafce14a6984a0`<br>`game-codex-gameplay-coherence-v1.0.0` | `ONGOING_NOT_CLOSED` | `NOT_PERFORMED_AND_NOT_CLAIMED` |

- 当前有界周期：`gameplay-coherence-02`；完成条件：`RELEASE_TAG_TARGET`；最终完成由发布 tag、CI 与 Pages 同 SHA 回读证明，不由源码预先宣告。
- 当前收敛阶段：`natural-use-observation`
- 下一自动阶段：`NONE`
- 三个正式世界：`chinese / math / english`
- 真实儿童验证：`NOT_PERFORMED_AND_NOT_CLAIMED`
- Observation Kit：`READY`
- Natural-use evidence：`ACTIVE`
- 自动大型任务：`NONE`

## 质量等级

- **S**：汉字魔法战、算式滑轨；核心机制或发布变化才运行各自完整 release gate。
- **A**：数学世界、英文魔法战；核心变化覆盖状态/内容、目标浏览器、响应式、存档、输入、console/network 和返回流程。
- **B**：目标工坊世界模块；覆盖可解性、确定性题库、提示/恢复、输入、route 和 versioned save。
- **C**：时钟、乘法、记忆、拼音；覆盖内容、mount、一次主交互、exit、双视口、焦点、console/asset/network。

## 下一步边界

`NEXT: Normal family use. New development only when real evidence or a reproducible defect exists.`

普通家庭使用已开始。Observation Kit 可选、家长主动、本机保存、默认零记录，没有规定频率；只在自然出现的真实证据、可复现缺陷或明确的大范围扩展决定出现时开始新的有界工作。

家庭使用说明：`docs/project-status/natural-use.md`。
