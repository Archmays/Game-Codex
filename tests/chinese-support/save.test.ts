import { LEGACY_PINYIN_SAVE_KEY, PINYIN_SAVE_KEY, readPinyinSave, writePinyinSave } from "../../games/hanzi-radical-battle/complete/support/pinyin/save";
import { LEGACY_MEMORY_SAVE_KEY, MEMORY_MATCH_SAVE_KEY, readLegacyMemoryPresence, readMemorySave, writeMemorySave } from "../../packages/activity-engines/memory-match";

class MemoryStorage implements Storage {
  readonly data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe("Chinese support save isolation", () => {
  it("preserves old Pinyin bytes while writing the new versioned key", () => {
    const storage = new MemoryStorage();
    const legacy = '{"bestQuizScore":8,"unknown":true}';
    storage.setItem(LEGACY_PINYIN_SAVE_KEY, legacy);
    writePinyinSave(readPinyinSave("assemble", "r1", storage), storage);
    expect(storage.getItem(LEGACY_PINYIN_SAVE_KEY)).toBe(legacy);
    expect(storage.getItem(PINYIN_SAVE_KEY)).toContain('"version":1');
  });

  it("preserves old memory bytes while writing the new versioned key", () => {
    const storage = new MemoryStorage();
    const legacy = '{"grades":{"p1":{"bestMoves":4,"completions":9}}}';
    storage.setItem(LEGACY_MEMORY_SAVE_KEY, legacy);
    writeMemorySave(readMemorySave("same-glyph", "r1", storage), storage);
    expect(storage.getItem(LEGACY_MEMORY_SAVE_KEY)).toBe(legacy);
    expect(storage.getItem(MEMORY_MATCH_SAVE_KEY)).toContain('"version":1');
    expect(readLegacyMemoryPresence(storage)).toEqual({ present: true, parseable: true });
  });

  it("tolerates a malformed old memory save without deleting it", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_MEMORY_SAVE_KEY, "{old-bytes");
    expect(readLegacyMemoryPresence(storage)).toEqual({ present: true, parseable: false });
    expect(storage.getItem(LEGACY_MEMORY_SAVE_KEY)).toBe("{old-bytes");
  });
});
