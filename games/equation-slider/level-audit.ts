import {
  canonicalStructureSignature,
  getRequiredTileIds,
  solveLevel,
  solutionTopologySignature,
  validateLevelDefinition
} from "./solver";
import type {
  ArithmeticOperator,
  ArithmeticToken,
  PublishedEquationSliderLevel,
  ScaffoldLevel,
  ValidArrangement
} from "./types";

export interface LevelAuditSummary {
  readonly totalLevels: number;
  readonly chapters: Readonly<Record<string, number>>;
  readonly units: Readonly<Record<string, number>>;
  readonly modes: Readonly<Record<string, number>>;
  readonly scaffolds: Readonly<Record<ScaffoldLevel, number>>;
  readonly uniqueChallenges: number;
  readonly solverValidated: number;
  readonly orphanTiles: number;
  readonly unsolvableLevels: number;
  readonly exactDuplicateStructures: number;
  readonly maximumFamilyReusePerUnit: number;
  readonly maximumTopologyReusePerChapter: number;
  readonly maximumConsecutiveTopologyReuse: number;
  readonly threeReelTwoTileCohort: number;
  readonly threeReelTwoTilePlanCounts: Readonly<Record<string, number>>;
  readonly maximumThreeReelTwoTilePlanReuse: number;
  readonly maximumThreeReelTwoTileTopologyReusePerChapter: number;
  readonly maximumConsecutiveCanonicalPlanReuse: number;
  readonly openingPlanDiversityMinimum: number;
  readonly crossChapterReviewCount: number;
  readonly advancedUniqueChallenges: number;
  readonly initialDistanceDistribution: Readonly<Record<string, number>>;
  readonly trivialAlignedCompleteCovers: number;
  readonly nonTrivialCoverageLevels: number;
  readonly maximumGenerationAttempt: number;
}

export interface LevelSetAudit {
  readonly errors: readonly string[];
  readonly summary: LevelAuditSummary;
}

const EXPECTED_SCAFFOLD: readonly ScaffoldLevel[] = [
  "guided",
  "guided",
  "supported",
  "supported",
  "independent",
  "independent",
  "transfer",
  "transfer",
  "review",
  "review"
];

export function auditLevelSet(levels: readonly PublishedEquationSliderLevel[]): LevelSetAudit {
  const errors: string[] = [];
  const levelIds = new Set<string>();
  const structureCounts = new Map<string, number>();
  const chapterCounts = countBy(levels, (level) => level.chapterId);
  const unitCounts = countBy(levels, (level) => level.unitId);
  const modeCounts = countBy(levels, (level) => level.mode);
  const scaffoldCounts = countBy(levels, (level) => level.learning.scaffoldLevel) as Record<ScaffoldLevel, number>;
  let solverValidated = 0;
  let orphanTiles = 0;
  let unsolvableLevels = 0;
  let trivialAlignedCompleteCovers = 0;
  let nonTrivialCoverageLevels = 0;

  for (const level of levels) {
    if (levelIds.has(level.id)) {
      errors.push(`${level.id}: duplicate level ID`);
    }
    levelIds.add(level.id);
    const definitionErrors = validateLevelDefinition(level);
    errors.push(...definitionErrors.map((error) => `${level.id}: ${error}`));
    const requiredIds = getRequiredTileIds(level);
    if (new Set(requiredIds).size !== requiredIds.length) {
      errors.push(`${level.id}: duplicate tile IDs`);
    }
    if (level.reels.length > 5) {
      errors.push(`${level.id}: more than five movable reels`);
    }
    if (level.learning.scaffoldLevel !== EXPECTED_SCAFFOLD[level.unitLevelNumber - 1]) {
      errors.push(`${level.id}: scaffold does not match its station position`);
    }
    if (level.learning.reviewOf.length === 0) {
      errors.push(`${level.id}: reviewOf must name at least one real skill source`);
    }
    if (level.mode === "multi-target" && !level.learning.reflectionText.includes("目标")) {
      errors.push(`${level.id}: multi-target reflection must mention the target relationship`);
    }
    if (level.mode === "equality" && !level.learning.reflectionText.includes("等号")) {
      errors.push(`${level.id}: equality reflection must mention equality`);
    }
    if (level.unitId === "chapter-2-unit-3" && !hasAddSubFactFamily(level)) {
      errors.push(`${level.id}: fact-family station must contain related addition and subtraction facts`);
    }
    if (level.unitId === "chapter-3-unit-4" && !hasMultiplyDivideFactFamily(level)) {
      errors.push(`${level.id}: inverse station must contain related multiplication and division facts`);
    }
    if (
      level.unitId === "chapter-3-unit-4"
      && level.unitLevelNumber >= 9
      && !levelOperators(level).some((operator) => operator === "+" || operator === "−")
    ) {
      errors.push(`${level.id}: inverse review must include real addition or subtraction content`);
    }
    if (level.unitId === "chapter-3-unit-1" && !planUsesFactorFamily(level, [2, 5, 10])) {
      errors.push(`${level.id}: 2/5/10 station plan leaves its factor family`);
    }
    if (level.unitId === "chapter-3-unit-2" && !planUsesFactorFamily(level, [3, 4, 6])) {
      errors.push(`${level.id}: 3/4/6 station plan leaves its factor family`);
    }
    if (level.unitId === "chapter-3-unit-5" && !planUsesMixedOperationOrder(level)) {
      errors.push(`${level.id}: order-of-operations station plan must retain both operation tiers`);
    }

    const solved = solveLevel(level);
    orphanTiles += solved.orphanTileIds.length;
    if (solved.orphanTileIds.length > 0) {
      errors.push(`${level.id}: orphan tiles ${solved.orphanTileIds.join(", ")}`);
    }
    if (solved.status !== "solved" || !solved.difficultyMetrics) {
      unsolvableLevels += 1;
      errors.push(`${level.id}: solver status ${solved.status}: ${solved.errors.join("; ")}`);
      continue;
    }
    solverValidated += 1;
    if (hasTrivialAlignedCompleteCover(level, solved.validArrangements)) {
      trivialAlignedCompleteCovers += 1;
      errors.push(`${level.id}: aligned tile indexes form a mechanical complete cover`);
    }
    if (solved.minimumCorrectExpressions! > level.reels[0].tiles.length) {
      nonTrivialCoverageLevels += 1;
    }
    const initialKey = level.reels.map((reel) => reel.initialIndex).join(".");
    if (solved.validArrangements.some((arrangement) => arrangement.key === initialKey)) {
      errors.push(`${level.id}: initial arrangement is already valid`);
    }
    if (level.challenge === "unique-minimum-cover") {
      if (solved.minimumCoverSetCountCapped !== 1 || (solved.minimumCorrectExpressions ?? 0) < 2) {
        errors.push(`${level.id}: unique challenge is not a unique multi-expression minimum cover`);
      }
    }
    const canonicalPlan = solved.canonicalPlan.map((step) => [...step.indexes]);
    if (JSON.stringify(canonicalPlan) !== JSON.stringify(level.analysis.canonicalPlan)) {
      errors.push(`${level.id}: published canonical plan is stale`);
    }
    if (JSON.stringify(solved.difficultyMetrics) !== JSON.stringify(level.analysis.difficultyMetrics)) {
      errors.push(`${level.id}: published difficulty metrics are stale`);
    }
    const structure = canonicalStructureSignature(level);
    const topology = solutionTopologySignature(level, solved);
    if (structure !== level.analysis.structureSignature || topology !== level.analysis.topologySignature) {
      errors.push(`${level.id}: published signatures are stale`);
    }
    structureCounts.set(structure, (structureCounts.get(structure) ?? 0) + 1);
  }

  for (const chapterNumber of [1, 2, 3, 4]) {
    const chapterId = `chapter-${chapterNumber}`;
    const chapterLevels = levels.filter((level) => level.chapterId === chapterId);
    if (chapterLevels.length < 50) {
      errors.push(`${chapterId}: expected at least 50 levels, found ${chapterLevels.length}`);
    }
    const reviewOrTransfer = chapterLevels.filter((level) => ["review", "transfer"].includes(level.learning.scaffoldLevel));
    if (reviewOrTransfer.length < 10) {
      errors.push(`${chapterId}: expected at least 10 review or transfer levels`);
    }
    const explicitReview = chapterLevels.filter((level) => level.learning.reviewOf.length > 0);
    if (explicitReview.length < 5) {
      errors.push(`${chapterId}: expected at least five explicit review levels`);
    }
    for (const reviewLevelNumber of [10, 20, 30, 40, 50]) {
      const reviewLevel = chapterLevels.find((level) => level.levelNumber === reviewLevelNumber);
      if (reviewLevel?.learning.scaffoldLevel !== "review") {
        errors.push(`${chapterId}: level ${reviewLevelNumber} must be a review station`);
      }
    }
    const firstUnitAverage = averageDifficulty(chapterLevels.filter((level) => level.levelNumber <= 10));
    const finalUnitAverage = averageDifficulty(chapterLevels.filter((level) => level.levelNumber > 40));
    if (finalUnitAverage < firstUnitAverage) {
      errors.push(`${chapterId}: final unit average difficulty must not be below the first unit`);
    }
  }

  for (const [unitId, count] of Object.entries(unitCounts)) {
    if (count < 10) {
      errors.push(`${unitId}: expected at least 10 levels, found ${count}`);
    }
    const familyCounts = countBy(levels.filter((level) => level.unitId === unitId), (level) => level.provenance.familyId);
    if (Object.keys(familyCounts).length < 3) {
      errors.push(`${unitId}: expected at least three level families`);
    }
    if (Math.max(...Object.values(familyCounts)) > 4) {
      errors.push(`${unitId}: one level family is over-concentrated`);
    }
  }

  const exactDuplicateStructures = [...structureCounts.values()].filter((count) => count > 1).length;
  if (exactDuplicateStructures > 0) {
    errors.push(`found ${exactDuplicateStructures} exact duplicate structures`);
  }
  const chapterFourUniqueStation = levels.filter((level) => level.unitId === "chapter-4-unit-4");
  if (chapterFourUniqueStation.length !== 10 || chapterFourUniqueStation.some((level) => level.challenge !== "unique-minimum-cover")) {
    errors.push("chapter 4 unit 4 must contain ten solver-verified unique challenges");
  }
  const earlyUniqueAverage = averageDifficulty(chapterFourUniqueStation.slice(0, 4));
  const lateUniqueAverage = averageDifficulty(chapterFourUniqueStation.slice(6));
  if (lateUniqueAverage < earlyUniqueAverage + 10) {
    errors.push("chapter 4 unique-route station must materially increase late-stage reasoning complexity");
  }
  const finalStation = levels.filter((level) => level.unitId === "chapter-4-unit-5");
  if (finalStation.filter((level) => level.mode === "multi-target").length < 2
    || finalStation.filter((level) => level.mode === "equality").length < 2
    || finalStation.filter((level) => level.challenge === "unique-minimum-cover").length < 2
    || finalStation.filter((level) => level.learning.scaffoldLevel === "transfer").length < 2) {
    errors.push("chapter 4 final station does not meet its mode and transfer mix");
  }

  const firstOperatorLevels = new Map<string, PublishedEquationSliderLevel>();
  for (const level of levels) {
    for (const operator of level.reels.filter((reel) => reel.kind === "operator").flatMap((reel) => reel.tiles.map((tile) => String(tile.value)))) {
      if (!firstOperatorLevels.has(operator)) {
        firstOperatorLevels.set(operator, level);
      }
    }
  }
  for (const operator of ["−", "×", "÷"]) {
    if (firstOperatorLevels.get(operator)?.learning.scaffoldLevel !== "guided") {
      errors.push(`${operator}: first operator appearance must be guided`);
    }
  }
  const firstMulti = levels.find((level) => level.mode === "multi-target");
  const firstEquality = levels.find((level) => level.mode === "equality");
  if (firstMulti?.learning.scaffoldLevel !== "guided" || firstEquality?.learning.scaffoldLevel !== "guided") {
    errors.push("new multi-target and equality modes must first appear in guided levels");
  }

  const familyReuse = maximumGroupedReuse(levels, (level) => level.unitId, (level) => level.provenance.familyId);
  const topologyReuse = maximumGroupedReuse(levels, (level) => level.chapterId, (level) => level.analysis.topologySignature);
  const maximumConsecutiveTopologyReuse = maximumConsecutiveReuse(
    levels,
    (level) => level.chapterId,
    (level) => level.analysis.topologySignature
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
      const opening = levels.filter((level) => level.unitId === unitId).slice(0, 4);
      return new Set(opening.map(canonicalPlanSignature)).size;
    })
  );
  if (threeReelTwoTileLevels.length > 30) {
    errors.push(`three-reel two-tile introductions are overused: ${threeReelTwoTileLevels.length}`);
  }
  if (maximumThreeReelTwoTilePlanReuse > 18) {
    errors.push(`one introductory canonical plan is overused ${maximumThreeReelTwoTilePlanReuse} times`);
  }
  if (maximumThreeReelTwoTileTopologyReusePerChapter > 6) {
    errors.push(`one introductory topology is overused within a chapter: ${maximumThreeReelTwoTileTopologyReusePerChapter}`);
  }
  if (maximumConsecutiveCanonicalPlanReuse > 2) {
    errors.push(`one canonical plan repeats ${maximumConsecutiveCanonicalPlanReuse} times in sequence within a station`);
  }
  if (openingPlanDiversityMinimum < 2) {
    errors.push("every station's opening four levels must use at least two canonical plans");
  }
  const crossChapterReviewCount = levels.filter((level) => {
    const operators = levelOperators(level);
    if (level.chapterId === "chapter-3") {
      return level.learning.reviewOf.some((tag) => ["addition", "subtraction", "make-ten"].includes(tag))
        && operators.some((operator) => operator === "+" || operator === "−");
    }
    if (level.chapterId === "chapter-4") {
      return level.learning.reviewOf.some((tag) => ["make-ten", "addition", "subtraction", "inverse-operations"].includes(tag))
        && operators.length > 0;
    }
    return false;
  }).length;
  const initialDistanceDistribution = countBy(
    levels,
    (level) => String(level.analysis.difficultyMetrics.initialToFirstValidMoves)
  );
  if (nonTrivialCoverageLevels < 30) {
    errors.push(`expected at least 30 non-trivial coverage levels, found ${nonTrivialCoverageLevels}`);
  }
  if ((initialDistanceDistribution["2"] ?? 0) + (initialDistanceDistribution["3"] ?? 0) < 50) {
    errors.push("initial arrangements are over-concentrated one move from a valid expression");
  }
  if ((initialDistanceDistribution["3"] ?? 0) < 10) {
    errors.push("expected at least ten levels to start three moves from the nearest valid expression");
  }
  const maximumGenerationAttempt = Math.max(
    0,
    ...levels.map((level) => Number(level.provenance.seed.split(":").at(-1) ?? Number.POSITIVE_INFINITY))
  );
  if (!Number.isFinite(maximumGenerationAttempt) || maximumGenerationAttempt > 1000) {
    errors.push(`generation retry budget is unhealthy: ${maximumGenerationAttempt}`);
  }

  return {
    errors,
    summary: {
      totalLevels: levels.length,
      chapters: chapterCounts,
      units: unitCounts,
      modes: modeCounts,
      scaffolds: scaffoldCounts,
      uniqueChallenges: levels.filter((level) => level.challenge === "unique-minimum-cover").length,
      solverValidated,
      orphanTiles,
      unsolvableLevels,
      exactDuplicateStructures,
      maximumFamilyReusePerUnit: familyReuse,
      maximumTopologyReusePerChapter: topologyReuse,
      maximumConsecutiveTopologyReuse,
      threeReelTwoTileCohort: threeReelTwoTileLevels.length,
      threeReelTwoTilePlanCounts,
      maximumThreeReelTwoTilePlanReuse,
      maximumThreeReelTwoTileTopologyReusePerChapter,
      maximumConsecutiveCanonicalPlanReuse,
      openingPlanDiversityMinimum,
      crossChapterReviewCount,
      advancedUniqueChallenges: levels.filter((level) => {
        return level.challenge === "unique-minimum-cover"
          && level.analysis.difficultyMetrics.minimumCorrectExpressions >= 3
          && level.analysis.difficultyMetrics.validArrangementCount > level.analysis.difficultyMetrics.minimumCorrectExpressions;
      }).length,
      initialDistanceDistribution,
      trivialAlignedCompleteCovers,
      nonTrivialCoverageLevels,
      maximumGenerationAttempt
    }
  };
}

function isThreeReelTwoTileCohort(level: PublishedEquationSliderLevel): boolean {
  return level.reels.length === 3
    && level.reels.every((reel) => reel.tiles.length === 2)
    && level.analysis.difficultyMetrics.minimumCorrectExpressions === 2;
}

function canonicalPlanSignature(level: PublishedEquationSliderLevel): string {
  return level.analysis.canonicalPlan.map((indexes) => indexes.join(".")).join(">");
}

function hasTrivialAlignedCompleteCover(
  level: PublishedEquationSliderLevel,
  validArrangements: readonly ValidArrangement[]
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
    targetMask |= arrangement.targetMask;
  }
  return level.mode !== "multi-target" || targetMask === (1 << level.targets.length) - 1;
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function averageDifficulty(levels: readonly PublishedEquationSliderLevel[]): number {
  if (levels.length === 0) {
    return 0;
  }
  return levels.reduce((total, level) => total + level.analysis.difficultyMetrics.compositeDifficulty, 0) / levels.length;
}

function maximumGroupedReuse<T>(
  items: readonly T[],
  groupKey: (item: T) => string,
  valueKey: (item: T) => string
): number {
  let maximum = 0;
  for (const group of new Set(items.map(groupKey))) {
    const counts = countBy(items.filter((item) => groupKey(item) === group), valueKey);
    maximum = Math.max(maximum, ...Object.values(counts));
  }
  return maximum;
}

function maximumConsecutiveReuse<T>(
  items: readonly T[],
  groupKey: (item: T) => string,
  valueKey: (item: T) => string
): number {
  let maximum = 0;
  for (const group of new Set(items.map(groupKey))) {
    let currentValue = "";
    let currentCount = 0;
    for (const item of items.filter((candidate) => groupKey(candidate) === group)) {
      const value = valueKey(item);
      if (value === currentValue) {
        currentCount += 1;
      } else {
        currentValue = value;
        currentCount = 1;
      }
      maximum = Math.max(maximum, currentCount);
    }
  }
  return maximum;
}

function levelOperators(level: PublishedEquationSliderLevel): readonly ArithmeticOperator[] {
  return [...new Set(level.reels
    .filter((reel) => reel.kind === "operator")
    .flatMap((reel) => reel.tiles.map((tile) => tile.value as ArithmeticOperator)))];
}

function planExpressions(level: PublishedEquationSliderLevel): readonly (readonly ArithmeticToken[])[] {
  return level.analysis.canonicalPlan.map((indexes) => {
    return level.reels.map((reel, reelIndex) => reel.tiles[indexes[reelIndex]].value);
  });
}

function hasAddSubFactFamily(level: PublishedEquationSliderLevel): boolean {
  const expressions = planExpressions(level);
  const additions = expressions.filter((tokens) => tokens.length === 3 && tokens[1] === "+");
  const subtractions = expressions.filter((tokens) => tokens.length === 3 && tokens[1] === "−");
  return additions.some((addition) => subtractions.some((subtraction) => {
    if (
      typeof addition[0] !== "number"
      || typeof addition[2] !== "number"
      || typeof subtraction[0] !== "number"
      || typeof subtraction[2] !== "number"
    ) {
      return false;
    }
    const additionFamily = [addition[0], addition[2], addition[0] + addition[2]].sort((a, b) => a - b);
    const subtractionFamily = [subtraction[0], subtraction[2], subtraction[0] - subtraction[2]].sort((a, b) => a - b);
    return additionFamily.join(",") === subtractionFamily.join(",");
  }));
}

function hasMultiplyDivideFactFamily(level: PublishedEquationSliderLevel): boolean {
  const expressions = planExpressions(level);
  const multiplications = expressions.filter((tokens) => tokens.length === 3 && tokens[1] === "×");
  const divisions = expressions.filter((tokens) => tokens.length === 3 && tokens[1] === "÷");
  return multiplications.some((multiplication) => divisions.some((division) => {
    if (
      typeof multiplication[0] !== "number"
      || typeof multiplication[2] !== "number"
      || typeof division[0] !== "number"
      || typeof division[2] !== "number"
    ) {
      return false;
    }
    const multiplicationFamily = [
      multiplication[0],
      multiplication[2],
      multiplication[0] * multiplication[2]
    ].sort((a, b) => a - b);
    const divisionFamily = [division[0], division[2], division[0] / division[2]].sort((a, b) => a - b);
    return multiplicationFamily.join(",") === divisionFamily.join(",");
  }));
}

function planUsesFactorFamily(level: PublishedEquationSliderLevel, factors: readonly number[]): boolean {
  return planExpressions(level).every((tokens) => {
    return tokens.length === 3
      && tokens[1] === "×"
      && [tokens[0], tokens[2]].some((token) => typeof token === "number" && factors.includes(token));
  });
}

function planUsesMixedOperationOrder(level: PublishedEquationSliderLevel): boolean {
  return planExpressions(level).every((tokens) => {
    const operators = tokens.filter((token): token is ArithmeticOperator => typeof token === "string");
    return operators.some((operator) => operator === "+" || operator === "−")
      && operators.some((operator) => operator === "×" || operator === "÷");
  });
}
