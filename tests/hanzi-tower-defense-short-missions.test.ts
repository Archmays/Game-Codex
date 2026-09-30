import { describe, it, expect } from 'vitest';
import { SCENARIO_IDS, LEGACY_SCENARIO_IDS, rulesFor, type ScenarioId } from '../games/hanzi-tower-defense/tactics';
import { newTactics, choosePreparation, changeVariation, deploy, stow, fuse, recycle, packProgress, packConsequence, checkpointOf, retryWave, startWave, updateBattle, equipEnglish, previewEquipment, type BattleState } from '../games/hanzi-tower-defense/model';
import { RESONANCES } from '../games/hanzi-tower-defense/resonance';
import { openTacticsSave, TACTICS_SAVE_KEY, SAVE_KEY, validTacticsCheckpoint, validTacticsPayload } from '../games/hanzi-tower-defense/save';

const prefs = { muted: true, reducedMotion: true };
function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
function equipVolcano(s: BattleState) {
  const r = RESONANCES[0], tower = s.cores.find(c => c.kind === 'volcano')!;
  s.englishCores.push({ id: s.nextEnglishId++, lexemeId: r.lexemeId, senseId: r.senseId, grantId: r.grantId, attachedTo: null });
  s.englishClaims.push(r.grantId);
  expect(equipEnglish(s, previewEquipment(s, s.englishCores[0].id, tower.id))).toBe(true);
  return tower;
}
function advance(s: BattleState, count = 600) { for (let i = 0; i < count; i++) updateBattle(s, .05); }

describe('three Qinglan short missions', () => {
  it('keeps all six legacy IDs and adds three independent three-wave missions', () => {
    expect(LEGACY_SCENARIO_IDS).toHaveLength(6);
    expect(SCENARIO_IDS).toHaveLength(9);
    for (const id of ['qinglan-elite', 'qinglan-repair', 'qinglan-packs'] as const) {
      const s = newTactics(id);
      expect(s.mapId).toBe('qinglan-pass');
      expect(rulesFor(s).waves).toHaveLength(3);
      expect(validTacticsCheckpoint(checkpointOf(s))).toBe(true);
    }
  });

  it('A enforces a three-tower cap and rejects illegal deployment atomically', () => {
    const s = choosePreparation(newTactics('qinglan-elite'), { packId: 'ember' })!;
    for (let i = 1; i <= 3; i++) expect(deploy(s, i, i - 1)).toBe(true);
    for (const [id, slot] of [[4, 3], [1, 1], [999, 4], [1, -1], [1, 1.5]]) {
      const before = JSON.stringify(s);
      expect(deploy(s, id, slot)).toBe(false);
      expect(JSON.stringify(s)).toBe(before);
    }
    expect(deploy(s, 1, 4)).toBe(true);
    expect(stow(s, 1)).toBe(true);
    expect(deploy(s, 4, 4)).toBe(true);
    const combined = fuse(s, 2, 3, 1, 'fire-fire');
    expect(combined?.slot).toBe(1);
    expect(s.cores.filter(c => c.slot !== null)).toHaveLength(2);
    expect(deploy(s, 5, 2)).toBe(true);
    const before = JSON.stringify(s);
    expect(deploy(s, 6, 5)).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });

  it.each(['qinglan-elite', 'qinglan-packs'] as const)('%s replaces preparation instead of farming resources or retaining combat residue', id => {
    let s = newTactics(id, ['fire-mountain']);
    expect(startWave(s)).toBe(false);
    const patch = id === 'qinglan-elite' ? { packId: 'leaf' as const } : { goalId: 'wood-water' as const };
    s.seed = 876; s.health = 4; s.kills = 17; s.elapsed = 20;
    s.cores[0].cooldown = 2;
    const expected = newTactics(id, ['fire-mountain'], { ...patch, confirmed: true });
    s = choosePreparation(s, patch)!;
    expect(s).toEqual(expected);
    for (let i = 0; i < 3; i++) s = choosePreparation(s, patch)!;
    expect(s).toEqual(expected);
    expect(startWave(s)).toBe(true);
    const before = JSON.stringify(s);
    expect(choosePreparation(s, patch)).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
  });

  it('A clears real English attachment and RNG/cooldown residue when switching packs', () => {
    let s = choosePreparation(newTactics('qinglan-elite'), { packId: 'ember' })!;
    const fire = s.cores.find(c => c.kind === 'fire')!, mountain = s.cores.find(c => c.kind === 'mountain')!;
    expect(fuse(s, fire.id, mountain.id, null)?.kind).toBe('volcano');
    equipVolcano(s).cooldown = 1.3; s.seed = 998;
    s = choosePreparation(s, { packId: 'leaf' })!;
    expect(s).toEqual(newTactics('qinglan-elite', ['fire-mountain'], { packId: 'leaf', confirmed: true }));
    expect(s.englishCores).toEqual([]);
    expect(s.cores.filter(c => c.kind === 'wood')).toHaveLength(5);
  });

  it('B preserves actual tower identity, cooldown and English attachment while moving and stowing', () => {
    const s = newTactics('qinglan-repair');
    expect(s.cores.filter(c => c.slot !== null).map(c => [c.kind, c.slot])).toEqual([['volcano', 0], ['grove', 7], ['water', 6]]);
    const tower = equipVolcano(s); tower.cooldown = .73;
    const id = tower.id;
    expect(deploy(s, id, 3)).toBe(true);
    expect(s.cores.find(c => c.id === id)).toBe(tower);
    expect(tower.cooldown).toBe(.73);
    expect(s.englishCores[0].attachedTo).toBe(id);
    expect(stow(s, id)).toBe(true);
    expect(tower.slot).toBeNull();
    expect(tower.cooldown).toBe(.73);
    expect(s.englishCores[0].attachedTo).toBe(id);
    expect(deploy(s, id, 3)).toBe(true);
    expect(startWave(s)).toBe(true);
    const before = JSON.stringify(s);
    expect(stow(s, id)).toBe(false);
    expect(deploy(s, id, 4)).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('B variation changes only the declared grove starting slot and resets the run', () => {
    const original = newTactics('qinglan-repair', ['fire-mountain']);
    const varied = changeVariation(original)!;
    const expected = checkpointOf(original);
    expected.challenge = { variant: 1 };
    expected.cores.find(c => c.kind === 'grove')!.slot = 5;
    expect(checkpointOf(varied)).toEqual(expected);
    expect({ ...rulesFor(varied), starting: [] }).toEqual({ ...rulesFor(original), starting: [] });
    varied.seed = 80; varied.health = 2; varied.cores[0].cooldown = 4;
    expect(changeVariation(varied)).toEqual(original);
  });

  it('C counts only backpack base cores and reports deployment, fusion and gate-repair cost', () => {
    const s = choosePreparation(newTactics('qinglan-packs'), { goalId: 'wood-water' })!;
    const count = (kind: string) => packProgress(s)!.items.find(i => i.kind === kind)!.count;
    expect(packProgress(s)?.complete).toBe(false); // 氵2/3: later fixed supplies can help, but the goal is not pre-filled.
    expect(count('wood')).toBe(3); expect(count('water')).toBe(2);
    const woods = s.cores.filter(c => c.kind === 'wood');
    expect(packConsequence(s, [woods[0].id])).toContain('3→2');
    expect(deploy(s, woods[0].id, 0)).toBe(true);
    expect(count('wood')).toBe(2);
    expect(fuse(s, woods[1].id, woods[2].id, null)?.kind).toBe('grove');
    expect(count('wood')).toBe(0);
    expect(packProgress(s)?.complete).toBe(false);
    const water = s.cores.find(c => c.kind === 'water')!;
    s.health = 10;
    expect(packConsequence(s, [water.id])).toContain('2→1');
    expect(recycle(s, water.id)).toBeGreaterThan(0);
    expect(count('water')).toBe(1);
    expect(s.health).toBeGreaterThan(10);
    expect(packConsequence(s, [s.cores.find(c => c.kind === 'grove')!.id])).toBe('');
  });

  it.each(['qinglan-elite', 'qinglan-repair', 'qinglan-packs'] as const)('%s retry restores challenge, resources, towers, English, seed and deterministic combat', id => {
    let s = newTactics(id);
    if (id === 'qinglan-elite') s = choosePreparation(s, { packId: 'leaf' })!;
    if (id === 'qinglan-packs') s = choosePreparation(s, { goalId: 'wood-water' })!;
    if (id === 'qinglan-repair') { s = changeVariation(s)!; equipVolcano(s); }
    if (id !== 'qinglan-repair') {
      const fire = s.cores.find(c => c.kind === 'fire')!, mountain = s.cores.find(c => c.kind === 'mountain')!;
      const tower = fuse(s, fire.id, mountain.id, null)!;
      expect(deploy(s, tower.id, 0)).toBe(true);
    }
    expect(startWave(s)).toBe(true);
    const checkpoint = checkpointOf(s.checkpoint);
    advance(s);
    const after = JSON.parse(JSON.stringify(s));
    const retried = retryWave(s)!;
    expect(checkpointOf(retried)).toEqual(checkpoint);
    expect(retried.enemies).toEqual([]); expect(retried.echoes).toEqual([]); expect(retried.rootZones).toEqual([]);
    expect(startWave(retried)).toBe(true); advance(retried);
    expect({ ...retried, summaries: [] }).toEqual({ ...after, summaries: [] });
    expect(retried.summaries.at(-1)).toEqual(after.summaries.at(-1));
  });

  it('refresh preserves the old six slots and all new choices without touching campaign bytes', () => {
    const store = storage({ [SAVE_KEY]: 'protected campaign' });
    let save = openTacticsSave(store, prefs);
    for (const id of LEGACY_SCENARIO_IDS) expect(save.write(newTactics(id), prefs)).toBe(true);
    const legacyRaw = store.getItem(TACTICS_SAVE_KEY)!;
    save = openTacticsSave(store, prefs);
    expect(save.writable).toBe(true); expect(save.list()).toHaveLength(6);
    const states = [newTactics('qinglan-elite', [], { packId: 'leaf', confirmed: true }), newTactics('qinglan-repair', [], { variant: 1 }), newTactics('qinglan-packs', [], { goalId: 'wood-water', confirmed: true })];
    for (const s of states) expect(save.write(s, prefs)).toBe(true);
    const refreshed = openTacticsSave(store, prefs);
    expect(refreshed.writable).toBe(true); expect(refreshed.list()).toHaveLength(9);
    for (const s of states) expect(checkpointOf(refreshed.load(s.scenarioId!)!)).toEqual(checkpointOf(s));
    for (const id of LEGACY_SCENARIO_IDS) expect(JSON.parse(store.getItem(TACTICS_SAVE_KEY)!).scenarios[id]).toEqual(JSON.parse(legacyRaw).scenarios[id]);
    expect(store.getItem(SAVE_KEY)).toBe('protected campaign');
  });

  it.each(['qinglan-elite', 'qinglan-repair', 'qinglan-packs'] as const)('%s rejects contradictory main/retry choices and protects damaged save bytes', id => {
    const main = checkpointOf(newTactics(id, [], id === 'qinglan-elite' ? { packId: 'ember', confirmed: true } : id === 'qinglan-packs' ? { goalId: 'fire-mountain', confirmed: true } : { variant: 0 }));
    main.wave = 1;
    const retry = checkpointOf(newTactics(id, [], main.challenge));
    const payload = { version: 1, activeScenarioId: id, scenarios: { [id]: { checkpoint: main, retryCheckpoint: retry, unlocked: [], summaries: [] } }, preferences: prefs };
    expect(validTacticsPayload(payload)).toBe(true);
    retry.challenge = id === 'qinglan-elite' ? { packId: 'leaf', confirmed: true } : id === 'qinglan-packs' ? { goalId: 'wood-water', confirmed: true } : { variant: 1 };
    // Each checkpoint remains independently valid; only their contradictory run identity is rejected.
    expect(validTacticsCheckpoint(main)).toBe(true);
    expect(validTacticsCheckpoint(retry)).toBe(true);
    expect(validTacticsPayload(payload)).toBe(false);
    const raw = JSON.stringify(payload), store = storage({ [TACTICS_SAVE_KEY]: raw });
    const save = openTacticsSave(store, prefs);
    expect(save.writable).toBe(false);
    expect(save.write(newTactics(id), prefs)).toBe(false);
    expect(store.getItem(TACTICS_SAVE_KEY)).toBe(raw);
  });

  it.each([
    ['qinglan-elite', undefined], ['qinglan-elite', { packId: 'unknown', confirmed: true }],
    ['qinglan-elite', { packId: 'ember', confirmed: 'yes' }], ['qinglan-elite', { packId: 'ember', goalId: 'wood-water', confirmed: true }],
    ['qinglan-repair', { variant: 2 }], ['qinglan-repair', { variant: 0, confirmed: true }],
    ['qinglan-packs', { goalId: 'future', confirmed: true }], ['qinglan-packs', { goalId: 'wood-water' }],
    ['qinglan-intercept', { packId: 'ember', confirmed: true }],
  ])('rejects damaged or cross-mission challenge parameters: %s %j', (id, challenge) => {
    const checkpoint = checkpointOf(newTactics(id as ScenarioId));
    expect(validTacticsCheckpoint({ ...checkpoint, challenge })).toBe(false);
  });
});
