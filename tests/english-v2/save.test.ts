import {
  ENGLISH_WORLD_SAVE_KEY,
  LEGACY_ENGLISH_SAVE_KEY,
  createDefaultEnglishWorldSave,
  readEnglishWorldSave,
  updateEnglishWorldSave,
  writeEnglishWorldSave,
} from "../../games/english-spell-battle/v2/save/save";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("Wordlight Island V2 save", () => {
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

  it("round-trips checksummed V2 settings and progress", () => {
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
    expect(read.status).toBe("ok");
    expect(read.save).toEqual(save);
  });

  it("recovers calmly from malformed or checksum-mismatched V2 bytes", () => {
    const malformed = new MemoryStorage();
    malformed.setItem(ENGLISH_WORLD_SAVE_KEY, "{bad");
    expect(readEnglishWorldSave(malformed).status).toBe("corrupt-recovered");

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
});
