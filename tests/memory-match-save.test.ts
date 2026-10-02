import { LEGACY_MEMORY_SAVE_KEY, MEMORY_MATCH_SAVE_KEY, readLegacyMemoryPresence, readMemorySave, writeMemorySave, inspectMemorySave, openMemorySave } from "../packages/activity-engines/memory-match";

class MemoryStorage implements Storage {
  readonly data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe("Independent memory save isolation", () => {
  it('distinguishes absent, legacy, current, future, corrupt and failed reads', () => {
    const storage = new MemoryStorage();
    expect(inspectMemorySave('same-glyph', 'r1', storage).status).toBe('missing');
    storage.setItem(LEGACY_MEMORY_SAVE_KEY, '{"grades":{}}');
    expect(inspectMemorySave('same-glyph', 'r1', storage).status).toBe('legacy');
    expect(writeMemorySave(readMemorySave('same-glyph', 'r1', storage), storage)).toBe(true);
    expect(inspectMemorySave('same-glyph', 'r1', storage).status).toBe('current');
    storage.setItem(MEMORY_MATCH_SAVE_KEY, '{"version":2}');
    expect(inspectMemorySave('same-glyph', 'r1', storage).status).toBe('future');
    storage.setItem(MEMORY_MATCH_SAVE_KEY, '{}');
    expect(inspectMemorySave('same-glyph', 'r1', storage).status).toBe('corrupt');
    storage.getItem = () => { throw new Error('blocked'); };
    expect(inspectMemorySave('same-glyph', 'r1', storage).status).toBe('unavailable');
    expect(writeMemorySave({ version: 1, selectedPackId: 'same-glyph', contentRevision: 'r1', recentRelationIds: [] }, storage)).toBe(false);
  });
  it('never reports quota failure or concurrent replacement as a successful save', () => {
    const storage = new MemoryStorage();
    const first = openMemorySave('same-glyph', 'r1', storage);
    storage.setItem(MEMORY_MATCH_SAVE_KEY, '{"version":9}');
    expect(first.write(first.value)).toBe(false);
    expect(first.status).toBe('conflict');
    expect(storage.getItem(MEMORY_MATCH_SAVE_KEY)).toBe('{"version":9}');
    storage.removeItem(MEMORY_MATCH_SAVE_KEY);
    const second = openMemorySave('same-glyph', 'r1', storage);
    storage.setItem = () => { throw new Error('quota'); };
    expect(second.write(second.value)).toBe(false);
    expect(second.status).toBe('write-failed');
  });
  it.each(['{"version":99,"precious":"future"}', '{broken', '{"version":1,"recentRelationIds":5}'])("does not overwrite protected bytes %s during normal play", raw => {
    const storage = new MemoryStorage();
    storage.setItem(MEMORY_MATCH_SAVE_KEY, raw);
    writeMemorySave(readMemorySave("same-glyph", "r1", storage), storage);
    expect(storage.getItem(MEMORY_MATCH_SAVE_KEY)).toBe(raw);
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
