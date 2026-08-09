import {
  createChildFirstUseEventBridge,
  createFirstUseEventReceiver,
  eventLogStorageKey,
  readFirstUseEventLog,
  type FirstUseBroadcastChannelLike,
} from "../games/hanzi-radical-battle/v2/golden-slice/first-use/event-bridge";
import type { FirstUseStorage } from "../games/hanzi-radical-battle/v2/golden-slice/first-use/session";

const sessionId = `s04-${"d".repeat(32)}`;

class MemoryStorage implements FirstUseStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

class FakeChannel implements FirstUseBroadcastChannelLike {
  static readonly groups = new Map<string, Set<FakeChannel>>();
  readonly listeners = new Set<EventListener>();
  constructor(readonly name: string) {
    const group = FakeChannel.groups.get(name) ?? new Set<FakeChannel>();
    group.add(this);
    FakeChannel.groups.set(name, group);
  }
  postMessage(message: unknown) {
    for (const peer of FakeChannel.groups.get(this.name) ?? []) {
      if (peer === this) continue;
      for (const listener of peer.listeners) listener({ data: message } as MessageEvent<unknown>);
    }
  }
  addEventListener(_type: "message", listener: EventListener) { this.listeners.add(listener); }
  removeEventListener(_type: "message", listener: EventListener) { this.listeners.delete(listener); }
  close() {
    FakeChannel.groups.get(this.name)?.delete(this);
    this.listeners.clear();
  }
}

describe("Hanzi V2 STEP 04 same-origin event bridge", () => {
  beforeEach(() => FakeChannel.groups.clear());

  it("streams strict increasing minimal events over BroadcastChannel and delivers stop", () => {
    const storage = new MemoryStorage();
    let now = 100;
    let stopCode = "";
    const child = createChildFirstUseEventBridge({
      mode: "child-first-use",
      sessionId,
      storage,
      broadcastChannel: FakeChannel,
      now: () => now,
      startedAtMs: 100,
      onStop: (value) => { stopCode = value; },
    });
    const receiver = createFirstUseEventReceiver({ sessionId, storage, broadcastChannel: FakeChannel });
    child.emit("session_opened", { muted: false, replayIndex: 0 });
    now = 245;
    child.emit("phase_entered", { phase: "camp_intro" });
    expect(receiver.getEvents().map(({ sequence, relativeMs, eventType }) => [sequence, relativeMs, eventType])).toEqual([
      [1, 0, "session_opened"],
      [2, 145, "phase_entered"],
    ]);
    receiver.sendStop("CHILD_REQUEST");
    expect(stopCode).toBe("CHILD_REQUEST");
    receiver.close();
    child.close();
  });

  it("recovers through the local log without an observer and de-duplicates on reconnect", () => {
    const storage = new MemoryStorage();
    const child = createChildFirstUseEventBridge({ mode: "child-first-use", sessionId, storage, broadcastChannel: null, now: () => 10, startedAtMs: 0 });
    expect(() => child.emit("child_route_ready", { muted: true })).not.toThrow();
    expect(() => child.emit("phase_entered", { phase: "boot" })).not.toThrow();
    const receiver = createFirstUseEventReceiver({ sessionId, storage, broadcastChannel: null });
    expect(receiver.getEvents().map(({ sequence }) => sequence)).toEqual([1, 2]);
    receiver.reconnect();
    expect(receiver.getEvents().map(({ sequence }) => sequence)).toEqual([1, 2]);

    const raw = JSON.parse(storage.getItem(eventLogStorageKey(sessionId)) ?? "[]");
    storage.setItem(eventLogStorageKey(sessionId), JSON.stringify([...raw, raw[0]]));
    expect(readFirstUseEventLog(storage, sessionId).map(({ sequence }) => sequence)).toEqual([1, 2]);
    receiver.close();
    child.close();
  });

  it("is inactive outside child-first-use mode and rejects answer-bearing or free metadata", () => {
    const storage = new MemoryStorage();
    const inactive = createChildFirstUseEventBridge({ mode: "review", sessionId, storage, broadcastChannel: null });
    expect(inactive.active).toBe(false);
    expect(inactive.emit("phase_entered", { phase: "boot" })).toBeNull();

    const child = createChildFirstUseEventBridge({ mode: "child-first-use", sessionId, storage, broadcastChannel: null });
    expect(() => child.emit("invalid_placement", { encounterId: "encounter-ming", slotId: "left" })).toThrow(/Unsafe or invalid/);
    expect(() => child.emit("technical_error", { errorCode: "BRIDGE_UNAVAILABLE", recoverable: true, details: "free" })).toThrow(/Unsafe or invalid/);
    child.close();
  });
});
