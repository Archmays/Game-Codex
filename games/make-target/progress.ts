export const MAKE_TARGET_SAVE_KEY = "family-games/make-target/progress";
export const MAKE_TARGET_SAVE_VERSION = 1;

export interface MakeTargetSaveV1 {
  readonly version: 1;
  readonly wins: number;
  readonly completedPuzzleIds: readonly string[];
  readonly [field: string]: unknown;
}

export interface LoadedMakeTargetSave {
  readonly save: MakeTargetSaveV1;
  readonly canPersist: boolean;
  readonly migrated: boolean;
}

function emptySave(): MakeTargetSaveV1 {
  return { version: 1, wins: 0, completedPuzzleIds: [] };
}

function readOnly(): LoadedMakeTargetSave {
  return { save: emptySave(), canPersist: false, migrated: false };
}

export function loadMakeTargetSave(value: unknown): LoadedMakeTargetSave {
  if (value === null) return { save: emptySave(), canPersist: true, migrated: false };
  if (typeof value !== "object" || Array.isArray(value) || !value) return readOnly();
  const record = value as Record<string, unknown>;
  const legacy = !("version" in record);
  if (!legacy && record.version !== MAKE_TARGET_SAVE_VERSION) return readOnly();
  if (!Number.isSafeInteger(record.wins) || Number(record.wins) < 0) return readOnly();
  const ids = record.completedPuzzleIds;
  if (!(legacy && ids === undefined)
    && (!Array.isArray(ids) || !ids.every((id) => typeof id === "string" && id.trim().length > 0))) return readOnly();
  const { version: _version, wins: _wins, completedPuzzleIds: _ids, ...extensions } = record;
  return {
    save: {
      version: MAKE_TARGET_SAVE_VERSION,
      wins: Number(record.wins),
      completedPuzzleIds: [...new Set((ids ?? []) as string[])].sort(),
      ...extensions,
    },
    canPersist: true,
    migrated: legacy,
  };
}

export type TargetCompletionWrite = "saved" | "already-saved" | "unavailable" | "changed";

/**
 * A page may write only the exact storage generation it read. A different tab
 * or Vault restore invalidates this page; a completed local round still works.
 * No probe writes, repair-on-read, or in-progress game state are stored.
 */
export function createTargetProgressSession(storage?: Storage): {
  readonly save: MakeTargetSaveV1;
  complete: (puzzleId: string) => TargetCompletionWrite;
} {
  let target: Storage | undefined;
  let expectedRaw: string | null = null;
  let loaded = readOnly();
  try {
    target = storage ?? window.localStorage;
    expectedRaw = target.getItem(MAKE_TARGET_SAVE_KEY);
    // Stored JSON null is unrecognized data; only a missing key is a fresh save.
    loaded = expectedRaw === null
      ? loadMakeTargetSave(null)
      : JSON.parse(expectedRaw) === null ? readOnly() : loadMakeTargetSave(JSON.parse(expectedRaw));
  } catch { /* Preserve unreadable bytes and allow local play. */ }
  let save = loaded.save;
  let writable = loaded.canPersist;
  let unavailableReason: TargetCompletionWrite = "unavailable";
  const localCompletions = new Set(save.completedPuzzleIds);

  return {
    get save() { return save; },
    complete(puzzleId): TargetCompletionWrite {
      if (!writable || !target) return unavailableReason;
      try {
        if (target.getItem(MAKE_TARGET_SAVE_KEY) !== expectedRaw) {
          writable = false;
          unavailableReason = "changed";
          return unavailableReason;
        }
        if (localCompletions.has(puzzleId)) return "already-saved";
        if (save.wins === Number.MAX_SAFE_INTEGER) {
          writable = false;
          return "unavailable";
        }
        const next = {
          ...save,
          wins: save.wins + 1,
          completedPuzzleIds: [...save.completedPuzzleIds, puzzleId].sort(),
        };
        const raw = JSON.stringify(next);
        target.setItem(MAKE_TARGET_SAVE_KEY, raw);
        expectedRaw = raw;
        save = next;
        localCompletions.add(puzzleId);
        return "saved";
      } catch {
        writable = false;
        return "unavailable";
      }
    },
  };
}
