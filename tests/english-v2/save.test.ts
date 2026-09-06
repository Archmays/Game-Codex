import {
  ENGLISH_WORLD_SAVE_KEY,
  LEGACY_ENGLISH_SAVE_KEY,
  createDefaultEnglishWorldSave,
  readEnglishWorldSave,
  updateEnglishWorldSave,
  writeEnglishWorldSave,
} from "../../games/english-spell-battle/v2/save/save";
import { ENGLISH_V2_CONTENT_REVISION } from "../../games/english-spell-battle/v2/content/manifest";
import { initialPilotRecord } from "../../games/english-spell-battle/v2/pilot/model";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("Wordlight Island same-key V3 save", () => {
  it("starts fresh without interpreting legacy score bytes as learning progress", () => {
    const storage = new MemoryStorage();
    const legacy = '{"bestScore":8,"wins":4,"keep":"exact"}';
    storage.setItem(LEGACY_ENGLISH_SAVE_KEY, legacy);
    const read = readEnglishWorldSave(storage);
    expect(read.status).toBe("fresh");
    expect(read.legacyRaw).toBe(legacy);
    expect(read.save.completedStoryWordIds).toEqual([]);
    expect(storage.getItem(LEGACY_ENGLISH_SAVE_KEY)).toBe(legacy);
  });

  it("round-trips checksummed V3 settings and progress", () => {
    const storage = new MemoryStorage();
    const save = updateEnglishWorldSave(createDefaultEnglishWorldSave(), {
      completedStoryWordIds: ["word-cat"],
      completedSentenceIds: ["sentence-cat-home"],
      visitedRegionIds: ["animals"],
      activeRegionId: "animals",
      settings: { soundEnabled: false, chineseScaffold: false, reducedMotion: true },
    });
    expect(writeEnglishWorldSave(save, storage)).toBe(true);
    const read = readEnglishWorldSave(storage);
    expect(read.save.version).toBe(3);
    expect(read.status).toBe("ok");
    expect(read.save).toEqual(save);
  });

  it("recovers calmly from malformed or checksum-mismatched V2 bytes", () => {
    const malformed = new MemoryStorage();
    malformed.setItem(ENGLISH_WORLD_SAVE_KEY, "{bad");
    expect(readEnglishWorldSave(malformed).status).toBe("corrupt-recovered");
    expect(readEnglishWorldSave(malformed).writable).toBe(false);
    expect(writeEnglishWorldSave(createDefaultEnglishWorldSave(), malformed, "{bad")).toBe(false);
    expect(malformed.getItem(ENGLISH_WORLD_SAVE_KEY)).toBe("{bad");

    const mismatch = new MemoryStorage();
    const save = createDefaultEnglishWorldSave();
    mismatch.setItem(ENGLISH_WORLD_SAVE_KEY, JSON.stringify({ ...save, completedStoryWordIds: ["word-cat"] }));
    expect(readEnglishWorldSave(mismatch).status).toBe("corrupt-recovered");
  });

  it("opens a future save read-only and never overwrites it", () => {
    const storage = new MemoryStorage();
    const future = '{"version":9,"future":"keep-exact"}';
    storage.setItem(ENGLISH_WORLD_SAVE_KEY, future);
    const read = readEnglishWorldSave(storage);
    expect(read.status).toBe("future-readonly");
    expect(read.writable).toBe(false);
    expect(storage.getItem(ENGLISH_WORLD_SAVE_KEY)).toBe(future);
  });

  it("verifies the shipped V2 checksum contract before migration and keeps full old bytes/extensions", () => {
    const storage = new MemoryStorage();
    const known = {
      version: 2, completedStoryWordIds: ["word-jump", "word-cat"], encounteredOptionalWordIds: ["word-pig"],
      completedSentenceIds: ["sentence-jump-can", "sentence-cat-home"], visitedRegionIds: ["actions", "animals"], activeRegionId: "actions",
      settings: { soundEnabled: false, chineseScaffold: true, reducedMotion: true }, contentRevision: ENGLISH_V2_CONTENT_REVISION,
    };
    const v2 = { ...known, checksum: legacyChecksum(known), extension: { keep: [1, "old"] }, settings: { ...known.settings, extraPreference: { keep: true } } };
    const raw = `  ${JSON.stringify(v2, null, 2)}\n`;
    storage.setItem(ENGLISH_WORLD_SAVE_KEY, raw);
    const read = readEnglishWorldSave(storage);
    expect(read.status).toBe("migrated"); expect(read.raw).toBe(raw); expect(read.writable).toBe(true);
    expect(read.save.completedStoryWordIds).toEqual(known.completedStoryWordIds);
    expect(read.save.interactions).toEqual({});
    expect(read.save.extension).toEqual(v2.extension); expect(read.save.settings.extraPreference).toEqual({ keep: true });
    expect(read.save.migratedFromV2Raw).toBe(raw);
    expect(storage.getItem(ENGLISH_WORLD_SAVE_KEY)).toBe(raw);
    expect(writeEnglishWorldSave(read.save, storage, raw)).toBe(true);
    const migratedRaw = storage.getItem(ENGLISH_WORLD_SAVE_KEY)!;
    const updated = updateEnglishWorldSave(readEnglishWorldSave(storage).save, { settings: { soundEnabled: true, chineseScaffold: false, reducedMotion: false } });
    expect(writeEnglishWorldSave(updated, storage, migratedRaw)).toBe(true);
    const reread = readEnglishWorldSave(storage);
    expect(reread.status).toBe("ok"); expect(reread.save.migratedFromV2Raw).toBe(raw);
    expect(reread.save.extension).toEqual(v2.extension); expect(reread.save.settings.extraPreference).toEqual({ keep: true });
    storage.setItem(ENGLISH_WORLD_SAVE_KEY, JSON.stringify({ ...v2, completedStoryWordIds: ["word-run"] }));
    expect(readEnglishWorldSave(storage).writable).toBe(false);
  });

  it("locks every stale writer after a valid tab change, deletion, future/corrupt replacement or Vault swap", () => {
    const first = createDefaultEnglishWorldSave();
    for (const replacement of [JSON.stringify(updateEnglishWorldSave(first, { completedStoryWordIds: ["word-cat"] })), '{"version":9}', '{bad', null]) {
      const storage = new MemoryStorage();
      expect(writeEnglishWorldSave(first, storage)).toBe(true);
      const raw = storage.getItem(ENGLISH_WORLD_SAVE_KEY);
      if (replacement === null) storage.removeItem(ENGLISH_WORLD_SAVE_KEY); else storage.setItem(ENGLISH_WORLD_SAVE_KEY, replacement);
      const stale = updateEnglishWorldSave(first, { interactions: { "word-jump": initialPilotRecord("word-jump") } });
      expect(writeEnglishWorldSave(stale, storage, raw)).toBe(false);
      expect(storage.getItem(ENGLISH_WORLD_SAVE_KEY)).toBe(replacement);
    }
  });

  it("protects V3 extension checksum, unknown rules, impossible states and all storage denials", () => {
    const current = createDefaultEnglishWorldSave();
    const storage = new MemoryStorage();
    for (const bad of ["null", "[]", "", JSON.stringify({ ...current, extra: "tampered" }), JSON.stringify({ ...current, interactionRevision: "unknown-rules" }),
      JSON.stringify(resign({ ...current, interactions: { "word-two": { ...initialPilotRecord("word-two"), state: { kind: "number", word: "two", active: ["A", "A"], selected: ["A"], applied: true } } } })),
      JSON.stringify(resign({ ...current, interactions: { "word-seven": initialPilotRecord("word-two") } })),
    ]) {
      storage.setItem(ENGLISH_WORLD_SAVE_KEY, bad);
      expect(readEnglishWorldSave(storage).writable, bad).toBe(false);
      expect(writeEnglishWorldSave(current, storage, bad)).toBe(false);
      expect(storage.getItem(ENGLISH_WORLD_SAVE_KEY)).toBe(bad);
    }
    const deniedRead = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("must not write"); } };
    expect(readEnglishWorldSave(deniedRead).status).toBe("storage-readonly");
    expect(writeEnglishWorldSave(current, deniedRead)).toBe(false);
    const deniedWrite = { getItem() { return null; }, setItem() { throw new Error("quota"); } };
    expect(writeEnglishWorldSave(current, deniedWrite)).toBe(false);
  });
});

// Fixture integrity is constructed independently, retaining the original JSON property order.
function legacyChecksum(payload: object): string {
  let value = 2166136261;
  for (const char of JSON.stringify(payload)) value = Math.imul(value ^ char.codePointAt(0)!, 16777619);
  return (value >>> 0).toString(16).padStart(8, "0");
}
function resign(value: Record<string, unknown>) {
  const { checksum: _checksum, ...payload } = value;
  return { ...payload, checksum: legacyChecksum(payload) };
}
