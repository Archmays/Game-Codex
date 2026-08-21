import type { GameCatalogMetadata } from "./load-game-catalog-metadata";
import {
  GAME_PORTFOLIO,
  PORTFOLIO_FOUNDATION_BASELINE,
  PORTFOLIO_FOUNDATION_INITIAL_TRACKED_BYTES,
  PRODUCT_ROLE_LABELS,
  WORLD_LABELS,
} from "../../packages/data/gamePortfolio";

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
  const rows = GAME_PORTFOLIO.map((record) => {
    const game = catalogById.get(record.id);
    if (!game) throw new Error(`Missing GameDefinition for ${record.id}`);
    return `| ${cell(game.title)} | ${cell(game.subject)} | ${cell(game.recommendedAge)} | ${WORLD_LABELS[record.targetWorld]} | ${PRODUCT_ROLE_LABELS[record.productRole]} | ${record.qualityTier} | ${cell(game.status)} |`;
  });
  return [
    README_PORTFOLIO_START,
    "经典大厅当前收录 9 个游戏。默认入口 `/` 是儿童侧“我的游戏世界”；世界中的“游戏百宝箱”或 `?hub=classic` 继续展示全部 9 个当前独立入口。",
    "",
    "| 游戏 | 学科 | 适合年龄 | 目标世界 | 产品角色 | 质量等级 | 当前状态 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "长期方向是中文、数学、英语三个真实世界入口；本阶段没有创建尚无内容的空占位页。`targetStandaloneVisible = false` 只表示替代入口成熟后的方向，当前经典大厅可见性不变。",
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
    "- 经典大厅：`9/9` 当前可见",
    "- 历史治理：本阶段不重写 Git 历史、不强推、不移动或覆盖 tag",
    "- 真人儿童验证：`NO_BY_USER_DIRECTION_AND_NOT_A_DEVELOPMENT_GATE`",
    "",
    "## 当前组合",
    "",
    "| 游戏 | 稳定 ID | 目标世界 | 产品角色 | 等级 | 生命周期 | 当前独立可见 | 目标独立可见 | 当前 route | save namespace | test profile |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## 质量等级",
    "",
    "- **S**：汉字魔法战、算式滑轨；核心机制或发布变化才运行各自完整 release gate。",
    "- **A**：数学实验室、英文魔法战；核心变化覆盖状态/内容、目标浏览器、响应式、存档、输入、console/network 和返回流程。",
    "- **B**：凑10算12算24；覆盖可解性、确定性题库、提示/恢复、输入、route 和 save。",
    "- **C**：时钟、乘法、记忆、拼音；覆盖内容、mount、一次主交互、exit、双视口、焦点、console/asset/network。",
    "",
    "## 下一阶段",
    "",
    "`GAME-CODEX-MATH-WORLD-02`：先建立有真实内容的数学世界骨架，再逐个接入时钟、乘法与目标数模块；算式滑轨继续保留独立旗舰入口。",
    "",
  ].join("\n");
}

export function renderPortfolioRoadmap(): string {
  return [
    "# Game-Codex Portfolio 长期路线",
    "",
    "> 路线只描述产品阶段，不创建空的儿童世界占位页；每个替代入口必须成熟并验证后，才退役对应经典大厅独立入口。",
    "",
    "## 1. Foundation",
    "",
    "组合真源、S/A/B/C 质量分级、确定性状态文档、安全维护事务、首次当前树清理、affected gates、项目级 smoke 与 CI。",
    "",
    "## 2. Math World",
    "",
    "数学实验室作为场景骨架；时钟成为时钟塔，乘法成为阵列工坊，目标数成为工坊；算式滑轨保持独立旗舰。替代入口成熟后再考虑退役九九乘法表独立卡片。",
    "",
    "## 3. Chinese Consolidation",
    "",
    "汉字魔法战 V3 保持维护；拼音重构为声韵试炼，记忆翻牌抽成跨学科复习引擎。替代入口成熟后再收拢独立卡片，不启动汉字 V4。",
    "",
    "## 4. English V2",
    "",
    "先完成一个纵向切片：看图/听音 → 理解词义 → 组合字母 → 放入极短句 → 英语世界发生变化；切片机器门禁通过后再扩展词库。",
    "",
    "## 5. Observation & Polish",
    "",
    "只依据本地、匿名、低干扰的真实家庭使用观察做小步修订。机器审核继续只证明技术与内容合同，不冒充儿童兴趣、学习效果或保持度。",
    "",
  ].join("\n");
}
