import {
  EQUATION_SLIDER_SAVE_VERSION,
  type CheckpointLevelDescriptor,
  type CompletionCheckpoint,
  type EquationSliderBadge,
  type EquationSliderProgress,
  type LegacyProgressArchive,
  type LevelMapState,
  type LevelProgressRecord,
  type LoadedEquationSliderProgress
} from "./types";

export {
  EQUATION_SLIDER_SAVE_VERSION,
  type CheckpointLevelDescriptor,
  type CompletionCheckpoint,
  type EquationSliderBadge,
  type EquationSliderProgress,
  type LegacyProgressArchive,
  type LevelMapState,
  type LevelProgressRecord,
  type LoadedEquationSliderProgress
} from "./types";

export function createDefaultProgress(): EquationSliderProgress {
  return {
    saveVersion: EQUATION_SLIDER_SAVE_VERSION,
    tutorialCompleted: false,
    upgradeNoticeSeen: false,
    soundEnabled: true,
    levels: {},
    seenCheckpoints: []
  };
}

export function loadEquationSliderProgress(value: unknown): LoadedEquationSliderProgress {
  if (!isRecord(value)) {
    return { progress: createDefaultProgress(), canPersist: true, migrated: false };
  }

  const sourceVersion = value.saveVersion;
  if (
    typeof sourceVersion === "number"
    && sourceVersion > EQUATION_SLIDER_SAVE_VERSION
  ) {
    return { progress: createDefaultProgress(), canPersist: false, migrated: false };
  }

  if (sourceVersion === 0 || sourceVersion === 1 || sourceVersion === undefined) {
    return {
      progress: migrateLegacyProgress(value, sourceVersion === 1 ? 1 : 0),
      canPersist: true,
      migrated: true
    };
  }

  if (sourceVersion !== EQUATION_SLIDER_SAVE_VERSION) {
    return { progress: createDefaultProgress(), canPersist: true, migrated: false };
  }

  return {
    progress: sanitizeCurrentProgress(value),
    canPersist: true,
    migrated: false
  };
}

export function markTutorialCompleted(progress: EquationSliderProgress): EquationSliderProgress {
  return { ...progress, tutorialCompleted: true };
}

export function markUpgradeNoticeSeen(progress: EquationSliderProgress): EquationSliderProgress {
  return { ...progress, upgradeNoticeSeen: true };
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

export function markCompletionCheckpointSeen(
  progress: EquationSliderProgress,
  checkpoint: CompletionCheckpoint,
  level: CheckpointLevelDescriptor
): EquationSliderProgress {
  let next = progress;
  if (checkpoint.checkpointId) {
    next = markCheckpointSeen(next, checkpoint.checkpointId);
  }
  // A chapter-ending level also closes its final station. The chapter card is
  // the stronger message, but both checkpoints must become durable so replay
  // cannot surface the weaker station review afterward.
  if (checkpoint.kind === "chapter-review") {
    next = markCheckpointSeen(next, `${level.stationId}-review`);
  }
  return next;
}

export function resolveCompletionCheckpoint(
  progress: EquationSliderProgress,
  level: CheckpointLevelDescriptor,
  chapterLevels: readonly CheckpointLevelDescriptor[]
): CompletionCheckpoint {
  const stationLevels = chapterLevels.filter((candidate) => candidate.stationId === level.stationId);
  const chapterComplete = chapterLevels.length === 50
    && chapterLevels.every((candidate) => progress.levels[candidate.id]?.completed);
  const stationComplete = stationLevels.length === 10
    && stationLevels.every((candidate) => progress.levels[candidate.id]?.completed);

  const chapterCheckpointId = `${level.chapterId}-review`;
  if (chapterComplete && !progress.seenCheckpoints.includes(chapterCheckpointId)) {
    return { kind: "chapter-review", checkpointId: chapterCheckpointId };
  }

  const stationCheckpointId = `${level.stationId}-review`;
  if (stationComplete && !progress.seenCheckpoints.includes(stationCheckpointId)) {
    return { kind: "station-review", checkpointId: stationCheckpointId };
  }

  const restCheckpointId = `${level.id}-rest`;
  if (level.stationOrder === 5 && !progress.seenCheckpoints.includes(restCheckpointId)) {
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

function migrateLegacyProgress(
  value: Record<string, unknown>,
  sourceSaveVersion: 0 | 1
): EquationSliderProgress {
  const completedLevelIds = sourceSaveVersion === 1
    ? completedIdsFromVersionOne(value.levels)
    : sanitizePublishedLevelIds(value.completedLevels);
  const lastLevelId = typeof value.lastLevelId === "string" && isPublishedLevelId(value.lastLevelId)
    ? value.lastLevelId
    : undefined;
  const legacy: LegacyProgressArchive = {
    sourceSaveVersion,
    completedLevelIds,
    ...(lastLevelId === undefined ? {} : { lastLevelId })
  };

  return {
    ...createDefaultProgress(),
    soundEnabled: readLegacySoundPreference(value),
    legacy
  };
}

function sanitizeCurrentProgress(value: Record<string, unknown>): EquationSliderProgress {
  const lastLevelId = typeof value.lastLevelId === "string" && isPublishedLevelId(value.lastLevelId)
    ? value.lastLevelId
    : undefined;
  const legacy = sanitizeLegacyArchive(value.legacy);

  return {
    saveVersion: EQUATION_SLIDER_SAVE_VERSION,
    tutorialCompleted: value.tutorialCompleted === true,
    upgradeNoticeSeen: value.upgradeNoticeSeen === true,
    soundEnabled: value.soundEnabled !== false,
    ...(lastLevelId === undefined ? {} : { lastLevelId }),
    levels: sanitizeLevelRecords(value.levels),
    seenCheckpoints: sanitizeStringArray(value.seenCheckpoints),
    ...(legacy === undefined ? {} : { legacy })
  };
}

function completedIdsFromVersionOne(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }
  return Object.entries(value)
    .filter(([levelId, record]) => isPublishedLevelId(levelId) && isRecord(record) && record.completed === true)
    .map(([levelId]) => levelId);
}

function readLegacySoundPreference(value: Record<string, unknown>): boolean {
  if (typeof value.soundEnabled === "boolean") {
    return value.soundEnabled;
  }
  if (typeof value.muted === "boolean") {
    return !value.muted;
  }
  return true;
}

function sanitizeLegacyArchive(value: unknown): LegacyProgressArchive | undefined {
  if (!isRecord(value) || (value.sourceSaveVersion !== 0 && value.sourceSaveVersion !== 1)) {
    return undefined;
  }
  const lastLevelId = typeof value.lastLevelId === "string" && isPublishedLevelId(value.lastLevelId)
    ? value.lastLevelId
    : undefined;
  return {
    sourceSaveVersion: value.sourceSaveVersion,
    completedLevelIds: sanitizePublishedLevelIds(value.completedLevelIds),
    ...(lastLevelId === undefined ? {} : { lastLevelId })
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

function sanitizePublishedLevelIds(value: unknown): string[] {
  return sanitizeStringArray(value).filter(isPublishedLevelId);
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
