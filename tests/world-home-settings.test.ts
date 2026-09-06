import { describe, expect, it } from "vitest";
import { MY_GAME_WORLD_SETTINGS_KEY as KEY, readWorldHomeState, updateWorldSettings, type WorldHomeStorageLike } from "../apps/my-game-world/world-state";

class StorageFixture implements WorldHomeStorageLike {
  data = new Map<string, string>();
  denyRead = false;
  denyWrite = false;
  getItem(key: string) { if (this.denyRead) throw new Error("denied"); return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.denyWrite) throw new Error("denied"); this.data.set(key, value); }
}

describe("home settings preserve original bytes and mount identity", () => {
  it.each([null, '{"version":1}', '{"version":1,"settings":{"muted":true}}'])('updates legal old settings: %s', raw => {
    const storage = new StorageFixture();
    if (raw !== null) storage.setItem(KEY, raw);
    const first = updateWorldSettings(storage, readWorldHomeState(storage), { reducedMotion: true });
    expect(first.ok).toBe(true);
    const second = updateWorldSettings(storage, first.state, { muted: true });
    expect(second.ok).toBe(true);
    expect(JSON.parse(storage.getItem(KEY)!)).toEqual({ version: 1, settings: { muted: true, reducedMotion: true } });
  });

  it("retains top-level and nested extensions without writing other keys", () => {
    const storage = new StorageFixture();
    storage.setItem(KEY, '{"version":1,"extension":{"futureOption":[1,2]},"settings":{"muted":false,"reducedMotion":false,"custom":"kept"}}');
    storage.setItem("family-games/english-world/v2", "unrelated exact bytes");
    const result = updateWorldSettings(storage, readWorldHomeState(storage), { muted: true });
    expect(result.ok).toBe(true);
    expect(JSON.parse(storage.getItem(KEY)!)).toEqual({ version: 1, extension: { futureOption: [1,2] }, settings: { muted: true, reducedMotion: false, custom: "kept" } });
    expect([...storage.data.keys()]).toEqual([KEY, "family-games/english-world/v2"]);
    expect(storage.getItem("family-games/english-world/v2")).toBe("unrelated exact bytes");
  });

  it.each(['{"version":99,"settings":{"muted":true},"future":[7]}', '{bad-json', '', 'null', '[]', '{"version":1,"settings":{"muted":"yes"}}'])('keeps unknown or damaged bytes read-only: %s', raw => {
    const storage = new StorageFixture(); storage.setItem(KEY, raw);
    const initial = readWorldHomeState(storage);
    expect(initial.recoveredCalmly).toBe(true);
    expect(updateWorldSettings(storage, initial, { muted: true })).toEqual({ ok: false, state: initial });
    expect(storage.getItem(KEY)).toBe(raw);
  });

  it.each([null, '{"version":1,"extension":"restored","settings":{"muted":true}}', '{"version":88}', '{corrupt'])('stops a mounted writer after replacement or deletion: %s', replacement => {
    const storage = new StorageFixture();
    const original = '{"version":1,"settings":{"muted":false}}'; storage.setItem(KEY, original);
    const initial = readWorldHomeState(storage);
    if (replacement === null) storage.data.delete(KEY); else storage.setItem(KEY, replacement);
    expect(updateWorldSettings(storage, initial, { muted: true }).ok).toBe(false);
    expect(storage.getItem(KEY)).toBe(replacement);
    storage.setItem(KEY, original);
    expect(updateWorldSettings(storage, initial, { muted: true }).ok).toBe(false);
    expect(storage.getItem(KEY)).toBe(original);
  });

  it("fails closed for denied read or write and never advances the visible state", () => {
    const storage = new StorageFixture(); storage.denyRead = true;
    const denied = readWorldHomeState(storage);
    storage.denyRead = false;
    expect(updateWorldSettings(storage, denied, { muted: true }).ok).toBe(false);
    const fresh = readWorldHomeState(storage); storage.denyWrite = true;
    expect(updateWorldSettings(storage, fresh, { muted: true })).toEqual({ ok: false, state: fresh });
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("prevents a stale pre-write state from being reused", () => {
    const storage = new StorageFixture(); const initial = readWorldHomeState(storage);
    expect(updateWorldSettings(storage, initial, { muted: true }).ok).toBe(true);
    const bytes = storage.getItem(KEY);
    expect(updateWorldSettings(storage, initial, { reducedMotion: true }).ok).toBe(false);
    expect(storage.getItem(KEY)).toBe(bytes);
  });
});
