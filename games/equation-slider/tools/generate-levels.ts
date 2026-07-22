import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateExpression, formatExpression } from "../evaluator";
import {
  SOLVER_VERSION,
  canonicalStructureSignature,
  enumerateArrangements,
  getArrangementTokens,
  solveLevel,
  solutionTopologySignature
} from "../solver";
import type {
  ArithmeticOperator,
  ArithmeticToken,
  ChallengeKind,
  EquationReel,
  EquationSliderLevelDefinition,
  LevelMode,
  PublishedEquationSliderLevel,
  ScaffoldLevel
} from "../types";

const GENERATOR_VERSION = "1.2.0";
const GENERATED_ON = "2026-07-23";
const DEFAULT_POOL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const SMALL_POOL = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
const TWENTY_POOL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;

interface UnitBlueprint {
  readonly chapter: 1 | 2 | 3 | 4;
  readonly unit: 1 | 2 | 3 | 4 | 5;
  readonly name: string;
  readonly primarySkill: string;
  readonly skillTags: readonly string[];
  readonly misconceptionTags: readonly string[];
  readonly reviewOf: readonly string[];
  readonly hint: string;
  readonly age: string;
  readonly operators: readonly ArithmeticOperator[];
  readonly numberPools: readonly (readonly number[])[];
  readonly resultMin: number;
  readonly resultMax: number;
  readonly fixedResult?: number;
}

interface ExpressionRecord {
  readonly tokens: readonly ArithmeticToken[];
  readonly result: number;
  readonly key: string;
}

interface GeneratedAudit {
  readonly generatedOn: string;
  readonly generatorVersion: string;
  readonly solverVersion: string;
  readonly totalLevels: number;
  readonly levelsPerChapter: Readonly<Record<string, number>>;
  readonly modes: Readonly<Record<string, number>>;
  readonly scaffoldLevels: Readonly<Record<string, number>>;
  readonly targetValues: Readonly<Record<string, number>>;
  readonly operatorOccurrences: Readonly<Record<string, number>>;
  readonly difficultyBands: Readonly<Record<string, number>>;
  readonly minimumSolutionSteps: Readonly<Record<string, number>>;
  readonly averageCompositeDifficulty: number;
  readonly initialDistanceDistribution: Readonly<Record<string, number>>;
  readonly trivialAlignedCompleteCovers: number;
  readonly nonTrivialCoverageLevels: number;
  readonly maximumGenerationAttempt: number;
  readonly perChapter: Readonly<Record<string, {
    readonly modes: Readonly<Record<string, number>>;
    readonly targetValues: Readonly<Record<string, number>>;
    readonly operatorOccurrences: Readonly<Record<string, number>>;
    readonly difficultyBands: Readonly<Record<string, number>>;
    readonly minimumSolutionSteps: Readonly<Record<string, number>>;
    readonly averageCompositeDifficulty: number;
  }>>;
  readonly uniqueChallenges: number;
  readonly solverValidated: number;
  readonly orphanTiles: number;
  readonly unsolvableLevels: number;
  readonly exactDuplicateStructures: number;
  readonly maximumTopologyReusePerChapter: number;
  readonly threeReelTwoTileCohort: number;
  readonly threeReelTwoTilePlanCounts: Readonly<Record<string, number>>;
  readonly maximumThreeReelTwoTilePlanReuse: number;
  readonly maximumThreeReelTwoTileTopologyReusePerChapter: number;
  readonly maximumConsecutiveCanonicalPlanReuse: number;
  readonly openingPlanDiversityMinimum: number;
}

const BLUEPRINTS: readonly UnitBlueprint[] = [
  unit(1, 1, "小数合成站", "part-whole", ["part-whole", "addition"], ["center-line-selection", "part-whole-confusion"], ["counting", "number-pairs"], "先看中央线上的两个数，它们合起来是多少？", "约 6–7 岁", ["+"], [SMALL_POOL, SMALL_POOL, SMALL_POOL], 2, 8),
  unit(1, 2, "组成 10 站", "make-ten", ["make-ten", "commutative-addition"], ["addition-order-matters", "valid-without-new-coverage"], ["part-whole", "addition"], "找一对合起来正好是 10 的数。", "约 6–7 岁", ["+"], [DEFAULT_POOL, DEFAULT_POOL, DEFAULT_POOL], 10, 10, 10),
  unit(1, 3, "跨十桥站", "within-20-addition", ["within-20-addition", "make-ten", "two-step"], ["make-ten-remainder-loss", "center-line-selection"], ["make-ten", "part-whole"], "能不能先凑成 10，再把剩下的数加上？", "约 6–8 岁", ["+"], [DEFAULT_POOL, DEFAULT_POOL, DEFAULT_POOL], 8, 20),
  unit(1, 4, "灵活凑整站", "compensation", ["compensation", "coverage-strategy", "addition"], ["valid-without-new-coverage", "target-vs-coverage"], ["make-ten", "within-20-addition"], "先找容易凑整的一组，再看看哪些灯还没有亮。", "约 6–8 岁", ["+"], [DEFAULT_POOL, DEFAULT_POOL, DEFAULT_POOL], 10, 24),
  unit(1, 5, "加法总站", "addition-transfer", ["addition-transfer", "coverage-strategy", "make-ten"], ["target-vs-coverage", "shortest-path-as-mastery"], ["part-whole", "make-ten", "within-20-addition", "compensation"], "想一想：这关更适合组成 10，还是先凑整？", "约 6–8 岁", ["+"], [DEFAULT_POOL, DEFAULT_POOL, DEFAULT_POOL], 8, 28),

  unit(2, 1, "拿走站", "take-away", ["take-away", "subtraction"], ["subtraction-order", "take-away-vs-difference"], ["part-whole", "addition"], "从较大的数量里拿走一部分，还剩多少？", "约 6–8 岁", ["−"], [TWENTY_POOL, TWENTY_POOL, TWENTY_POOL], 0, 10),
  unit(2, 2, "相差站", "difference", ["difference", "subtraction"], ["subtraction-order", "take-away-vs-difference"], ["take-away", "part-whole"], "比较两个数，看看它们相差多少。", "约 6–8 岁", ["−"], [TWENTY_POOL, TWENTY_POOL, TWENTY_POOL], 1, 12),
  unit(2, 3, "算式家族站", "fact-family", ["fact-family", "inverse-operations", "make-ten"], ["fact-family-disconnection", "addition-order-matters"], ["make-ten", "take-away", "difference"], "哪个加法关系能帮助你检查这个减法？", "约 6–8 岁", ["+", "−"], [TWENTY_POOL, TWENTY_POOL, TWENTY_POOL], 0, 20),
  unit(2, 4, "两步换轨站", "left-to-right-add-sub", ["left-to-right-add-sub", "two-step"], ["left-to-right-add-sub", "subtraction-order"], ["fact-family", "difference"], "只有加减时，从左往右一步一步算。", "约 7–9 岁", ["+", "−"], [TWENTY_POOL, TWENTY_POOL, TWENTY_POOL], 0, 24),
  unit(2, 5, "加减总站", "add-sub-transfer", ["add-sub-transfer", "coverage-strategy", "inverse-operations"], ["target-vs-coverage", "shortest-path-as-mastery"], ["make-ten", "difference", "fact-family", "left-to-right-add-sub"], "先判断是加、减还是两步关系，再规划没有点亮的方块。", "约 7–9 岁", ["+", "−"], [TWENTY_POOL, TWENTY_POOL, TWENTY_POOL], 0, 28),

  unit(3, 1, "二五十工坊", "times-2-5-10", ["multiplication-groups", "times-2-5-10"], ["multiplication-as-addition", "unequal-groups"], ["repeated-addition", "addition"], "想一想有几组，每组有几个。", "约 7–9 岁", ["×"], [[1, 2, 4, 5, 6, 8, 10], [1, 2, 4, 5, 6, 8, 10], [1, 2, 4, 5, 6, 8, 10]], 2, 80),
  unit(3, 2, "三四六工坊", "multiplication-facts", ["multiplication-facts", "doubling"], ["multiplication-as-addition", "addition-order-matters"], ["times-2-5-10", "multiplication-groups"], "能不能用一个已经知道的乘法事实来推一推？", "约 7–10 岁", ["×"], [[2, 3, 4, 5, 6, 7, 8, 9], [2, 3, 4, 5, 6, 7, 8, 9], [2, 3, 4, 5, 6, 7, 8, 9]], 6, 81),
  unit(3, 3, "平均分站", "exact-division", ["exact-division", "equal-sharing"], ["division-order", "division-must-be-exact"], ["multiplication-facts", "multiplication-groups"], "先看总数能不能平均分成整数份。", "约 7–10 岁", ["÷"], [[4, 6, 8, 10, 12, 14, 15, 16, 18, 20, 21, 24, 27, 30, 32, 36, 40, 42, 48, 54, 60], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], DEFAULT_POOL], 1, 12),
  unit(3, 4, "乘除互逆站", "multiply-divide-inverse", ["multiply-divide-inverse", "inverse-operations"], ["inverse-operation-disconnection", "division-order"], ["exact-division", "multiplication-facts", "addition", "subtraction"], "哪个乘法事实能帮你检查这个除法？", "约 7–10 岁", ["×", "÷", "+", "−"], [[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24], [1, 2, 3, 4, 5, 6, 8, 10, 12], DEFAULT_POOL], 1, 48),
  unit(3, 5, "顺序工坊", "order-of-operations", ["order-of-operations", "mixed-operations"], ["order-of-operations", "division-must-be-exact"], ["multiply-divide-inverse", "make-ten", "left-to-right-add-sub"], "加减和乘除在一起时，先找乘除。", "约 8–10 岁", ["+", "−", "×", "÷"], [DEFAULT_POOL, DEFAULT_POOL, DEFAULT_POOL], 0, 60),

  unit(4, 1, "多目标站", "multi-target", ["multi-target", "coverage-planning"], ["target-vs-coverage", "valid-without-new-coverage"], ["addition-transfer", "mixed-operations"], "目标清单和方块灯都要完成，先看看还缺哪一项。", "约 8–10 岁", ["+", "−", "×", "÷"], [DEFAULT_POOL, DEFAULT_POOL, DEFAULT_POOL], 0, 60),
  unit(4, 2, "等式平衡站", "equal-sign", ["equal-sign", "balance"], ["equal-sign-as-answer", "order-of-operations"], ["multi-target", "inverse-operations"], "分别算等号左右两边，再比较它们相差多少。", "约 8–10 岁", ["+", "−", "×", "÷"], [DEFAULT_POOL, DEFAULT_POOL, DEFAULT_POOL], 0, 60),
  unit(4, 3, "综合策略站", "coverage-strategy", ["mixed-operations", "coverage-strategy"], ["value-vs-tile-identity", "valid-without-new-coverage"], ["multi-target", "equal-sign", "order-of-operations"], "结果成立以后，再检查这一步有没有点亮新方块。", "约 8–10 岁", ["+", "−", "×", "÷"], [DEFAULT_POOL, DEFAULT_POOL, DEFAULT_POOL], 0, 72),
  unit(4, 4, "唯一路线站", "unique-route", ["unique-route", "deductive-reasoning"], ["shortest-path-as-mastery", "value-vs-tile-identity"], ["coverage-strategy", "multi-target", "equal-sign"], "排除只会重复覆盖的路线，保留能完成全图的组合。", "约 8–10 岁", ["+", "−", "×", "÷"], [DEFAULT_POOL, DEFAULT_POOL, DEFAULT_POOL], 0, 72),
  unit(4, 5, "全线路总站", "cross-chapter-transfer", ["cross-chapter-transfer", "equation-reasoning"], ["target-vs-coverage", "order-of-operations", "equal-sign-as-answer"], ["make-ten", "difference", "multiply-divide-inverse", "order-of-operations", "equal-sign"], "先认清模式，再选最适合的四则关系。", "约 8–10 岁", ["+", "−", "×", "÷"], [DEFAULT_POOL, DEFAULT_POOL, DEFAULT_POOL], 0, 72)
];

const expressionCache = new Map<string, ReadonlyMap<number, readonly ExpressionRecord[]>>();

export function generatePublishedLevels(): readonly PublishedEquationSliderLevel[] {
  const levels: PublishedEquationSliderLevel[] = [];
  const structureSignatures = new Set<string>();
  const topologyCountsByChapter = new Map<string, Map<string, number>>();

  for (const blueprint of BLUEPRINTS) {
    for (let local = 1; local <= 10; local += 1) {
      const chapterLevel = (blueprint.unit - 1) * 10 + local;
      const id = `es-${blueprint.chapter}-${String(chapterLevel).padStart(2, "0")}`;
      let published: PublishedEquationSliderLevel | null = null;

      for (let attempt = 0; attempt < 6000 && !published; attempt += 1) {
        const seed = `${id}:${attempt}`;
        const random = createRandom(seed);
        const mode = modeFor(blueprint.chapter, blueprint.unit, local);
        const challenge = challengeFor(blueprint.chapter, blueprint.unit, local);
        const { reelCount, tileCount, familyVariant } = shapeFor(blueprint, local, challenge, mode, attempt);
        const candidate = createCandidateLevel(
          blueprint,
          local,
          mode,
          challenge,
          reelCount,
          tileCount,
          familyVariant,
          seed,
          random
        );
        if (!candidate) {
          continue;
        }
        const provisional = solveLevel(candidate);
        if (provisional.status !== "solved" || !provisional.difficultyMetrics) {
          continue;
        }
        const desiredInitialDistance = local <= 2 ? 1 : local <= 4 ? 2 : 2 + ((local + attempt) % 2);
        const initial = chooseInitialArrangement(
          candidate,
          provisional.validArrangements,
          desiredInitialDistance,
          random
        );
        if (!initial) {
          continue;
        }
        const withInitial: EquationSliderLevelDefinition = {
          ...candidate,
          reels: candidate.reels.map((reel, index) => ({ ...reel, initialIndex: initial[index] }))
        };
        const analysis = solveLevel(withInitial);
        if (
          analysis.status !== "solved"
          || !analysis.difficultyMetrics
          || analysis.minimumCorrectExpressions === null
          || analysis.minimumCorrectExpressions < 2
          || analysis.minimumCorrectExpressions > 5
          || analysis.difficultyMetrics.invalidArrangementRatio <= 0
          || hasTrivialAlignedCompleteCover(withInitial, analysis.validArrangements)
          || (
            requiresNonTrivialCoverage(blueprint, local, challenge, reelCount, tileCount)
            && analysis.minimumCorrectExpressions <= tileCount
          )
          || (challenge === "unique-minimum-cover" && analysis.minimumCoverSetCountCapped !== 1)
          || (
            challenge === "unique-minimum-cover"
            && blueprint.chapter === 4
            && blueprint.unit === 4
            && local >= 7
            && (
              analysis.minimumCorrectExpressions < 3
              || analysis.validArrangements.length <= analysis.minimumCorrectExpressions
            )
          )
        ) {
          continue;
        }
        const canonicalRows = expressionRowsForPlan(withInitial, analysis.canonicalPlan.map((step) => step.indexes));
        if (!rowsMatchUnitSemantics(blueprint, canonicalRows, local)) {
          continue;
        }
        const canonicalPlan = analysis.canonicalPlan.map((step) => [...step.indexes]);
        const canonicalPlanKey = planIndexSignature(canonicalPlan);
        const recentUnitLevels = levels.filter((level) => level.unitId === `chapter-${blueprint.chapter}-unit-${blueprint.unit}`).slice(-2);
        if (
          recentUnitLevels.length === 2
          && recentUnitLevels.every((level) => canonicalPlanSignature(level) === canonicalPlanKey)
        ) {
          continue;
        }
        const structureSignature = canonicalStructureSignature(withInitial);
        if (structureSignatures.has(structureSignature)) {
          continue;
        }
        const topologySignature = solutionTopologySignature(withInitial, analysis);
        const chapterId = `chapter-${blueprint.chapter}`;
        const topologyCounts = topologyCountsByChapter.get(chapterId) ?? new Map<string, number>();
        if ((topologyCounts.get(topologySignature) ?? 0) >= 8) {
          continue;
        }
        const recentChapterLevels = levels.filter((level) => level.chapterId === chapterId).slice(-6);
        if (
          recentChapterLevels.length === 6
          && recentChapterLevels.every((level) => level.analysis.topologySignature === topologySignature)
        ) {
          continue;
        }

        structureSignatures.add(structureSignature);
        topologyCounts.set(topologySignature, (topologyCounts.get(topologySignature) ?? 0) + 1);
        topologyCountsByChapter.set(chapterId, topologyCounts);
        const condition = withInitial as unknown as Pick<EquationSliderLevelDefinition, "mode"> & Record<string, unknown>;
        const resultLabel = resultLabelForLevel(withInitial);
        published = {
          ...withInitial,
          learning: {
            ...withInitial.learning,
            learningObjective: buildLearningObjective(blueprint, condition, canonicalRows, reelCount, resultLabel),
            reflectionText: buildReflectionText(blueprint, condition, canonicalRows, resultLabel)
          },
          provenance: {
            ...withInitial.provenance,
            familyId: buildSemanticFamilyId(blueprint, condition, canonicalRows, reelCount, tileCount)
          },
          analysis: {
            solverVersion: SOLVER_VERSION,
            solvable: true,
            orphanTileIds: [],
            canonicalPlan,
            difficultyMetrics: analysis.difficultyMetrics,
            structureSignature,
            topologySignature
          }
        };
      }

      if (!published) {
        throw new Error(`Unable to generate an accepted level for ${id}`);
      }
      levels.push(published);
    }
  }

  return levels;
}

export function buildGeneratedAudit(levels: readonly PublishedEquationSliderLevel[]): GeneratedAudit {
  const levelsPerChapter = countBy(levels, (level) => level.chapterId);
  const scaffoldLevels = countBy(levels, (level) => level.learning.scaffoldLevel);
  const structureCounts = countBy(levels, (level) => level.analysis.structureSignature);
  const distributions = buildDistributions(levels);
  const perChapter = Object.fromEntries([1, 2, 3, 4].map((chapter) => {
    const chapterId = `chapter-${chapter}`;
    return [chapterId, buildDistributions(levels.filter((level) => level.chapterId === chapterId))];
  }));
  const topologyMax = Math.max(
    ...[1, 2, 3, 4].map((chapter) => {
      const chapterLevels = levels.filter((level) => level.chapterId === `chapter-${chapter}`);
      const counts = Object.values(countBy(chapterLevels, (level) => level.analysis.topologySignature));
      return Math.max(0, ...counts);
    })
  );
  const threeReelTwoTileLevels = levels.filter(isThreeReelTwoTileCohort);
  const threeReelTwoTilePlanCounts = countBy(threeReelTwoTileLevels, canonicalPlanSignature);
  const maximumThreeReelTwoTilePlanReuse = Math.max(0, ...Object.values(threeReelTwoTilePlanCounts));
  const maximumThreeReelTwoTileTopologyReusePerChapter = maximumGroupedReuse(
    threeReelTwoTileLevels,
    (level) => level.chapterId,
    (level) => level.analysis.topologySignature
  );
  const maximumConsecutiveCanonicalPlanReuse = maximumConsecutiveReuse(
    levels,
    (level) => level.unitId,
    canonicalPlanSignature
  );
  const openingPlanDiversityMinimum = Math.min(
    ...[...new Set(levels.map((level) => level.unitId))].map((unitId) => {
      return new Set(levels
        .filter((level) => level.unitId === unitId)
        .slice(0, 4)
        .map(canonicalPlanSignature)).size;
    })
  );
  const solved = levels.map((level) => solveLevel(level));
  return {
    generatedOn: GENERATED_ON,
    generatorVersion: GENERATOR_VERSION,
    solverVersion: SOLVER_VERSION,
    totalLevels: levels.length,
    levelsPerChapter,
    scaffoldLevels,
    ...distributions,
    perChapter,
    uniqueChallenges: levels.filter((level) => level.challenge === "unique-minimum-cover").length,
    solverValidated: levels.length,
    orphanTiles: levels.reduce((count, level) => count + level.analysis.orphanTileIds.length, 0),
    unsolvableLevels: 0,
    exactDuplicateStructures: Object.values(structureCounts).filter((count) => count > 1).length,
    maximumTopologyReusePerChapter: topologyMax,
    threeReelTwoTileCohort: threeReelTwoTileLevels.length,
    threeReelTwoTilePlanCounts,
    maximumThreeReelTwoTilePlanReuse,
    maximumThreeReelTwoTileTopologyReusePerChapter,
    maximumConsecutiveCanonicalPlanReuse,
    openingPlanDiversityMinimum,
    initialDistanceDistribution: countBy(
      levels,
      (level) => String(level.analysis.difficultyMetrics.initialToFirstValidMoves)
    ),
    trivialAlignedCompleteCovers: levels.filter((level, index) => {
      return hasTrivialAlignedCompleteCover(level, solved[index].validArrangements);
    }).length,
    nonTrivialCoverageLevels: levels.filter((level) => {
      return level.analysis.difficultyMetrics.minimumCorrectExpressions > level.reels[0].tiles.length;
    }).length,
    maximumGenerationAttempt: Math.max(
      0,
      ...levels.map((level) => Number(level.provenance.seed.split(":").at(-1) ?? 0))
    )
  };
}

function buildDistributions(levels: readonly PublishedEquationSliderLevel[]): {
  readonly targetValues: Readonly<Record<string, number>>;
  readonly operatorOccurrences: Readonly<Record<string, number>>;
  readonly difficultyBands: Readonly<Record<string, number>>;
  readonly minimumSolutionSteps: Readonly<Record<string, number>>;
  readonly modes: Readonly<Record<string, number>>;
  readonly averageCompositeDifficulty: number;
} {
  const targetValues = countBy(
    levels.flatMap(targetValuesForLevel).sort((a, b) => a - b),
    (value) => String(value)
  );
  const operatorOccurrences = countBy(
    levels.flatMap((level) => [
      ...level.reels.flatMap((reel) => reel.tiles
        .map((tile) => tile.value)
        .filter((value): value is ArithmeticOperator => typeof value === "string")),
      ...(level.mode === "equality"
        ? level.rightExpression.filter((value): value is ArithmeticOperator => typeof value === "string")
        : [])
    ]),
    (operator) => operator
  );
  const difficultyBands = countBy(levels, (level) => difficultyBand(level.analysis.difficultyMetrics.compositeDifficulty));
  const minimumSolutionSteps = countBy(
    levels,
    (level) => String(level.analysis.difficultyMetrics.minimumCorrectExpressions)
  );
  const averageCompositeDifficulty = levels.length === 0
    ? 0
    : Number((levels.reduce(
      (sum, level) => sum + level.analysis.difficultyMetrics.compositeDifficulty,
      0
    ) / levels.length).toFixed(3));
  return {
    modes: countBy(levels, (level) => level.mode),
    targetValues,
    operatorOccurrences,
    difficultyBands,
    minimumSolutionSteps,
    averageCompositeDifficulty
  };
}

function targetValuesForLevel(level: PublishedEquationSliderLevel): readonly number[] {
  if (level.mode === "target") {
    return [level.target];
  }
  if (level.mode === "multi-target") {
    return level.targets;
  }
  const evaluation = evaluateExpression(level.rightExpression);
  return evaluation.ok ? [evaluation.value] : [];
}

function difficultyBand(value: number): "foundational" | "developing" | "strategic" | "advanced" {
  if (value < 24) {
    return "foundational";
  }
  if (value < 34) {
    return "developing";
  }
  if (value < 44) {
    return "strategic";
  }
  return "advanced";
}

export function writeMaterializedLevels(repoRoot: string): void {
  const levels = generatePublishedLevels();
  const outputDir = resolve(repoRoot, "games/equation-slider/levels");
  mkdirSync(outputDir, { recursive: true });
  const filenames = [
    "chapter-1-addition.json",
    "chapter-2-add-sub.json",
    "chapter-3-mul-div.json",
    "chapter-4-reasoning.json"
  ];
  filenames.forEach((filename, index) => {
    const chapterLevels = levels.filter((level) => level.chapterId === `chapter-${index + 1}`);
    writeFileSync(resolve(outputDir, filename), `${JSON.stringify(chapterLevels, null, 2)}\n`, "utf8");
  });
  writeFileSync(
    resolve(outputDir, "generated-audit.json"),
    `${JSON.stringify(buildGeneratedAudit(levels), null, 2)}\n`,
    "utf8"
  );
}

function createCandidateLevel(
  blueprint: UnitBlueprint,
  local: number,
  mode: LevelMode,
  challenge: ChallengeKind,
  reelCount: 3 | 5,
  tileCount: 2 | 3,
  familyVariant: number,
  seed: string,
  random: () => number
): EquationSliderLevelDefinition | null {
  const library = getExpressionLibrary(blueprint, reelCount);
  const availableResults = [...library.keys()]
    .filter((result) => (library.get(result)?.length ?? 0) >= tileCount)
    .sort((a, b) => a - b);
  if (availableResults.length === 0) {
    return null;
  }

  let rows: readonly ExpressionRecord[];
  let condition: Pick<EquationSliderLevelDefinition, "mode"> & Record<string, unknown>;
  if (blueprint.primarySkill === "fact-family") {
    const selected = selectAddSubFactFamilyRows(library, tileCount, local, familyVariant, random);
    if (!selected) {
      return null;
    }
    rows = selected.rows;
    condition = { mode: "multi-target", targets: selected.targets };
  } else if (blueprint.primarySkill === "multiply-divide-inverse") {
    const selected = selectMultiplyDivideFamilyRows(library, tileCount, local, familyVariant, random);
    if (!selected) {
      return null;
    }
    rows = selected.rows;
    condition = { mode: "multi-target", targets: selected.targets };
  } else if (mode === "multi-target") {
    const targetCount = tileCount === 3 && local % 2 === 0 ? 3 : 2;
    const preferredResults = resultsForFamilyVariant(availableResults, familyVariant);
    const resultPool = preferredResults.length >= targetCount ? preferredResults : availableResults;
    const selected = selectMultiTargetRows(library, resultPool, tileCount, targetCount, random);
    if (!selected) {
      return null;
    }
    rows = selected.rows;
    condition = { mode, targets: selected.targets };
  } else {
    const preferredResults = resultsForFamilyVariant(availableResults, familyVariant);
    const resultPool = preferredResults.length > 0 ? preferredResults : availableResults;
    const result = resultPool[Math.floor(random() * resultPool.length)];
    const selectedRows = selectDiverseRows(library.get(result) ?? [], tileCount, reelCount, random);
    if (!selectedRows) {
      return null;
    }
    rows = selectedRows;
    condition = mode === "target"
      ? { mode, target: result }
      : { mode, rightExpression: buildRightExpression(result, local, random) };
  }

  if (!rowsMatchUnitSemantics(blueprint, rows, local)) {
    return null;
  }

  const chapterLevel = (blueprint.unit - 1) * 10 + local;
  const id = `es-${blueprint.chapter}-${String(chapterLevel).padStart(2, "0")}`;
  const requireNonTrivialCoverage = requiresNonTrivialCoverage(
    blueprint,
    local,
    challenge,
    reelCount,
    tileCount
  );
  const baseReels = buildReels(id, rows, reelCount, random);
  const reels = requireNonTrivialCoverage
    ? disruptPerfectCover(baseReels, library, random)
    : baseReels;
  if (!reels) {
    return null;
  }
  const scaffoldLevel = scaffoldFor(local);
  const resultLabel = mode === "target"
    ? String(condition.target)
    : mode === "multi-target"
      ? (condition.targets as readonly number[]).join("、")
      : String(evaluateExpression(condition.rightExpression as readonly ArithmeticToken[]).ok
        ? (evaluateExpression(condition.rightExpression as readonly ArithmeticToken[]) as { ok: true; value: number }).value
        : "平衡");
  const objective = buildLearningObjective(blueprint, condition, rows, reelCount, resultLabel);
  const reflection = buildReflectionText(blueprint, condition, rows, resultLabel);
  const modeSkills = mode === "multi-target" ? ["multi-target"] : mode === "equality" ? ["equal-sign", "balance"] : [];
  const challengeSkills = challenge === "unique-minimum-cover" ? ["unique-route", "deductive-reasoning"] : [];
  const reviewOf = buildReviewOf(blueprint, local);
  const repetitionPurpose = scaffoldLevel === "review"
    ? "spaced-review" as const
    : scaffoldLevel === "transfer"
      ? "representation-transfer" as const
      : "scaffold-fade" as const;
  const base = {
    schemaVersion: 1 as const,
    id,
    chapterId: `chapter-${blueprint.chapter}`,
    unitId: `chapter-${blueprint.chapter}-unit-${blueprint.unit}`,
    levelNumber: chapterLevel,
    unitLevelNumber: local,
    challenge,
    reels,
    learning: {
      learningObjective: objective,
      primarySkill: blueprint.primarySkill,
      skillTags: [...new Set([...blueprint.skillTags, ...modeSkills, ...challengeSkills])],
      misconceptionTags: blueprint.misconceptionTags,
      scaffoldLevel,
      reviewOf,
      reflectionText: reflection,
      recommendedAgeBand: blueprint.age
    },
    provenance: {
      generatorVersion: GENERATOR_VERSION,
      seed,
      familyId: buildSemanticFamilyId(blueprint, condition, rows, reelCount, tileCount),
      repetitionPurpose
    },
    conceptHint: blueprint.hint
  };

  if (condition.mode === "target") {
    return { ...base, mode: "target", target: condition.target as number };
  }
  if (condition.mode === "multi-target") {
    return {
      ...base,
      mode: "multi-target",
      targets: condition.targets as readonly [number, number] | readonly [number, number, number]
    };
  }
  return {
    ...base,
    mode: "equality",
    rightExpression: condition.rightExpression as readonly ArithmeticToken[]
  };
}

function getExpressionLibrary(
  blueprint: UnitBlueprint,
  reelCount: 3 | 5
): ReadonlyMap<number, readonly ExpressionRecord[]> {
  const key = `${blueprint.chapter}-${blueprint.unit}-${reelCount}`;
  const cached = expressionCache.get(key);
  if (cached) {
    return cached;
  }
  const groups = new Map<number, ExpressionRecord[]>();
  const pools = numberPoolsFor(blueprint, reelCount);
  const add = (tokens: readonly ArithmeticToken[]): void => {
    const evaluation = evaluateExpression(tokens);
    if (!evaluation.ok || evaluation.value < blueprint.resultMin || evaluation.value > blueprint.resultMax) {
      return;
    }
    if (blueprint.fixedResult !== undefined && evaluation.value !== blueprint.fixedResult) {
      return;
    }
    const record: ExpressionRecord = {
      tokens,
      result: evaluation.value,
      key: tokens.join("|")
    };
    const records = groups.get(evaluation.value) ?? [];
    records.push(record);
    groups.set(evaluation.value, records);
  };

  if (reelCount === 3) {
    for (const first of pools[0]) {
      for (const operator of blueprint.operators) {
        for (const second of pools[1]) {
          add([first, operator, second]);
        }
      }
    }
  } else {
    for (const first of pools[0]) {
      for (const firstOperator of blueprint.operators) {
        for (const second of pools[1]) {
          for (const secondOperator of blueprint.operators) {
            for (const third of pools[2]) {
              add([first, firstOperator, second, secondOperator, third]);
            }
          }
        }
      }
    }
  }
  for (const records of groups.values()) {
    records.sort((a, b) => a.key.localeCompare(b.key));
  }
  expressionCache.set(key, groups);
  return groups;
}

function selectDiverseRows(
  records: readonly ExpressionRecord[],
  tileCount: 2 | 3,
  reelCount: 3 | 5,
  random: () => number
): readonly ExpressionRecord[] | null {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const rows = sampleWithoutReplacement(records, tileCount, random);
    if (rows.length !== tileCount) {
      return null;
    }
    const numberColumns = Array.from({ length: Math.ceil(reelCount / 2) }, (_, numberIndex) => numberIndex * 2);
    const hasVariety = numberColumns.every((column) => new Set(rows.map((row) => row.tokens[column])).size >= 2);
    if (hasVariety) {
      return rows;
    }
  }
  return null;
}

function selectMultiTargetRows(
  library: ReadonlyMap<number, readonly ExpressionRecord[]>,
  results: readonly number[],
  tileCount: 2 | 3,
  targetCount: 2 | 3,
  random: () => number
): { readonly rows: readonly ExpressionRecord[]; readonly targets: readonly [number, number] | readonly [number, number, number] } | null {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const targets = sampleWithoutReplacement(results, targetCount, random).sort((a, b) => a - b);
    if (targets.length !== targetCount) {
      return null;
    }
    const rows: ExpressionRecord[] = [];
    for (const target of targets) {
      const records = library.get(target) ?? [];
      if (records.length === 0) {
        break;
      }
      rows.push(records[Math.floor(random() * records.length)]);
    }
    while (rows.length < tileCount) {
      const target = targets[Math.floor(random() * targets.length)];
      const records = library.get(target) ?? [];
      const unused = records.filter((record) => !rows.some((row) => row.key === record.key));
      if (unused.length === 0) {
        break;
      }
      rows.push(unused[Math.floor(random() * unused.length)]);
    }
    if (rows.length !== tileCount) {
      continue;
    }
    const numberColumns = Array.from({ length: Math.ceil(rows[0].tokens.length / 2) }, (_, index) => index * 2);
    if (numberColumns.every((column) => new Set(rows.map((row) => row.tokens[column])).size >= 2)) {
      return {
        rows,
        targets: targets as unknown as readonly [number, number] | readonly [number, number, number]
      };
    }
  }
  return null;
}

function selectAddSubFactFamilyRows(
  library: ReadonlyMap<number, readonly ExpressionRecord[]>,
  tileCount: 2 | 3,
  local: number,
  familyVariant: number,
  random: () => number
): { readonly rows: readonly ExpressionRecord[]; readonly targets: readonly [number, number] | readonly [number, number, number] } | null {
  const additions = [...library.values()]
    .flat()
    .filter((record) => record.tokens.length === 3 && record.tokens[1] === "+")
    .filter((record) => local < 9 || record.result === 10);
  const preferredResults = resultsForFamilyVariant(
    [...new Set(additions.map((record) => record.result))].sort((a, b) => a - b),
    familyVariant
  );
  const candidates = preferredResults.length > 0
    ? additions.filter((record) => preferredResults.includes(record.result))
    : additions;

  for (let attempt = 0; attempt < 180; attempt += 1) {
    const addition = candidates[Math.floor(random() * candidates.length)];
    if (!addition) {
      return null;
    }
    const first = addition.tokens[0];
    const second = addition.tokens[2];
    if (typeof first !== "number" || typeof second !== "number" || first <= 0 || second <= 0) {
      continue;
    }
    const sum = first + second;
    const subtractFirst = (library.get(second) ?? []).find((record) => {
      return record.tokens.length === 3
        && record.tokens[0] === sum
        && record.tokens[1] === "−"
        && record.tokens[2] === first;
    });
    const subtractSecond = (library.get(first) ?? []).find((record) => {
      return record.tokens.length === 3
        && record.tokens[0] === sum
        && record.tokens[1] === "−"
        && record.tokens[2] === second;
    });
    if (!subtractFirst || !subtractSecond) {
      continue;
    }
    if (tileCount === 2) {
      const subtraction = familyVariant % 2 === 0 ? subtractFirst : subtractSecond;
      return { rows: [addition, subtraction], targets: [sum, subtraction.result] };
    }
    if (first !== second) {
      return {
        rows: [addition, subtractFirst, subtractSecond],
        targets: [sum, first, second].sort((a, b) => a - b) as unknown as readonly [number, number, number]
      };
    }
  }
  return null;
}

function selectMultiplyDivideFamilyRows(
  library: ReadonlyMap<number, readonly ExpressionRecord[]>,
  tileCount: 2 | 3,
  local: number,
  familyVariant: number,
  random: () => number
): { readonly rows: readonly ExpressionRecord[]; readonly targets: readonly [number, number] | readonly [number, number, number] } | null {
  const multiplications = [...library.values()]
    .flat()
    .filter((record) => record.tokens.length === 3 && record.tokens[1] === "×")
    .filter((record) => {
      return typeof record.tokens[0] === "number"
        && typeof record.tokens[2] === "number"
        && record.tokens[0] > 1
        && record.tokens[2] > 1
        && record.tokens[0] !== record.tokens[2]
        && record.result <= 24;
    });
  const preferredResults = resultsForFamilyVariant(
    [...new Set(multiplications.map((record) => record.result))].sort((a, b) => a - b),
    familyVariant
  );
  const candidates = preferredResults.length > 0
    ? multiplications.filter((record) => preferredResults.includes(record.result))
    : multiplications;

  for (let attempt = 0; attempt < 220; attempt += 1) {
    const multiplication = candidates[Math.floor(random() * candidates.length)];
    if (!multiplication) {
      return null;
    }
    const first = multiplication.tokens[0];
    const second = multiplication.tokens[2];
    if (typeof first !== "number" || typeof second !== "number") {
      continue;
    }
    const product = first * second;
    const divideByFirst = (library.get(second) ?? []).find((record) => {
      return record.tokens.length === 3
        && record.tokens[0] === product
        && record.tokens[1] === "÷"
        && record.tokens[2] === first;
    });
    const divideBySecond = (library.get(first) ?? []).find((record) => {
      return record.tokens.length === 3
        && record.tokens[0] === product
        && record.tokens[1] === "÷"
        && record.tokens[2] === second;
    });
    if (!divideByFirst || !divideBySecond) {
      continue;
    }
    if (tileCount === 2) {
      const division = familyVariant % 2 === 0 ? divideByFirst : divideBySecond;
      return { rows: [multiplication, division], targets: [product, division.result] };
    }
    if (local >= 9) {
      const reviewTargets = [product, divideByFirst.result, divideBySecond.result];
      const reviewRows = reviewTargets.flatMap((target) => {
        return (library.get(target) ?? []).filter((record) => record.tokens[1] === "+" || record.tokens[1] === "−");
      });
      const review = reviewRows[Math.floor(random() * reviewRows.length)];
      if (!review) {
        continue;
      }
      const division = familyVariant % 2 === 0 ? divideByFirst : divideBySecond;
      const targets = [...new Set([product, division.result, review.result])].sort((a, b) => a - b);
      if (targets.length < 2 || targets.length > 3) {
        continue;
      }
      return {
        rows: [multiplication, division, review],
        targets: targets as unknown as readonly [number, number] | readonly [number, number, number]
      };
    }
    return {
      rows: [multiplication, divideByFirst, divideBySecond],
      targets: [product, first, second].sort((a, b) => a - b) as unknown as readonly [number, number, number]
    };
  }
  return null;
}

function rowsMatchUnitSemantics(
  blueprint: UnitBlueprint,
  rows: readonly ExpressionRecord[],
  local: number
): boolean {
  if (blueprint.primarySkill === "times-2-5-10") {
    return rows.every((row) => [row.tokens[0], row.tokens[2]].some((value) => value === 2 || value === 5 || value === 10));
  }
  if (blueprint.primarySkill === "multiplication-facts") {
    return rows.every((row) => [row.tokens[0], row.tokens[2]].some((value) => value === 3 || value === 4 || value === 6));
  }
  const operators = new Set(rows.flatMap((row) => row.tokens.filter((token): token is ArithmeticOperator => typeof token === "string")));
  if (blueprint.primarySkill === "fact-family") {
    return operators.has("+") && operators.has("−") && (local < 9 || rows.some((row) => row.result === 10));
  }
  if (blueprint.primarySkill === "multiply-divide-inverse") {
    return operators.has("×") && operators.has("÷") && (local < 9 || operators.has("+") || operators.has("−"));
  }
  if (blueprint.primarySkill === "order-of-operations") {
    return rows.every((row) => {
      const rowOperators = row.tokens.filter((token): token is ArithmeticOperator => typeof token === "string");
      return rowOperators.some((operator) => operator === "+" || operator === "−")
        && rowOperators.some((operator) => operator === "×" || operator === "÷");
    });
  }
  return blueprint.operators.length <= 1 || operators.size >= 2;
}

function resultsForFamilyVariant(results: readonly number[], familyVariant: number): readonly number[] {
  if (results.length <= 1) {
    return results;
  }
  return results.filter((_, index) => {
    return Math.min(3, Math.floor(index * 4 / results.length)) === familyVariant % 4;
  });
}

function buildLearningObjective(
  blueprint: UnitBlueprint,
  condition: Pick<EquationSliderLevelDefinition, "mode"> & Record<string, unknown>,
  rows: readonly ExpressionRecord[],
  reelCount: 3 | 5,
  resultLabel: string
): string {
  const focus = learningFocus(blueprint.primarySkill, rows, resultLabel);
  if (condition.mode === "multi-target") {
    return `${focus.objective}；分别命中目标 ${resultLabel}，再规划不同成立算式来点亮全部方块。`;
  }
  if (condition.mode === "equality") {
    return `${focus.objective}；分别计算等号两边，在${reelCount}列滑轨中找到同值表达式并点亮全部方块。`;
  }
  return `${focus.objective}；找到结果为 ${resultLabel} 的不同表达式并点亮全部方块。`;
}

function buildReflectionText(
  blueprint: UnitBlueprint,
  condition: Pick<EquationSliderLevelDefinition, "mode"> & Record<string, unknown>,
  rows: readonly ExpressionRecord[],
  resultLabel: string
): string {
  const focus = learningFocus(blueprint.primarySkill, rows, resultLabel);
  if (condition.mode === "multi-target") {
    return `${focus.reflection} 目标 ${resultLabel} 要分别命中，目标灯和方块灯都要检查。`;
  }
  if (condition.mode === "equality") {
    return `${focus.reflection} 等号表示左右两边的值相同。`;
  }
  return focus.reflection;
}

function learningFocus(
  primarySkill: string,
  rows: readonly ExpressionRecord[],
  resultLabel: string
): { readonly objective: string; readonly reflection: string } {
  const [exampleRow, relatedRow] = relationExampleRows(primarySkill, rows);
  const example = formatExpression(exampleRow?.tokens ?? []);
  const related = formatExpression(relatedRow?.tokens ?? exampleRow?.tokens ?? []);
  const focuses: Record<string, { readonly objective: string; readonly reflection: string }> = {
    "part-whole": {
      objective: `找到两个部分合成整体 ${resultLabel} 的加法关系`,
      reflection: `${example} 表示两个部分合成一个整体。`
    },
    "make-ten": {
      objective: "找出不同的组成 10 数对，并观察交换加数后的结果",
      reflection: `${example} 是一组组成 10 的数，交换加数后和不变。`
    },
    "within-20-addition": {
      objective: `用凑 10 或分步相加得到 ${resultLabel}`,
      reflection: `${example} 可以先寻找接近 10 的部分，再合上剩余数量。`
    },
    compensation: {
      objective: `比较凑整方法，灵活得到 ${resultLabel}`,
      reflection: `${example} 可以通过先凑整再补回，帮助心算。`
    },
    "addition-transfer": {
      objective: "在不同排列中选择合适的加法与凑整关系",
      reflection: `${example} 是一种加法路线；换一种分组也可以得到同一个和。`
    },
    "take-away": {
      objective: `用减法表示从较大数量中拿走一部分后还剩 ${resultLabel}`,
      reflection: `${example} 表示拿走一部分以后还剩下的数量。`
    },
    difference: {
      objective: `用减法比较两个数量相差 ${resultLabel}`,
      reflection: `${example} 表示两个数量之间的相差。`
    },
    "fact-family": {
      objective: "用同一组数连接相关的加法与减法事实",
      reflection: `${example} 与 ${related} 使用同一组数，加法和减法可以互相检查。`
    },
    "left-to-right-add-sub": {
      objective: `按从左到右的顺序完成两步加减并得到 ${resultLabel}`,
      reflection: `${example} 只有加减时，要从左到右一步一步计算。`
    },
    "add-sub-transfer": {
      objective: "判断拿走、相差、组成与两步加减中的合适关系",
      reflection: `${example} 展示了一条加减路线，先读懂关系再选择运算。`
    },
    "times-2-5-10": {
      objective: `用 2、5 或 10 的相同分组得到 ${resultLabel}`,
      reflection: `${example} 可以读作若干组相同的数量。`
    },
    "multiplication-facts": {
      objective: `利用 3、4 或 6 的乘法事实得到 ${resultLabel}`,
      reflection: `${example} 是一个乘法事实，可以联系已知的倍数关系。`
    },
    "exact-division": {
      objective: `把总量平均分成整数份并得到 ${resultLabel}`,
      reflection: `${example} 能整除，表示每份都是完整的整数数量。`
    },
    "multiply-divide-inverse": {
      objective: "用同一组数连接相关的乘法与除法事实",
      reflection: `${example} 与 ${related} 使用同一组数，乘法和除法可以互相检查。`
    },
    "order-of-operations": {
      objective: `在混合算式中先算乘除、再算加减并得到 ${resultLabel}`,
      reflection: `${example} 同时有加减和乘除，要先完成乘除。`
    },
    "multi-target": {
      objective: "比较多条可行路线，安排多个目标的完成顺序",
      reflection: "多目标任务要同时留意目标清单和还没有亮的方块。"
    },
    "equal-sign": {
      objective: "把等号看作两边同值的关系，并验证左右平衡",
      reflection: `${example} 与右式同值时，等号两边才平衡。`
    },
    "coverage-strategy": {
      objective: "比较多条成立算式，选择能增加新覆盖的路线",
      reflection: `${example} 成立以后，还要检查它是否点亮了新的方块。`
    },
    "unique-route": {
      objective: "排除重复覆盖的组合，找出唯一的最短完整路线",
      reflection: "唯一路线来自逐步排除：每条保留的算式都承担不可替代的覆盖。"
    },
    "cross-chapter-transfer": {
      objective: "辨认题目模式，并迁移加减、乘除、顺序与等式关系",
      reflection: `${example} 先辨认关系，再调用合适的运算规则。`
    }
  };
  return focuses[primarySkill] ?? {
    objective: `解释怎样得到 ${resultLabel}`,
    reflection: `${example} 展示了一条成立的数学关系。`
  };
}

function relationExampleRows(
  primarySkill: string,
  rows: readonly ExpressionRecord[]
): readonly [ExpressionRecord | undefined, ExpressionRecord | undefined] {
  const operatorPair = primarySkill === "fact-family"
    ? (["+", "−"] as const)
    : primarySkill === "multiply-divide-inverse"
      ? (["×", "÷"] as const)
      : null;
  if (!operatorPair) {
    return [rows[0], rows[1] ?? rows[0]];
  }
  const first = rows.find((row) => row.tokens.includes(operatorPair[0]));
  const second = rows.find((row) => row.tokens.includes(operatorPair[1]));
  return [first ?? rows[0], second ?? rows[1] ?? first ?? rows[0]];
}

function buildSemanticFamilyId(
  blueprint: UnitBlueprint,
  condition: Pick<EquationSliderLevelDefinition, "mode"> & Record<string, unknown>,
  rows: readonly ExpressionRecord[],
  reelCount: 3 | 5,
  tileCount: 2 | 3
): string {
  const operators = [...new Set(
    rows.flatMap((row) => row.tokens.filter((token): token is ArithmeticOperator => typeof token === "string"))
  )].sort().join("");
  const numbers = rows.flatMap((row) => row.tokens.filter((token): token is number => typeof token === "number"));
  const span = Math.max(...numbers) - Math.min(...numbers);
  const evenRatio = numbers.filter((value) => value % 2 === 0).length / Math.max(1, numbers.length);
  const parityPattern = evenRatio <= 0.34 ? "odd" : evenRatio >= 0.67 ? "even" : "mix";
  const repetitionPattern = new Set(numbers).size < numbers.length ? "repeat" : "distinct";
  const numberPattern = `${numbers.includes(0) ? "z" : "n"}${span <= 5 ? "tight" : span <= 12 ? "mid" : "wide"}-${parityPattern}-${repetitionPattern}`;
  const conditionValues = condition.mode === "target"
    ? [condition.target as number]
    : condition.mode === "multi-target"
      ? [...(condition.targets as readonly number[])]
      : [evaluateExpression(condition.rightExpression as readonly ArithmeticToken[])]
        .flatMap((evaluation) => evaluation.ok ? [evaluation.value] : []);
  const maximum = Math.max(0, ...conditionValues);
  const valueBand = maximum <= 5 ? "v1" : maximum <= 10 ? "v2" : maximum <= 24 ? "v3" : "v4";
  return `${blueprint.chapter}-${blueprint.unit}-${condition.mode}-r${reelCount}-t${tileCount}-${operators}-${numberPattern}-${valueBand}`;
}

function buildReels(
  levelId: string,
  rows: readonly ExpressionRecord[],
  reelCount: 3 | 5,
  random: () => number
): readonly EquationReel[] {
  const rowOrders = Array.from({ length: reelCount }, () => shuffledIndexes(rows.length, random));
  if (rowOrders.every((order) => order.join(".") === rowOrders[0].join("."))) {
    const forcedReel = 1 + Math.floor(random() * Math.max(1, reelCount - 1));
    rowOrders[forcedReel] = [...rowOrders[forcedReel].slice(1), rowOrders[forcedReel][0]];
  }
  if (rows.length === 2) {
    const balancedPattern = balancedBinaryRowPattern(levelId, reelCount, rows);
    balancedPattern.forEach((reversed, reelIndex) => {
      rowOrders[reelIndex] = reversed ? [1, 0] : [0, 1];
    });
  }
  return Array.from({ length: reelCount }, (_, reelIndex) => {
    const kind = reelIndex % 2 === 0 ? "number" as const : "operator" as const;
    return {
      id: `${levelId}-r${reelIndex + 1}`,
      kind,
      initialIndex: 0,
      tiles: rowOrders[reelIndex].map((rowIndex, tileIndex) => ({
        id: `${levelId}-r${reelIndex + 1}-t${tileIndex + 1}`,
        kind,
        value: rows[rowIndex].tokens[reelIndex]
      }))
    };
  });
}

function balancedBinaryRowPattern(
  levelId: string,
  reelCount: 3 | 5,
  rows: readonly ExpressionRecord[]
): readonly boolean[] {
  const match = /^es-(\d+)-(\d+)$/.exec(levelId);
  const chapter = Number(match?.[1] ?? 1);
  const chapterLevel = Number(match?.[2] ?? 1);
  const ordinal = Math.max(0, (chapter - 1) * 50 + chapterLevel - 1);
  const differingColumns = Array.from({ length: reelCount }, (_, reelIndex) => reelIndex)
    .filter((reelIndex) => rows[0]?.tokens[reelIndex] !== rows[1]?.tokens[reelIndex]);
  const patterns = Array.from({ length: (1 << (reelCount - 1)) - 1 }, (_, index) => index + 1)
    .map((variant) => Array.from({ length: reelCount }, (_, reelIndex) => {
      return reelIndex > 0 && (variant & (1 << (reelIndex - 1))) !== 0;
    }))
    .filter((pattern) => new Set(differingColumns.map((reelIndex) => pattern[reelIndex])).size > 1);
  return patterns[ordinal % patterns.length] ?? [false, ...new Array(reelCount - 2).fill(false), true];
}

function disruptPerfectCover(
  reels: readonly EquationReel[],
  library: ReadonlyMap<number, readonly ExpressionRecord[]>,
  random: () => number
): readonly EquationReel[] | null {
  const records = [...library.values()].flat();
  const reelIndexes = shuffledIndexes(reels.length, random).filter((index) => reels[index].kind === "number");
  for (const reelIndex of reelIndexes) {
    const currentValues = new Set(reels[reelIndex].tiles.map((tile) => tile.value));
    const alternatives = [...new Set(records.map((record) => record.tokens[reelIndex]))]
      .filter((value): value is number => typeof value === "number" && !currentValues.has(value));
    if (alternatives.length === 0) {
      continue;
    }
    const tileIndex = Math.floor(random() * reels[reelIndex].tiles.length);
    const replacement = alternatives[Math.floor(random() * alternatives.length)];
    return reels.map((reel, index) => index !== reelIndex
      ? reel
      : {
          ...reel,
          tiles: reel.tiles.map((tile, indexInReel) => indexInReel === tileIndex ? { ...tile, value: replacement } : tile)
        });
  }
  return null;
}

function chooseInitialArrangement(
  level: EquationSliderLevelDefinition,
  validArrangements: readonly { readonly key: string; readonly indexes: readonly number[] }[],
  desiredDistance: number,
  random: () => number
): readonly number[] | null {
  const validKeys = new Set(validArrangements.map((arrangement) => arrangement.key));
  const invalid = enumerateArrangements(level)
    .filter((arrangement) => !validKeys.has(arrangement.indexes.join(".")))
    .map((arrangement) => ({
      indexes: arrangement.indexes,
      distance: Math.min(...validArrangements.map((valid) => moveDistance(level, arrangement.indexes, valid.indexes)))
    }))
    .filter((entry) => entry.distance > 0 && entry.distance <= level.reels.length);
  if (invalid.length === 0) {
    return null;
  }
  const closestDelta = Math.min(...invalid.map((entry) => Math.abs(entry.distance - desiredDistance)));
  const pool = invalid
    .filter((entry) => Math.abs(entry.distance - desiredDistance) === closestDelta)
    .sort((a, b) => a.indexes.join(".").localeCompare(b.indexes.join(".")));
  return pool[Math.floor(random() * pool.length)]?.indexes ?? null;
}

function requiresNonTrivialCoverage(
  blueprint: UnitBlueprint,
  local: number,
  challenge: ChallengeKind,
  reelCount: 3 | 5,
  tileCount: 2 | 3
): boolean {
  return challenge === "standard"
    && reelCount === 5
    && tileCount === 3
    && local >= 7
    && !["fact-family", "multiply-divide-inverse"].includes(blueprint.primarySkill);
}

function hasTrivialAlignedCompleteCover(
  level: EquationSliderLevelDefinition,
  validArrangements: readonly { readonly key: string; readonly targetMask?: number }[]
): boolean {
  const tileCount = level.reels[0]?.tiles.length ?? 0;
  if (tileCount < 2 || level.reels.some((reel) => reel.tiles.length !== tileCount)) {
    return false;
  }
  const validByKey = new Map(validArrangements.map((arrangement) => [arrangement.key, arrangement]));
  let targetMask = 0;
  for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
    const key = new Array(level.reels.length).fill(tileIndex).join(".");
    const arrangement = validByKey.get(key);
    if (!arrangement) {
      return false;
    }
    targetMask |= arrangement.targetMask ?? 0;
  }
  return level.mode !== "multi-target" || targetMask === (1 << level.targets.length) - 1;
}

function shuffledIndexes(length: number, random: () => number): number[] {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }
  return indexes;
}

function buildRightExpression(result: number, local: number, random: () => number): readonly ArithmeticToken[] {
  const variant = local % 4;
  if (variant === 0 && result >= 2) {
    const left = Math.max(1, Math.floor(random() * result));
    return [left, "+", result - left];
  }
  if (variant === 1) {
    const extra = Math.floor(random() * 5) + 1;
    return [result + extra, "−", extra];
  }
  if (variant === 2 && result > 0) {
    const factors = [2, 3, 4, 5, 6].filter((factor) => result % factor === 0);
    if (factors.length > 0) {
      const factor = factors[Math.floor(random() * factors.length)];
      return [factor, "×", result / factor];
    }
  }
  return [result];
}

function expressionRowsForPlan(
  level: EquationSliderLevelDefinition,
  plan: readonly (readonly number[])[]
): readonly ExpressionRecord[] {
  return plan.map((indexes) => {
    const tokens = getArrangementTokens(level, { indexes });
    const evaluation = evaluateExpression(tokens);
    if (!evaluation.ok) {
      throw new Error(`${level.id}: canonical plan contains an invalid expression`);
    }
    return {
      tokens,
      result: evaluation.value,
      key: tokens.join("|")
    };
  });
}

function resultLabelForLevel(level: EquationSliderLevelDefinition): string {
  if (level.mode === "target") {
    return String(level.target);
  }
  if (level.mode === "multi-target") {
    return level.targets.join("、");
  }
  const evaluation = evaluateExpression(level.rightExpression);
  return evaluation.ok ? String(evaluation.value) : "平衡";
}

function shapeFor(
  blueprint: UnitBlueprint,
  local: number,
  challenge: ChallengeKind,
  mode: LevelMode,
  attempt: number
): { readonly reelCount: 3 | 5; readonly tileCount: 2 | 3; readonly familyVariant: number } {
  if (challenge === "unique-minimum-cover") {
    const advancedUnique = blueprint.chapter === 4
      && ((blueprint.unit === 4 && local >= 7) || (blueprint.unit === 5 && local === 6));
    return {
      reelCount: blueprint.chapter === 4 && local >= 4 ? 5 : (local + attempt) % 2 === 0 ? 5 : 3,
      tileCount: advancedUnique ? 3 : 2,
      familyVariant: (local + attempt) % 4
    };
  }
  if ((blueprint.chapter === 2 && blueprint.unit === 3) || (blueprint.chapter === 3 && blueprint.unit === 4)) {
    return {
      reelCount: 3,
      tileCount: local <= 4 ? 2 : 3,
      familyVariant: (local + attempt) % 4
    };
  }
  let fiveColumnFrom = 11;
  if (blueprint.chapter === 1) {
    fiveColumnFrom = blueprint.unit === 3 ? 7 : blueprint.unit === 4 ? 5 : blueprint.unit === 5 ? 3 : 11;
  } else if (blueprint.chapter === 2) {
    fiveColumnFrom = blueprint.unit >= 4 ? 1 : blueprint.unit === 3 ? 7 : 11;
  } else if (blueprint.chapter === 3) {
    fiveColumnFrom = blueprint.unit === 5 ? 1 : 11;
  } else {
    fiveColumnFrom = blueprint.unit >= 3 ? 3 : 6;
  }
  const reelCount: 3 | 5 = local >= fiveColumnFrom ? 5 : 3;
  const usesTwoTileIntroduction = local === 1
    || (blueprint.chapter === 1 && blueprint.unit === 1 && local === 2);
  const tileCount: 2 | 3 = mode === "multi-target" && local % 2 === 0
    ? 3
    : usesTwoTileIntroduction
      ? 2
      : 3;
  return { reelCount, tileCount, familyVariant: (local + attempt) % 4 };
}

function modeFor(chapter: number, unitNumber: number, local: number): LevelMode {
  if ((chapter === 2 && unitNumber === 3) || (chapter === 3 && unitNumber === 4)) {
    return "multi-target";
  }
  if (chapter < 4) {
    return "target";
  }
  if (unitNumber === 1) {
    return "multi-target";
  }
  if (unitNumber === 2) {
    return "equality";
  }
  if (unitNumber === 3 || unitNumber === 4) {
    return (["target", "multi-target", "equality"] as const)[(local - 1) % 3];
  }
  return (["multi-target", "multi-target", "equality", "equality", "target", "multi-target", "target", "equality", "multi-target", "equality"] as const)[local - 1];
}

function challengeFor(chapter: number, unitNumber: number, local: number): ChallengeKind {
  if (chapter === 2 && unitNumber === 5 && (local === 7 || local === 8)) {
    return "unique-minimum-cover";
  }
  if (chapter === 4 && unitNumber === 4) {
    return "unique-minimum-cover";
  }
  if (chapter === 4 && unitNumber === 5 && (local === 5 || local === 6)) {
    return "unique-minimum-cover";
  }
  return "standard";
}

function scaffoldFor(local: number): ScaffoldLevel {
  if (local <= 2) {
    return "guided";
  }
  if (local <= 4) {
    return "supported";
  }
  if (local <= 6) {
    return "independent";
  }
  if (local <= 8) {
    return "transfer";
  }
  return "review";
}

function buildReviewOf(blueprint: UnitBlueprint, local: number): readonly string[] {
  const review = new Set(blueprint.reviewOf);
  if (local >= 9) {
    blueprint.skillTags.forEach((skill) => review.add(skill));
  }
  if (blueprint.chapter >= 2 && (blueprint.unit >= 3 || local >= 9)) {
    review.add("make-ten");
  }
  if (blueprint.chapter >= 3 && (blueprint.unit >= 4 || local >= 9)) {
    review.add("addition");
    review.add("subtraction");
  }
  if (blueprint.chapter === 4) {
    review.add("inverse-operations");
    if (blueprint.unit >= 3) {
      review.add("order-of-operations");
    }
  }
  return [...review];
}

function numberPoolsFor(blueprint: UnitBlueprint, reelCount: 3 | 5): readonly (readonly number[])[] {
  const needed = reelCount === 3 ? 2 : 3;
  return Array.from({ length: needed }, (_, index) => {
    return blueprint.numberPools[Math.min(index, blueprint.numberPools.length - 1)] ?? DEFAULT_POOL;
  });
}

function moveDistance(
  level: EquationSliderLevelDefinition,
  from: readonly number[],
  to: readonly number[]
): number {
  return level.reels.reduce((total, reel, index) => {
    const difference = Math.abs(from[index] - to[index]);
    return total + Math.min(difference, reel.tiles.length - difference);
  }, 0);
}

function sampleWithoutReplacement<T>(items: readonly T[], count: number, random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy.slice(0, count);
}

function createRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (const character of seedText) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return (): number => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const itemKey = key(item);
    counts[itemKey] = (counts[itemKey] ?? 0) + 1;
  }
  return counts;
}

function maximumGroupedReuse<T>(
  items: readonly T[],
  groupKey: (item: T) => string,
  valueKey: (item: T) => string
): number {
  return Math.max(0, ...[...new Set(items.map(groupKey))].map((group) => {
    return Math.max(0, ...Object.values(countBy(items.filter((item) => groupKey(item) === group), valueKey)));
  }));
}

function maximumConsecutiveReuse<T>(
  items: readonly T[],
  groupKey: (item: T) => string,
  valueKey: (item: T) => string
): number {
  let maximum = 0;
  for (const group of new Set(items.map(groupKey))) {
    let previous = "";
    let current = 0;
    for (const item of items.filter((candidate) => groupKey(candidate) === group)) {
      const value = valueKey(item);
      current = value === previous ? current + 1 : 1;
      previous = value;
      maximum = Math.max(maximum, current);
    }
  }
  return maximum;
}

function isThreeReelTwoTileCohort(level: PublishedEquationSliderLevel): boolean {
  return level.reels.length === 3
    && level.reels.every((reel) => reel.tiles.length === 2)
    && level.analysis.difficultyMetrics.minimumCorrectExpressions === 2;
}

function canonicalPlanSignature(level: PublishedEquationSliderLevel): string {
  return planIndexSignature(level.analysis.canonicalPlan);
}

function planIndexSignature(plan: readonly (readonly number[])[]): string {
  return plan.map((indexes) => indexes.join(".")).join(">");
}

function unit(
  chapter: 1 | 2 | 3 | 4,
  unitNumber: 1 | 2 | 3 | 4 | 5,
  name: string,
  primarySkill: string,
  skillTags: readonly string[],
  misconceptionTags: readonly string[],
  reviewOf: readonly string[],
  hint: string,
  age: string,
  operators: readonly ArithmeticOperator[],
  numberPools: readonly (readonly number[])[],
  resultMin: number,
  resultMax: number,
  fixedResult?: number
): UnitBlueprint {
  return {
    chapter,
    unit: unitNumber,
    name,
    primarySkill,
    skillTags,
    misconceptionTags,
    reviewOf,
    hint,
    age,
    operators,
    numberPools,
    resultMin,
    resultMax,
    fixedResult
  };
}
