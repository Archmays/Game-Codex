import { createRevisionHash } from "../../content/revision-hash";
import { getGoldenCharacter } from "./manifest";
import { FINAL_GOLDEN_CHARACTER_IDS, type AbilityId, type GoldenCharacterId } from "./types";

export const HANZI_MAGIC_V1_AUTHORIZATION_ID = "HUMAN_AUTHORIZED_SKIP_REAL_SECOND_USE_AND_COMPLETE_V1_ONE_SHOT_01" as const;
export const HANZI_MAGIC_V1_GAME_VERSION = "V1.0.0" as const;
export const HANZI_MAGIC_V1_CONTENT_VERSION = "hanzi-magic-battle-v2-v1-content-1" as const;

export type V1AdventureId = "glimmer-path" | "garden-echo" | "wind-footprints";
export type V1EncounterId = `v1-${GoldenCharacterId}`;
export type V1SlotId = "left" | "right" | "top" | "bottom" | "outer" | "inner";
export type V1EncounterKind = "normal" | "boss-phase";

export interface V1Component {
  readonly id: string;
  readonly glyph: string;
  readonly sourceGlyph: string;
  readonly slotId: V1SlotId;
}

export interface V1Character {
  readonly id: GoldenCharacterId;
  readonly glyph: string;
  readonly pinyin: string;
  readonly familiarWord: string;
  readonly shortMeaning: string;
  readonly structure: "left-right" | "top-bottom" | "full-enclosure" | "semi-enclosure";
  readonly components: readonly V1Component[];
  readonly magic: { readonly id: string; readonly name: string; readonly effect: string };
  readonly spokenPhrase: string;
  readonly etymologyClaim: null;
  readonly meaningAssetId: string;
}

export interface V1HandCard extends V1Component {
  readonly kind: "target" | "distractor";
  readonly expectedSlotId: V1SlotId | null;
}

export interface V1Encounter {
  readonly id: V1EncounterId;
  readonly adventureId: V1AdventureId;
  readonly characterId: GoldenCharacterId;
  readonly sequence: 1 | 2 | 3 | 4;
  readonly kind: V1EncounterKind;
  readonly prompt: string;
  readonly cards: readonly V1HandCard[];
}

export interface V1Adventure {
  readonly id: V1AdventureId;
  readonly sequence: 1 | 2 | 3;
  readonly title: string;
  readonly shortTitle: string;
  readonly entryAction: string;
  readonly purpose: string;
  readonly characterIds: readonly [GoldenCharacterId, GoldenCharacterId, GoldenCharacterId, GoldenCharacterId];
  readonly encounterIds: readonly [V1EncounterId, V1EncounterId, V1EncounterId, V1EncounterId];
  readonly abilityIds: readonly AbilityId[];
  readonly repair: {
    readonly stage: 1 | 2 | 3;
    readonly title: string;
    readonly description: string;
    readonly worldState: "camp-lamp" | "garden-path" | "world-gate";
  };
}

const DISPLAY_COMPONENT_OVERRIDES: Partial<Record<GoldenCharacterId, Readonly<Record<string, string>>>> = {
  kan: { "kan-shou": "龵" },
  pao: { "pao-zu": "⻊" },
};

const MEANING_ASSET_IDS: Readonly<Record<GoldenCharacterId, string>> = {
  ming: "A10", hua: "A11", lin: "A12", xing: "A13",
  cao: "A17", kan: "A18", yuan: "A19", hui: "A20",
  bao: "A21", feng: "A22", mao: "A23", pao: "A24",
};

function toV1Character(id: GoldenCharacterId): V1Character {
  const source = getGoldenCharacter(id);
  return {
    id,
    glyph: source.glyph,
    pinyin: source.visualPinyin,
    familiarWord: source.familiarWord,
    shortMeaning: source.shortMeaning,
    structure: source.structure,
    components: source.components.map((component) => ({
      id: component.id,
      glyph: DISPLAY_COMPONENT_OVERRIDES[id]?.[component.id] ?? component.glyph,
      sourceGlyph: component.glyph,
      slotId: component.slotId,
    })),
    magic: source.magic,
    spokenPhrase: source.spokenPhrase,
    etymologyClaim: null,
    meaningAssetId: MEANING_ASSET_IDS[id],
  };
}

export const HANZI_MAGIC_V1_CHARACTERS: readonly V1Character[] = FINAL_GOLDEN_CHARACTER_IDS.map(toV1Character);

export const HANZI_MAGIC_V1_ADVENTURES: readonly V1Adventure[] = [
  {
    id: "glimmer-path", sequence: 1, title: "微光林径", shortTitle: "微光", entryAction: "走进林径",
    purpose: "从左右与上下结构开始，让四道字光重新点亮营地。",
    characterIds: ["ming", "hua", "lin", "xing"],
    encounterIds: ["v1-ming", "v1-hua", "v1-lin", "v1-xing"],
    abilityIds: ["guardian-light", "star-path", "ink-echo"],
    repair: { stage: 1, title: "营地灯亮起来了", description: "森林入口重新有了颜色。", worldState: "camp-lamp" },
  },
  {
    id: "garden-echo", sequence: 2, title: "花园回声", shortTitle: "花园", entryAction: "走进花园",
    purpose: "用外框与里面的空间关系，修好花园和回营小径。",
    characterIds: ["cao", "kan", "yuan", "hui"],
    encounterIds: ["v1-cao", "v1-kan", "v1-yuan", "v1-hui"],
    abilityIds: ["guardian-light", "star-path", "ink-echo"],
    repair: { stage: 2, title: "花园重新围好了", description: "拱门和回营小径恢复了形状。", worldState: "garden-path" },
  },
  {
    id: "wind-footprints", sequence: 3, title: "风的脚印", shortTitle: "风路", entryAction: "追上脚印",
    purpose: "认识半包围和位置部件，让风铃路径通向完整的世界门。",
    characterIds: ["bao", "feng", "mao", "pao"],
    encounterIds: ["v1-bao", "v1-feng", "v1-mao", "v1-pao"],
    abilityIds: ["guardian-light", "star-path", "ink-echo"],
    repair: { stage: 3, title: "世界门打开了", description: "风铃路径和最终营地入口完全恢复。", worldState: "world-gate" },
  },
] as const;

const DISTRACTORS = [
  { key: "water", glyph: "氵" },
  { key: "person", glyph: "亻" },
  { key: "speech", glyph: "讠" },
] as const;

const DISTRACTOR_OVERRIDES: Partial<Record<GoldenCharacterId, readonly { readonly key: string; readonly glyph: string }[]>> = {
  kan: [{ key: "speech", glyph: "讠" }, { key: "fire", glyph: "火" }, { key: "moon", glyph: "月" }],
  pao: [{ key: "woman", glyph: "女" }, { key: "earth", glyph: "土" }, { key: "jade", glyph: "王" }],
};

function makeEncounter(adventure: V1Adventure, characterId: GoldenCharacterId, index: number): V1Encounter {
  const character = HANZI_MAGIC_V1_CHARACTERS.find((entry) => entry.id === characterId)!;
  const targetCards: V1HandCard[] = character.components.map((component) => ({
    ...component,
    expectedSlotId: component.slotId,
    kind: "target",
  }));
  const distractorCount = 5 - targetCards.length;
  const distractors: V1HandCard[] = (DISTRACTOR_OVERRIDES[characterId] ?? DISTRACTORS).slice(0, distractorCount).map((entry) => ({
    id: `${characterId}-${entry.key}`,
    glyph: entry.glyph,
    sourceGlyph: entry.glyph,
    slotId: "left",
    expectedSlotId: null,
    kind: "distractor",
  }));
  return {
    id: `v1-${characterId}`,
    adventureId: adventure.id,
    characterId,
    sequence: (index + 1) as 1 | 2 | 3 | 4,
    kind: index < 2 ? "normal" : "boss-phase",
    prompt: `把${character.components.map((part) => part.glyph).join("和")}送回位置`,
    cards: [...targetCards, ...distractors],
  };
}

export const HANZI_MAGIC_V1_ENCOUNTERS: readonly V1Encounter[] = HANZI_MAGIC_V1_ADVENTURES.flatMap((adventure) =>
  adventure.characterIds.map((characterId, index) => makeEncounter(adventure, characterId, index)),
);

export const HANZI_MAGIC_V1_CONTENT_REVISION = createRevisionHash(HANZI_MAGIC_V1_CONTENT_VERSION, {
  authorization: HANZI_MAGIC_V1_AUTHORIZATION_ID,
  characters: HANZI_MAGIC_V1_CHARACTERS,
  adventures: HANZI_MAGIC_V1_ADVENTURES,
  encounters: HANZI_MAGIC_V1_ENCOUNTERS,
});

export function getV1Character(id: GoldenCharacterId): V1Character {
  const character = HANZI_MAGIC_V1_CHARACTERS.find((entry) => entry.id === id);
  if (!character) throw new Error(`Unknown V1 character: ${id}`);
  return character;
}

export function getV1Adventure(id: V1AdventureId): V1Adventure {
  const adventure = HANZI_MAGIC_V1_ADVENTURES.find((entry) => entry.id === id);
  if (!adventure) throw new Error(`Unknown V1 adventure: ${id}`);
  return adventure;
}

export function getV1Encounter(id: V1EncounterId): V1Encounter {
  const encounter = HANZI_MAGIC_V1_ENCOUNTERS.find((entry) => entry.id === id);
  if (!encounter) throw new Error(`Unknown V1 encounter: ${id}`);
  return encounter;
}
