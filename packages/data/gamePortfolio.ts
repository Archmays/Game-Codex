export type WorldId = "chinese" | "math" | "english" | "shared";
export type ProductRole = "flagship" | "core-world" | "independent-puzzle" | "module";
export type QualityTier = "S" | "A" | "B" | "C";
export type LifecycleStatus =
  | "active"
  | "active-module"
  | "active-maintenance"
  | "flagship-candidate"
  | "architecture-consolidation-candidate"
  | "module-candidate"
  | "shared-engine-candidate"
  | "migrate-then-retire-standalone"
  | "migrated-module";
export type LoadingPolicy = "current-eager" | "route-lazy" | "mixed";
export type TestProfileId = "s-hanzi-release" | "s-equation-release" | "a-core-world" | "b-independent-puzzle" | "c-module";

export interface PortfolioTestProfile {
  readonly id: TestProfileId;
  readonly qualityTier: QualityTier;
  readonly requiredGates: readonly string[];
}

export interface GamePortfolioRecord {
  readonly id: string;
  readonly targetWorld: WorldId;
  readonly productRole: ProductRole;
  readonly qualityTier: QualityTier;
  readonly lifecycleStatus: LifecycleStatus;
  readonly currentStandaloneVisible: boolean;
  readonly targetStandaloneVisible: boolean;
  readonly mergeTarget?: string;
  readonly canonicalRoute?: string;
  readonly saveNamespaces: readonly string[];
  readonly testProfile: TestProfileId;
  readonly loadingPolicy: LoadingPolicy;
  readonly canonicalDocs: readonly string[];
}

export const PORTFOLIO_FOUNDATION_BASELINE = "12c86dc22b7219a23baeb26efbe7eab9fb0a2da2";
export const PORTFOLIO_FOUNDATION_INITIAL_TRACKED_BYTES = 708_232_522;

export const PORTFOLIO_TEST_PROFILES: readonly PortfolioTestProfile[] = [
  { id: "s-hanzi-release", qualityTier: "S", requiredGates: ["pure simulation", "full E2E", "pointer/keyboard/touch", "visual/ARIA/geometry", "save recovery", "asset/performance", "Pages exact commit"] },
  { id: "s-equation-release", qualityTier: "S", requiredGates: ["solver and catalog", "full E2E", "pointer/keyboard/touch", "visual/ARIA/geometry", "save migration", "Pages exact commit"] },
  { id: "a-core-world", qualityTier: "A", requiredGates: ["state/content", "targeted E2E", "responsive", "local save", "keyboard/touch", "console/network", "returning flow"] },
  { id: "b-independent-puzzle", qualityTier: "B", requiredGates: ["solvability", "deterministic content", "hint/recovery", "keyboard/touch", "route smoke", "save"] },
  { id: "c-module", qualityTier: "C", requiredGates: ["unit/content", "route mount", "primary interaction", "exit", "mobile/desktop", "keyboard focus", "console/asset/network"] },
] as const;

export const GAME_PORTFOLIO: readonly GamePortfolioRecord[] = [
  {
    id: "hanzi-radical-battle", targetWorld: "chinese", productRole: "flagship", qualityTier: "S", lifecycleStatus: "active-maintenance",
    currentStandaloneVisible: true, targetStandaloneVisible: true, canonicalRoute: "?play=hanzi-magic-complete&from=hub",
    saveNamespaces: ["family-games/hanzi-magic-complete/v3", "family-games/hanzi-magic-v2/chapter-one", "family-games/hanzi-magic-v2/wheel-workshop/v1", "family-games/hanzi-radical-battle-v2/golden-slice/state"],
    testProfile: "s-hanzi-release", loadingPolicy: "route-lazy",
    canonicalDocs: ["docs/hanzi-radical-battle-v3/README.md", "docs/hanzi-radical-battle-v2/README.md"],
  },
  {
    id: "equation-slider", targetWorld: "math", productRole: "flagship", qualityTier: "S", lifecycleStatus: "active",
    currentStandaloneVisible: true, targetStandaloneVisible: true, saveNamespaces: ["family-games/equation-slider"],
    testProfile: "s-equation-release", loadingPolicy: "current-eager",
    canonicalDocs: ["docs/equation-slider/rebuild-v3/11-final-acceptance-report.md", "docs/equation-slider/rebuild-v3/12-final-reflection.md"],
  },
  {
    id: "math-lab", targetWorld: "math", productRole: "core-world", qualityTier: "A", lifecycleStatus: "active",
    currentStandaloneVisible: true, targetStandaloneVisible: true, mergeTarget: "math-world", canonicalRoute: "?world=math-world&from=hub", saveNamespaces: ["family-games/math-world/v1", "math-battle-web/save-v1"],
    testProfile: "a-core-world", loadingPolicy: "route-lazy", canonicalDocs: ["games/math-lab/README.md", "docs/math-lab-deep-research-brief.md"],
  },
  {
    id: "english-spell-battle", targetWorld: "english", productRole: "core-world", qualityTier: "A", lifecycleStatus: "flagship-candidate",
    currentStandaloneVisible: true, targetStandaloneVisible: true, mergeTarget: "english-world", saveNamespaces: ["family-games/english-spell-battle"],
    testProfile: "a-core-world", loadingPolicy: "current-eager", canonicalDocs: ["games/english-spell-battle/README.md"],
  },
  {
    id: "make-target", targetWorld: "math", productRole: "independent-puzzle", qualityTier: "B", lifecycleStatus: "active",
    currentStandaloneVisible: true, targetStandaloneVisible: true, saveNamespaces: ["family-games/make-target"],
    testProfile: "b-independent-puzzle", loadingPolicy: "current-eager", canonicalDocs: ["games/make-target/README.md"],
  },
  {
    id: "clock-reader", targetWorld: "math", productRole: "module", qualityTier: "C", lifecycleStatus: "active-module",
    currentStandaloneVisible: false, targetStandaloneVisible: false, mergeTarget: "math-world/clock-tower", saveNamespaces: ["family-games/clock-reader"],
    testProfile: "c-module", loadingPolicy: "route-lazy", canonicalDocs: ["games/clock-reader/README.md"],
  },
  {
    id: "multiplication-adventure", targetWorld: "math", productRole: "module", qualityTier: "C", lifecycleStatus: "migrated-module",
    currentStandaloneVisible: false, targetStandaloneVisible: false, mergeTarget: "math-world/array-workshop", saveNamespaces: ["family-games/multiplication-adventure"],
    testProfile: "c-module", loadingPolicy: "route-lazy", canonicalDocs: ["games/multiplication-adventure/README.md"],
  },
  {
    id: "memory-card", targetWorld: "shared", productRole: "module", qualityTier: "C", lifecycleStatus: "active-module",
    currentStandaloneVisible: true, targetStandaloneVisible: true, mergeTarget: "shared/memory-match", saveNamespaces: ["family-games/memory-card", "family-games/memory-match/v1"],
    testProfile: "c-module", loadingPolicy: "current-eager", canonicalDocs: ["games/memory-card/README.md"],
  },
  {
    id: "pinyin-magic-battle", targetWorld: "chinese", productRole: "module", qualityTier: "C", lifecycleStatus: "migrated-module",
    currentStandaloneVisible: false, targetStandaloneVisible: false, mergeTarget: "chinese-world/sound-rhyme-trial", canonicalRoute: "?play=hanzi-magic-complete&view=pinyin", saveNamespaces: ["family-games/pinyin-magic-battle", "family-games/chinese-support/pinyin/v1"],
    testProfile: "c-module", loadingPolicy: "current-eager", canonicalDocs: ["games/pinyin-magic-battle/README.md"],
  },
] as const;

export const GAME_PORTFOLIO_BY_ID: ReadonlyMap<string, GamePortfolioRecord> = new Map(GAME_PORTFOLIO.map((record) => [record.id, record]));

export const WORLD_LABELS: Readonly<Record<WorldId, string>> = { chinese: "中文世界", math: "数学世界", english: "英语世界", shared: "共享模块" };
export const PRODUCT_ROLE_LABELS: Readonly<Record<ProductRole, string>> = { flagship: "旗舰", "core-world": "核心世界", "independent-puzzle": "独立谜题", module: "模块" };
