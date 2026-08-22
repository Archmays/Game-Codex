import type { GameCatalogMetadata } from "./load-game-catalog-metadata";
import {
  GAME_PORTFOLIO,
  PORTFOLIO_FOUNDATION_BASELINE,
  PORTFOLIO_FOUNDATION_INITIAL_TRACKED_BYTES,
  PRODUCT_ROLE_LABELS,
  WORLD_LABELS,
} from "../../packages/data/gamePortfolio";
import {
  ACTIVE_PROJECT_PHASE,
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
  const classicCount = GAME_PORTFOLIO.filter((record) => record.currentStandaloneVisible).length;
  const rows = GAME_PORTFOLIO.map((record) => {
    const game = catalogById.get(record.id);
    if (!game) throw new Error(`Missing GameDefinition for ${record.id}`);
    return `| ${cell(game.title)} | ${cell(game.subject)} | ${cell(game.recommendedAge)} | ${WORLD_LABELS[record.targetWorld]} | ${PRODUCT_ROLE_LABELS[record.productRole]} | ${record.qualityTier} | ${cell(game.status)} |`;
  });
  return [
    README_PORTFOLIO_START,
    `Portfolio 与 \`allGameDefinitions\` 保留 ${GAME_PORTFOLIO.length} 个可挂载定义；经典大厅当前展示 ${classicCount} 个独立入口。默认入口 \`/\` 是儿童侧“我的游戏世界”，其中可进入墨迹森林、数学世界和游戏百宝箱。`,
    "",
    "| 游戏 | 学科 | 适合年龄 | 目标世界 | 产品角色 | 质量等级 | 当前状态 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    `三个正式世界（${PRIMARY_WORLDS.join(" / ")}）均已完成当前发布阶段；数学世界有 5 个自由开放站点，中文与英语世界的支持活动由各自世界进入。时钟塔、阵列工坊与旧拼音定义继续保留，但不再重复占用经典大厅卡片。`,
    "",
    `项目阶段：Foundation、Math World、Chinese Consolidation、English V2 与 Play Readiness 均为 COMPLETE；Natural-use Observation 为 ACTIVE；家庭稳定基线已冻结在 \`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineTag}\`；下一自动阶段为 \`${NEXT_PROJECT_PHASE ?? "NONE"}\`。`,
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
  const classicCount = GAME_PORTFOLIO.filter((record) => record.currentStandaloneVisible).length;
  const rows = GAME_PORTFOLIO.map((record) => {
    const game = catalogById.get(record.id);
    if (!game) throw new Error(`Missing GameDefinition for ${record.id}`);
    return `| ${cell(game.title)} | \`${record.id}\` | ${WORLD_LABELS[record.targetWorld]} | ${PRODUCT_ROLE_LABELS[record.productRole]} | ${record.qualityTier} | \`${record.lifecycleStatus}\` | ${record.currentStandaloneVisible ? "是" : "否"} | ${record.targetStandaloneVisible ? "是" : "否"} | ${cell(record.canonicalRoute ?? "经典大厅内嵌")} | ${record.saveNamespaces.map((namespace) => `\`${namespace}\``).join("<br>")} | \`${record.testProfile}\` |`;
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
    `- Portfolio / all definitions：\`${GAME_PORTFOLIO.length}/${GAME_PORTFOLIO.length}\` 保留`,
    `- 经典大厅：\`${classicCount}\` 当前独立入口`,
    "- 数学世界：`5/5` 自由开放站点",
    "- 历史治理：本阶段不重写 Git 历史、不强推、不移动或覆盖 tag",
    `- 家庭稳定基线：\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaseline}\`（\`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineTag}\` / \`${PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineCommit}\`）`,
    "- 真人儿童验证：`NO_BY_USER_DIRECTION_AND_NOT_A_DEVELOPMENT_GATE`",
    "",
    "## 当前组合",
    "",
    "| 游戏 | 稳定 ID | 目标世界 | 产品角色 | 等级 | 生命周期 | 当前独立可见 | 目标独立可见 | 当前 route | save namespace | test profile |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## 项目阶段真源",
    "",
    "| 阶段 | 状态 | 发布 tag / route | 摘要 |",
    "| --- | --- | --- | --- |",
    ...PROJECT_PHASES.map((phase) => `| ${cell(phase.title)} | \`${phase.status.toUpperCase()}\` | ${cell([phase.releaseTag, phase.canonicalRoute].filter(Boolean).map((value) => `\`${value}\``).join("<br>") || "—")} | ${cell(phase.summary)} |`),
    "",
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
    "- **B**：目标工坊；覆盖可解性、确定性题库、提示/恢复、输入、route 和 save。",
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
