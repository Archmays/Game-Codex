export const THEME_C_ASSET_MANIFEST_VERSION = "hanzi-v2-theme-c-procedural-v1";

export interface ProceduralThemeAsset {
  readonly key: string;
  readonly role: "background" | "camp" | "hero" | "companion" | "monster" | "boss" | "spell" | "repair";
  readonly anchor: { readonly x: number; readonly y: number };
  readonly scale: number;
  readonly stableProcedural: true;
}

export const THEME_C_PROCEDURAL_ASSETS: readonly ProceduralThemeAsset[] = [
  { key: "theme-c/ink-forest-background", role: "background", anchor: { x: 0.5, y: 0.5 }, scale: 1, stableProcedural: true },
  { key: "theme-c/camp-lantern", role: "camp", anchor: { x: 0.5, y: 1 }, scale: 0.9, stableProcedural: true },
  { key: "theme-c/hanzi-mage", role: "hero", anchor: { x: 0.5, y: 1 }, scale: 0.82, stableProcedural: true },
  { key: "theme-c/ink-dot-companion", role: "companion", anchor: { x: 0.5, y: 0.5 }, scale: 0.54, stableProcedural: true },
  { key: "theme-c/lost-ink", role: "monster", anchor: { x: 0.5, y: 1 }, scale: 0.68, stableProcedural: true },
  { key: "theme-c/root-ink-boss", role: "boss", anchor: { x: 0.5, y: 1 }, scale: 1.08, stableProcedural: true },
  { key: "theme-c/star-ink-boss", role: "boss", anchor: { x: 0.5, y: 1 }, scale: 1.12, stableProcedural: true },
  { key: "theme-c/hanzi-spell-glow", role: "spell", anchor: { x: 0.5, y: 0.5 }, scale: 1, stableProcedural: true },
  { key: "theme-c/lantern-repair-glow", role: "repair", anchor: { x: 0.5, y: 1 }, scale: 1, stableProcedural: true },
] as const;
