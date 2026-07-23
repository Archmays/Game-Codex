import { evaluateExpression } from "../../evaluator";
import {
  enumerateArrangements,
  evaluateArrangementOutcome,
  publishLevel
} from "../../solver";
import type {
  ArithmeticOperator,
  ArithmeticToken,
  EquationSliderLevelDefinition,
  EquationTile,
  ExpressionSlot,
  HintStep,
  LearningMetadata,
  PublishedEquationSliderLevel,
  ScaffoldLevel
} from "../../types";

export const V3_GENERATOR_VERSION = "equation-slider-v3.0.0";
export const V3_GOLD_AUTHORING_VERSION = "authored-v3.0.0";

interface TemplateBase {
  readonly chapter: 1 | 2 | 3 | 4;
  readonly order: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  readonly objective: string;
  readonly primarySkill: string;
  readonly skillTags: readonly string[];
  readonly prerequisiteTags: readonly string[];
  readonly misconceptionTags: readonly string[];
  readonly reflection: string;
  readonly recommendedAgeBand: string;
  readonly scaffold: ScaffoldLevel;
  readonly reviewOf?: readonly string[];
  readonly conceptHint: string;
  readonly positionHint: string;
  readonly directionHint: string;
}

export interface PairSumTemplate extends TemplateBase {
  readonly family: "pair-sum";
  readonly target: number;
  readonly left: readonly [number, number, number];
  readonly variantStep?: number;
  readonly mode?: "target" | "equality";
  readonly rightExpression?: readonly ArithmeticToken[];
}

export interface PairDifferenceTemplate extends TemplateBase {
  readonly family: "pair-difference";
  readonly difference: number;
  readonly right: readonly [number, number, number];
  readonly variantStep?: number;
  readonly mode?: "target" | "equality";
  readonly rightExpression?: readonly ArithmeticToken[];
}

export interface PairProductTemplate extends TemplateBase {
  readonly family: "pair-product";
  readonly target: number;
  readonly left: readonly [number, number, number];
  readonly mode?: "target" | "equality";
  readonly rightExpression?: readonly ArithmeticToken[];
}

export interface PairQuotientTemplate extends TemplateBase {
  readonly family: "pair-quotient";
  readonly quotient: number;
  readonly denominators: readonly [number, number, number];
  readonly mode?: "target" | "equality";
  readonly rightExpression?: readonly ArithmeticToken[];
}

export interface ThreeNumberSumTemplate extends TemplateBase {
  readonly family: "three-number-sum";
  readonly target: number;
  readonly rows: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number]
  ];
  readonly mode?: "target" | "equality";
  readonly rightExpression?: readonly ArithmeticToken[];
}

export interface FourNumberSumTemplate extends TemplateBase {
  readonly family: "four-number-sum";
  readonly target: number;
  readonly rows: readonly [
    readonly [number, number, number, number],
    readonly [number, number, number, number],
    readonly [number, number, number, number]
  ];
  readonly mode?: "target" | "equality";
  readonly rightExpression?: readonly ArithmeticToken[];
}

export interface ThreeNumberDifferenceTemplate extends TemplateBase {
  readonly family: "three-number-difference";
  readonly target: number;
  readonly rows: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number]
  ];
  readonly mode?: "target" | "equality";
  readonly rightExpression?: readonly ArithmeticToken[];
}

export interface ThreeNumberProductTemplate extends TemplateBase {
  readonly family: "three-number-product";
  readonly target: number;
  readonly rows: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number]
  ];
  readonly mode?: "target" | "equality";
  readonly rightExpression?: readonly ArithmeticToken[];
}

export interface ThreeNumberQuotientTemplate extends TemplateBase {
  readonly family: "three-number-quotient";
  readonly target: number;
  readonly rows: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number]
  ];
  readonly mode?: "target" | "equality";
  readonly rightExpression?: readonly ArithmeticToken[];
}

export interface OperatorChoiceTemplate extends TemplateBase {
  readonly family: "operator-choice";
  readonly fixedLeft: number;
  readonly operators: readonly [ArithmeticOperator, ArithmeticOperator, ArithmeticOperator];
  readonly right: readonly [number, number, number];
}

export interface MixedThreeReelTemplate extends TemplateBase {
  readonly family: "mixed-three-reel";
  readonly left: readonly [number, number, number];
  readonly operators: readonly [ArithmeticOperator, ArithmeticOperator, ArithmeticOperator];
  readonly right: readonly [number, number, number];
}

export interface FourReelTemplate extends TemplateBase {
  readonly family: "four-reel";
  readonly target: number;
  readonly mode?: "target" | "equality";
  readonly rightExpression?: readonly ArithmeticToken[];
}

export interface FiveReelTemplate extends TemplateBase {
  readonly family: "five-reel";
  readonly target: number;
  readonly mode?: "target" | "equality";
  readonly rightExpression?: readonly ArithmeticToken[];
}

export type GoldTemplateSpec =
  | PairSumTemplate
  | PairDifferenceTemplate
  | PairProductTemplate
  | PairQuotientTemplate
  | ThreeNumberSumTemplate
  | FourNumberSumTemplate
  | ThreeNumberDifferenceTemplate
  | ThreeNumberProductTemplate
  | ThreeNumberQuotientTemplate
  | OperatorChoiceTemplate
  | MixedThreeReelTemplate
  | FourReelTemplate
  | FiveReelTemplate;

export function buildGoldLevel(template: GoldTemplateSpec): PublishedEquationSliderLevel {
  return buildLevel(template, 0);
}

export function generateLevelsFromGold(
  templates: readonly GoldTemplateSpec[]
): readonly PublishedEquationSliderLevel[] {
  return templates.flatMap((template) =>
    ([1, 2, 3, 4] as const).map((variant) => buildLevel(template, variant))
  );
}

export function buildCompleteV3Catalog(
  templates: readonly GoldTemplateSpec[],
  firstGoldLevel: PublishedEquationSliderLevel
): readonly PublishedEquationSliderLevel[] {
  const goldLevels = templates.map((template) =>
    `es-${template.chapter}-${String(template.order).padStart(2, "0")}` === firstGoldLevel.id
      ? firstGoldLevel
      : buildGoldLevel(template)
  );
  return diversifyInitialIndexes([
    ...goldLevels,
    ...generateLevelsFromGold(templates)
  ]);
}

export function diversifyInitialIndexes(
  levels: readonly PublishedEquationSliderLevel[]
): readonly PublishedEquationSliderLevel[] {
  const actionCounts = new Map<string, number>();
  const previousActionByStation = new Map<string, string>();
  const firstFourActionsByStation = new Map<string, Set<string>>();
  const diversified: PublishedEquationSliderLevel[] = [];
  const ordered = [...levels].sort((left, right) =>
    left.chapterId.localeCompare(right.chapterId) || left.order - right.order
  );

  for (const level of ordered) {
    const firstFourActions = firstFourActionsByStation.get(level.stationId) ?? new Set<string>();
    const candidates = initialIndexCandidates(level);
    const lockedFirstLevel = level.id === "es-1-01"
      ? candidates.find((candidate) => sameIndexes(candidate.indexes, level.initialIndexes))
      : undefined;
    const eligible = candidates.filter((candidate) =>
      (actionCounts.get(candidate.action) ?? 0) < 15
      && candidate.action !== previousActionByStation.get(level.stationId)
    );
    const pool = lockedFirstLevel
      ? [lockedFirstLevel]
      : eligible.length > 0
        ? eligible
        : candidates.filter((candidate) => (actionCounts.get(candidate.action) ?? 0) < 15);
    if (pool.length === 0) {
      throw new Error(`${level.id}: no initial arrangement can satisfy the canonical-action reuse gate`);
    }
    const selected = [...pool].sort((left, right) => {
      const firstFourNoveltyLeft = level.stationOrder <= 4 && !firstFourActions.has(left.action) ? 0 : 1;
      const firstFourNoveltyRight = level.stationOrder <= 4 && !firstFourActions.has(right.action) ? 0 : 1;
      return firstFourNoveltyLeft - firstFourNoveltyRight
        || (actionCounts.get(left.action) ?? 0) - (actionCounts.get(right.action) ?? 0)
        || Math.max(0, left.minimumMoves - 2) - Math.max(0, right.minimumMoves - 2)
        || left.minimumMoves - right.minimumMoves
        || left.action.localeCompare(right.action)
        || left.key.localeCompare(right.key);
    })[0];
    const { analysis: _analysis, ...definition } = level;
    const republished = publishLevel({
      ...definition,
      initialIndexes: selected.indexes
    } as EquationSliderLevelDefinition);
    diversified.push(republished);
    actionCounts.set(selected.action, (actionCounts.get(selected.action) ?? 0) + 1);
    previousActionByStation.set(level.stationId, selected.action);
    firstFourActions.add(selected.action);
    firstFourActionsByStation.set(level.stationId, firstFourActions);
  }
  return diversified;
}

function buildLevel(
  template: GoldTemplateSpec,
  variant: 0 | 1 | 2 | 3 | 4
): PublishedEquationSliderLevel {
  const order = variant * 10 + template.order;
  const levelId = `es-${template.chapter}-${String(order).padStart(2, "0")}`;
  const expression = buildExpression(template, variant, levelId);
  const definitionWithoutInitial: EquationSliderLevelDefinition = {
    schemaVersion: 3,
    id: levelId,
    chapterId: `chapter-${template.chapter}`,
    stationId: `chapter-${template.chapter}-station-${variant + 1}`,
    order,
    stationOrder: template.order,
    mode: expression.mode,
    challenge: "standard",
    slots: expression.slots,
    initialIndexes: new Array(countMovable(expression.slots)).fill(0),
    requiredTileIds: expression.slots.flatMap((slot) =>
      slot.kind === "movable-reel" ? slot.reel.tiles.map((tile) => tile.id) : []
    ),
    targets: expression.targets,
    learning: buildLearning(template, variant),
    hints: buildHints(template, variant),
    provenance: variant === 0
      ? {
          kind: "hand-authored-gold",
          generatorVersion: V3_GOLD_AUTHORING_VERSION
        }
      : {
          kind: "generated-from-gold",
          templateId: `es-${template.chapter}-${String(template.order).padStart(2, "0")}`,
          seed: `chapter-${template.chapter}:template-${template.order}:station-${variant + 1}`,
          generatorVersion: V3_GENERATOR_VERSION
        }
  } as EquationSliderLevelDefinition;

  const initialIndexes = enumerateArrangements(definitionWithoutInitial)
    .find((arrangement) => !evaluateArrangementOutcome(definitionWithoutInitial, arrangement.indexes).valid)
    ?.indexes;
  if (!initialIndexes) {
    throw new Error(`${levelId}: template has no invalid initial arrangement`);
  }
  return publishLevel({
    ...definitionWithoutInitial,
    initialIndexes
  });
}

function buildExpression(
  template: GoldTemplateSpec,
  variant: number,
  levelId: string
): Pick<EquationSliderLevelDefinition, "mode" | "slots" | "targets"> {
  switch (template.family) {
    case "pair-sum": {
      const offset = variant * (template.variantStep ?? 1);
      const target = template.target + offset * 2;
      const left = mapTriple(template.left, (value) => value + offset);
      const right = mapTriple(template.left, (value) => template.target - value + offset);
      return targetExpression(
        levelId,
        template.mode,
        target,
        [
          numberReel(levelId, "left", left),
          fixedOperator(levelId, "plus", "+", "固定运算符：加号"),
          numberReel(levelId, "right", right)
        ],
        variant === 0 ? template.rightExpression : undefined
      );
    }
    case "pair-difference": {
      const offset = variant * (template.variantStep ?? 1);
      const right = mapTriple(template.right, (value) => value + offset);
      const left = mapTriple(template.right, (value) => value + template.difference + offset);
      return targetExpression(
        levelId,
        template.mode,
        template.difference,
        [
          numberReel(levelId, "left", left),
          fixedOperator(levelId, "minus", "−", "固定运算符：减号"),
          numberReel(levelId, "right", right)
        ],
        variant === 0 ? template.rightExpression : undefined
      );
    }
    case "pair-product": {
      const scale = variant + 1;
      const target = template.target * scale;
      const left = mapTriple(template.left, (value) => value * scale);
      const right = mapTriple(template.left, (value) => template.target / value);
      return targetExpression(
        levelId,
        template.mode,
        target,
        [
          numberReel(levelId, "left", left),
          fixedOperator(levelId, "times", "×", "固定运算符：乘号"),
          numberReel(levelId, "right", right)
        ],
        variant === 0 ? template.rightExpression : undefined
      );
    }
    case "pair-quotient": {
      const quotient = template.quotient + variant;
      const numerators = mapTriple(template.denominators, (value) => value * quotient);
      return targetExpression(
        levelId,
        template.mode,
        quotient,
        [
          numberReel(levelId, "numerator", numerators),
          fixedOperator(levelId, "divide", "÷", "固定运算符：除号"),
          numberReel(levelId, "denominator", template.denominators)
        ],
        variant === 0 ? template.rightExpression : undefined
      );
    }
    case "three-number-sum": {
      const offsets = threeColumnOffsets(variant);
      const target = template.target + offsets.reduce((total, offset) => total + offset, 0);
      const columns = [0, 1, 2].map((column) =>
        template.rows.map((row) => row[column] + offsets[column]) as [number, number, number]
      ) as unknown as [
        readonly [number, number, number],
        readonly [number, number, number],
        readonly [number, number, number]
      ];
      return targetExpression(
        levelId,
        template.mode,
        target,
        [
          numberReel(levelId, "left", columns[0]),
          fixedOperator(levelId, "plus-a", "+", "固定运算符：第一个加号"),
          numberReel(levelId, "middle", columns[1]),
          fixedOperator(levelId, "plus-b", "+", "固定运算符：第二个加号"),
          numberReel(levelId, "right", columns[2])
        ],
        variant === 0 ? template.rightExpression : undefined
      );
    }
    case "four-number-sum": {
      const offsets = fourColumnOffsets(variant);
      const target = template.target + offsets.reduce((total, offset) => total + offset, 0);
      const columns = [0, 1, 2, 3].map((column) =>
        template.rows.map((row) => row[column] + offsets[column]) as [number, number, number]
      ) as unknown as [
        readonly [number, number, number],
        readonly [number, number, number],
        readonly [number, number, number],
        readonly [number, number, number]
      ];
      return targetExpression(
        levelId,
        template.mode,
        target,
        [
          numberReel(levelId, "number-a", columns[0]),
          fixedOperator(levelId, "plus-a", "+", "固定运算符：第一个加号"),
          numberReel(levelId, "number-b", columns[1]),
          fixedOperator(levelId, "plus-b", "+", "固定运算符：第二个加号"),
          numberReel(levelId, "number-c", columns[2]),
          fixedOperator(levelId, "plus-c", "+", "固定运算符：第三个加号"),
          numberReel(levelId, "number-d", columns[3])
        ],
        variant === 0 ? template.rightExpression : undefined
      );
    }
    case "three-number-difference": {
      const offset = variant;
      const target = template.target + offset;
      const columns = transposeThreeRows(template.rows, (value) => value + offset);
      return targetExpression(
        levelId,
        template.mode,
        target,
        [
          numberReel(levelId, "minuend", columns[0]),
          fixedOperator(levelId, "minus", "−", "固定运算符：减号"),
          numberReel(levelId, "subtrahend", columns[1]),
          fixedOperator(levelId, "plus", "+", "固定运算符：加号"),
          numberReel(levelId, "adjustment", columns[2])
        ],
        variant === 0 ? template.rightExpression : undefined
      );
    }
    case "three-number-product": {
      const scale = variant + 1;
      const target = template.target * scale;
      const columns = transposeThreeRows(template.rows, (value, column) =>
        column === 0 ? value * scale : value
      );
      return targetExpression(
        levelId,
        template.mode,
        target,
        [
          numberReel(levelId, "factor-a", columns[0]),
          fixedOperator(levelId, "times-a", "×", "固定运算符：第一个乘号"),
          numberReel(levelId, "factor-b", columns[1]),
          fixedOperator(levelId, "times-b", "×", "固定运算符：第二个乘号"),
          numberReel(levelId, "factor-c", columns[2])
        ],
        variant === 0 ? template.rightExpression : undefined
      );
    }
    case "three-number-quotient": {
      const offset = variant;
      const target = template.target + offset;
      const columns = transposeThreeRows(template.rows, (value, column) =>
        column === 2 ? value + offset : value
      );
      return targetExpression(
        levelId,
        template.mode,
        target,
        [
          numberReel(levelId, "dividend", columns[0]),
          fixedOperator(levelId, "divide", "÷", "固定运算符：除号"),
          numberReel(levelId, "divisor", columns[1]),
          fixedOperator(levelId, "plus", "+", "固定运算符：加号"),
          numberReel(levelId, "remainder-part", columns[2])
        ],
        variant === 0 ? template.rightExpression : undefined
      );
    }
    case "operator-choice": {
      const offset = variant;
      const fixedLeft = template.fixedLeft + offset;
      const right = mapTriple(template.right, (value) => value + offset);
      const targets = diagonalResults(
        [fixedLeft, fixedLeft, fixedLeft],
        template.operators,
        right,
        levelId
      );
      return {
        mode: "multi-target",
        slots: [
          fixedNumber(levelId, "left", fixedLeft, `固定数字：${fixedLeft}`),
          operatorReel(levelId, "operator", template.operators),
          numberReel(levelId, "right", right)
        ],
        targets: targets.map((value, index) => ({
          kind: "value",
          id: `${levelId}-target-${index + 1}`,
          value
        })) as unknown as EquationSliderLevelDefinition["targets"]
      };
    }
    case "mixed-three-reel": {
      const offset = variant;
      const left = mapTriple(template.left, (value) => value + offset);
      const right = mapTriple(template.right, (value) => value + offset);
      const targets = diagonalResults(left, template.operators, right, levelId);
      return {
        mode: "multi-target",
        slots: [
          numberReel(levelId, "left", left),
          operatorReel(levelId, "operator", template.operators),
          numberReel(levelId, "right", right)
        ],
        targets: targets.map((value, index) => ({
          kind: "value",
          id: `${levelId}-target-${index + 1}`,
          value
        })) as unknown as EquationSliderLevelDefinition["targets"]
      };
    }
    case "four-reel": {
      const target = template.target + variant * 3;
      const isAddSubtractChapter = template.chapter === 2;
      const left = isAddSubtractChapter
        ? [2 + variant, target + 2, 3 + variant] as const
        : [2 + variant, target + 2, target - 6 - variant * 2] as const;
      const middle = isAddSubtractChapter
        ? [3 + variant, 2 + variant, 4 + variant] as const
        : [3 + variant, 2 + variant, 2] as const;
      const operators = isAddSubtractChapter
        ? ["+", "−", "+"] as const
        : ["+", "−", "×"] as const;
      const right = isAddSubtractChapter
        ? [template.target - 5 + variant, 4 + variant, template.target - 7 + variant] as const
        : [template.target - 5 + variant, 4 + variant, 3 + variant] as const;
      return targetExpression(
        levelId,
        template.mode,
        target,
        [
          numberReel(levelId, "left", left),
          fixedOperator(levelId, "plus", "+", "固定运算符：加号"),
          numberReel(levelId, "middle", middle),
          operatorReel(levelId, "operator", operators),
          numberReel(levelId, "right", right)
        ],
        variant === 0 ? template.rightExpression : undefined
      );
    }
    case "five-reel": {
      const target = template.target + variant * 2;
      const left = [2 + variant, target - 2, 4 + variant] as const;
      const firstOperators = ["+", "−", "×"] as const;
      const middle = [3 + variant, 2 + variant, 3] as const;
      const secondOperators = ["+", "+", "−"] as const;
      const right = [template.target - 5, 4 + variant, 12 - template.target + variant] as const;
      return targetExpression(
        levelId,
        template.mode,
        target,
        [
          numberReel(levelId, "left", left),
          operatorReel(levelId, "operator-a", firstOperators),
          numberReel(levelId, "middle", middle),
          operatorReel(levelId, "operator-b", secondOperators),
          numberReel(levelId, "right", right)
        ],
        variant === 0 ? template.rightExpression : undefined
      );
    }
  }
}

function targetExpression(
  levelId: string,
  mode: "target" | "equality" | undefined,
  target: number,
  slots: readonly ExpressionSlot[],
  authoredRightExpression?: readonly ArithmeticToken[]
): Pick<EquationSliderLevelDefinition, "mode" | "slots" | "targets"> {
  if (mode === "equality") {
    return {
      mode: "equality",
      slots,
      targets: [{
        kind: "equality",
        id: `${levelId}-equality`,
        rightExpression: authoredRightExpression ?? [target]
      }]
    };
  }
  return {
    mode: "target",
    slots,
    targets: [{ kind: "value", id: `${levelId}-target-${target}`, value: target }]
  };
}

function buildLearning(template: GoldTemplateSpec, variant: number): LearningMetadata {
  const scaffoldByVariant: readonly ScaffoldLevel[] = [
    template.scaffold,
    "supported",
    "independent",
    "review",
    "transfer"
  ];
  return {
    objective: variant === 0
      ? template.objective
      : `${template.objective}（第 ${variant + 1} 站迁移练习）`,
    primarySkill: template.primarySkill,
    skillTags: [...template.skillTags],
    prerequisiteTags: [...template.prerequisiteTags],
    misconceptionTags: [...template.misconceptionTags],
    scaffold: scaffoldByVariant[variant] ?? "transfer",
    reviewOf: variant === 0
      ? [...(template.reviewOf ?? [])]
      : [`es-${template.chapter}-${String(template.order).padStart(2, "0")}`],
    reflection: template.reflection,
    recommendedAgeBand: template.recommendedAgeBand
  };
}

function buildHints(
  template: GoldTemplateSpec,
  variant: number
): readonly [HintStep, HintStep, HintStep] {
  const suffix = variant === 0 ? "" : " 数字变了，关系没有变。";
  return [
    { kind: "concept", text: `${template.conceptHint}${suffix}` },
    { kind: "position", text: template.positionHint },
    { kind: "direction", text: template.directionHint }
  ];
}

function numberReel(
  levelId: string,
  name: string,
  values: readonly [number, number, number]
): Extract<ExpressionSlot, { kind: "movable-reel" }> {
  return {
    kind: "movable-reel",
    reel: {
      id: `${levelId}-${name}`,
      kind: "number",
      tiles: values.map((value, index) =>
        numberTile(`${levelId}-${name}-n${index + 1}`, value)
      ) as unknown as readonly [EquationTile, EquationTile, EquationTile]
    }
  };
}

function operatorReel(
  levelId: string,
  name: string,
  values: readonly [ArithmeticOperator, ArithmeticOperator, ArithmeticOperator]
): Extract<ExpressionSlot, { kind: "movable-reel" }> {
  return {
    kind: "movable-reel",
    reel: {
      id: `${levelId}-${name}`,
      kind: "operator",
      tiles: values.map((value, index) => ({
        id: `${levelId}-${name}-o${index + 1}`,
        kind: "operator" as const,
        value
      })) as unknown as readonly [EquationTile, EquationTile, EquationTile]
    }
  };
}

function fixedOperator(
  levelId: string,
  name: string,
  token: ArithmeticOperator,
  ariaLabel: string
): Extract<ExpressionSlot, { kind: "fixed-token" }> {
  return {
    kind: "fixed-token",
    id: `${levelId}-${name}`,
    token,
    ariaLabel
  };
}

function fixedNumber(
  levelId: string,
  name: string,
  token: number,
  ariaLabel: string
): Extract<ExpressionSlot, { kind: "fixed-token" }> {
  return {
    kind: "fixed-token",
    id: `${levelId}-${name}`,
    token,
    ariaLabel
  };
}

function numberTile(id: string, value: number): EquationTile {
  return { id, kind: "number", value };
}

function diagonalResults(
  left: readonly [number, number, number],
  operators: readonly [ArithmeticOperator, ArithmeticOperator, ArithmeticOperator],
  right: readonly [number, number, number],
  levelId: string
): readonly [number, number, number] {
  const values = left.map((value, index) => {
    const result = evaluateExpression([value, operators[index], right[index]]);
    if (!result.ok) throw new Error(`${levelId}: invalid diagonal expression at ${index}`);
    return result.value;
  }) as [number, number, number];
  if (new Set(values).size !== 3) {
    throw new Error(`${levelId}: diagonal multi-target values must be distinct`);
  }
  return values;
}

function mapTriple(
  values: readonly [number, number, number],
  map: (value: number, index: number) => number
): readonly [number, number, number] {
  return values.map(map) as unknown as readonly [number, number, number];
}

function threeColumnOffsets(variant: number): readonly [number, number, number] {
  return [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 1],
    [1, 1, 1],
    [2, 1, 1]
  ][variant] as unknown as readonly [number, number, number];
}

function fourColumnOffsets(variant: number): readonly [number, number, number, number] {
  return [
    [0, 0, 0, 0],
    [1, 0, 0, 0],
    [0, 1, 1, 0],
    [1, 1, 1, 0],
    [1, 1, 1, 1]
  ][variant] as unknown as readonly [number, number, number, number];
}

function transposeThreeRows(
  rows: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number]
  ],
  map: (value: number, column: number, row: number) => number
): readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number]
] {
  return [0, 1, 2].map((column) =>
    rows.map((row, rowIndex) => map(row[column], column, rowIndex))
  ) as unknown as readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number]
  ];
}

function initialIndexCandidates(
  level: PublishedEquationSliderLevel
): readonly {
  readonly indexes: readonly number[];
  readonly key: string;
  readonly action: string;
  readonly minimumMoves: number;
}[] {
  const validKeys = new Set(level.analysis.validArrangements.map((arrangement) => arrangement.key));
  return enumerateArrangements(level)
    .filter((arrangement) => !validKeys.has(arrangement.indexes.join(".")))
    .map((arrangement) => {
      const first = [...level.analysis.validArrangements].sort((left, right) =>
        cyclicMoveDistance(arrangement.indexes, left.indexes)
          - cyclicMoveDistance(arrangement.indexes, right.indexes)
        || left.key.localeCompare(right.key)
      )[0];
      if (!first) throw new Error(`${level.id}: no valid arrangement for initial-index selection`);
      return {
        indexes: arrangement.indexes,
        key: arrangement.indexes.join("."),
        action: first.indexes.map((target, reelIndex) =>
          shortestActionCode(arrangement.indexes[reelIndex], target)
        ).join("."),
        minimumMoves: cyclicMoveDistance(arrangement.indexes, first.indexes)
      };
    });
}

function cyclicMoveDistance(from: readonly number[], to: readonly number[]): number {
  return from.reduce((total, current, index) => {
    const target = to[index] ?? current;
    const direct = Math.abs(target - current);
    return total + Math.min(direct, 3 - direct);
  }, 0);
}

function shortestActionCode(current: number, target: number): "stay" | "up" | "down" {
  if (current === target) return "stay";
  const upSteps = (current - target + 3) % 3;
  const downSteps = (target - current + 3) % 3;
  return upSteps <= downSteps ? "up" : "down";
}

function sameIndexes(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function countMovable(slots: readonly ExpressionSlot[]): number {
  return slots.filter((slot) => slot.kind === "movable-reel").length;
}
