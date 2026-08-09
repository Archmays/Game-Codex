import type { GoldenEncounter, GoldenEncounterId } from "./types";

export const GOLDEN_SLICE_ENCOUNTERS: readonly GoldenEncounter[] = [
  {
    id: "encounter-ming",
    characterId: "ming",
    purpose: "child-pilot",
    structure: "left-right",
    prompt: "把日和月送回位置",
    kind: "normal",
    sequence: 1,
    cards: [
      { id: "ming-ri", glyph: "日", expectedSlotId: "left", kind: "target" },
      { id: "ming-yue", glyph: "月", expectedSlotId: "right", kind: "target" },
      { id: "ming-water", glyph: "氵", expectedSlotId: null, kind: "distractor" },
      { id: "ming-person", glyph: "亻", expectedSlotId: null, kind: "distractor" },
      { id: "ming-speech", glyph: "讠", expectedSlotId: null, kind: "distractor" },
    ],
    slots: [
      { id: "left", label: "左边", spatialRole: "left" },
      { id: "right", label: "右边", spatialRole: "right" },
    ],
    noAlternativeTwoOrThreePartCombination: true,
    handAuditNote: "由 STEP 03 固定种子审计；仅命中明。",
  },
  {
    id: "encounter-hua",
    characterId: "hua",
    purpose: "child-pilot",
    structure: "top-bottom",
    prompt: "把艹和化送回位置",
    kind: "normal",
    sequence: 2,
    cards: [
      { id: "hua-cao", glyph: "艹", expectedSlotId: "top", kind: "target" },
      { id: "hua-hua", glyph: "化", expectedSlotId: "bottom", kind: "target" },
      { id: "hua-water", glyph: "氵", expectedSlotId: null, kind: "distractor" },
      { id: "hua-person", glyph: "亻", expectedSlotId: null, kind: "distractor" },
      { id: "hua-speech", glyph: "讠", expectedSlotId: null, kind: "distractor" },
    ],
    slots: [
      { id: "top", label: "上边", spatialRole: "top" },
      { id: "bottom", label: "下边", spatialRole: "bottom" },
    ],
    noAlternativeTwoOrThreePartCombination: true,
    handAuditNote: "由 STEP 03 固定种子审计；仅命中花。",
  },
  {
    id: "boss-lin",
    characterId: "lin",
    purpose: "child-pilot",
    structure: "left-right",
    prompt: "把两张木送回位置",
    kind: "boss-phase",
    sequence: 3,
    cards: [
      { id: "lin-mu-left", glyph: "木", expectedSlotId: "left", kind: "target" },
      { id: "lin-mu-right", glyph: "木", expectedSlotId: "right", kind: "target" },
      { id: "lin-water", glyph: "氵", expectedSlotId: null, kind: "distractor" },
      { id: "lin-person", glyph: "亻", expectedSlotId: null, kind: "distractor" },
      { id: "lin-speech", glyph: "讠", expectedSlotId: null, kind: "distractor" },
    ],
    slots: [
      { id: "left", label: "左边", spatialRole: "left" },
      { id: "right", label: "右边", spatialRole: "right" },
    ],
    noAlternativeTwoOrThreePartCombination: true,
    handAuditNote: "由 STEP 03 固定种子审计；仅命中林，双木保留实例 ID。",
  },
  {
    id: "boss-xing",
    characterId: "xing",
    purpose: "child-pilot",
    structure: "top-bottom",
    prompt: "把日和生送回位置",
    kind: "boss-phase",
    sequence: 4,
    cards: [
      { id: "xing-ri", glyph: "日", expectedSlotId: "top", kind: "target" },
      { id: "xing-sheng", glyph: "生", expectedSlotId: "bottom", kind: "target" },
      { id: "xing-water", glyph: "氵", expectedSlotId: null, kind: "distractor" },
      { id: "xing-person", glyph: "亻", expectedSlotId: null, kind: "distractor" },
      { id: "xing-speech", glyph: "讠", expectedSlotId: null, kind: "distractor" },
    ],
    slots: [
      { id: "top", label: "上边", spatialRole: "top" },
      { id: "bottom", label: "下边", spatialRole: "bottom" },
    ],
    noAlternativeTwoOrThreePartCombination: true,
    handAuditNote: "由 STEP 03 固定种子审计；仅命中星。",
  },
] as const;

export function getGoldenEncounter(id: GoldenEncounterId): GoldenEncounter {
  const encounter = GOLDEN_SLICE_ENCOUNTERS.find((entry) => entry.id === id);
  if (!encounter) throw new Error(`Unknown golden-slice encounter: ${id}`);
  return encounter;
}
