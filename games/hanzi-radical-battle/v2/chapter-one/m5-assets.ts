import { CHAPTER_ONE_CHARACTERS } from "./characters";
import { M3_BUILD_ABILITIES, M3_HEROES } from "./builds";
import { M4_REPAIR_IDS } from "./camp";
import { M5_BEHAVIORS, M5_BOSSES } from "./m5-content";

const RAW_BASE_URL = import.meta.env?.BASE_URL ?? "./";
const APP_BASE_URL = RAW_BASE_URL === "/" ? "/" : RAW_BASE_URL.endsWith("/") ? RAW_BASE_URL : `${RAW_BASE_URL}/`;
export const M5_ASSET_BASE_URL = `${APP_BASE_URL}assets/hanzi-radical-battle/v2/theme-c/chapter-one/`;

export type M5AssetRole = "region" | "hero" | "monster" | "boss" | "meaning" | "ability" | "repair" | "ending" | "hub";

export interface M5RuntimeAsset {
  readonly key: string;
  readonly fileName: `${string}.webp`;
  readonly role: M5AssetRole;
  readonly eagerlyLoaded: boolean;
  readonly generatedSource: "imagegen-theme-c-chapter-one";
}

const asset = (key: string, role: M5AssetRole, eagerlyLoaded = false): M5RuntimeAsset => ({ key, fileName: `${key}.webp`, role, eagerlyLoaded, generatedSource: "imagegen-theme-c-chapter-one" });

export const M5_RUNTIME_ASSETS: readonly M5RuntimeAsset[] = [
  asset("hub-ink-forest", "hub", true),
  ...(["region-glimmer-grove", "region-echo-garden", "region-wind-trail", "region-ink-king-core"] as const).map((key, index) => asset(key, "region", index === 0)),
  ...M3_HEROES.map((entry) => asset(`hero-${entry.id}`, "hero", true)),
  ...M5_BEHAVIORS.map((entry) => asset(entry.visualKey, "monster")),
  ...M5_BOSSES.map((entry) => asset(entry.assetKey, "boss")),
  ...CHAPTER_ONE_CHARACTERS.slice(12).map((entry) => asset(`meaning-${entry.id}`, "meaning")),
  ...M3_BUILD_ABILITIES.map((entry) => asset(entry.iconKey, "ability")),
  ...M4_REPAIR_IDS.map((id) => asset(`repair-${id}`, "repair")),
  asset("chapter-one-restored", "ending"),
] as const;

export function m5AssetUrl(key: string): string {
  const entry = M5_RUNTIME_ASSETS.find((candidate) => candidate.key === key);
  if (!entry) throw new Error(`Unknown M5 runtime asset: ${key}`);
  return `${M5_ASSET_BASE_URL}${entry.fileName}`;
}

export function m5MeaningAssetUrl(characterId: string): string | null {
  const generated = M5_RUNTIME_ASSETS.find((entry) => entry.key === `meaning-${characterId}`);
  return generated ? `${M5_ASSET_BASE_URL}${generated.fileName}` : null;
}
