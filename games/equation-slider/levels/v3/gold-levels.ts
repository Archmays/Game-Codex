import { publishLevel } from "../../solver";
import type {
  EquationSliderLevelDefinition,
  EquationTile,
  PublishedEquationSliderLevel
} from "../../types";

const FIRST_LEVEL_DEFINITION = {
  schemaVersion: 3,
  id: "es-1-01",
  chapterId: "chapter-1",
  stationId: "chapter-1-station-1",
  order: 1,
  stationOrder: 1,
  mode: "target",
  challenge: "unique-minimum-cover",
  slots: [
    {
      kind: "movable-reel",
      reel: {
        id: "es-1-01-left",
        kind: "number",
        tiles: [
          numberTile("es-1-01-left-1", 1),
          numberTile("es-1-01-left-2", 2),
          numberTile("es-1-01-left-4", 4)
        ]
      }
    },
    {
      kind: "fixed-token",
      id: "es-1-01-plus",
      token: "+",
      ariaLabel: "固定运算符：加号"
    },
    {
      kind: "movable-reel",
      reel: {
        id: "es-1-01-right",
        kind: "number",
        tiles: [
          numberTile("es-1-01-right-5", 5),
          numberTile("es-1-01-right-4", 4),
          numberTile("es-1-01-right-2", 2)
        ]
      }
    }
  ],
  initialIndexes: [2, 0],
  requiredTileIds: [
    "es-1-01-left-1",
    "es-1-01-left-2",
    "es-1-01-left-4",
    "es-1-01-right-5",
    "es-1-01-right-4",
    "es-1-01-right-2"
  ],
  targets: [{ kind: "value", id: "es-1-01-target-6", value: 6 }],
  learning: {
    objective: "用不同的两个数合成 6，并观察加法中的部分与整体。",
    primarySkill: "part-whole-addition",
    skillTags: ["addition", "part-whole", "number-bonds"],
    prerequisiteTags: ["recognize-1-to-6"],
    misconceptionTags: ["repeat-same-pair", "operator-as-movable-decoration"],
    scaffold: "guided",
    reviewOf: [],
    reflection: "哪两组数字交换了位置，但仍然得到 6？",
    recommendedAgeBand: "约 6–7 岁"
  },
  hints: [
    { kind: "concept", text: "想一想：6 可以分成哪两个部分？" },
    { kind: "position", text: "先看看右边滑轨上还没有用过的数字。" },
    { kind: "direction", text: "把右边滑轨上方的 2 移到中央。" }
  ],
  provenance: {
    kind: "hand-authored-gold",
    generatorVersion: "authored-v3.0.0"
  }
} satisfies EquationSliderLevelDefinition;

export const FIRST_GOLD_LEVEL: PublishedEquationSliderLevel = publishLevel(FIRST_LEVEL_DEFINITION);

export const HAND_AUTHORED_GOLD_LEVELS: readonly PublishedEquationSliderLevel[] = [FIRST_GOLD_LEVEL];

function numberTile(id: string, value: number): EquationTile & { readonly kind: "number" } {
  return { id, kind: "number", value };
}
