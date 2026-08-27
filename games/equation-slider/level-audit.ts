import { getMovableReels, solveLevel, validatePublishedLevel } from "./solver";
import type { PublishedEquationSliderLevel, QualitySignatures } from "./types";

export interface NearDuplicateFinding {
  readonly leftId: string;
  readonly rightId: string;
  readonly stationId: string;
  readonly sharedSignals: readonly (keyof QualitySignatures)[];
}

export interface AdjacentRepetitionFinding {
  readonly leftId: string;
  readonly rightId: string;
  readonly reason: "number-multiset" | "canonical-action";
}

export interface StationDiversityAudit {
  readonly levelCount: number;
  readonly structureFamilies: number;
  readonly firstFourActionFamilies: number;
  readonly passesStructureMinimum: boolean;
  readonly passesFirstFourActionMinimum: boolean;
}

export interface SameVisibleMoveFinding {
  readonly reelId: string;
  readonly reelIndex: number;
  readonly direction: "up" | "down";
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly fromTileId: string;
  readonly toTileId: string;
  readonly value: string;
  readonly alternativeDirection: "up" | "down";
  readonly alternativeSteps: 2;
  readonly hasVisibleAlternative: boolean;
}

export interface SameVisibleCompletionPathAudit {
  readonly initialSameVisibleMove: boolean;
  readonly shortestMovesWithSameVisibleEdges: number;
  readonly shortestMovesWithoutSameVisibleEdges: number | null;
  readonly shortestPathDelta: number | null;
  readonly solvableWithoutSameVisibleEdges: boolean;
}

export interface EquationSliderLevelAudit {
  readonly schemaVersion: 3;
  readonly generatedAt: string;
  readonly totalLevels: number;
  readonly chapterCounts: Readonly<Record<string, number>>;
  readonly stationCounts: Readonly<Record<string, number>>;
  readonly goldCount: number;
  readonly generatedCount: number;
  readonly modeDistribution: Readonly<Record<string, number>>;
  readonly movableReelCountDistribution: Readonly<Record<string, number>>;
  readonly fixedOperatorDistribution: Readonly<Record<string, number>>;
  readonly movableOperatorDistribution: Readonly<Record<string, number>>;
  readonly repeatedValueReelCount: number;
  readonly repeatedValueLevelCount: number;
  readonly repeatedValueReelKindDistribution: Readonly<Record<string, number>>;
  readonly repeatedValueTileCount: number;
  readonly coverableRepeatedValueTileCount: number;
  readonly uncoverableRepeatedValueTiles: Readonly<Record<string, readonly string[]>>;
  readonly sameVisibleTransitionCount: number;
  readonly sameVisibleTransitionLevelCount: number;
  readonly sameVisibleTransitions: Readonly<Record<string, readonly SameVisibleMoveFinding[]>>;
  readonly initialSameVisibleMoveLevelCount: number;
  readonly initialSameVisibleMoves: Readonly<Record<string, readonly SameVisibleMoveFinding[]>>;
  readonly sameVisibleCompletionPaths: Readonly<Record<string, SameVisibleCompletionPathAudit>>;
  readonly sameVisibleShortestPathBenefitLevelIds: readonly string[];
  readonly initialSameVisibleShortestPathBenefitLevelIds: readonly string[];
  readonly canonicalPlanSameExpressionIdentityLevelIds: readonly string[];
  readonly requiredSameVisibleMoveLevelIds: readonly string[];
  readonly numberTileValueDistribution: Readonly<Record<string, number>>;
  readonly chapterNumberTileValueDistribution: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly stationNumberTileValueDistribution: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly targetDistribution: Readonly<Record<string, number>>;
  readonly numberTileRange: { readonly minimum: number; readonly maximum: number };
  readonly zeroCount: number;
  readonly oneCount: number;
  readonly zeroRatio: number;
  readonly oneRatio: number;
  readonly firstTenZeroCountByChapter: Readonly<Record<string, number>>;
  readonly minimumMovesDistribution: Readonly<Record<string, number>>;
  readonly minimumCorrectArrangementsDistribution: Readonly<Record<string, number>>;
  readonly validArrangementCountDistribution: Readonly<Record<string, number>>;
  readonly exactDuplicateGroups: readonly (readonly string[])[];
  readonly nearDuplicates: readonly NearDuplicateFinding[];
  readonly adjacentRepetitions: readonly AdjacentRepetitionFinding[];
  readonly canonicalActionPatternReuse: Readonly<Record<string, readonly string[]>>;
  readonly overusedCanonicalActionPatterns: Readonly<Record<string, readonly string[]>>;
  readonly stationDiversity: Readonly<Record<string, StationDiversityAudit>>;
  readonly invalidPublishedLevels: Readonly<Record<string, readonly string[]>>;
  readonly unsolvedLevelIds: readonly string[];
  readonly orphanTiles: Readonly<Record<string, readonly string[]>>;
  readonly missingTargets: Readonly<Record<string, readonly string[]>>;
  readonly generationRetryCount: number;
  readonly rejectedCandidateReasons: Readonly<Record<string, number>>;
  readonly deterministicHash: string;
  readonly passes: boolean;
}

const NEAR_DUPLICATE_SIGNALS: readonly (keyof QualitySignatures)[] = [
  "slotStructure",
  "rotationNormalized",
  "operatorPattern",
  "validArrangements",
  "canonicalCoverage",
  "firstSuccessAction",
  "numberMultiset",
  "learningBand"
];

export function auditEquationSliderLevels(
  levels: readonly PublishedEquationSliderLevel[],
  generatedAt = "deterministic-build"
): EquationSliderLevelAudit {
  const chapterCounts: Record<string, number> = {};
  const stationCounts: Record<string, number> = {};
  const modeDistribution: Record<string, number> = {};
  const movableReelCountDistribution: Record<string, number> = {};
  const fixedOperatorDistribution: Record<string, number> = {};
  const movableOperatorDistribution: Record<string, number> = {};
  const repeatedValueReelKindDistribution: Record<string, number> = {};
  const repeatedValueLevelIds = new Set<string>();
  const uncoverableRepeatedValueTiles: Record<string, string[]> = {};
  const sameVisibleTransitions: Record<string, SameVisibleMoveFinding[]> = {};
  const initialSameVisibleMoves: Record<string, SameVisibleMoveFinding[]> = {};
  const sameVisibleCompletionPaths: Record<string, SameVisibleCompletionPathAudit> = {};
  const sameVisibleShortestPathBenefitLevelIds: string[] = [];
  const initialSameVisibleShortestPathBenefitLevelIds: string[] = [];
  const canonicalPlanSameExpressionIdentityLevelIds: string[] = [];
  const requiredSameVisibleMoveLevelIds: string[] = [];
  const numberTileValueDistribution: Record<string, number> = {};
  const chapterNumberTileValueDistribution: Record<string, Record<string, number>> = {};
  const stationNumberTileValueDistribution: Record<string, Record<string, number>> = {};
  const targetDistribution: Record<string, number> = {};
  const firstTenZeroCountByChapter: Record<string, number> = {};
  const minimumMovesDistribution: Record<string, number> = {};
  const minimumCorrectArrangementsDistribution: Record<string, number> = {};
  const validArrangementCountDistribution: Record<string, number> = {};
  const invalidPublishedLevels: Record<string, readonly string[]> = {};
  const orphanTiles: Record<string, readonly string[]> = {};
  const missingTargets: Record<string, readonly string[]> = {};
  const unsolvedLevelIds: string[] = [];
  const numberValues: number[] = [];
  let goldCount = 0;
  let repeatedValueReelCount = 0;
  let repeatedValueTileCount = 0;
  let coverableRepeatedValueTileCount = 0;

  for (const level of levels) {
    increment(chapterCounts, level.chapterId);
    increment(stationCounts, level.stationId);
    increment(modeDistribution, level.mode);
    const movableSlots = level.slots.filter((slot) => slot.kind === "movable-reel");
    increment(movableReelCountDistribution, String(movableSlots.length));
    if (level.provenance.kind === "hand-authored-gold") goldCount += 1;
    const sameVisible = findSameVisibleTransitions(level);
    if (sameVisible.length > 0) {
      sameVisibleTransitions[level.id] = sameVisible;
      const initial = sameVisible.filter(
        (finding) => level.initialIndexes[finding.reelIndex] === finding.fromIndex
      );
      if (initial.length > 0) initialSameVisibleMoves[level.id] = initial;
      const completionPaths = auditSameVisibleCompletionPaths(level, initial.length > 0);
      sameVisibleCompletionPaths[level.id] = completionPaths;
      if (!completionPaths.solvableWithoutSameVisibleEdges) {
        requiredSameVisibleMoveLevelIds.push(level.id);
      }
      if ((completionPaths.shortestPathDelta ?? 0) > 0) {
        sameVisibleShortestPathBenefitLevelIds.push(level.id);
        if (completionPaths.initialSameVisibleMove) {
          initialSameVisibleShortestPathBenefitLevelIds.push(level.id);
        }
      }
      if (canonicalPlanRepeatsExpressionAcrossIdentities(level)) {
        canonicalPlanSameExpressionIdentityLevelIds.push(level.id);
      }
    }

    for (const target of level.targets) {
      increment(targetDistribution, target.kind === "value" ? String(target.value) : `=${target.rightExpression.join(" ")}`);
    }
    const coverableTileIds = new Set(
      level.analysis.validArrangements.flatMap((arrangement) => arrangement.selectedTileIds)
    );
    for (const slot of level.slots) {
      if (slot.kind === "fixed-token") {
        if (typeof slot.token === "string") increment(fixedOperatorDistribution, slot.token);
        continue;
      }
      if (slot.reel.kind === "operator") {
        for (const tile of slot.reel.tiles) increment(movableOperatorDistribution, String(tile.value));
      } else {
        for (const tile of slot.reel.tiles) {
          const value = Number(tile.value);
          numberValues.push(value);
          increment(numberTileValueDistribution, String(value));
          chapterNumberTileValueDistribution[level.chapterId] ??= {};
          stationNumberTileValueDistribution[level.stationId] ??= {};
          increment(chapterNumberTileValueDistribution[level.chapterId], String(value));
          increment(stationNumberTileValueDistribution[level.stationId], String(value));
          if (level.order <= 10 && value === 0) increment(firstTenZeroCountByChapter, level.chapterId);
        }
      }

      const valueCounts = new Map<string, number>();
      for (const tile of slot.reel.tiles) {
        const key = String(tile.value);
        valueCounts.set(key, (valueCounts.get(key) ?? 0) + 1);
      }
      const repeatedTiles = slot.reel.tiles.filter(
        (tile) => (valueCounts.get(String(tile.value)) ?? 0) > 1
      );
      if (repeatedTiles.length > 0) {
        repeatedValueReelCount += 1;
        repeatedValueLevelIds.add(level.id);
        increment(repeatedValueReelKindDistribution, slot.reel.kind);
        repeatedValueTileCount += repeatedTiles.length;
        for (const tile of repeatedTiles) {
          if (coverableTileIds.has(tile.id)) {
            coverableRepeatedValueTileCount += 1;
          } else {
            (uncoverableRepeatedValueTiles[level.id] ??= []).push(tile.id);
          }
        }
      }
    }

    increment(minimumMovesDistribution, String(level.analysis.minimumMovesToFirstSuccess));
    increment(minimumCorrectArrangementsDistribution, String(level.analysis.minimumCorrectArrangements));
    increment(validArrangementCountDistribution, String(level.analysis.validArrangements.length));
    const validationErrors = validatePublishedLevel(level);
    if (validationErrors.length > 0) invalidPublishedLevels[level.id] = validationErrors;
    const solved = solveLevel(level);
    if (solved.status !== "solved") unsolvedLevelIds.push(level.id);
    if (solved.orphanTileIds.length > 0) orphanTiles[level.id] = solved.orphanTileIds;
    if (solved.missingTargetIds.length > 0) missingTargets[level.id] = solved.missingTargetIds;
  }

  for (const chapter of ["chapter-1", "chapter-2", "chapter-3", "chapter-4"]) {
    firstTenZeroCountByChapter[chapter] ??= 0;
  }
  const exactDuplicateGroups = groupExactDuplicates(levels);
  const nearDuplicates = findNearDuplicates(levels);
  const adjacentRepetitions = findAdjacentRepetitions(levels);
  const canonicalActionPatternReuse = groupCanonicalActions(levels);
  const levelById = new Map(levels.map((level) => [level.id, level]));
  const overusedCanonicalActionPatterns = Object.fromEntries(
    Object.entries(canonicalActionPatternReuse).filter(([, ids]) => {
      if (ids.length < 16) return false;
      const unexplained = ids.filter((id) => {
        const level = levelById.get(id);
        return level
          ? level.learning.reviewOf.length === 0
            && level.learning.scaffold !== "review"
            && level.learning.scaffold !== "transfer"
          : true;
      });
      return unexplained.length >= 16;
    })
  );
  const stationDiversity = auditStationDiversity(levels);
  const totalNumberTiles = numberValues.length;
  const zeroCount = numberTileValueDistribution["0"] ?? 0;
  const oneCount = numberTileValueDistribution["1"] ?? 0;
  const structuralCountsPass = ["chapter-1", "chapter-2", "chapter-3", "chapter-4"]
    .every((chapterId) => chapterCounts[chapterId] === 50)
    && Object.values(stationCounts).length === 20
    && Object.values(stationCounts).every((count) => count === 10);
  const stationDiversityPass = Object.values(stationDiversity).every(
    (station) => station.passesStructureMinimum && station.passesFirstFourActionMinimum
  );
  const passes = levels.length === 200
    && goldCount === 40
    && structuralCountsPass
    && (firstTenZeroCountByChapter["chapter-1"] ?? 0) === 0
    && exactDuplicateGroups.length === 0
    && adjacentRepetitions.length === 0
    && Object.keys(overusedCanonicalActionPatterns).length === 0
    && Object.keys(invalidPublishedLevels).length === 0
    && unsolvedLevelIds.length === 0
    && Object.keys(orphanTiles).length === 0
    && Object.keys(missingTargets).length === 0
    && Object.keys(uncoverableRepeatedValueTiles).length === 0
    && requiredSameVisibleMoveLevelIds.length === 0
    && stationDiversityPass;

  return {
    schemaVersion: 3,
    generatedAt,
    totalLevels: levels.length,
    chapterCounts: sortRecord(chapterCounts),
    stationCounts: sortRecord(stationCounts),
    goldCount,
    generatedCount: levels.length - goldCount,
    modeDistribution: sortRecord(modeDistribution),
    movableReelCountDistribution: sortRecord(movableReelCountDistribution),
    fixedOperatorDistribution: sortRecord(fixedOperatorDistribution),
    movableOperatorDistribution: sortRecord(movableOperatorDistribution),
    repeatedValueReelCount,
    repeatedValueLevelCount: repeatedValueLevelIds.size,
    repeatedValueReelKindDistribution: sortRecord(repeatedValueReelKindDistribution),
    repeatedValueTileCount,
    coverableRepeatedValueTileCount,
    uncoverableRepeatedValueTiles: sortNestedStringRecords(uncoverableRepeatedValueTiles),
    sameVisibleTransitionCount: Object.values(sameVisibleTransitions).reduce(
      (total, findings) => total + findings.length,
      0
    ),
    sameVisibleTransitionLevelCount: Object.keys(sameVisibleTransitions).length,
    sameVisibleTransitions: sortFindingRecords(sameVisibleTransitions),
    initialSameVisibleMoveLevelCount: Object.keys(initialSameVisibleMoves).length,
    initialSameVisibleMoves: sortFindingRecords(initialSameVisibleMoves),
    sameVisibleCompletionPaths: sortRecord(sameVisibleCompletionPaths),
    sameVisibleShortestPathBenefitLevelIds: [...sameVisibleShortestPathBenefitLevelIds].sort(),
    initialSameVisibleShortestPathBenefitLevelIds: [...initialSameVisibleShortestPathBenefitLevelIds].sort(),
    canonicalPlanSameExpressionIdentityLevelIds: [...canonicalPlanSameExpressionIdentityLevelIds].sort(),
    requiredSameVisibleMoveLevelIds: [...requiredSameVisibleMoveLevelIds].sort(),
    numberTileValueDistribution: sortNumericRecord(numberTileValueDistribution),
    chapterNumberTileValueDistribution: sortNestedRecords(chapterNumberTileValueDistribution),
    stationNumberTileValueDistribution: sortNestedRecords(stationNumberTileValueDistribution),
    targetDistribution: sortNumericRecord(targetDistribution),
    numberTileRange: {
      minimum: numberValues.length ? Math.min(...numberValues) : 0,
      maximum: numberValues.length ? Math.max(...numberValues) : 0
    },
    zeroCount,
    oneCount,
    zeroRatio: ratio(zeroCount, totalNumberTiles),
    oneRatio: ratio(oneCount, totalNumberTiles),
    firstTenZeroCountByChapter: sortRecord(firstTenZeroCountByChapter),
    minimumMovesDistribution: sortNumericRecord(minimumMovesDistribution),
    minimumCorrectArrangementsDistribution: sortNumericRecord(minimumCorrectArrangementsDistribution),
    validArrangementCountDistribution: sortNumericRecord(validArrangementCountDistribution),
    exactDuplicateGroups,
    nearDuplicates,
    adjacentRepetitions,
    canonicalActionPatternReuse,
    overusedCanonicalActionPatterns,
    stationDiversity,
    invalidPublishedLevels,
    unsolvedLevelIds,
    orphanTiles,
    missingTargets,
    generationRetryCount: 0,
    rejectedCandidateReasons: {},
    deterministicHash: hashLevels(levels),
    passes
  };
}

function findSameVisibleTransitions(
  level: PublishedEquationSliderLevel
): SameVisibleMoveFinding[] {
  const findings: SameVisibleMoveFinding[] = [];
  for (const [reelIndex, reel] of getMovableReels(level).entries()) {
    for (let fromIndex = 0; fromIndex < 3; fromIndex += 1) {
      for (const direction of ["up", "down"] as const) {
        const toIndex = wrapThree(fromIndex + (direction === "up" ? -1 : 1));
        const fromTile = reel.tiles[fromIndex];
        const toTile = reel.tiles[toIndex];
        if (fromTile.value !== toTile.value) continue;
        const alternativeIndex = 3 - fromIndex - toIndex;
        findings.push({
          reelId: reel.id,
          reelIndex,
          direction,
          fromIndex,
          toIndex,
          fromTileId: fromTile.id,
          toTileId: toTile.id,
          value: String(fromTile.value),
          alternativeDirection: direction === "up" ? "down" : "up",
          alternativeSteps: 2,
          hasVisibleAlternative: reel.tiles[alternativeIndex]?.value !== fromTile.value
        });
      }
    }
  }
  return findings.sort((left, right) =>
    left.reelIndex - right.reelIndex
      || left.fromIndex - right.fromIndex
      || left.direction.localeCompare(right.direction));
}

function canonicalPlanRepeatsExpressionAcrossIdentities(
  level: PublishedEquationSliderLevel
): boolean {
  const canonical = level.analysis.canonicalPlan
    .map((arrangement) => level.analysis.validArrangements.find(
      (candidate) => candidate.key === arrangement.indexes.join(".")
    ))
    .filter((arrangement): arrangement is PublishedEquationSliderLevel["analysis"]["validArrangements"][number] => Boolean(arrangement));
  for (let leftIndex = 0; leftIndex < canonical.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < canonical.length; rightIndex += 1) {
      const left = canonical[leftIndex];
      const right = canonical[rightIndex];
      if (
        left.expressionText === right.expressionText
        && left.selectedTileIds.some((tileId, index) => right.selectedTileIds[index] !== tileId)
      ) return true;
    }
  }
  return false;
}

function auditSameVisibleCompletionPaths(
  level: PublishedEquationSliderLevel,
  initialSameVisibleMove: boolean
): SameVisibleCompletionPathAudit {
  const shortestMovesWithSameVisibleEdges = shortestCompletionPath(level, false);
  const shortestMovesWithoutSameVisibleEdges = shortestCompletionPath(level, true);
  if (shortestMovesWithSameVisibleEdges === null) {
    throw new Error(`${level.id}: published solvable level has no completion path`);
  }
  return {
    initialSameVisibleMove,
    shortestMovesWithSameVisibleEdges,
    shortestMovesWithoutSameVisibleEdges,
    shortestPathDelta: shortestMovesWithoutSameVisibleEdges === null
      ? null
      : shortestMovesWithoutSameVisibleEdges - shortestMovesWithSameVisibleEdges,
    solvableWithoutSameVisibleEdges: shortestMovesWithoutSameVisibleEdges !== null
  };
}

function shortestCompletionPath(
  level: PublishedEquationSliderLevel,
  rejectSameVisibleEdges: boolean
): number | null {
  const reels = getMovableReels(level);
  const validByIndexes = new Map(
    level.analysis.validArrangements.map((arrangement) => [arrangement.indexes.join(","), arrangement])
  );
  const fullTileMask = (1 << level.requiredTileIds.length) - 1;
  const fullTargetMask = (1 << level.targets.length) - 1;
  const queue: Array<{
    readonly indexes: readonly number[];
    readonly tileMask: number;
    readonly targetMask: number;
    readonly distance: number;
  }> = [{ indexes: [...level.initialIndexes], tileMask: 0, targetMask: 0, distance: 0 }];
  const seen = new Set([`${level.initialIndexes.join(",")}|0|0`]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const state = queue[cursor];
    for (let reelIndex = 0; reelIndex < reels.length; reelIndex += 1) {
      for (const step of [-1, 1] as const) {
        const nextIndexes = [...state.indexes];
        nextIndexes[reelIndex] = wrapThree(nextIndexes[reelIndex] + step);
        if (
          rejectSameVisibleEdges
          && reels[reelIndex].tiles[state.indexes[reelIndex]].value
            === reels[reelIndex].tiles[nextIndexes[reelIndex]].value
        ) continue;
        const arrangement = validByIndexes.get(nextIndexes.join(","));
        const tileMask = state.tileMask | (arrangement?.tileMask ?? 0);
        const targetMask = state.targetMask | (arrangement?.targetMask ?? 0);
        if (tileMask === fullTileMask && targetMask === fullTargetMask) return state.distance + 1;
        const key = `${nextIndexes.join(",")}|${tileMask}|${targetMask}`;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ indexes: nextIndexes, tileMask, targetMask, distance: state.distance + 1 });
      }
    }
  }
  return null;
}

function wrapThree(index: number): number {
  return ((index % 3) + 3) % 3;
}

function groupExactDuplicates(levels: readonly PublishedEquationSliderLevel[]): readonly (readonly string[])[] {
  const groups = new Map<string, string[]>();
  for (const level of levels) {
    const signature = exactSignature(level);
    const ids = groups.get(signature) ?? [];
    ids.push(level.id);
    groups.set(signature, ids);
  }
  return [...groups.values()].filter((ids) => ids.length > 1).sort((a, b) => a[0].localeCompare(b[0]));
}

function findNearDuplicates(levels: readonly PublishedEquationSliderLevel[]): readonly NearDuplicateFinding[] {
  const findings: NearDuplicateFinding[] = [];
  const byStation = groupByStation(levels);
  for (const [stationId, stationLevels] of byStation) {
    for (let leftIndex = 0; leftIndex < stationLevels.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < stationLevels.length; rightIndex += 1) {
        const left = stationLevels[leftIndex];
        const right = stationLevels[rightIndex];
        const sharedSignals = NEAR_DUPLICATE_SIGNALS.filter(
          (signal) => left.analysis.signatures[signal] === right.analysis.signatures[signal]
        );
        if (sharedSignals.length >= 5) {
          findings.push({ leftId: left.id, rightId: right.id, stationId, sharedSignals });
        }
      }
    }
  }
  return findings;
}

function findAdjacentRepetitions(
  levels: readonly PublishedEquationSliderLevel[]
): readonly AdjacentRepetitionFinding[] {
  const findings: AdjacentRepetitionFinding[] = [];
  const byStation = groupByStation(levels);
  for (const stationLevels of byStation.values()) {
    const ordered = [...stationLevels].sort((a, b) => a.stationOrder - b.stationOrder);
    for (let index = 1; index < ordered.length; index += 1) {
      const left = ordered[index - 1];
      const right = ordered[index];
      if (left.analysis.signatures.numberMultiset === right.analysis.signatures.numberMultiset) {
        findings.push({ leftId: left.id, rightId: right.id, reason: "number-multiset" });
      }
      if (left.analysis.signatures.firstSuccessAction === right.analysis.signatures.firstSuccessAction) {
        findings.push({ leftId: left.id, rightId: right.id, reason: "canonical-action" });
      }
    }
  }
  return findings;
}

function groupCanonicalActions(
  levels: readonly PublishedEquationSliderLevel[]
): Readonly<Record<string, readonly string[]>> {
  const groups: Record<string, string[]> = {};
  for (const level of levels) {
    const key = level.analysis.signatures.firstSuccessAction;
    (groups[key] ??= []).push(level.id);
  }
  return Object.fromEntries(Object.entries(groups).sort(([left], [right]) => left.localeCompare(right)));
}

function auditStationDiversity(
  levels: readonly PublishedEquationSliderLevel[]
): Readonly<Record<string, StationDiversityAudit>> {
  const audit: Record<string, StationDiversityAudit> = {};
  for (const [stationId, stationLevels] of groupByStation(levels)) {
    const ordered = [...stationLevels].sort((a, b) => a.stationOrder - b.stationOrder);
    const structureFamilies = new Set(ordered.map((level) =>
      `${level.analysis.signatures.slotStructure}|${level.analysis.signatures.operatorPattern}|${level.mode}`)).size;
    const firstFourActionFamilies = new Set(
      ordered.slice(0, 4).map((level) => level.analysis.signatures.firstSuccessAction)
    ).size;
    audit[stationId] = {
      levelCount: ordered.length,
      structureFamilies,
      firstFourActionFamilies,
      passesStructureMinimum: structureFamilies >= 4,
      passesFirstFourActionMinimum: firstFourActionFamilies >= 3
    };
  }
  return sortRecord(audit);
}

function exactSignature(level: PublishedEquationSliderLevel): string {
  const signatures = level.analysis.signatures;
  return [
    level.mode,
    signatures.valueStructure,
    signatures.rotationNormalized,
    signatures.validArrangements,
    signatures.canonicalCoverage,
    signatures.firstSuccessAction,
    signatures.learningBand
  ].join("||");
}

function groupByStation(
  levels: readonly PublishedEquationSliderLevel[]
): ReadonlyMap<string, readonly PublishedEquationSliderLevel[]> {
  const groups = new Map<string, PublishedEquationSliderLevel[]>();
  for (const level of levels) {
    const stationLevels = groups.get(level.stationId) ?? [];
    stationLevels.push(level);
    groups.set(level.stationId, stationLevels);
  }
  return groups;
}

function hashLevels(levels: readonly PublishedEquationSliderLevel[]): string {
  const source = JSON.stringify(levels);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function ratio(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100_000) / 100_000;
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function sortNumericRecord(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    return Number.isNaN(leftNumber) || Number.isNaN(rightNumber)
      ? left.localeCompare(right)
      : leftNumber - rightNumber;
  }));
}

function sortNestedRecords(
  record: Record<string, Record<string, number>>
): Record<string, Readonly<Record<string, number>>> {
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, sortNumericRecord(value)])
  );
}

function sortNestedStringRecords(
  record: Record<string, string[]>
): Record<string, readonly string[]> {
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, [...value].sort()])
  );
}

function sortFindingRecords(
  record: Record<string, SameVisibleMoveFinding[]>
): Record<string, readonly SameVisibleMoveFinding[]> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}
