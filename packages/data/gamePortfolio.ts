export type WorldId = "chinese" | "math" | "english" | "shared";
export type ProductRole = "flagship" | "core-world" | "independent-puzzle" | "module";
export type DefinitionRole = "active-child-product" | "world-module-mount" | "compatibility-adapter";
export type QualityTier = "S" | "A" | "B" | "C";
export type LifecycleStatus = "active" | "active-module" | "active-maintenance" | "compatibility-only";
export type LoadingPolicy = "current-eager" | "route-lazy" | "mixed";
export type TestProfileId = "s-hanzi-release" | "s-equation-release" | "a-core-world" | "b-independent-puzzle" | "c-module";

export interface PortfolioTestProfile {
  readonly id: TestProfileId;
  readonly qualityTier: QualityTier;
  readonly requiredGates: readonly string[];
}

/**
 * One record per mountable GameDefinition. This is deliberately not the child
 * product count: module mounts and compatibility adapters remain registered so
 * old saves and routes can stay readable after child-facing convergence.
 */
export interface GamePortfolioRecord {
  readonly id: string;
  readonly targetWorld: WorldId;
  readonly productRole: ProductRole;
  readonly definitionRole: DefinitionRole;
  readonly activeChildProduct: boolean;
  readonly classicCardVisible: boolean;
  readonly childProductOrder?: number;
  readonly qualityTier: QualityTier;
  readonly lifecycleStatus: LifecycleStatus;
  readonly mergeTarget?: string;
  readonly canonicalRoute?: string;
  readonly worldModuleIds: readonly string[];
  readonly compatibilitySurfaceIds: readonly string[];
  readonly sharedEngineIds: readonly string[];
  readonly saveNamespaces: readonly string[];
  readonly testProfile: TestProfileId;
  readonly loadingPolicy: LoadingPolicy;
  readonly contentStatus: "frozen";
  readonly canonicalDocs: readonly string[];
}

export interface WorldModuleRecord {
  readonly id: string;
  readonly world: Exclude<WorldId, "shared">;
  readonly title: string;
  readonly ownerDefinitionId: string;
  readonly route: string;
  readonly engineId?: string;
  readonly status: "active-module";
}

export interface CompatibilitySurfaceRecord {
  readonly id: string;
  readonly title: string;
  readonly route?: string;
  readonly purpose: "alternate-launcher" | "legacy-route" | "definition-adapter";
}

export interface SharedEngineRecord {
  readonly id: string;
  readonly path: string;
  readonly consumers: readonly string[];
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
    id: "hanzi-radical-battle", targetWorld: "chinese", productRole: "flagship", definitionRole: "active-child-product", activeChildProduct: true, classicCardVisible: true, childProductOrder: 1, qualityTier: "S", lifecycleStatus: "active-maintenance",
    canonicalRoute: "?play=hanzi-magic-complete&from=hub", worldModuleIds: ["chinese-story", "chinese-pinyin", "chinese-memory"], compatibilitySurfaceIds: ["hanzi-v2-compat", "hanzi-v1-compat"], sharedEngineIds: ["memory-match", "game-core-local-storage"],
    saveNamespaces: ["family-games/hanzi-magic-complete/v3", "family-games/hanzi-magic-v2/chapter-one", "family-games/hanzi-magic-v2/wheel-workshop/v1", "family-games/hanzi-radical-battle-v2/golden-slice/state"],
    testProfile: "s-hanzi-release", loadingPolicy: "route-lazy", contentStatus: "frozen",
    canonicalDocs: ["docs/hanzi-radical-battle-v3/README.md", "docs/hanzi-radical-battle-v2/README.md"],
  },
  {
    id: "equation-slider", targetWorld: "math", productRole: "flagship", definitionRole: "active-child-product", activeChildProduct: true, classicCardVisible: true, childProductOrder: 4, qualityTier: "S", lifecycleStatus: "active",
    canonicalRoute: "?world=math-world&station=slider", worldModuleIds: ["math-equation-slider"], compatibilitySurfaceIds: [], sharedEngineIds: ["game-core-local-storage"], saveNamespaces: ["family-games/equation-slider"],
    testProfile: "s-equation-release", loadingPolicy: "current-eager", contentStatus: "frozen",
    canonicalDocs: ["docs/equation-slider/rebuild-v3/11-final-acceptance-report.md", "docs/equation-slider/rebuild-v3/12-final-reflection.md", "docs/portfolio-evolution/portfolio-audit.md"],
  },
  {
    id: "math-lab", targetWorld: "math", productRole: "core-world", definitionRole: "active-child-product", activeChildProduct: true, classicCardVisible: true, childProductOrder: 2, qualityTier: "A", lifecycleStatus: "active",
    mergeTarget: "math-world", canonicalRoute: "?world=math-world&from=hub", worldModuleIds: ["math-lab-core"], compatibilitySurfaceIds: [], sharedEngineIds: ["game-core-local-storage"], saveNamespaces: ["family-games/math-world/v1", "math-battle-web/save-v1"],
    testProfile: "a-core-world", loadingPolicy: "route-lazy", contentStatus: "frozen", canonicalDocs: ["games/math-lab/README.md", "docs/math-lab-deep-research-brief.md"],
  },
  {
    id: "english-spell-battle", targetWorld: "english", productRole: "core-world", definitionRole: "active-child-product", activeChildProduct: true, classicCardVisible: true, childProductOrder: 3, qualityTier: "A", lifecycleStatus: "active",
    mergeTarget: "english-world", canonicalRoute: "?world=english-world&from=hub", worldModuleIds: ["english-core", "english-journal", "english-memory"], compatibilitySurfaceIds: ["english-legacy-route"], sharedEngineIds: ["memory-match", "game-core-local-storage"], saveNamespaces: ["family-games/english-spell-battle", "family-games/english-world/v2"],
    testProfile: "a-core-world", loadingPolicy: "route-lazy", contentStatus: "frozen", canonicalDocs: ["games/english-spell-battle/README.md"],
  },
  {
    id: "make-target", targetWorld: "math", productRole: "independent-puzzle", definitionRole: "world-module-mount", activeChildProduct: false, classicCardVisible: false, qualityTier: "B", lifecycleStatus: "active-module",
    mergeTarget: "math-world/target-workshop", canonicalRoute: "?world=math-world&station=target", worldModuleIds: ["math-make-target"], compatibilitySurfaceIds: [], sharedEngineIds: ["game-core-local-storage"], saveNamespaces: ["family-games/make-target"],
    testProfile: "b-independent-puzzle", loadingPolicy: "current-eager", contentStatus: "frozen", canonicalDocs: ["games/make-target/README.md"],
  },
  {
    id: "clock-reader", targetWorld: "math", productRole: "module", definitionRole: "world-module-mount", activeChildProduct: false, classicCardVisible: false, qualityTier: "C", lifecycleStatus: "active-module",
    mergeTarget: "math-world/clock-tower", canonicalRoute: "?world=math-world&station=clock", worldModuleIds: ["math-clock"], compatibilitySurfaceIds: [], sharedEngineIds: ["game-core-local-storage"], saveNamespaces: ["family-games/clock-reader"],
    testProfile: "c-module", loadingPolicy: "route-lazy", contentStatus: "frozen", canonicalDocs: ["games/clock-reader/README.md"],
  },
  {
    id: "multiplication-adventure", targetWorld: "math", productRole: "module", definitionRole: "world-module-mount", activeChildProduct: false, classicCardVisible: false, qualityTier: "C", lifecycleStatus: "active-module",
    mergeTarget: "math-world/array-workshop", canonicalRoute: "?world=math-world&station=array", worldModuleIds: ["math-array"], compatibilitySurfaceIds: [], sharedEngineIds: ["game-core-local-storage"], saveNamespaces: ["family-games/multiplication-adventure"],
    testProfile: "c-module", loadingPolicy: "route-lazy", contentStatus: "frozen", canonicalDocs: ["games/multiplication-adventure/README.md"],
  },
  {
    id: "memory-card", targetWorld: "shared", productRole: "module", definitionRole: "compatibility-adapter", activeChildProduct: false, classicCardVisible: false, qualityTier: "C", lifecycleStatus: "compatibility-only",
    mergeTarget: "shared/memory-match", worldModuleIds: [], compatibilitySurfaceIds: ["memory-definition-adapter"], sharedEngineIds: ["memory-match", "game-core-local-storage"], saveNamespaces: ["family-games/memory-card", "family-games/memory-match/v1"],
    testProfile: "c-module", loadingPolicy: "current-eager", contentStatus: "frozen", canonicalDocs: ["games/memory-card/README.md"],
  },
  {
    id: "pinyin-magic-battle", targetWorld: "chinese", productRole: "module", definitionRole: "compatibility-adapter", activeChildProduct: false, classicCardVisible: false, qualityTier: "C", lifecycleStatus: "compatibility-only",
    mergeTarget: "chinese-world/sound-rhyme-trial", canonicalRoute: "?play=hanzi-magic-complete&view=pinyin", worldModuleIds: [], compatibilitySurfaceIds: ["pinyin-legacy-route"], sharedEngineIds: ["game-core-local-storage"], saveNamespaces: ["family-games/pinyin-magic-battle", "family-games/chinese-support/pinyin/v1"],
    testProfile: "c-module", loadingPolicy: "current-eager", contentStatus: "frozen", canonicalDocs: ["games/pinyin-magic-battle/README.md"],
  },
] as const;

export const WORLD_MODULES: readonly WorldModuleRecord[] = [
  { id: "chinese-story", world: "chinese", title: "墨迹森林主故事", ownerDefinitionId: "hanzi-radical-battle", route: "?play=hanzi-magic-complete", status: "active-module" },
  { id: "chinese-pinyin", world: "chinese", title: "声韵试炼", ownerDefinitionId: "hanzi-radical-battle", route: "?play=hanzi-magic-complete&view=pinyin", status: "active-module" },
  { id: "chinese-memory", world: "chinese", title: "字光配对", ownerDefinitionId: "hanzi-radical-battle", route: "?play=hanzi-magic-complete&view=memory", engineId: "memory-match", status: "active-module" },
  { id: "math-lab-core", world: "math", title: "数感实验室", ownerDefinitionId: "math-lab", route: "?world=math-world&station=lab", status: "active-module" },
  { id: "math-clock", world: "math", title: "时钟塔", ownerDefinitionId: "clock-reader", route: "?world=math-world&station=clock", status: "active-module" },
  { id: "math-array", world: "math", title: "阵列工坊", ownerDefinitionId: "multiplication-adventure", route: "?world=math-world&station=array", status: "active-module" },
  { id: "math-make-target", world: "math", title: "目标工坊", ownerDefinitionId: "make-target", route: "?world=math-world&station=target", status: "active-module" },
  { id: "math-equation-slider", world: "math", title: "算式滑轨站", ownerDefinitionId: "equation-slider", route: "?world=math-world&station=slider", status: "active-module" },
  { id: "english-core", world: "english", title: "词光岛五区域", ownerDefinitionId: "english-spell-battle", route: "?world=english-world", status: "active-module" },
  { id: "english-journal", world: "english", title: "词光册", ownerDefinitionId: "english-spell-battle", route: "?world=english-world&view=journal", status: "active-module" },
  { id: "english-memory", world: "english", title: "English Memory", ownerDefinitionId: "english-spell-battle", route: "?world=english-world&view=memory", engineId: "memory-match", status: "active-module" },
] as const;

export const COMPATIBILITY_SURFACES: readonly CompatibilitySurfaceRecord[] = [
  { id: "classic-hub", title: "游戏百宝箱", route: "?hub=classic", purpose: "alternate-launcher" },
  { id: "hanzi-v2-compat", title: "墨迹森林 V2", route: "?play=hanzi-v2-chapter-one", purpose: "legacy-route" },
  { id: "hanzi-v1-compat", title: "墨迹森林 V1", route: "?play=hanzi-v2-v1", purpose: "legacy-route" },
  { id: "english-legacy-route", title: "英文魔法战旧版拼写练习", route: "?play=english-spell-battle-legacy", purpose: "legacy-route" },
  { id: "memory-definition-adapter", title: "记忆配对旧定义", purpose: "definition-adapter" },
  { id: "pinyin-legacy-route", title: "声韵试炼旧入口", route: "?play=pinyin-magic-battle", purpose: "legacy-route" },
] as const;

export const SHARED_ENGINES: readonly SharedEngineRecord[] = [
  { id: "memory-match", path: "packages/activity-engines/memory-match", consumers: ["chinese-memory", "english-memory", "memory-card"] },
  { id: "game-core-local-storage", path: "packages/game-core", consumers: GAME_PORTFOLIO.map((record) => record.id) },
] as const;

export const GAME_PORTFOLIO_BY_ID: ReadonlyMap<string, GamePortfolioRecord> = new Map(GAME_PORTFOLIO.map((record) => [record.id, record]));
export const ACTIVE_CHILD_PRODUCTS = GAME_PORTFOLIO
  .filter((record) => record.activeChildProduct)
  .sort((left, right) => (left.childProductOrder ?? Number.MAX_SAFE_INTEGER) - (right.childProductOrder ?? Number.MAX_SAFE_INTEGER));
export const CLASSIC_CARD_PRODUCTS = GAME_PORTFOLIO
  .filter((record) => record.classicCardVisible)
  .sort((left, right) => (left.childProductOrder ?? Number.MAX_SAFE_INTEGER) - (right.childProductOrder ?? Number.MAX_SAFE_INTEGER));

export const WORLD_LABELS: Readonly<Record<WorldId, string>> = { chinese: "中文世界", math: "数学世界", english: "英语世界", shared: "共享模块" };
export const PRODUCT_ROLE_LABELS: Readonly<Record<ProductRole, string>> = { flagship: "旗舰", "core-world": "核心世界", "independent-puzzle": "独立谜题", module: "模块" };
export const DEFINITION_ROLE_LABELS: Readonly<Record<DefinitionRole, string>> = { "active-child-product": "活跃儿童产品", "world-module-mount": "世界模块挂载", "compatibility-adapter": "兼容适配定义" };
