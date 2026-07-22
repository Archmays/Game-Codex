export const EQUATION_SLIDER_SAVE_VERSION = 1;

export type EquationSliderBadge = "independent" | "all-new" | "review-complete" | "try-again";

export interface LevelProgressRecord {
  readonly startedCount: number;
  readonly completed: boolean;
  readonly independent: boolean;
  readonly hintCount: number;
  readonly badges: readonly EquationSliderBadge[];
  readonly bestMoves?: number;
}

export interface EquationSliderProgress {
  readonly saveVersion: 1;
  readonly tutorialCompleted: boolean;
  readonly soundEnabled: boolean;
  readonly lastLevelId?: string;
  readonly levels: Readonly<Record<string, LevelProgressRecord>>;
  readonly seenCheckpoints: readonly string[];
}

export interface LoadedEquationSliderProgress {
  readonly progress: EquationSliderProgress;
  readonly canPersist: boolean;
  readonly migrated: boolean;
}

export type LevelMapState = "unstarted" | "in-progress" | "completed" | "review-suggested";

export type EquationSliderCheckpointKind = "normal" | "rest" | "station-review" | "chapter-review";

export interface CheckpointLevelDescriptor {
  readonly id: string;
  readonly chapterId: string;
  readonly unitId: string;
  readonly unitLevelNumber: number;
}

export interface CompletionCheckpoint {
  readonly kind: EquationSliderCheckpointKind;
  readonly checkpointId?: string;
}

export function createDefaultProgress(): EquationSliderProgress {
  return {
    saveVersion: EQUATION_SLIDER_SAVE_VERSION,
    tutorialCompleted: false,
    soundEnabled: true,
    levels: {},
    seenCheckpoints: []
  };
}

export function loadEquationSliderProgress(value: unknown): LoadedEquationSliderProgress {
  if (!isRecord(value)) {
    return { progress: createDefaultProgress(), canPersist: true, migrated: false };
  }
  if (typeof value.saveVersion === "number" && value.saveVersion > EQUATION_SLIDER_SAVE_VERSION) {
    return { progress: createDefaultProgress(), canPersist: false, migrated: false };
  }
  if (value.saveVersion === 0 || value.saveVersion === undefined) {
    return { progress: migrateLegacyProgress(value), canPersist: true, migrated: true };
  }
  if (value.saveVersion !== EQUATION_SLIDER_SAVE_VERSION) {
    return { progress: createDefaultProgress(), canPersist: true, migrated: false };
  }
  const levels = sanitizeLevelRecords(value.levels);
  return {
    progress: {
      saveVersion: EQUATION_SLIDER_SAVE_VERSION,
      tutorialCompleted: value.tutorialCompleted === true,
      soundEnabled: value.soundEnabled !== false,
      ...(typeof value.lastLevelId === "string" && isPublishedLevelId(value.lastLevelId)
        ? { lastLevelId: value.lastLevelId }
        : {}),
      levels,
      seenCheckpoints: sanitizeStringArray(value.seenCheckpoints)
    },
    canPersist: true,
    migrated: false
  };
}

export function markTutorialCompleted(progress: EquationSliderProgress): EquationSliderProgress {
  return { ...progress, tutorialCompleted: true };
}

export function setSoundEnabled(progress: EquationSliderProgress, soundEnabled: boolean): EquationSliderProgress {
  return { ...progress, soundEnabled };
}

export function levelMapState(record: LevelProgressRecord | undefined): LevelMapState {
  if (record?.completed) {
    return record.independent ? "completed" : "review-suggested";
  }
  return record && record.startedCount > 0 ? "in-progress" : "unstarted";
}

export function recordLevelStart(progress: EquationSliderProgress, levelId: string): EquationSliderProgress {
  const current = progress.levels[levelId] ?? emptyLevelRecord();
  return updateLevel(progress, levelId, {
    ...current,
    startedCount: current.startedCount + 1
  });
}

export function recordHintUse(progress: EquationSliderProgress, levelId: string): EquationSliderProgress {
  const current = progress.levels[levelId] ?? emptyLevelRecord();
  return updateLevel(progress, levelId, {
    ...current,
    hintCount: current.hintCount + 1
  });
}

export function completeLevelProgress(
  progress: EquationSliderProgress,
  levelId: string,
  result: {
    readonly independent: boolean;
    readonly moves: number;
    readonly badges: readonly EquationSliderBadge[];
  }
): EquationSliderProgress {
  const current = progress.levels[levelId] ?? emptyLevelRecord();
  const bestMoves = Number.isInteger(result.moves) && result.moves >= 0
    ? current.bestMoves === undefined
      ? result.moves
      : Math.min(current.bestMoves, result.moves)
    : current.bestMoves;
  return {
    ...updateLevel(progress, levelId, {
      ...current,
      completed: true,
      independent: current.independent || result.independent,
      badges: [...new Set([...current.badges, ...result.badges])],
      ...(bestMoves === undefined ? {} : { bestMoves })
    }),
    lastLevelId: levelId
  };
}

export function markCheckpointSeen(progress: EquationSliderProgress, checkpointId: string): EquationSliderProgress {
  if (progress.seenCheckpoints.includes(checkpointId)) {
    return progress;
  }
  return { ...progress, seenCheckpoints: [...progress.seenCheckpoints, checkpointId] };
}

export function resolveCompletionCheckpoint(
  progress: EquationSliderProgress,
  level: CheckpointLevelDescriptor,
  chapterLevels: readonly CheckpointLevelDescriptor[]
): CompletionCheckpoint {
  const unitLevels = chapterLevels.filter((candidate) => candidate.unitId === level.unitId);
  const chapterComplete = chapterLevels.length === 50
    && chapterLevels.every((candidate) => progress.levels[candidate.id]?.completed);
  const unitComplete = unitLevels.length === 10
    && unitLevels.every((candidate) => progress.levels[candidate.id]?.completed);
  const chapterCheckpointId = `${level.chapterId}-review`;
  if (chapterComplete && !progress.seenCheckpoints.includes(chapterCheckpointId)) {
    return { kind: "chapter-review", checkpointId: chapterCheckpointId };
  }
  const unitCheckpointId = `${level.unitId}-review`;
  if (unitComplete && !progress.seenCheckpoints.includes(unitCheckpointId)) {
    return { kind: "station-review", checkpointId: unitCheckpointId };
  }
  const restCheckpointId = `${level.id}-rest`;
  if (
    level.unitLevelNumber === 5
    && !progress.seenCheckpoints.includes(restCheckpointId)
  ) {
    return { kind: "rest", checkpointId: restCheckpointId };
  }
  return { kind: "normal" };
}

export function sanitizeLastLevelId(
  progress: EquationSliderProgress,
  validLevelIds: ReadonlySet<string>
): EquationSliderProgress {
  if (!progress.lastLevelId || validLevelIds.has(progress.lastLevelId)) {
    return progress;
  }
  const { lastLevelId: _invalid, ...safe } = progress;
  return safe;
}

function migrateLegacyProgress(value: Record<string, unknown>): EquationSliderProgress {
  const completedLevels = sanitizeStringArray(value.completedLevels);
  const hints = isRecord(value.hints) ? value.hints : {};
  const levels: Record<string, LevelProgressRecord> = {};
  for (const levelId of new Set([...completedLevels, ...Object.keys(hints)])) {
    if (!isPublishedLevelId(levelId)) {
      continue;
    }
    const hintCount = toNonNegativeInteger(hints[levelId]);
    levels[levelId] = {
      startedCount: 1,
      completed: completedLevels.includes(levelId),
      independent: completedLevels.includes(levelId) && hintCount === 0,
      hintCount,
      badges: completedLevels.includes(levelId) && hintCount === 0 ? ["independent"] : []
    };
  }
  return {
    saveVersion: EQUATION_SLIDER_SAVE_VERSION,
    tutorialCompleted: value.tutorialDone === true || value.tutorialCompleted === true,
    soundEnabled: value.muted !== true && value.soundEnabled !== false,
    levels,
    seenCheckpoints: []
  };
}

function sanitizeLevelRecords(value: unknown): Readonly<Record<string, LevelProgressRecord>> {
  if (!isRecord(value)) {
    return {};
  }
  const records: Record<string, LevelProgressRecord> = {};
  for (const [levelId, raw] of Object.entries(value)) {
    if (!isPublishedLevelId(levelId) || !isRecord(raw)) {
      continue;
    }
    const completed = raw.completed === true;
    const badges = completed ? sanitizeStringArray(raw.badges).filter(isBadge) : [];
    const bestMoves = toOptionalNonNegativeInteger(raw.bestMoves);
    records[levelId] = {
      startedCount: toNonNegativeInteger(raw.startedCount),
      completed,
      independent: completed && raw.independent === true,
      hintCount: toNonNegativeInteger(raw.hintCount),
      badges,
      ...(!completed || bestMoves === undefined ? {} : { bestMoves })
    };
  }
  return records;
}

function updateLevel(
  progress: EquationSliderProgress,
  levelId: string,
  levelProgress: LevelProgressRecord
): EquationSliderProgress {
  return {
    ...progress,
    levels: { ...progress.levels, [levelId]: levelProgress },
    lastLevelId: levelId
  };
}

function emptyLevelRecord(): LevelProgressRecord {
  return {
    startedCount: 0,
    completed: false,
    independent: false,
    hintCount: 0,
    badges: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublishedLevelId(value: string): boolean {
  return /^es-[1-4]-(?:0[1-9]|[1-4]\d|50)$/.test(value);
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
}

function toNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function toOptionalNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function isBadge(value: string): value is EquationSliderBadge {
  return ["independent", "all-new", "review-complete", "try-again"].includes(value);
}
