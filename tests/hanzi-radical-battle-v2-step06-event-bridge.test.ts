import { createStep06EventBridge, readStep06EventLog } from "../apps/my-game-world/second-use/event-bridge";
import { createStep06SyntheticCompleteSave, STEP06_CANONICAL_ORIGIN, verifyStep06ProgressContinuity } from "../apps/my-game-world/second-use/progress-continuity";
import { authorizeStep06Session } from "../apps/my-game-world/second-use/session";
import { GOLDEN_SLICE_SAVE_KEY } from "../games/hanzi-radical-battle/v2/golden-slice/save/schema";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("Hanzi V2 STEP 06 navigation-safe event bridge", () => {
  it("keeps sequence and relative time across bridge recreation", () => {
    const storage = new MemoryStorage();
    storage.setItem(GOLDEN_SLICE_SAVE_KEY, JSON.stringify(createStep06SyntheticCompleteSave()));
    const continuity = verifyStep06ProgressContinuity(STEP06_CANONICAL_ORIGIN, storage);
    if (!continuity.ok) throw new Error("fixture invalid");
    const grant = authorizeStep06Session(storage, { sessionId: "s06-12345678", evidenceKind: "SYNTHETIC_TOOLING_TEST_ONLY", buildCommit: "a".repeat(40), intervalBucket: "ONE_TO_THREE_DAYS", soundMode: "START_MUTED", progressContinuity: continuity.projection, nowMs: 100 });
    const first = createStep06EventBridge({ grant, storage, now: () => 110, broadcastChannelFactory: () => { throw new Error("fallback"); } });
    first.emit("session_opened"); first.emit("world_ready"); first.close();
    const second = createStep06EventBridge({ grant, storage, now: () => 245, broadcastChannelFactory: () => { throw new Error("fallback"); } });
    second.emit("world_first_action"); second.emit("world_destination_opened", { destinationId: "FOREST" });
    expect(readStep06EventLog(storage, grant.sessionId).map(({ sequence, relativeMs, eventType }) => [sequence, relativeMs, eventType])).toEqual([
      [1, 10, "session_opened"], [2, 10, "world_ready"], [3, 145, "world_first_action"], [4, 145, "world_destination_opened"],
    ]);
    second.close();
  });
});
