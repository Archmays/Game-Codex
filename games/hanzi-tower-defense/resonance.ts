import type { CoreKind } from "./content";

/** Curated senses, not translations inferred from a core's internal name or display color. */
export const RESONANCES = [{
  coreId: "volcano" as const,
  senseId: "zh-volcano-landform",
  lexemeId: "en-volcano",
  text: "volcano",
  form: "word" as const,
  meaning: "岩浆等喷出并堆积形成的高地",
  recipe: "火 ＋ 山 → 火山",
  effectId: "echo-eruption" as const,
  effectName: "回声喷发",
  effectText: "命中后 0.45 秒，原落点再爆发：25.2 伤害，范围 80。",
  grantId: "wave-2-volcano",
  dropWave: 1, dropKill: 3,
  sources: ["https://www.zdic.net/hans/火山", "https://www.oxfordlearnersdictionaries.com/us/definition/english/volcano"],
}, {
  coreId: "wildwood" as const,
  senseId: "zh-shanlin-trees-on-mountains",
  lexemeId: "en-mountain-forest",
  text: "mountain forest",
  form: "phrase" as const,
  meaning: "山上的树林",
  recipe: "木 ＋ 木 → 林；山 ＋ 林 → 山林",
  effectId: "spreading-roots" as const,
  effectName: "根须蔓延",
  effectText: "落点生根 2.4 秒，范围 85；每 0.4 秒 5.88 伤害，区内减速 48%。重叠不相加，最多 3 区。",
  grantId: "wave-4-mountain-forest",
  dropWave: 3, dropKill: 3,
  sources: ["https://www.zdic.net/hans/山林", "https://www.fao.org/sustainable-forest-management-toolbox/modules/mountain-forests/en"],
}] as const;
export type Resonance = typeof RESONANCES[number];
export type LexemeId = Resonance["lexemeId"];
export type GrantId = Resonance["grantId"];
export type EffectId = Resonance["effectId"];
export interface EnglishCore {
  id: number; lexemeId: LexemeId; senseId: string; grantId: GrantId; attachedTo: number | null;
}
export function resonanceFor(coreId: CoreKind): Resonance | undefined { return RESONANCES.find(r => r.coreId === coreId); }
export function englishMapping(core: EnglishCore): Resonance | undefined {
  return RESONANCES.find(r => r.lexemeId === core.lexemeId && r.senseId === core.senseId && r.grantId === core.grantId);
}
export const ECHO = { multiplier: .4, delay: .45, radius: 80, maxPending: 4 } as const;
export const ROOTS = { multiplier: .12, duration: 2.4, radius: 85, tick: .4, slow: .48, maxZones: 3 } as const;
