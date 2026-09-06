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
  { kind: "play", queryKey: "play", queryValue: "hanzi-magic-complete", query: "?play=hanzi-magic-complete", defaultScrollPolicy: "document" },
  { kind: "play", queryKey: "play", queryValue: "hanzi-v2-chapter-one", query: "?play=hanzi-v2-chapter-one", defaultScrollPolicy: "document" },
  { kind: "play", queryKey: "play", queryValue: "hanzi-v2-v1", query: "?play=hanzi-v2-v1", defaultScrollPolicy: "locked" },
  { kind: "play", queryKey: "play", queryValue: "pinyin-magic-battle", query: "?play=pinyin-magic-battle", defaultScrollPolicy: "document" },
  { kind: "play", queryKey: "play", queryValue: "english-spell-battle-legacy", query: "?play=english-spell-battle-legacy", defaultScrollPolicy: "document" },
  { kind: "classic-hub", queryKey: "hub", queryValue: "classic", query: "?hub=classic", defaultScrollPolicy: "document" },
  { kind: "world", queryKey: "world", queryValue: "english-world", query: "?world=english-world", defaultScrollPolicy: "document" },
  { kind: "world", queryKey: "world", queryValue: "math-world", query: "?world=math-world", defaultScrollPolicy: "document" },
  { kind: "world", queryKey: "world", queryValue: "my-game-world", query: "?world=my-game-world", defaultScrollPolicy: "document" },
] as const satisfies readonly AppRouteQueryRegistration[];

const ALL_INPUTS = ["pointer", "touch", "keyboard"] as const;
const HANZI_SAVE = ["family-games/hanzi-magic-complete/v3"] as const;
const MATH_HOST_SAVE = ["family-games/math-world/v1"] as const;
const ENGLISH_SAVE = ["family-games/english-world/v2"] as const;

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

const hanzi = (record: ProductSurfaceInput): PlaySurfaceRecord => surface({
  ...record,
  productId: "hanzi-radical-battle",
  mountDefinitionId: "hanzi-radical-battle",
  topLevelProductId: "hanzi-radical-battle",
  runtimeOwnerDefinitionId: "hanzi-radical-battle",
  hostWorldId: "chinese",
  expectedInputs: ALL_INPUTS,
  qualityProfile: "s-hanzi-release",
  settingsAvailable: true,
  destructiveActionAvailable: false,
  saveNamespaces: HANZI_SAVE,
});

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

const english = (record: ProductSurfaceInput): PlaySurfaceRecord => surface({
  ...record,
  productId: "english-spell-battle",
  mountDefinitionId: "english-spell-battle",
  topLevelProductId: "english-spell-battle",
  runtimeOwnerDefinitionId: "english-spell-battle",
  hostWorldId: "english",
  expectedInputs: ALL_INPUTS,
  qualityProfile: "a-core-world",
  settingsAvailable: record.kind !== "support-activity",
  destructiveActionAvailable: false,
  saveNamespaces: ENGLISH_SAVE,
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
  surface({ id: "my-game-world", title: "我的游戏世界", route: "?world=my-game-world", productId: "portfolio", kind: "portfolio-world", returnRoute: "?world=my-game-world", primaryActionSelector: ".world-entry", settingsAvailable: true, destructiveActionAvailable: false, saveNamespaces: ["family-games/my-game-world/v1"], expectedInputs: ALL_INPUTS, qualityProfile: "portfolio-play-ready", scrollPolicy: "document", primaryEntry: true }),
  surface({ id: "classic-hub", title: "游戏百宝箱", route: "?hub=classic&from=world", productId: "portfolio", kind: "classic-hub", parentSurfaceId: "my-game-world", returnRoute: "?world=my-game-world", primaryActionSelector: ".game-card__button", settingsAvailable: false, destructiveActionAvailable: false, saveNamespaces: [], expectedInputs: ALL_INPUTS, qualityProfile: "portfolio-play-ready", compatibilitySurfaceId: "classic-hub", primaryEntry: true }),

  hanzi({ id: "hanzi-world", title: "墨迹森林", route: "?play=hanzi-magic-complete&from=world", kind: "product-world", parentSurfaceId: "my-game-world", returnRoute: "?world=my-game-world", primaryActionSelector: "[data-primary-focus], button:not([disabled]), a", primaryEntry: true }),
  ...(["one", "two", "three"] as const).map((chapter, index) => hanzi({ id: `hanzi-chapter-${chapter}`, title: `墨迹森林第${["一", "二", "三"][index]}章`, route: `?play=hanzi-magic-complete&from=hub&chapter=${chapter}`, kind: "chapter", parentSurfaceId: "hanzi-world", returnRoute: "?play=hanzi-magic-complete&from=hub", primaryActionSelector: "[data-primary-focus], button:not([disabled]), a" })),
  hanzi({ id: "hanzi-spellbook", title: "字光册", route: "?play=hanzi-magic-complete&from=hub&view=spellbook", kind: "support-activity", parentSurfaceId: "hanzi-world", returnRoute: "?play=hanzi-magic-complete&from=hub", primaryActionSelector: "button:not([disabled]), a" }),
  hanzi({ id: "hanzi-wheel", title: "七十二字轮工坊", route: "?play=hanzi-magic-complete&from=hub&view=wheel", kind: "support-activity", parentSurfaceId: "hanzi-world", returnRoute: "?play=hanzi-magic-complete&from=hub", primaryActionSelector: "[data-primary-focus], button:not([disabled]), a" }),
  hanzi({ id: "hanzi-archive", title: "归林档案", route: "?play=hanzi-magic-complete&from=hub&view=archive", kind: "support-activity", parentSurfaceId: "hanzi-world", returnRoute: "?play=hanzi-magic-complete&from=hub", primaryActionSelector: "button:not([disabled]), a" }),
  ...(["assemble", "tone", "contrast"] as const).map((mode) => hanzi({ id: `hanzi-pinyin-${mode}`, title: `声韵试炼 · ${mode}`, route: `?play=hanzi-magic-complete&view=pinyin&mode=${mode}`, kind: "support-activity", parentSurfaceId: "hanzi-world", returnRoute: "?play=hanzi-magic-complete&from=world", primaryActionSelector: "[data-answer], [data-action=hint], a" })),
  ...(["same-glyph", "glyph-pinyin", "glyph-phrase"] as const).map((pack) => hanzi({ id: `hanzi-memory-${pack}`, title: `字光配对 · ${pack}`, route: `?play=hanzi-magic-complete&view=memory&pack=${pack}`, kind: "support-activity", parentSurfaceId: "hanzi-world", returnRoute: "?play=hanzi-magic-complete&from=world", primaryActionSelector: "[data-card-id], [data-pack-id], a" })),
  ...(["free-adventure", "component-trails", "word-resonance"] as const).map((mode) => hanzi({ id: `hanzi-postgame-${mode}`, title: `墨迹森林通关探索 · ${mode}`, route: `?play=hanzi-magic-complete&from=hub&postgame=${mode}`, kind: "postgame", parentSurfaceId: "hanzi-world", returnRoute: "?play=hanzi-magic-complete&from=hub", primaryActionSelector: "[data-primary-focus], button:not([disabled]), a" })),
  hanzi({ id: "hanzi-family-slice", title: "字脉连接", route: "?play=hanzi-magic-complete&from=hub&slice=family", kind: "support-activity", parentSurfaceId: "hanzi-world", returnRoute: "?play=hanzi-magic-complete&from=hub", primaryActionSelector: "[data-primary-focus], button:not([disabled]), a", scrollPolicy: "internal", scrollContainerSelector: ".hmc-shell" }),
  hanzi({ id: "hanzi-word-slice", title: "词带连接", route: "?play=hanzi-magic-complete&from=hub&slice=word", kind: "support-activity", parentSurfaceId: "hanzi-world", returnRoute: "?play=hanzi-magic-complete&from=hub", primaryActionSelector: "[data-primary-focus], button:not([disabled]), a", scrollPolicy: "internal", scrollContainerSelector: ".hmc-shell" }),
  hanzi({ id: "hanzi-v2-compat", title: "墨迹森林 V2", route: "?play=hanzi-v2-chapter-one&from=world", kind: "chapter", parentSurfaceId: "hanzi-world", returnRoute: "?world=my-game-world", primaryActionSelector: "[data-primary-focus], button:not([disabled]), a" }),
  hanzi({ id: "hanzi-v1-compat", title: "墨迹森林 V1", route: "?play=hanzi-v2-v1&from=world", kind: "chapter", parentSurfaceId: "hanzi-world", returnRoute: "?world=my-game-world", primaryActionSelector: "button:not([disabled]), a", scrollPolicy: "locked", lockedReason: "The compatibility edition is a fixed inset Phaser scene with its own viewport-safe overlays." }),

  mathWorld({ id: "math-world", title: "数感实验城", route: "?world=math-world&from=world", kind: "product-world", parentSurfaceId: "my-game-world", returnRoute: "?world=my-game-world", primaryActionSelector: "[data-station-id] button", primaryEntry: true }),
  ...(["slider", "target"] as const).map(mathStation),

  english({ id: "english-world", title: "词光岛", route: "?world=english-world&from=world", kind: "product-world", parentSurfaceId: "my-game-world", returnRoute: "?world=my-game-world", primaryActionSelector: "[data-theme-id]", primaryEntry: true }),
  ...(["animals", "home", "food", "actions", "colors"] as const).map((region) => english({ id: `english-region-${region}`, title: `词光岛区域 · ${region}`, route: `?world=english-world&region=${region}`, kind: "region", parentSurfaceId: "english-world", returnRoute: "?world=english-world", primaryActionSelector: "[data-word-id], [data-action=map]" })),
  english({ id: "english-journal", title: "词光册", route: "?world=english-world&view=journal", kind: "journal", parentSurfaceId: "english-world", returnRoute: "?world=english-world", primaryActionSelector: "[data-action=map], [data-speak]" }),
  english({ id: "english-memory", title: "English Memory", route: "?world=english-world&view=memory", kind: "support-activity", parentSurfaceId: "english-world", returnRoute: "?world=english-world", primaryActionSelector: "[data-card-id], [data-pack-id], a" }),

  ...([
    ["classic-hanzi", "hanzi-radical-battle", "汉字魔法战", "s-hanzi-release", false],
    ["classic-math", "math-lab", "数学世界", "a-core-world", false],
    ["classic-english", "english-spell-battle", "英文魔法战", "a-core-world", false],
  ] as const).map(([id, productId, title, qualityProfile, primaryEntry]) => {
    const product = GAME_PORTFOLIO.find((record) => record.id === productId);
    if (!product) throw new Error(`Classic play surface references unknown product: ${productId}`);
    return surface({ id, title, route: "?hub=classic&from=world", productId, kind: "classic-entry", parentSurfaceId: "classic-hub", returnRoute: productId === "math-lab" ? "?world=my-game-world" : "?hub=classic&from=world", primaryActionSelector: `[data-game-id="${productId}"] .game-card__button`, settingsAvailable: false, destructiveActionAvailable: false, saveNamespaces: product.saveNamespaces, mountDefinitionId: productId, topLevelProductId: productId, runtimeOwnerDefinitionId: productId, hostWorldId: product.targetWorld === "shared" ? undefined : product.targetWorld, compatibilitySurfaceId: "classic-hub", expectedInputs: ALL_INPUTS, qualityProfile, primaryEntry });
  }),
] as const;

export const PRIMARY_PLAY_SURFACES = PLAY_SURFACE_MANIFEST.filter((record) => record.primaryEntry);
export const PLAY_SURFACE_BY_ID: ReadonlyMap<string, PlaySurfaceRecord> = new Map(PLAY_SURFACE_MANIFEST.map((record) => [record.id, record]));
