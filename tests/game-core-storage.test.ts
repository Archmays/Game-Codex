import { createLocalStorageStore } from '../packages/game-core';

afterEach(() => vi.unstubAllGlobals());
describe('namespace storage adapter', () => {
  it('reads without probe writes and mutates only the requested namespace', () => {
    const values = new Map<string, string>([['family-games/one/state', '{"n":2}'], ['family-games/other/state', 'keep']]);
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); }),
      get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    };
    vi.stubGlobal('localStorage', storage);
    const store = createLocalStorageStore('one');
    expect(store.get('state', {})).toEqual({ n: 2 });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    store.set('next', [3]);
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith('family-games/one/next', '[3]');
    store.clear();
    expect([...values.entries()]).toEqual([['family-games/other/state', 'keep']]);
  });
  it('contains failed reads, quota writes, removes and enumeration without false data', () => {
    const fail = () => { throw new Error('unavailable'); };
    vi.stubGlobal('localStorage', { getItem: fail, setItem: fail, removeItem: fail, get length() { return fail(); } });
    const store = createLocalStorageStore('one');
    expect(store.get('state', 'fallback')).toBe('fallback');
    expect(() => store.set('state', 1)).not.toThrow();
    expect(() => store.remove('state')).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });
});
