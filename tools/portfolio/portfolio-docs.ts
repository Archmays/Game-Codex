import type { GameCatalogMetadata } from "./load-game-catalog-metadata";
import {
  ACTIVE_CHILD_PRODUCTS,
  CLASSIC_CARD_PRODUCTS,
  COMPATIBILITY_SURFACES,
  DEFINITION_ROLE_LABELS,
  GAME_PORTFOLIO,
  PORTFOLIO_FOUNDATION_BASELINE,
  PORTFOLIO_FOUNDATION_INITIAL_TRACKED_BYTES,
  PRODUCT_ROLE_LABELS,
  SHARED_ENGINES,
  WORLD_MODULES,
  WORLD_LABELS,
} from "../../packages/data/gamePortfolio";
import {
  ACTIVE_PROJECT_PHASE,
  AUTHORIZED_DEVELOPMENT_CYCLES,
  NEXT_PROJECT_PHASE,
  PRIMARY_WORLDS,
  PROJECT_LIFECYCLE_TERMINAL_TRUTH,
  PROJECT_PHASES,
} from "../../packages/data/projectLifecycle";

export const README_PORTFOLIO_START = "<!-- GAME_PORTFOLIO:START -->";
export const README_PORTFOLIO_END = "<!-- GAME_PORTFOLIO:END -->";

function cell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function gamesById(catalog: readonly GameCatalogMetadata[]): ReadonlyMap<string, GameCatalogMetadata> {
  return new Map(catalog.map((game) => [game.id, game]));
}

export function renderReadmePortfolio(catalog: readonly GameCatalogMetadata[]): string {
  const catalogById = gamesById(catalog);
  const classicCount = CLASSIC_CARD_PRODUCTS.length;
  const rows = GAME_PORTFOLIO.map((record) => {
    const game = catalogById.get(record.id);
    if (!game) throw new Error(`Missing GameDefinition for ${record.id}`);
    return `| ${cell(game.title)} | ${cell(game.subject)} | ${WORLD_LABELS[record.targetWorld]} | ${DEFINITION_ROLE_LABELS[record.definitionRole]} | ${record.activeChildProduct ? "是" : "否"} | ${record.qualityTier} | ${cell(game.status)} |`;
  });
  return [
    README_PORTFOLIO_START,
    `\`allGameDefinitions\` 保留 ${GAME_PORTFOLIO.length} 个可挂载定义，但儿童产品组合已明确收敛为 ${ACTIVE_CHILD_PRODUCTS.length} 个活跃产品；经典大厅只投影这 ${classicCount} 个产品。世界模块、兼容入口和共享引擎分别维护，不再拿定义数冒充产品数。`,
    "",
    "| 游戏 | 学科 | 目标世界 | 定义角色 | 活跃儿童产品 | 质量等级 | 当前状态 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    `三个正式世界（${PRIMARY_WORLDS.join(" / ")}）包含 ${WORLD_MODULES.length} 个显式世界模块；${COMPATIBILITY_SURFACES.length} 个兼容表面与 ${SHARED_ENGINES.length} 个共享引擎独立登记。目标工坊与记忆配对的重复 Classic 卡已退役，模块、引擎、存档和既有规范 route 均保留。`,
    "",
    `项目阶段：Foundation、Math World、Chinese Consolidation、English V2 与 Play Readiness 均为 COMPLETE；Natural-use Observation 为 ACTIVE；家庭稳定基线已冻结在 \`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineTag}\`；下一自动阶段为 \`${NEXT_PROJECT_PHASE ?? "NONE"}\`。`,
    `本次 \`${AUTHORIZED_DEVELOPMENT_CYCLES[0].id}\` 是用户明确授权、由发布 tag 目标闭合的独立 bounded development cycle；源码不提前冒充外部发布完成。它不关闭 Natural-use Observation，也不创建自动后续任务。`,
    "家庭使用入口、可选 Observation Kit 与重新开发边界见 `docs/project-status/natural-use.md`。",
    README_PORTFOLIO_END,
  ].join("\n");
}

export function replaceMarkedSection(source: string, rendered: string): string {
  const start = source.indexOf(README_PORTFOLIO_START);
  const end = source.indexOf(README_PORTFOLIO_END);
  if (start < 0 || end < start) throw new Error("README is missing a valid GAME_PORTFOLIO marker pair");
  return `${source.slice(0, start)}${rendered}${source.slice(end + README_PORTFOLIO_END.length)}`;
}

export function renderPortfolioStatus(catalog: readonly GameCatalogMetadata[]): string {
  const catalogById = gamesById(catalog);
  const classicCount = CLASSIC_CARD_PRODUCTS.length;
  const rows = GAME_PORTFOLIO.map((record) => {
    const game = catalogById.get(record.id);
    if (!game) throw new Error(`Missing GameDefinition for ${record.id}`);
    return `| ${cell(game.title)} | \`${record.id}\` | ${WORLD_LABELS[record.targetWorld]} | ${DEFINITION_ROLE_LABELS[record.definitionRole]} | ${PRODUCT_ROLE_LABELS[record.productRole]} | ${record.qualityTier} | \`${record.lifecycleStatus}\` | ${record.activeChildProduct ? "是" : "否"} | ${record.classicCardVisible ? "是" : "否"} | ${cell(record.canonicalRoute ?? "无儿童侧独立 route")} | ${record.saveNamespaces.map((namespace) => `\`${namespace}\``).join("<br>")} |`;
  });
  return [
    "# Game-Codex Portfolio 状态",
    "",
    "> 本页由 `packages/data/gamePortfolio.ts` 确定性生成，是跨游戏生命周期、世界归属、质量等级、可见性和测试配置的唯一当前状态页。游戏自己的儿童文案仍由各 `GameDefinition` 管理。",
    "",
    "## Foundation 基线",
    "",
    `- 实际起点：\`${PORTFOLIO_FOUNDATION_BASELINE}\``,
    `- 起点 tracked 文件：\`${PORTFOLIO_FOUNDATION_INITIAL_TRACKED_BYTES}\` bytes`,
    `- Mount definitions：\`${GAME_PORTFOLIO.length}\` 保留`,
    `- Active child products：\`${ACTIVE_CHILD_PRODUCTS.length}\``,
    `- World modules：\`${WORLD_MODULES.length}\``,
    `- Compatibility surfaces：\`${COMPATIBILITY_SURFACES.length}\``,
    `- Shared engines：\`${SHARED_ENGINES.length}\``,
    `- 经典大厅：\`${classicCount}\` 活跃产品入口`,
    "- 数学世界：`5/5` 自由开放站点",
    "- 历史治理：本阶段不重写 Git 历史、不强推、不移动或覆盖 tag",
    `- 家庭稳定基线：\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaseline}\`（\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineTag}\` / \`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineCommit}\`）`,
    "- 真人儿童验证：`NO_BY_USER_DIRECTION_AND_NOT_A_DEVELOPMENT_GATE`",
    "",
    "## 当前组合",
    "",
    "| 游戏 | 稳定 ID | 目标世界 | 定义角色 | 产品角色 | 等级 | 生命周期 | 活跃儿童产品 | Classic 卡片 | 规范 route | save namespace |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## 分层组合真源",
    "",
    `- 活跃儿童产品：${ACTIVE_CHILD_PRODUCTS.map((record) => `\`${record.id}\``).join(" / ")}`,
    `- Classic 投影：${CLASSIC_CARD_PRODUCTS.map((record) => `\`${record.id}\``).join(" / ")}`,
    "",
    "| 世界模块 | 所属世界 | 所有者定义 | 规范 route | 引擎 |",
    "| --- | --- | --- | --- | --- |",
    ...WORLD_MODULES.map((module) => `| ${cell(module.title)} | ${WORLD_LABELS[module.world]} | \`${module.ownerDefinitionId}\` | ${cell(module.route)} | ${module.engineId ? `\`${module.engineId}\`` : "game-owned"} |`),
    "",
    "| 兼容表面 | 用途 | route |",
    "| --- | --- | --- |",
    ...COMPATIBILITY_SURFACES.map((surface) => `| ${cell(surface.title)} | \`${surface.purpose}\` | ${cell(surface.route ?? "无儿童侧 route；仅保留定义适配")} |`),
    "",
    "| 共享引擎 | 路径 | 消费者 |",
    "| --- | --- | --- |",
    ...SHARED_ENGINES.map((engine) => `| \`${engine.id}\` | \`${engine.path}\` | ${engine.consumers.map((consumer) => `\`${consumer}\``).join("<br>")} |`),
    "",
    "## 项目阶段真源",
    "",
    "| 阶段 | 状态 | 发布 tag / route | 摘要 |",
    "| --- | --- | --- | --- |",
    ...PROJECT_PHASES.map((phase) => `| ${cell(phase.title)} | \`${phase.status.toUpperCase()}\` | ${cell([phase.releaseTag, phase.canonicalRoute].filter(Boolean).map((value) => `\`${value}\``).join("<br>") || "—")} | ${cell(phase.summary)} |`),
    "",
    "## 明确授权的有界开发周期",
    "",
    "| 周期 | 触发 | 状态 | 起点 / 发布 tag | Natural-use 影响 | 真人儿童验证 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...AUTHORIZED_DEVELOPMENT_CYCLES.map((cycle) => `| ${cell(cycle.title)} | \`${cycle.trigger}\` | \`${cycle.status.toUpperCase()}\` | \`${cycle.startCommit}\`<br>\`${cycle.releaseTag}\` | \`${cycle.naturalUseObservationImpact}\` | \`${cycle.realChildValidation}\` |`),
    "",
    `- 有界周期完成条件：\`${AUTHORIZED_DEVELOPMENT_CYCLES[0].completionCondition}\`；最终完成由发布 tag、CI 与 Pages 同 SHA 回读证明，不由源码预先宣告。`,
    `- 当前收敛阶段：\`${ACTIVE_PROJECT_PHASE}\`` ,
    `- 下一自动阶段：\`${NEXT_PROJECT_PHASE ?? "NONE"}\`` ,
    `- 三个正式世界：\`${PRIMARY_WORLDS.join(" / ")}\`` ,
    `- 真实儿童验证：\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.realChildValidation}\`` ,
    `- Observation Kit：\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.observationTooling}\`` ,
    `- Natural-use evidence：\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.naturalUseObservation}\`` ,
    `- 自动大型任务：\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.automaticLargeTask}\`` ,
    "",
    "## 质量等级",
    "",
    "- **S**：汉字魔法战、算式滑轨；核心机制或发布变化才运行各自完整 release gate。",
    "- **A**：数学世界、英文魔法战；核心变化覆盖状态/内容、目标浏览器、响应式、存档、输入、console/network 和返回流程。",
    "- **B**：目标工坊世界模块；覆盖可解性、确定性题库、提示/恢复、输入、route 和 versioned save。",
    "- **C**：时钟、乘法、记忆、拼音；覆盖内容、mount、一次主交互、exit、双视口、焦点、console/asset/network。",
    "",
    "## 下一步边界",
    "",
    `\`NEXT: ${PROJECT_LIFECYCLE_TERMINAL_TRUTH.next}\``,
    "",
    "普通家庭使用已开始。Observation Kit 可选、家长主动、本机保存、默认零记录，没有规定频率；只在自然出现的真实证据、可复现缺陷或明确的大范围扩展决定出现时开始新的有界工作。",
    "",
    "家庭使用说明：`docs/project-status/natural-use.md`。",
    "",
  ].join("\n");
}

export function renderPortfolioRoadmap(): string {
  return [
    "# Game-Codex Portfolio 长期路线",
    "",
    "> 路线只描述产品阶段，不创建空的儿童世界占位页；每个替代入口必须成熟并验证后，才退役对应经典大厅独立入口。",
    "",
    ...PROJECT_PHASES.flatMap((phase, index) => [
      `## ${index + 1}. ${phase.title} — ${phase.status.toUpperCase()}`,
      "",
      phase.summary,
      ...(phase.releaseTag ? ["", `- 发布 tag：\`${phase.releaseTag}\``] : []),
      ...(phase.canonicalRoute ? [`- 当前 route：\`${phase.canonicalRoute}\``] : []),
      "",
    ]),
    "## 明确授权的有界开发周期",
    "",
    ...AUTHORIZED_DEVELOPMENT_CYCLES.flatMap((cycle) => [
      `- \`${cycle.id}\`：\`${cycle.status.toUpperCase()}\`；触发为 \`${cycle.trigger}\`；发布 tag 为 \`${cycle.releaseTag}\`。`,
      `- 完成条件：\`${cycle.completionCondition}\`；只有 tag、CI 与 Pages 同 SHA 回读后才对外成立。`,
      `- Natural-use 影响：\`${cycle.naturalUseObservationImpact}\`；真人儿童验证：\`${cycle.realChildValidation}\`。`,
      "",
    ]),
    "## 终态边界",
    "",
    `- \`NEXT: ${PROJECT_LIFECYCLE_TERMINAL_TRUTH.next}\`` ,
    `- 下一自动阶段：\`${NEXT_PROJECT_PHASE ?? "NONE"}\`` ,
    `- 家庭稳定基线：\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineTag}\`（\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineCommit}\`）`,
    `- 真实儿童验证：\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.realChildValidation}\`` ,
    `- Observation Kit：\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.observationTooling}\`` ,
    `- Natural-use evidence：\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.naturalUseObservation}\`` ,
    "- Natural-use Observation 处于 ACTIVE，但工具仍为可选、家长主动、本机保存、默认零记录且没有规定频率；机器审核不冒充儿童兴趣、学习效果或保持度。",
    "",
  ].join("\n");
}
