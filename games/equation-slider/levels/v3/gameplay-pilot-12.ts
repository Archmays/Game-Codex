import { EQUATION_SLIDER_CONTENT_REVISIONS } from "../../content-revisions";
import { publishLevel } from "../../solver";
import type {
  ExpressionSlot,
  PublishedEquationSliderLevel,
  ScaffoldLevel
} from "../../types";
import { V3_GENERATOR_VERSION } from "./generator";

export const PILOT_REVISION_SOURCE = "games/equation-slider/levels/v3/gameplay-pilot-12.ts";
export const PILOT_AUTHORING_VERSION = "authored-slider-pilot-12-r1";
export const CURRENT_EQUATION_SLIDER_CONTENT_VERSION =
  `${V3_GENERATOR_VERSION}+${EQUATION_SLIDER_CONTENT_REVISIONS["es-1-02"]}`;

interface PilotBoard {
  readonly order: number;
  readonly targets: readonly [number] | readonly [number, number];
  readonly columns: readonly (readonly [number, number, number])[];
  readonly initialIndexes: readonly number[];
  readonly objective: string;
  readonly primarySkill: string;
  readonly scaffold: ScaffoldLevel;
  readonly concept: string;
  readonly reflection: string;
  readonly reviewOf: readonly string[];
}

// These are replacements of published boards, not templates for later stations.
// The original 40 templates and their global initial-index selection run first.
const PILOT_BOARDS: readonly PilotBoard[] = [
  {
    order: 2, targets: [5], columns: [[1, 2, 3], [3, 2, 4]], initialIndexes: [0, 0],
    objective: "观察中央数字怎样随滑轨移动变化，并用不同数对合成 5。",
    primarySkill: "visible-addend-change", scaffold: "supported",
    concept: "让中央两个数合起来是 5；上方或下方的格都可以点。",
    reflection: "移动一格后，中央的哪一个数变了？", reviewOf: ["es-1-01"]
  },
  {
    order: 3, targets: [6], columns: [[1, 2, 3], [3, 5, 4]], initialIndexes: [0, 0],
    objective: "区分算式成立与全关完成，让未亮数字也参加合成 6。",
    primarySkill: "success-and-coverage", scaffold: "supported",
    concept: "得到 6 以后，还要让没亮的数字也参加成立的算式。",
    reflection: "算式成立一次后，棋盘上还有哪些格没亮？", reviewOf: ["es-1-01"]
  },
  {
    order: 4, targets: [10], columns: [[2, 4, 7], [3, 8, 6]], initialIndexes: [1, 0],
    objective: "从一个部分反推另一个部分，发现 10 的互补数。",
    primarySkill: "make-ten-complements", scaffold: "supported",
    concept: "选一个数，想想它离 10 还差多少。",
    reflection: "看到一个部分，怎样想到另一个部分？", reviewOf: []
  },
  {
    order: 5, targets: [8], columns: [[2, 4, 6], [4, 2, 6]], initialIndexes: [2, 2],
    objective: "比较 2+6、6+2 和 4+4，发现交换加数不改变和。",
    primarySkill: "exchange-addends", scaffold: "supported",
    concept: "两个加数换个位置，总数会怎样？",
    reflection: "哪些不同位置的数字组成了相同的和？", reviewOf: []
  },
  {
    order: 6, targets: [9], columns: [[2, 3, 4], [5, 7, 6]], initialIndexes: [1, 0],
    objective: "比较 2+7、3+6、4+5，发现一增一减保持和不变。",
    primarySkill: "constant-sum-compensation", scaffold: "independent",
    concept: "总数不变时，一边多 1，另一边怎样变？",
    reflection: "两个部分怎样一起变化，才能保持总数不变？", reviewOf: ["es-1-04"]
  },
  {
    order: 7, targets: [6, 7], columns: [[1, 2, 3], [3, 4, 5]], initialIndexes: [2, 2],
    objective: "围绕未亮数字选择能合成 6 或 7 的伙伴，并分别命中两个目标。",
    primarySkill: "unlit-partner-choice", scaffold: "supported",
    concept: "6 和 7 都能点灯，找一个没亮的数字给它配伙伴。",
    reflection: "同一个数字可以参加哪些不同的成立组合？", reviewOf: ["es-1-03"]
  },
  {
    order: 8, targets: [6], columns: [[1, 2, 3], [1, 2, 3], [1, 2, 3]], initialIndexes: [0, 1, 0],
    objective: "用三个小数合成 6，比较不同位置的 1、2、3 与三个 2。",
    primarySkill: "three-small-parts", scaffold: "supported",
    concept: "先合起两个数，再看第三个数还差多少。",
    reflection: "保持和为 6 时，哪些数字可以交换位置？", reviewOf: ["es-1-05"]
  },
  {
    order: 9, targets: [6, 8], columns: [[1, 2, 3], [1, 2, 3], [1, 2, 4]], initialIndexes: [2, 2, 2],
    objective: "从未亮格和未命中的目标出发，选择合成 6 或 8 的三部分组合。",
    primarySkill: "three-part-coverage-choice", scaffold: "independent",
    concept: "先看没亮的格，再试它能组成 6 还是 8。",
    reflection: "下一组怎样同时照顾未亮格和还没命中的目标？", reviewOf: ["es-1-07", "es-1-08"]
  },
  {
    order: 10, targets: [8], columns: [[1, 2, 4], [1, 2, 4], [2, 3, 5]], initialIndexes: [0, 0, 0],
    objective: "选择未亮数字，把其余两部分配成需要的补数，合成 8。",
    primarySkill: "three-part-complement-choice", scaffold: "review",
    concept: "找一个还没亮的数字，另外两部分怎样配？",
    reflection: "哪两部分先合起来能帮助你找到另一部分？", reviewOf: ["es-1-04", "es-1-08"]
  },
  {
    order: 12, targets: [10], columns: [[1, 3, 4], [1, 2, 3], [3, 4, 6]], initialIndexes: [0, 0, 0],
    objective: "把两数补数经验迁移到三个部分，逐步让未亮格参加合成 10。",
    primarySkill: "three-part-make-ten-transfer", scaffold: "transfer",
    concept: "试着让没亮的格也参加凑 10。",
    reflection: "怎样用已经会的两数补数帮助三个部分凑 10？", reviewOf: ["es-1-04", "es-1-10", "es-1-11"]
  }
];

/** Apply only after the unchanged generator has diversified all 200 boards. */
export function applyGameplayPilot12(
  diversifiedLevels: readonly PublishedEquationSliderLevel[]
): readonly PublishedEquationSliderLevel[] {
  return diversifiedLevels.map((level) => {
    if (level.id === "es-1-11") {
      const { analysis: _analysis, ...originalDefinition } = level;
      return publishLevel({
        ...originalDefinition,
        learning: {
          ...level.learning,
          objective: "用不同的两个数合成 8，并观察加法中的部分与整体。（第 2 站迁移练习）",
          reflection: "哪两组数字交换了位置，但仍然得到 8？"
        },
        provenance: {
          kind: "hand-authored-gold",
          generatorVersion: PILOT_AUTHORING_VERSION,
          contentRevision: "slider-pilot-12-copy-r1",
          revisionSource: PILOT_REVISION_SOURCE
        }
      });
    }
    const board = PILOT_BOARDS.find((candidate) =>
      level.id === `es-1-${String(candidate.order).padStart(2, "0")}`
    );
    if (!board) return level;
    const { analysis: _analysis, targets: _targets, mode: _mode, ...originalDefinition } = level;
    const slots: ExpressionSlot[] = [];
    const names = board.columns.length === 2 ? ["left", "right"] : ["left", "middle", "right"];
    board.columns.forEach((values, index) => {
      if (index > 0) {
        slots.push({
          kind: "fixed-token", id: `${level.id}-plus-${index}`, token: "+",
          ariaLabel: `固定运算符：第 ${index} 个加号`
        });
      }
      const reelId = `${level.id}-${names[index]}`;
      const tile = (tileIndex: 0 | 1 | 2) => ({
        id: `${reelId}-n${tileIndex + 1}`, kind: "number" as const, value: values[tileIndex]
      });
      slots.push({
        kind: "movable-reel",
        reel: {
          id: reelId,
          kind: "number",
          tiles: [tile(0), tile(1), tile(2)]
        }
      });
    });
    const commonDefinition = {
      ...originalDefinition,
      challenge: "standard" as const,
      slots,
      initialIndexes: board.initialIndexes,
      requiredTileIds: slots.flatMap((slot) =>
        slot.kind === "movable-reel" ? slot.reel.tiles.map((tile) => tile.id) : []
      ),
      learning: {
        objective: board.objective,
        primarySkill: board.primarySkill,
        skillTags: ["addition", board.primarySkill, ...(board.columns.length === 3 ? ["three-addends"] : ["number-bonds"])],
        prerequisiteTags: ["recognize-1-to-10", "addition-within-10"],
        misconceptionTags: ["repeat-same-pair", "first-success-means-complete"],
        scaffold: board.scaffold,
        reviewOf: board.reviewOf,
        reflection: board.reflection,
        recommendedAgeBand: "约 6–7 岁"
      },
      hints: [
        { kind: "concept", text: board.concept },
        { kind: "position", text: "看看值得留意的那条滑轨里，哪些格还没亮。" },
        { kind: "direction", text: "按当前棋盘的下一步提示移动一格，再看中央算式。" }
      ] as const,
      provenance: {
        kind: "hand-authored-gold" as const,
        generatorVersion: PILOT_AUTHORING_VERSION,
        contentRevision: EQUATION_SLIDER_CONTENT_REVISIONS[level.id],
        revisionSource: PILOT_REVISION_SOURCE
      }
    };
    const target = (value: number) => ({ kind: "value" as const, id: `${level.id}-target-${value}`, value });
    return board.targets.length === 1
      ? publishLevel({ ...commonDefinition, mode: "target", targets: [target(board.targets[0])] })
      : publishLevel({
        ...commonDefinition,
        mode: "multi-target",
        targets: [target(board.targets[0]), target(board.targets[1])]
      });
  });
}
