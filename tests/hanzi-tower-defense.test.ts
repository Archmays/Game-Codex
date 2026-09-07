import { describe, expect, it } from "vitest";
import { CORES, CORE_ORDER, RECIPES } from "../games/hanzi-tower-defense/content";
import { DEFAULT_SEED, deploy, ENEMIES, firingRange, fuse, newBattle, plannedDrops, recycle, resumeCheckpoint, SLOTS, startWave, stow, updateBattle, WAVES } from "../games/hanzi-tower-defense/model";
import { openSave, SAVE_KEY, validCheckpoint } from "../games/hanzi-tower-defense/save";

describe("字阵守城 content and minimal battle loop", () => {
  it("binds all nine readable cores and five ordered spatial recipes to language sources", () => {
    expect(CORE_ORDER).toHaveLength(9); expect(RECIPES).toHaveLength(5);
    for (const kind of CORE_ORDER) {
      const c = CORES[kind]; expect(c.id).toBe(kind); expect(c.source).toBe(`https://www.zdic.net/hans/${c.glyph}`);
      expect(c.pinyin && c.meaning && c.familiarWord && c.illustrationBrief).toBeTruthy(); expect(c.components.length).toBe(c.slots.length);
    }
    for (const r of RECIPES) { expect(CORES[r.result].components).toEqual(r.inputs.map(i => CORES[i].glyph)); expect(CORES[r.result].structure).toBe(r.structure); }
    expect(CORES.flame.slots).toEqual(["上", "下"]); expect(CORES.wash.components).toEqual(["氵", "木"]);
    expect(CORES.water.role).toBe("非成字部件"); expect(CORES.water.pinyin).toBe("三点水");
    expect(CORES.volcano.glyph).toBe("火山"); expect(CORES.wildwood.glyph).toBe("山林");
  });
  it("starts with an attacking tower, kills a real enemy and automatically delivers a visible drop", () => {
    const s = newBattle(); expect(s.cores.some(c => c.slot !== null)).toBe(true); expect(s.cores.filter(c => c.slot === null)).toHaveLength(5);
    startWave(s); const events = []; for (let i = 0; i < 1200 && s.kills === 0; i++) events.push(...updateBattle(s, .05));
    expect(events.some(e => e.type === "shot")).toBe(true); expect(s.kills).toBeGreaterThan(0);
    expect(events.some(e => e.type === "drop")).toBe(true); expect(s.cores).toHaveLength(7); expect(s.elapsed).toBeLessThan(60);
  });
  it("makes each output exceed all separately deployed ingredients at equal resource/time/range", () => {
    for (const recipe of RECIPES) {
      const before = firingRange(recipe.inputs), after = firingRange([recipe.result]);
      expect(after.damage, recipe.id).toBeGreaterThan(before.damage * 1.15);
    }
    expect(firingRange(["wash"]).slowSeconds).toBe(30);
    expect(CORES.wash.slow).toBeGreaterThan(CORES.water.slow);
  });
  it("consumes exactly two unique cores, releases old slots and cannot overwrite an unrelated tower", () => {
    const s = newBattle(); deploy(s, 2, 1); deploy(s, 3, 2); const before = JSON.stringify(s);
    expect(fuse(s, 1, 2, 2)).toBeNull(); expect(fuse(s, 1, 1, 0)).toBeNull(); expect(fuse(s, 1, 3, 0)).toBeNull(); expect(JSON.stringify(s)).toBe(before);
    const result = fuse(s, 1, 2, 1)!; expect(result.kind).toBe("flame"); expect(s.cores.some(c => c.slot === 0)).toBe(false);
    expect(s.cores.filter(c => c.slot === 1)).toEqual([result]); expect(s.cores).toHaveLength(5);
    expect(fuse(s, 1, 2, 1)).toBeNull(); expect(s.unlocked).toEqual(["fire-fire"]);
  });
  it("keeps word order, supports bag/tower sources and does not burn wrong materials", () => {
    const s = newBattle(); expect(fuse(s, 6, 1, 0)).toBeNull(); expect(s.cores).toHaveLength(6);
    expect(fuse(s, 1, 6, 0)?.kind).toBe("volcano"); expect(fuse(s, 3, 4, null)?.kind).toBe("grove");
    expect(stow(s, s.cores.find(c => c.kind === "volcano")!.id)).toBe(true); expect(s.cores.every(c => c.slot === null)).toBe(true);
  });
  it("guarantees base-kind reachability across many seeds without imposing a full inventory", () => {
    const signatures = new Set<string>();
    for (let seed = 0; seed < 120; seed++) for (let wave = 0; wave < 6; wave++) {
      const drops = plannedDrops(seed, wave); expect(drops).toHaveLength(5); expect(new Set(drops.slice(0, 4)).size).toBe(4); signatures.add(drops.join());
    }
    expect(signatures.size).toBeGreaterThan(12); expect(plannedDrops(DEFAULT_SEED, 0)).toEqual(plannedDrops(DEFAULT_SEED, 0));
  });
  it("freezes all simulation fields on pause and never catches up hidden time", () => {
    const s = newBattle(); startWave(s); updateBattle(s, 1); expect(s.elapsed).toBe(.1); s.paused = true;
    const raw = JSON.stringify(s); for (let i = 0; i < 500; i++) updateBattle(s, .05); expect(JSON.stringify(s)).toBe(raw);
    s.paused = false; updateBattle(s, .05); expect(s.elapsed).toBeCloseTo(.15);
  });
  it("allows calm loss/retry and denies recycle duplication or fusion-repair arbitrage", () => {
    const s = newBattle(); s.cores.forEach(c => c.slot = null); startWave(s);
    for (let i = 0; i < 10000 && s.phase === "battle"; i++) updateBattle(s, .05);
    if (s.phase === "ready") { startWave(s); for (let i = 0; i < 10000 && String(s.phase) === "battle"; i++) updateBattle(s, .05); }
    expect(s.phase).toBe("lost"); expect(s.health).toBe(0);
    const retry = newBattle(DEFAULT_SEED, ["fire-fire"]); expect(retry.health).toBe(16); expect(retry.unlocked).toEqual(["fire-fire"]);
    expect(recycle(retry, 2)).toBe(0); expect(retry.cores).toHaveLength(6); retry.health = 10;
    expect(recycle(retry, 2)).toBe(1); expect(recycle(retry, 2)).toBe(0);
    for (const recipe of RECIPES) expect(CORES[recipe.result].recycle).toBeLessThanOrEqual(recipe.inputs.reduce((sum, k) => sum + CORES[k].recycle, 0));
  });
});

describe("wave checkpoints and protected local storage", () => {
  const memory = (initial: Record<string, string> = {}) => { const data = new Map(Object.entries(initial)); return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } }; };
  const prefs = { muted: false, reducedMotion: false };
  it("refresh repeats the entire unfinished wave without duplicated reward or skip", () => {
    const store = memory({ "family-games/math-world/v1": "unchanged", "family-games/hanzi-magic-complete/v3": "legacy unchanged" });
    const save = openSave(store, prefs), s = save.state; startWave(s); save.write(s, prefs);
    for (let i = 0; i < 700; i++) updateBattle(s, .05); const rewardCount = s.cores.length;
    expect(rewardCount).toBeGreaterThan(6); save.write(s, prefs);
    const reload = openSave(store, prefs).state; expect(reload.wave).toBe(0); expect(reload.cores).toHaveLength(6); expect(reload.kills).toBe(0);
    startWave(reload); for (let i = 0; i < 700; i++) updateBattle(reload, .05); expect(reload.cores).toHaveLength(rewardCount);
    expect(store.data.get("family-games/math-world/v1")).toBe("unchanged"); expect(store.data.get("family-games/hanzi-magic-complete/v3")).toBe("legacy unchanged");
  });
  it("preserves discoveries across rollback and ready deployment across reload", () => {
    const store = memory(), save = openSave(store, prefs), s = save.state; deploy(s, 3, 1); save.write(s, prefs);
    expect(openSave(store, prefs).state.cores.find(c => c.id === 3)?.slot).toBe(1);
    startWave(s); fuse(s, 1, 2, 0); save.write(s, prefs); const reloaded = openSave(store, prefs).state;
    expect(reloaded.unlocked).toEqual(["fire-fire"]); expect(reloaded.cores.some(c => c.kind === "flame")).toBe(false);
  });
  it("never overwrites future, corrupt, storage-denied or externally changed records", () => {
    for (const raw of ["{bad", JSON.stringify({ version: 99 }), JSON.stringify({ version: 1, checkpoint: {} })]) {
      const store = memory({ [SAVE_KEY]: raw }), save = openSave(store, prefs); expect(save.writable).toBe(false); expect(save.write(save.state, prefs)).toBe(false); expect(store.getItem(SAVE_KEY)).toBe(raw);
    }
    const store = memory(), save = openSave(store, prefs); store.setItem(SAVE_KEY, "external"); expect(save.write(save.state, prefs)).toBe(false); expect(store.getItem(SAVE_KEY)).toBe("external");
    const denied = openSave({ getItem() { throw Error(); }, setItem() { throw Error(); } }, prefs); expect(denied.state.cores).toHaveLength(6); expect(denied.writable).toBe(false);
  });
  it("rejects duplicate identities, invalid slots and preserves unknown same-version fields", () => {
    const cp = newBattle().checkpoint; expect(validCheckpoint(cp)).toBe(true); expect(validCheckpoint({ ...cp, cores: [cp.cores[0], cp.cores[0]] })).toBe(false);
    expect(validCheckpoint({ ...cp, cores: [{ ...cp.cores[0], slot: SLOTS.length }] })).toBe(false);
    const store = memory({ [SAVE_KEY]: JSON.stringify({ version: 1, note: "keep", checkpoint: { ...cp, extra: "keep too" }, unlocked: [], preferences: { ...prefs, extra: 1 } }) });
    const save = openSave(store, prefs); save.write(save.state, prefs); const raw = JSON.parse(store.getItem(SAVE_KEY)!);
    expect(raw.note).toBe("keep"); expect(raw.checkpoint.extra).toBe("keep too"); expect(raw.preferences.extra).toBe(1);
  });
  it("has six waves and visibly distinct enemy roles", () => { expect(WAVES).toHaveLength(6); expect(ENEMIES.swift.speed).toBeGreaterThan(ENEMIES.swarm.speed); expect(ENEMIES.stone.hp).toBeGreaterThan(ENEMIES.swift.hp * 3); });
});
