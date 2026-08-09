import { GOLDEN_SLICE_SAVE_KEY } from "../../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import { writeGoldenSliceSave, type GoldenSliceStorageLike } from "../../games/hanzi-radical-battle/v2/golden-slice/save/store";
import {
  createStep06SyntheticCompleteSave,
  verifyStep06ProgressContinuity,
  type Step06ProgressContinuityResult,
} from "../my-game-world/second-use/progress-continuity";
import {
  authorizeStep06Session,
  createStep06SessionId,
  type Step06IntervalBucket,
  type Step06SessionGrant,
  type Step06SoundMode,
} from "../my-game-world/second-use/session";

export const STEP06_FIXTURE_MARKER = "SYNTHETIC_TOOLING_TEST_ONLY";

export function isStep06FixtureRoute(search: URLSearchParams): boolean {
  return search.get("fixture") === STEP06_FIXTURE_MARKER;
}

export function prepareStep06FixtureProgress(storage: GoldenSliceStorageLike): boolean {
  if (storage.getItem(GOLDEN_SLICE_SAVE_KEY) !== null) return false;
  writeGoldenSliceSave(storage, createStep06SyntheticCompleteSave());
  return true;
}

export function preflightStep06Continuity(origin: string, storage: GoldenSliceStorageLike): Step06ProgressContinuityResult {
  return verifyStep06ProgressContinuity(origin, storage);
}

export function startStep06AuthorizedSession(input: {
  readonly storage: GoldenSliceStorageLike;
  readonly origin: string;
  readonly buildCommit: string;
  readonly intervalBucket: Step06IntervalBucket;
  readonly soundMode: Step06SoundMode;
  readonly fixture: boolean;
}): Step06SessionGrant {
  if (input.soundMode === "CANCEL") throw new Error("STEP 06 start cancelled");
  const continuity = verifyStep06ProgressContinuity(input.origin, input.storage);
  if (!continuity.ok) throw new Error("SECOND_USE_PROGRESS_CONTINUITY_BLOCKED");
  return authorizeStep06Session(input.storage, {
    sessionId: createStep06SessionId(),
    evidenceKind: input.fixture ? "SYNTHETIC_TOOLING_TEST_ONLY" : "REAL_CHILD_SECOND_USE",
    buildCommit: input.buildCommit,
    intervalBucket: input.intervalBucket,
    soundMode: input.soundMode,
    progressContinuity: continuity.projection,
  });
}
