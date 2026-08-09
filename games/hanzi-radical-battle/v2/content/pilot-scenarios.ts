import type { PilotScenario } from "./types";

export const PILOT_SCENARIOS: readonly PilotScenario[] = [
  {
    id: "pilot-ming-left-right",
    characterId: "ming",
    purpose: "child-pilot",
    structure: "left-right",
    prompt: "把日和月送回它们真正的位置，让光回来。",
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
    handAuditNote: "已对 V1 非空组合枚举两／三牌子集；这手牌只命中“明”。",
  },
  {
    id: "preview-hua-top-bottom",
    characterId: "hua",
    purpose: "adult-structure-preview",
    structure: "top-bottom",
    prompt: "成人预览：检查上下结构的槽位是否一眼可辨。",
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
    handAuditNote: "已对 V1 非空组合枚举两／三牌子集；这手牌只命中“花”。",
  },
  {
    id: "preview-feng-semi-enclosure",
    characterId: "feng",
    purpose: "adult-structure-preview",
    structure: "semi-enclosure",
    prompt: "成人预览：检查半包围结构的外／内槽位是否清楚。",
    cards: [
      { id: "feng-ji", glyph: "几", expectedSlotId: "outer", kind: "target" },
      { id: "feng-yi", glyph: "乂", expectedSlotId: "inner", kind: "target" },
      { id: "feng-water", glyph: "氵", expectedSlotId: null, kind: "distractor" },
      { id: "feng-person", glyph: "亻", expectedSlotId: null, kind: "distractor" },
      { id: "feng-speech", glyph: "讠", expectedSlotId: null, kind: "distractor" },
    ],
    slots: [
      { id: "outer", label: "外边", spatialRole: "outer" },
      { id: "inner", label: "里边", spatialRole: "inner" },
    ],
    noAlternativeTwoOrThreePartCombination: true,
    handAuditNote: "已对 V1 非空组合枚举两／三牌子集；这手牌只命中“风”。",
  },
] as const;

export const DEFAULT_PILOT_SCENARIO = PILOT_SCENARIOS[0];

export function getPilotScenario(id: string): PilotScenario {
  const scenario = PILOT_SCENARIOS.find((item) => item.id === id);
  if (!scenario) throw new Error(`Unknown STEP 02 scenario: ${id}`);
  return scenario;
}
