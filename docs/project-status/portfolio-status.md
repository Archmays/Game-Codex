# Game-Codex Portfolio 状态

> 本页由 `packages/data/gamePortfolio.ts` 确定性生成，是跨游戏生命周期、世界归属、质量等级、可见性和测试配置的唯一当前状态页。游戏自己的儿童文案仍由各 `GameDefinition` 管理。

当前授权及处置：`docs/portfolio-retirement-step1.md`。只完成第一步产品减法，不自动启动玩法重做。

## Foundation 基线

- 实际起点：`12c86dc22b7219a23baeb26efbe7eab9fb0a2da2`
- 起点 tracked 文件：`708232522` bytes
- Mount definitions：`6` 保留
- Active child products：`3`
- World modules：`2`
- Compatibility surfaces：`2`
- Shared engines：`2`
- 经典大厅：`3` 活跃产品入口
- 数学世界：`slider / target` 两个自由开放站点，slider 排前
- 历史治理：本阶段不重写 Git 历史、不强推、不移动或覆盖 tag
- 家庭稳定基线：`FROZEN`（`game-codex-family-stable-v1.0.0` / `8b890ff14880bcb576dd1ced37e14e6e3df28af1`）
- 真人儿童验证：`NO_BY_USER_DIRECTION_AND_NOT_A_DEVELOPMENT_GATE`

## 当前组合

| 游戏 | 稳定 ID | 目标世界 | 定义角色 | 产品角色 | 等级 | 生命周期 | 活跃儿童产品 | Classic 卡片 | 规范 route | save namespace |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 字间行者 | `hanzi-word-adventure` | 中文世界 | 活跃儿童产品 | 独立谜题 | S | `active` | 是 | 是 | ?play=hanzi-word-adventure | `family-games/hanzi-word-adventure/v2`<br>`family-games/hanzi-word-adventure/v1` |
| 字阵守城 | `hanzi-tower-defense` | 中文世界 | 活跃儿童产品 | 旗舰 | S | `active` | 是 | 是 | ?play=hanzi-tower-defense | `family-games/hanzi-tower-defense/v3`<br>`family-games/hanzi-tower-defense/v2`<br>`family-games/hanzi-tower-defense/v1` |
| 算式滑轨 | `equation-slider` | 数学世界 | 世界模块挂载 | 旗舰模块 | S | `active-module` | 否 | 否 | ?world=math-world&station=slider | `family-games/equation-slider` |
| 数学世界 | `math-lab` | 数学世界 | 活跃儿童产品 | 核心世界 | A | `active` | 是 | 是 | ?world=math-world&from=hub | `family-games/math-world/v1` |
| 目标工坊 | `make-target` | 数学世界 | 世界模块挂载 | 独立谜题 | B | `active-module` | 否 | 否 | ?world=math-world&station=target | `family-games/make-target` |
| 记忆配对 | `memory-card` | 共享模块 | 兼容适配定义 | 模块 | C | `compatibility-only` | 否 | 否 | 无儿童侧独立 route | `family-games/memory-card`<br>`family-games/memory-match/v1` |

## 分层组合真源

- 活跃儿童产品：`hanzi-tower-defense` / `math-lab` / `hanzi-word-adventure`
- Classic 投影：`hanzi-tower-defense` / `math-lab` / `hanzi-word-adventure`

| 世界模块 | Host 世界 / 产品 | Mount 定义 | Runtime owner | 质量档 | Runtime save | 规范 route | 引擎 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 算式滑轨站 | 数学世界<br>`math-lab` | `equation-slider` | `equation-slider` | `s-equation-release` | `family-games/equation-slider` | ?world=math-world&station=slider | game-owned |
| 目标工坊 | 数学世界<br>`math-lab` | `make-target` | `make-target` | `b-independent-puzzle` | `family-games/make-target` | ?world=math-world&station=target | game-owned |

| 兼容表面 | 用途 | route |
| --- | --- | --- |
| 游戏百宝箱 | `alternate-launcher` | ?hub=classic |
| 记忆配对旧定义 | `definition-adapter` | 无儿童侧 route；仅保留定义适配 |

| 共享引擎 | 路径 | 消费者 |
| --- | --- | --- |
| `memory-match` | `packages/activity-engines/memory-match` | `memory-card` |
| `game-core-local-storage` | `packages/game-core` | `equation-slider`<br>`math-lab`<br>`make-target`<br>`memory-card` |

## 项目阶段真源

| 阶段 | 状态 | 发布 tag / route | 摘要 |
| --- | --- | --- | --- |
| Foundation | `COMPLETE` | — | Portfolio 真源、分级门禁、安全维护事务、CI 与 Pages 组合验证。 |
| Math World | `COMPLETE` | `math-world-v1.0.0`<br>`?world=math-world` | 历史 Math World 发布完成；当前仅保留算式滑轨、目标工坊，退役处置见 docs/portfolio-retirement-step1.md。 |
| Chinese Consolidation | `COMPLETE` | `chinese-consolidation-v1.0.0`<br>`?play=hanzi-magic-complete` | 历史收拢已完成；GAME-CODEX-STEP1 已退役旧语言运行产品，原存档保留。 |
| English V2 | `COMPLETE` | `english-world-v2.0.0`<br>`?world=english-world` | 历史英语产品已于 GAME-CODEX-STEP1 退役，原存档保留。 |
| Play Readiness | `COMPLETE` | `game-codex-play-ready-v1.0.0`<br>`?world=my-game-world` | 首用、反馈、返回、存档保险箱、无障碍、性能与长期家庭使用准备。 |
| Natural-use Observation | `ACTIVE` | `game-codex-observation-kit-v1.0.0`<br>`?world=my-game-world&parent=observation` | 普通家庭使用已开始；Observation Kit 保持家长主动、本机最小化、默认零记录，只在自然出现的真实证据需要时使用。 |

## 明确授权的有界开发周期

| 周期 | 触发 | 状态 | 起点 / 发布 tag | Natural-use 影响 | 真人儿童验证 |
| --- | --- | --- | --- | --- | --- |
| Portfolio Evolution | `EXPLICIT_USER_AUTHORIZATION` | `RELEASE-BOUND` | `73ae9d6be140c9e8294781b9f8e6ed296590c438`<br>`game-codex-portfolio-evolution-v1.0.0` | `ONGOING_NOT_CLOSED` | `NOT_PERFORMED_AND_NOT_CLAIMED` |
| World Coherence and Gameplay Lift | `EXPLICIT_USER_AUTHORIZATION` | `RELEASE-BOUND` | `90eb3b242b38b1d7a8cd98c8e0cafce14a6984a0`<br>`game-codex-gameplay-coherence-v1.0.1` | `ONGOING_NOT_CLOSED` | `NOT_PERFORMED_AND_NOT_CLAIMED` |

- 历史发布周期：`gameplay-coherence-02`；完成条件：`RELEASE_TAG_TARGET`；最终完成由发布 tag、CI 与 Pages 同 SHA 回读证明，不由源码预先宣告。
- 当前收敛阶段：`natural-use-observation`
- 下一自动阶段：`NONE`
- 当前两个产品领域：`chinese / math`
- 真实儿童验证：`NOT_PERFORMED_AND_NOT_CLAIMED`
- Observation Kit：`READY`
- Natural-use evidence：`ACTIVE`
- 自动大型任务：`NONE`

## 质量等级

- **S**：字阵守城、算式滑轨；核心机制或发布变化才运行各自完整 release gate。
- **A**：数学世界、英文魔法战；核心变化覆盖状态/内容、目标浏览器、响应式、存档、输入、console/network 和返回流程。
- **B**：目标工坊世界模块；覆盖可解性、确定性题库、提示/恢复、输入、route 和 versioned save。
- **C**：记忆、拼音兼容适配；覆盖内容、mount、一次主交互、exit、双视口、焦点、console/asset/network。

## 下一步边界

`NEXT: Normal family use. New development only when real evidence or a reproducible defect exists.`

普通家庭使用已开始。Observation Kit 可选、家长主动、本机保存、默认零记录，没有规定频率；只在自然出现的真实证据、可复现缺陷或明确的大范围扩展决定出现时开始新的有界工作。

家庭使用说明：`docs/project-status/natural-use.md`。
