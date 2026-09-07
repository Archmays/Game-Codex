import { GAME_PORTFOLIO, type TestProfileId } from "./gamePortfolio";

export type PlaySurfaceKind =
  | "portfolio-world"
  | "classic-hub"
  | "classic-entry"
  | "product-world"
  | "chapter"
  | "support-activity"
  | "postgame"
  | "station"
  | "region"
  | "journal";

export type PlayInput = "pointer" | "touch" | "keyboard";
export type PlaySurfaceQualityProfile = TestProfileId | "portfolio-play-ready";
export type ScrollPolicy = "document" | "internal" | "locked";

export interface PlaySurfaceRecord {
  readonly id: string;
  readonly title: string;
  readonly route: string;
  readonly productId: string;
  readonly kind: PlaySurfaceKind;
  readonly parentSurfaceId?: string;
  readonly returnRoute: string;
  readonly primaryActionSelector: string;
  readonly settingsAvailable: boolean;
  readonly destructiveActionAvailable: boolean;
  readonly saveNamespaces: readonly string[];
  readonly hostSaveNamespaces: readonly string[];
  readonly runtimeSaveNamespaces: readonly string[];
  readonly mountDefinitionId?: string;
  readonly topLevelProductId?: string;
  readonly worldModuleId?: string;
  readonly runtimeOwnerDefinitionId?: string;
  readonly hostWorldId?: "chinese" | "math" | "english";
  readonly compatibilitySurfaceId?: string;
  readonly expectedInputs: readonly PlayInput[];
  readonly qualityProfile: PlaySurfaceQualityProfile;
  readonly scrollPolicy: ScrollPolicy;
  readonly scrollContainerSelector?: string;
  readonly lockedReason?: string;
  readonly primaryEntry?: boolean;
}

export type AppRouteKind = "play" | "classic-hub" | "world";
export interface AppRouteQueryRegistration {
  readonly kind: AppRouteKind;
  readonly queryKey: "play" | "hub" | "world";
  readonly queryValue: string;
  readonly query: string;
  readonly defaultScrollPolicy: "document" | "locked";
}

export const APP_ROUTE_QUERY_MANIFEST = [
  { kind: "play", queryKey: "play", queryValue: "hanzi-word-adventure", query: "?play=hanzi-word-adventure", defaultScrollPolicy: "document" },
  { kind: "play", queryKey: "play", queryValue: "hanzi-tower-defense", query: "?play=hanzi-tower-defense", defaultScrollPolicy: "document" },
  { kind: "classic-hub", queryKey: "hub", queryValue: "classic", query: "?hub=classic", defaultScrollPolicy: "document" },
  { kind: "world", queryKey: "world", queryValue: "math-world", query: "?world=math-world", defaultScrollPolicy: "document" },
  { kind: "world", queryKey: "world", queryValue: "my-game-world", query: "?world=my-game-world", defaultScrollPolicy: "document" },
] as const satisfies readonly AppRouteQueryRegistration[];

const ALL_INPUTS = ["pointer", "touch", "keyboard"] as const;
const MATH_HOST_SAVE = ["family-games/math-world/v1"] as const;

type SurfaceInput = Omit<PlaySurfaceRecord, "scrollPolicy" | "hostSaveNamespaces" | "runtimeSaveNamespaces"> & {
  readonly scrollPolicy?: ScrollPolicy;
  readonly hostSaveNamespaces?: readonly string[];
  readonly runtimeSaveNamespaces?: readonly string[];
};

function surface(record: SurfaceInput): PlaySurfaceRecord {
  const { hostSaveNamespaces = [], runtimeSaveNamespaces = record.saveNamespaces, ...rest } = record;
  return { scrollPolicy: "document", ...rest, hostSaveNamespaces, runtimeSaveNamespaces };
}

type ProductSurfaceInput = Omit<
  SurfaceInput,
  "productId" | "expectedInputs" | "qualityProfile" | "settingsAvailable" | "destructiveActionAvailable" | "saveNamespaces"
>;

const mathWorld = (record: ProductSurfaceInput): PlaySurfaceRecord => surface({
  ...record,
  productId: "math-lab",
  mountDefinitionId: "math-lab",
  topLevelProductId: "math-lab",
  runtimeOwnerDefinitionId: "math-lab",
  hostWorldId: "math",
  expectedInputs: ALL_INPUTS,
  qualityProfile: "a-core-world",
  settingsAvailable: record.kind === "product-world",
  destructiveActionAvailable: false,
  saveNamespaces: MATH_HOST_SAVE,
  hostSaveNamespaces: MATH_HOST_SAVE,
  runtimeSaveNamespaces: [],
});

const MATH_STATION_CONTRACTS = {
  target: { moduleId: "math-make-target", ownerId: "make-target", qualityProfile: "b-independent-puzzle", runtimeSaves: ["family-games/make-target"] },
  slider: { moduleId: "math-equation-slider", ownerId: "equation-slider", qualityProfile: "s-equation-release", runtimeSaves: ["family-games/equation-slider"] },
} as const;

const mathStation = (station: keyof typeof MATH_STATION_CONTRACTS): PlaySurfaceRecord => {
  const contract = MATH_STATION_CONTRACTS[station];
  return surface({
    id: `math-${station}`,
    title: `数学站点 · ${station}`,
    route: `?world=math-world&station=${station}`,
    productId: "math-lab",
    kind: "station",
    parentSurfaceId: "math-world",
    returnRoute: "?world=math-world",
    primaryActionSelector: "[data-return-map], button:not([disabled]), a",
    settingsAvailable: false,
    destructiveActionAvailable: false,
    saveNamespaces: [...MATH_HOST_SAVE, ...contract.runtimeSaves],
    hostSaveNamespaces: MATH_HOST_SAVE,
    runtimeSaveNamespaces: contract.runtimeSaves,
    mountDefinitionId: contract.ownerId,
    topLevelProductId: "math-lab",
    worldModuleId: contract.moduleId,
    runtimeOwnerDefinitionId: contract.ownerId,
    hostWorldId: "math",
    expectedInputs: ALL_INPUTS,
    qualityProfile: contract.qualityProfile,
  });
};

export const PLAY_SURFACE_MANIFEST: readonly PlaySurfaceRecord[] = [
  surface({ id: "hanzi-word-adventure", title: "字间行者 · 借字归途", route: "?play=hanzi-word-adventure", productId: "hanzi-word-adventure", kind: "product-world", parentSurfaceId: "my-game-world", returnRoute: "?world=my-game-world", primaryActionSelector: "[data-hway-move=right]", settingsAvailable: true, destructiveActionAvailable: true, saveNamespaces: ["family-games/hanzi-word-adventure/v1"], expectedInputs: ALL_INPUTS, qualityProfile: "s-hanzi-release", mountDefinitionId: "hanzi-word-adventure", runtimeOwnerDefinitionId: "hanzi-word-adventure", topLevelProductId: "hanzi-word-adventure", hostWorldId: "chinese", primaryEntry: true }),
  surface({ id: "my-game-world", title: "我的游戏世界", route: "?world=my-game-world", productId: "portfolio", kind: "portfolio-world", returnRoute: "?world=my-game-world", primaryActionSelector: ".world-entry", settingsAvailable: true, destructiveActionAvailable: false, saveNamespaces: ["family-games/my-game-world/v1"], expectedInputs: ALL_INPUTS, qualityProfile: "portfolio-play-ready", scrollPolicy: "document", primaryEntry: true }),
  surface({ id: "classic-hub", title: "游戏百宝箱", route: "?hub=classic&from=world", productId: "portfolio", kind: "classic-hub", parentSurfaceId: "my-game-world", returnRoute: "?world=my-game-world", primaryActionSelector: ".game-card__button", settingsAvailable: false, destructiveActionAvailable: false, saveNamespaces: [], expectedInputs: ALL_INPUTS, qualityProfile: "portfolio-play-ready", compatibilitySurfaceId: "classic-hub", primaryEntry: true }),


  surface({ id: "hanzi-tower-defense", title: "字阵守城", route: "?play=hanzi-tower-defense", productId: "hanzi-tower-defense", kind: "product-world", parentSurfaceId: "my-game-world", returnRoute: "?world=my-game-world", primaryActionSelector: "[data-td-pause], [data-slot], [data-core]", settingsAvailable: true, destructiveActionAvailable: true, saveNamespaces: ["family-games/hanzi-tower-defense/v2", "family-games/hanzi-tower-defense/v1"], expectedInputs: ALL_INPUTS, qualityProfile: "s-hanzi-release", mountDefinitionId: "hanzi-tower-defense", runtimeOwnerDefinitionId: "hanzi-tower-defense", topLevelProductId: "hanzi-tower-defense", hostWorldId: "chinese", primaryEntry: true }),
  mathWorld({ id: "math-world", title: "数感实验城", route: "?world=math-world&from=world", kind: "product-world", parentSurfaceId: "my-game-world", returnRoute: "?world=my-game-world", primaryActionSelector: "[data-station-id] button", primaryEntry: true }),
  ...(["slider", "target"] as const).map(mathStation),


  ...([
    ["classic-defense", "hanzi-tower-defense", "字阵守城", "s-hanzi-release", false],
    ["classic-adventure", "hanzi-word-adventure", "字间行者", "s-hanzi-release", false],
    ["classic-math", "math-lab", "数学世界", "a-core-world", false],
  ] as const).map(([id, productId, title, qualityProfile, primaryEntry]) => {
    const product = GAME_PORTFOLIO.find((record) => record.id === productId);
    if (!product) throw new Error(`Classic play surface references unknown product: ${productId}`);
    return surface({ id, title, route: "?hub=classic&from=world", productId, kind: "classic-entry", parentSurfaceId: "classic-hub", returnRoute: productId === "math-lab" ? "?world=my-game-world" : "?hub=classic&from=world", primaryActionSelector: `[data-game-id="${productId}"] .game-card__button`, settingsAvailable: false, destructiveActionAvailable: false, saveNamespaces: product.saveNamespaces, mountDefinitionId: productId, topLevelProductId: productId, runtimeOwnerDefinitionId: productId, hostWorldId: product.targetWorld === "shared" ? undefined : product.targetWorld, compatibilitySurfaceId: "classic-hub", expectedInputs: ALL_INPUTS, qualityProfile, primaryEntry });
  }),
] as const;

export const PRIMARY_PLAY_SURFACES = PLAY_SURFACE_MANIFEST.filter((record) => record.primaryEntry);
export const PLAY_SURFACE_BY_ID: ReadonlyMap<string, PlaySurfaceRecord> = new Map(PLAY_SURFACE_MANIFEST.map((record) => [record.id, record]));
