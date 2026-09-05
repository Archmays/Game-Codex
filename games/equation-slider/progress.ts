import { EQUATION_SLIDER_CONTENT_REVISIONS } from "./content-revisions";
import {
  EQUATION_SLIDER_SAVE_VERSION,
  type CheckpointLevelDescriptor,
  type CompletionCheckpoint,
  type EquationSliderBadge,
  type EquationSliderProgress,
  type LegacyProgressArchive,
  type LevelMapState,
  type LevelProgressRecord,
  type LevelRevisionProgressRecord,
  type LevelRevisionState,
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
  type LevelRevisionProgressRecord,
  type LevelRevisionState,
  type LoadedEquationSliderProgress
} from "./types";

const CURRENT_PROGRESS_KEY = "family-games/equation-slider/progress-v3";
const LEGACY_PROGRESS_KEY = "family-games/equation-slider/progress";

/** Keep corrupt/unknown bytes distinct from a genuinely absent save. */
export function createEquationSliderProgressStore(
  storage: Pick<Storage, "getItem" | "setItem">
): {
  readonly loaded: LoadedEquationSliderProgress;
  readonly persist: (progress: EquationSliderProgress) => boolean;
} {
  let expectedRaw: string | null;
  let loaded: LoadedEquationSliderProgress;
  try {
    expectedRaw = storage.getItem(CURRENT_PROGRESS_KEY);
    const sourceRaw = expectedRaw === null ? storage.getItem(LEGACY_PROGRESS_KEY) : expectedRaw;
    if (sourceRaw === null) {
      loaded = { progress: createDefaultProgress(), canPersist: true, migrated: false };
    } else {
      const sourceValue: unknown = JSON.parse(sourceRaw);
      loaded = loadEquationSliderProgress(sourceValue);
      // Legacy-key fallback keeps its source bytes forever. If an old-format
      // record occupies the current key, migration would replace those bytes,
      // so unknown/damaged nested records must also remain read-only.
      if (expectedRaw !== null && loaded.migrated && !isIntactLegacyProgress(sourceValue)) {
        loaded = { ...loaded, canPersist: false, migrated: false };
      }
    }
  } catch {
    return {
      loaded: { progress: createDefaultProgress(), canPersist: false, migrated: false },
      persist: () => false
    };
  }

  let writable = loaded.canPersist;
  return {
    loaded,
    persist(progress): boolean {
      if (!writable) return false;
      try {
        // A Vault restore or another tab may have replaced this record since
        // mount. Preserve those exact bytes and require a fresh load.
        if (storage.getItem(CURRENT_PROGRESS_KEY) !== expectedRaw || !isKnownCurrentProgress(progress)) {
          writable = false;
          return false;
        }
        const nextRaw = JSON.stringify(progress);
        storage.setItem(CURRENT_PROGRESS_KEY, nextRaw);
        if (storage.getItem(CURRENT_PROGRESS_KEY) !== nextRaw) {
          writable = false;
          return false;
        }
        expectedRaw = nextRaw;
        return true;
      } catch {
        writable = false;
        return false;
      }
    }
  };
}

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
    return { progress: createDefaultProgress(), canPersist: false, migrated: false };
  }

  const sourceVersion = value.saveVersion;
  if (
    typeof sourceVersion === "number"
    && sourceVersion > EQUATION_SLIDER_SAVE_VERSION
  ) {
    return { progress: createDefaultProgress(), canPersist: false, migrated: false };
  }

  if (sourceVersion === 0 || sourceVersion === 1 || sourceVersion === undefined) {
    const recognizedLegacy = isKnownLegacyProgress(value, sourceVersion === 1 ? 1 : 0);
    return {
      progress: migrateLegacyProgress(value, sourceVersion === 1 ? 1 : 0),
      canPersist: recognizedLegacy,
      migrated: recognizedLegacy
    };
  }

  if (sourceVersion !== EQUATION_SLIDER_SAVE_VERSION) {
    return { progress: createDefaultProgress(), canPersist: false, migrated: false };
  }

  return {
    progress: sanitizeCurrentProgress(value),
    canPersist: isKnownCurrentProgress(value),
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

export function levelMapState(record: LevelRevisionProgressRecord | undefined): LevelMapState {
  if (record?.completed) {
    return record.independent ? "completed" : "review-suggested";
  }
  return record && record.startedCount > 0 ? "in-progress" : "unstarted";
}

export function getLevelRevisionProgress(
  record: LevelProgressRecord | undefined,
  revision?: string
): LevelRevisionProgressRecord | undefined {
  return revision === undefined ? record : record?.revisions?.[revision];
}

export function levelRevisionState(
  record: LevelProgressRecord | undefined,
  revision?: string
): LevelRevisionState {
  const current = getLevelRevisionProgress(record, revision);
  const state = levelMapState(current);
  if (revision !== undefined && state === "unstarted" && record
    && (record.completed || record.startedCount > 0 || record.hintCount > 0)) {
    return "previously-played";
  }
  return state;
}

export function recordLevelStart(
  progress: EquationSliderProgress,
  levelId: string,
  revision?: string
): EquationSliderProgress {
  const current = progress.levels[levelId] ?? emptyLevelRecord();
  const revised = revision === undefined ? undefined : current.revisions?.[revision] ?? emptyLevelRecord();
  return updateLevel(progress, levelId, {
    ...current,
    startedCount: current.startedCount + 1,
    ...(revision === undefined || revised === undefined ? {} : {
      revisions: { ...current.revisions, [revision]: { ...revised, startedCount: revised.startedCount + 1 } }
    })
  });
}

export function recordHintUse(
  progress: EquationSliderProgress,
  levelId: string,
  revision?: string
): EquationSliderProgress {
  const current = progress.levels[levelId] ?? emptyLevelRecord();
  const revised = revision === undefined ? undefined : current.revisions?.[revision] ?? emptyLevelRecord();
  return updateLevel(progress, levelId, {
    ...current,
    hintCount: current.hintCount + 1,
    ...(revision === undefined || revised === undefined ? {} : {
      revisions: { ...current.revisions, [revision]: { ...revised, hintCount: revised.hintCount + 1 } }
    })
  });
}

export function completeLevelProgress(
  progress: EquationSliderProgress,
  levelId: string,
  result: {
    readonly independent: boolean;
    readonly moves: number;
    readonly badges: readonly EquationSliderBadge[];
  },
  revision?: string
): EquationSliderProgress {
  const current = progress.levels[levelId] ?? emptyLevelRecord();
  const currentBoard = revision === undefined ? current : current.revisions?.[revision] ?? emptyLevelRecord();
  const bestMoves = Number.isInteger(result.moves) && result.moves >= 0
    ? currentBoard.bestMoves === undefined
      ? result.moves
      : Math.min(currentBoard.bestMoves, result.moves)
    : currentBoard.bestMoves;
  const completedBoard: LevelRevisionProgressRecord = {
    ...currentBoard,
    completed: true,
    independent: currentBoard.independent || result.independent,
    badges: [...new Set([...currentBoard.badges, ...result.badges])],
    ...(bestMoves === undefined ? {} : { bestMoves })
  };

  return {
    ...updateLevel(progress, levelId, {
      ...current,
      completed: true,
      independent: current.independent || result.independent,
      badges: [...new Set([...current.badges, ...result.badges])],
      // The original board's best remains historical, never a comparison with
      // moves on a revised board. Unlock/completion above remains cumulative.
      ...(revision === undefined
        ? bestMoves === undefined ? {} : { bestMoves }
        : { revisions: { ...current.revisions, [revision]: completedBoard } })
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
    records[levelId] = {
      ...sanitizeLevelStats(raw),
      ...(raw.revisions === undefined ? {} : { revisions: sanitizeRevisionRecords(raw.revisions, levelId) })
    };
  }
  return records;
}

function sanitizeLevelStats(raw: Record<string, unknown>): LevelRevisionProgressRecord {
  const completed = raw.completed === true;
  const badges = completed ? sanitizeStringArray(raw.badges).filter(isBadge) : [];
  const bestMoves = toOptionalNonNegativeInteger(raw.bestMoves);
  return {
    startedCount: toNonNegativeInteger(raw.startedCount),
    completed,
    independent: completed && raw.independent === true,
    hintCount: toNonNegativeInteger(raw.hintCount),
    badges,
    ...(!completed || bestMoves === undefined ? {} : { bestMoves })
  };
}

function sanitizeRevisionRecords(
  value: unknown,
  levelId: string
): Readonly<Record<string, LevelRevisionProgressRecord>> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([revision, raw]) => revision === EQUATION_SLIDER_CONTENT_REVISIONS[levelId] && isRecord(raw))
    .map(([revision, raw]) => [revision, sanitizeLevelStats(raw as Record<string, unknown>)]));
}

function isKnownCurrentProgress(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "saveVersion", "tutorialCompleted", "upgradeNoticeSeen", "soundEnabled",
    "lastLevelId", "levels", "seenCheckpoints", "legacy"
  ])) return false;
  if (value.saveVersion !== EQUATION_SLIDER_SAVE_VERSION
    || typeof value.tutorialCompleted !== "boolean"
    || typeof value.upgradeNoticeSeen !== "boolean"
    || typeof value.soundEnabled !== "boolean"
    || (value.lastLevelId !== undefined && (typeof value.lastLevelId !== "string" || !isPublishedLevelId(value.lastLevelId)))
    || !isRecord(value.levels)
    || !isStringArray(value.seenCheckpoints)
    || (value.legacy !== undefined && !isKnownLegacyArchive(value.legacy))) return false;
  return Object.entries(value.levels).every(([levelId, raw]) => {
    if (!isPublishedLevelId(levelId) || !isKnownLevelStats(raw, true)) return false;
    if (raw.revisions === undefined) return true;
    return EQUATION_SLIDER_CONTENT_REVISIONS[levelId] !== undefined
      && isRecord(raw.revisions) && Object.entries(raw.revisions).every(([revision, stats]) =>
      revision === EQUATION_SLIDER_CONTENT_REVISIONS[levelId] && isKnownLevelStats(stats));
  });
}

function isKnownLevelStats(
  value: unknown,
  allowRevisions = false
): value is Record<string, unknown> {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "startedCount", "completed", "independent", "hintCount", "badges", "bestMoves",
    ...(allowRevisions ? ["revisions"] : [])
  ])) return false;
  return isNonNegativeInteger(value.startedCount)
    && typeof value.completed === "boolean"
    && typeof value.independent === "boolean"
    && isNonNegativeInteger(value.hintCount)
    && Array.isArray(value.badges) && value.badges.every((badge) => typeof badge === "string" && isBadge(badge))
    && (value.bestMoves === undefined || isNonNegativeInteger(value.bestMoves))
    && (value.completed || (!value.independent && value.badges.length === 0 && value.bestMoves === undefined));
}

function isKnownLegacyArchive(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ["sourceSaveVersion", "completedLevelIds", "lastLevelId"])
    && (value.sourceSaveVersion === 0 || value.sourceSaveVersion === 1)
    && isStringArray(value.completedLevelIds) && value.completedLevelIds.every(isPublishedLevelId)
    && (value.lastLevelId === undefined || (typeof value.lastLevelId === "string" && isPublishedLevelId(value.lastLevelId)));
}

function isKnownLegacyProgress(value: Record<string, unknown>, version: 0 | 1): boolean {
  // Legacy sources remain byte-for-byte in their original key. Recognize their
  // established fields, while refusing an unrelated/unknown object as a save.
  return version === 0
    ? hasOnlyKeys(value, ["saveVersion", "completedLevels", "lastLevelId", "tutorialDone", "muted", "hints", "soundEnabled"])
      && Array.isArray(value.completedLevels)
    : hasOnlyKeys(value, ["saveVersion", "tutorialCompleted", "soundEnabled", "lastLevelId", "levels", "seenCheckpoints"])
      && isRecord(value.levels);
}

function isIntactLegacyProgress(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if ((value.lastLevelId !== undefined && (typeof value.lastLevelId !== "string" || !isPublishedLevelId(value.lastLevelId)))
    || !["soundEnabled", "muted", "tutorialDone", "tutorialCompleted"].every((key) =>
      value[key] === undefined || typeof value[key] === "boolean")) return false;
  if (value.saveVersion === 1) {
    return isRecord(value.levels)
      && Object.entries(value.levels).every(([levelId, raw]) => isPublishedLevelId(levelId)
        && isRecord(raw) && typeof raw.completed === "boolean" && isKnownLevelStats({ ...emptyLevelRecord(), ...raw }))
      && (value.seenCheckpoints === undefined || isStringArray(value.seenCheckpoints));
  }
  return isStringArray(value.completedLevels) && value.completedLevels.every(isPublishedLevelId)
    && (value.hints === undefined || (isRecord(value.hints)
      && Object.entries(value.hints).every(([levelId, count]) => isPublishedLevelId(levelId) && isNonNegativeInteger(count))));
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
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
