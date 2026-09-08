import { DEFENSE_MAPS, mapFor, PATH, pathLength, type MapId, type Point, type EnemyKind } from "./maps";
import { CORES, recipeFor, type CoreKind } from "./content";
import { ECHO, ROOTS, englishMapping, RESONANCES, type EnglishCore, type GrantId, type EffectId } from "./resonance";

export type { Point } from "./maps";
export const MAP = { width: 960, height: 640 } as const;
export { PATH, SLOTS } from "./maps";
export const WAVES = DEFENSE_MAPS["qinglan-pass"].waves;
export const PATH_LENGTH = pathLength(PATH);
export function pointOnPath(distance: number, mapId: MapId = "qinglan-pass", lane = 0): Point {
 const path=mapFor(mapId).paths[lane]??mapFor(mapId).paths[0]; let remaining=Math.max(0,distance);
 for(let i=1;i<path.length;i++) { const length=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y); if(remaining<=length) {const t=remaining/length;return {x:path[i-1].x+(path[i].x-path[i-1].x)*t,y:path[i-1].y+(path[i].y-path[i-1].y)*t};} remaining-=length; }
 return {...path[path.length-1]};
}
export const enemyPosition=(state:Checkpoint,enemy:Enemy):Point=>pointOnPath(enemy.distance,state.mapId,enemy.lane??0);
export const remainingDistance=(state:Checkpoint,enemy:Enemy):number=>pathLength(mapFor(state.mapId).paths[enemy.lane??0])-enemy.distance;
export const distanceBetween = (a:Point,b:Point):number=>Math.hypot(a.x-b.x,a.y-b.y);
export const ENEMIES = {
 swarm:{label:"团团怪",hp:46,speed:40,harm:1,frame:0},
 swift:{label:"疾风怪",hp:60,speed:77,harm:1,frame:1},
 stone:{label:"石甲怪",hp:245,speed:27,harm:3,frame:2},
 captain:{label:"烽台首领",hp:1650,speed:22,harm:6,frame:2},
} as const;
export type { EnemyKind } from "./maps";
export interface Core { id: number; kind: CoreKind; slot: number | null; cooldown: number; }
export interface Enemy { id: number; kind: EnemyKind; distance: number; hp: number; maxHp: number; slow: number; slowUntil: number; zoneSlow?: number; lane?: number; summons?: number; summonAt?: number; }
export type Phase = "ready" | "battle" | "won" | "lost";
export interface Checkpoint {
  mapId?: MapId;
  seed: number; wave: number; health: number; cores: Core[]; nextCoreId: number; kills: number; leaks: number; elapsed: number;
  englishCores: EnglishCore[]; englishClaims: GrantId[]; englishSkipped: GrantId[]; nextEnglishId: number;
}
export interface Echo {
  id: number; effectId: EffectId; sourceCoreId: number; sourceEnglishId: number;
  at: Point; due: number; damage: number; radius: number;
}
export interface RootZone {
  id: number; effectId: 'spreading-roots'; sourceCoreId: number; sourceEnglishId: number;
  at: Point; born: number; expires: number; damage: number; radius: number; slow: number;
}
export interface BattleState extends Checkpoint {
  phase: Phase; paused: boolean; waveTime: number; spawned: number; enemies: Enemy[]; unlocked: string[];
  checkpoint: Checkpoint; waveKills: number; waveDrops: number; nextEnemyId: number;
  echoes: Echo[]; nextEffectId: number; visuals: { event: BattleEvent; age: number }[];
  rootZones: RootZone[]; rootPulseAt: number;
}
export type BattleEvent =
  | { type: "shot"; from: Point; to: Point; core: CoreKind; coreId: number; enemyId: number; resonance?: EffectId }
  | { type: "echo"; at: Point; radius: number; damage: number; sourceCoreId: number }
  | { type: "roots"; at: Point; radius: number; sourceCoreId: number }
  | { type: "english-drop"; at: Point; englishId: number; grantId: GrantId }
  | { type: "defeat"; at: Point; kind: EnemyKind }
  | { type: "drop"; at: Point; core: CoreKind }
  | { type: "leak"; at: Point; harm: number }
  | { type: "wave-end"; won: boolean };
export const DEFAULT_SEED = 20260907;
export const START_HEALTH = 16;
export function checkpointOf(state: Checkpoint): Checkpoint {
  return { mapId: state.mapId ?? "qinglan-pass", seed: state.seed, wave: state.wave, health: state.health, cores: state.cores.map(c => ({ ...c })), nextCoreId: state.nextCoreId, kills: state.kills, leaks: state.leaks, elapsed: state.elapsed,
    englishCores: state.englishCores.map(c => ({ ...c })), englishClaims: [...state.englishClaims], englishSkipped: [...state.englishSkipped], nextEnglishId: state.nextEnglishId };
}
export function newBattle(seed = DEFAULT_SEED, unlocked: string[] = [], mapId: MapId = "qinglan-pass"): BattleState {
  const base: Checkpoint = { seed: seed >>> 0, wave: 0, health: START_HEALTH, mapId, cores: mapFor(mapId).starting.map((item,i)=>({id:i+1,...item,cooldown:0})), nextCoreId: mapFor(mapId).starting.length+1, kills: 0, leaks: 0, elapsed: 0, englishCores: [], englishClaims: [], englishSkipped: [], nextEnglishId: 1 };
  return resumeCheckpoint(base, unlocked);
}
export function resumeCheckpoint(checkpoint: Checkpoint, unlocked: string[]): BattleState {
  const base = checkpointOf(checkpoint);
  return { ...base, phase: base.wave >= mapFor(base.mapId).waves.length ? "won" : "ready", paused: false, waveTime: 0, spawned: 0, enemies: [], unlocked: [...unlocked], checkpoint: checkpointOf(base), waveKills: 0, waveDrops: 0, nextEnemyId: 1, echoes: [], nextEffectId: 1, visuals: [], rootZones: [], rootPulseAt: ROOTS.tick };
}
export function startWave(state: BattleState): boolean {
  if (state.phase !== "ready" || state.wave >= mapFor(state.mapId).waves.length) return false;
  state.checkpoint = checkpointOf(state);
  state.phase = "battle"; state.paused = false; state.waveTime = 0; state.spawned = 0; state.waveKills = 0; state.waveDrops = 0;
  state.echoes = []; state.visuals = []; state.rootZones = []; state.rootPulseAt = ROOTS.tick;
  return true;
}
export function deploy(state: BattleState, id: number, slot: number): boolean {
  if (state.phase === "won" || state.phase === "lost" || !Number.isInteger(slot) || !mapFor(state.mapId).slots[slot]) return false;
  const item = state.cores.find(c => c.id === id);
  if (!item || state.cores.some(c => c.slot === slot && c.id !== id)) return false;
  item.slot = slot;
  return true;
}
export function stow(state: BattleState, id: number): boolean {
  if (state.phase === "won" || state.phase === "lost") return false;
  const item = state.cores.find(c => c.id === id);
  if (!item || item.slot === null) return false;
  item.slot = null; return true;
}
export function fuse(state: BattleState, first: number, second: number, target: number | null, recipeId?: string): Core | null {
  if (state.phase === "won" || state.phase === "lost" || first === second) return null;
  const a = state.cores.find(c => c.id === first), b = state.cores.find(c => c.id === second);
  if (!a || !b) return null;
  const recipe = recipeFor(a.kind, b.kind, recipeId);
  const sourceSlots = [a.slot, b.slot].filter((slot): slot is number => slot !== null);
  if (!recipe || (!mapFor(state.mapId).expanded && ["wood-grove", "canopy-grove"].includes(recipe.id)) || (sourceSlots.length ? !sourceSlots.includes(target as number) : target !== null)
    || (target !== null && (!Number.isInteger(target) || !mapFor(state.mapId).slots[target]
    || state.cores.some(c => c.slot === target && c.id !== first && c.id !== second)))) return null;
  const result: Core = { id: state.nextCoreId++, kind: recipe.result, slot: target, cooldown: Math.max(a.cooldown, b.cooldown) };
  state.cores = [...state.cores.filter(c => c.id !== first && c.id !== second), result];
  if (!state.unlocked.includes(recipe.id)) state.unlocked.push(recipe.id);
  return result;
}
// Recycling only repairs this run's gate. No currency or purchasable cores: there is no conversion cycle.
export function recycle(state: BattleState, id: number): number {
  if (state.phase === "won" || state.phase === "lost" || state.health >= START_HEALTH) return 0;
  const item = state.cores.find(c => c.id === id);
  if (!item || item.slot !== null) return 0;
  const attachment = attachedEnglish(state, id);
  if (attachment && state.phase === "battle") return 0;
  const gain = Math.min(START_HEALTH - state.health, CORES[item.kind].recycle);
  if (attachment) attachment.attachedTo = null;
  state.cores = state.cores.filter(c => c.id !== id); state.health += gain; return gain;
}
export function attachedEnglish(state: Checkpoint, coreId: number): EnglishCore | undefined {
  return state.englishCores.find(e => e.attachedTo === coreId);
}
export function activeResonance(state: Checkpoint, core: Core) {
  const english = attachedEnglish(state, core.id), mapping = english && englishMapping(english);
  return english && mapping?.coreId === core.kind && state.englishClaims.includes(mapping.grantId) ? { english, mapping } : undefined;
}
export interface EquipmentPreview { ok: boolean; reason: string; englishId: number; targetId: number; fromId: number | null; }
export function previewEquipment(state: BattleState, englishId: number, targetId: number): EquipmentPreview {
  const english = state.englishCores.find(e => e.id === englishId), target = state.cores.find(c => c.id === targetId);
  const mapping = english && englishMapping(english);
  const result = (ok: boolean, reason: string): EquipmentPreview => ({ ok, reason, englishId, targetId, fromId: english?.attachedTo ?? null });
  if (!english || !mapping || !state.englishClaims.includes(mapping.grantId) || !target) return result(false, "词核或字塔已变化，没有消耗材料。");
  if (state.phase === "won" || state.phase === "lost") return result(false, "这一局已结束。");
  if (mapping.coreId !== target.kind) return result(false, `这枚 ${mapping.text} 用于${CORES[mapping.coreId].glyph}。${mapping.recipe}；可以先保留。`);
  if (english.attachedTo === target.id) return result(false, "这枚英文核已经在这座塔上。");
  if (attachedEnglish(state, target.id)) return result(false, "这座塔已经有一枚英文核。每塔只能装备一枚。");
  if (english.attachedTo !== null && state.phase === "battle") return result(false, "战中可首次装备；卸下和转移要等这一波结束，暂停仍在战中。");
  return result(true, `${CORES[target.kind].glyph}将获得${mapping.effectName}，保留原有基础攻击。`);
}
/** Both selection directions and drag/drop confirm this same atomic transaction. */
export function equipEnglish(state: BattleState, preview: EquipmentPreview): boolean {
  const current = previewEquipment(state, preview.englishId, preview.targetId);
  if (!preview.ok || !current.ok || current.fromId !== preview.fromId) return false;
  state.englishCores.find(e => e.id === preview.englishId)!.attachedTo = preview.targetId; return true;
}
export function unequipEnglish(state: BattleState, englishId: number, expectedCoreId: number): boolean {
  const english = state.englishCores.find(e => e.id === englishId);
  if (state.phase !== "ready" || !english || english.attachedTo !== expectedCoreId) return false;
  english.attachedTo = null; return true;
}
/** Kill drop and wave-end guarantee share the exact grant identity, independent of Chinese RNG. */
function grantEnglish(state: BattleState, at: Point, waveEnd = false): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const drop of mapFor(state.mapId).drops.english) {
    const r=RESONANCES.find(r=>r.grantId===drop.grantId)!;
    if (drop.wave !== state.wave || (!waveEnd && state.waveKills < drop.kill) || state.englishClaims.includes(r.grantId) || state.englishSkipped.includes(r.grantId)) continue;
    const english: EnglishCore = { id: state.nextEnglishId++, lexemeId: r.lexemeId, senseId: r.senseId, grantId: r.grantId, attachedTo: null };
    state.englishCores.push(english); state.englishClaims.push(r.grantId);
    events.push({ type: "english-drop", at: { ...at }, englishId: english.id, grantId: r.grantId });
  }
  return events;
}
function mix(seed: number): number { let x = seed >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; }
export function plannedDrops(seed: number, wave: number, mapId:MapId="qinglan-pass"): CoreKind[] {
  const pool = mapFor(mapId).drops.baseKinds;
  const bag = [...pool]; let random = mix(seed + 701 * (wave + 1));
  for (let i = pool.length-1; i > 0; i--) { random = mix(random + i); const j = random % (i + 1); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  // Every wave supplies all four base kinds once, with one extra from the seed. No indefinitely missing ingredient.
  return [...bag, pool[mix(random + 93) % pool.length]];
}
export function updateBattle(state: BattleState, dt: number): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (state.phase !== "battle" || state.paused || !Number.isFinite(dt) || dt <= 0) return events;
  // Callers use 50 ms fixed steps. Long hidden frames never fast-forward a battle.
  dt = Math.min(dt, .1); state.elapsed += dt; state.waveTime += dt;
  state.visuals = state.visuals.map(v => ({ ...v, age: v.age + dt })).filter(v => v.age < .6);
  state.rootZones = state.rootZones.filter(z => z.expires > state.waveTime + .000001);
  const wave = mapFor(state.mapId).waves[state.wave];
  while (state.spawned < wave.foes.length && state.waveTime >= .8 + state.spawned * wave.interval) {
    const index=state.spawned++, kind = wave.foes[index], hp = ENEMIES[kind].hp * wave.strength;
    state.enemies.push({ id: state.nextEnemyId++, kind, hp, maxHp: hp, distance: 0, slow: 0, slowUntil: 0, lane:wave.lanes?.[index]??0, ...(kind==="captain"?{summons:0}:{}) });
  }
  for (const enemy of state.enemies) {
    if(enemy.kind==='captain'&&(enemy.summons??0)<2) {
      const threshold=(enemy.summons??0)===0?.75:.4;
      if(enemy.hp/enemy.maxHp<=threshold&&enemy.summonAt===undefined) enemy.summonAt=state.waveTime+2;
      if(enemy.summonAt!==undefined&&state.waveTime>=enemy.summonAt) {
        for(let n=0;n<2;n++) {const hp=ENEMIES.swarm.hp*wave.strength;state.enemies.push({id:state.nextEnemyId++,kind:'swarm',hp,maxHp:hp,distance:Math.max(0,enemy.distance-35-n*40),slow:0,slowUntil:0,lane:enemy.lane??0});}
        enemy.summons=(enemy.summons??0)+1;delete enemy.summonAt;
      }
    }
    if (enemy.slowUntil <= state.waveTime) enemy.slow = 0;
    // Zone slow exists only while inside a live area; no additive or persistent root-lock.
    const zones = state.rootZones.filter(z => distanceBetween(enemyPosition(state,enemy), z.at) <= z.radius);
    if (zones.length) enemy.zoneSlow = Math.max(...zones.map(z=>z.slow)); else delete enemy.zoneSlow;
    enemy.distance += ENEMIES[enemy.kind].speed * (1 - Math.max(enemy.slow, enemy.zoneSlow ?? 0)) * dt;
  }
  if (state.waveTime + .000001 >= state.rootPulseAt) {
    state.rootPulseAt += ROOTS.tick;
    // One global pulse clock: staggered zones cannot multiply damage. Strongest covering snapshot wins.
    for (const foe of state.enemies) {
      if (foe.hp <= 0 || remainingDistance(state,foe) <= 0) continue;
      const zones=state.rootZones.filter(z=>distanceBetween(enemyPosition(state,foe),z.at)<=z.radius);
      if (zones.length) foe.hp -= Math.max(...zones.map(z=>z.damage));
    }
  }
  for (const echo of state.echoes.filter(e => e.due <= state.waveTime + .000001)) {
    for (const foe of state.enemies) if (foe.hp > 0 && remainingDistance(state,foe) > 0 && distanceBetween(enemyPosition(state,foe), echo.at) <= echo.radius) foe.hp -= echo.damage;
    events.push({ type: "echo", at: { ...echo.at }, radius: echo.radius, damage: echo.damage, sourceCoreId: echo.sourceCoreId });
  }
  state.echoes = state.echoes.filter(e => e.due > state.waveTime + .000001);
  for (const tower of state.cores) {
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    if (tower.slot === null || tower.cooldown > .000001) continue;
    const definition = CORES[tower.kind], origin = mapFor(state.mapId).slots[tower.slot];
    const targets = state.enemies.filter(e => e.hp > 0 && remainingDistance(state,e) > 0 && distanceBetween(origin, enemyPosition(state,e)) <= definition.range).sort((a, b) => remainingDistance(state,a) - remainingDistance(state,b) || a.id - b.id);
    const target = targets[0]; if (!target) continue;
    tower.cooldown = definition.interval;
    const hit = enemyPosition(state,target);
    const resonance = activeResonance(state, tower);
    events.push({ type: "shot", from: { ...origin }, to: hit, core: tower.kind, coreId: tower.id, enemyId: target.id, resonance: resonance?.mapping.effectId });
    if (resonance?.mapping.effectId === "echo-eruption" && state.echoes.length < ECHO.maxPending) state.echoes.push({
      id: state.nextEffectId++, effectId: "echo-eruption", sourceCoreId: tower.id, sourceEnglishId: resonance.english.id,
      at: { ...hit }, due: state.waveTime + ECHO.delay, damage: definition.damage * ECHO.multiplier, radius: ECHO.radius,
    });
    if (resonance?.mapping.effectId === 'spreading-roots') {
      if (state.rootZones.length >= ROOTS.maxZones) state.rootZones.shift();
      state.rootZones.push({ id: state.nextEffectId++, effectId: 'spreading-roots', sourceCoreId: tower.id, sourceEnglishId: resonance.english.id,
        at: { ...hit }, born: state.waveTime, expires: state.waveTime+ROOTS.duration, damage: definition.damage*ROOTS.multiplier, radius: ROOTS.radius, slow: ROOTS.slow });
      events.push({type:'roots',at:{...hit},radius:ROOTS.radius,sourceCoreId:tower.id});
    }
    if(tower.kind==='canopy'||tower.kind==='forest') {
      const cap=tower.kind==='canopy'?2:resonance?.mapping.effectId==='branching-volley'?4:3;
      const factor=tower.kind==='canopy'?.6:.65;
      for(const secondary of targets.slice(1,cap)) { secondary.hp-=definition.damage*factor;events.push({type:'shot',from:{...origin},to:enemyPosition(state,secondary),core:tower.kind,coreId:tower.id,enemyId:secondary.id,resonance:resonance?.mapping.effectId}); }
    }
    for (const foe of state.enemies) {
      if (foe.hp <= 0 || remainingDistance(state,foe) <= 0 || (foe.id !== target.id && (!definition.splash || distanceBetween(enemyPosition(state,foe), hit) > definition.splash))) continue;
      foe.hp -= definition.damage;
      if (definition.slow) { foe.slow = Math.max(foe.slow, definition.slow); foe.slowUntil = Math.max(foe.slowUntil, state.waveTime + definition.slowDuration); }
    }
  }
  for (const enemy of state.enemies) {
    const at = enemyPosition(state,enemy);
    if (enemy.hp <= 0) {
      state.kills++; state.waveKills++; events.push({ type: "defeat", at, kind: enemy.kind });
      // Five visible automatic drops per wave at reachable kill milestones; inventory has no capacity cap.
      const milestones = mapFor(state.mapId).drops.milestones;
      if (state.waveDrops < milestones.length && state.waveKills >= milestones[state.waveDrops]) {
        const kind = plannedDrops(state.seed, state.wave,state.mapId)[state.waveDrops++];
        state.cores.push({ id: state.nextCoreId++, kind, slot: null, cooldown: 0 });
        events.push({ type: "drop", at, core: kind });
      }
      events.push(...grantEnglish(state, at));
    } else if (remainingDistance(state,enemy) <= 0) {
      state.health = Math.max(0, state.health - ENEMIES[enemy.kind].harm); state.leaks++;
      events.push({ type: "leak", at, harm: ENEMIES[enemy.kind].harm });
    }
  }
  state.enemies = state.enemies.filter(e => e.hp > 0 && remainingDistance(state,e) > 0);
  if (state.health <= 0) { state.phase = "lost"; state.paused = false; state.echoes = []; state.rootZones=[]; state.visuals = []; return events; }
  if (state.spawned === wave.foes.length && !state.enemies.length) {
    events.push(...grantEnglish(state, mapFor(state.mapId).paths[0].at(-1)!, true)); state.echoes = []; state.rootZones=[];
    state.wave++; state.phase = state.wave >= mapFor(state.mapId).waves.length ? "won" : "ready"; state.paused = false;
    state.checkpoint = checkpointOf(state); events.push({ type: "wave-end", won: state.phase === "won" });
  }
  state.visuals = state.phase === 'battle' ? [...state.visuals, ...events.map(event=>({event,age:0}))].slice(-90) : [];
  return events;
}

/** Same duration, all towers continuously in range of one non-dying target; no movement/overkill/armor advantage. */
export function firingRange(kinds: readonly CoreKind[], seconds = 30): { damage: number; shots: number; slowSeconds: number } {
  const cooldowns = kinds.map(() => 0); let damage = 0, shots = 0, slowUntil = 0, slowSeconds = 0;
  for (let tick = 0; tick < Math.round(seconds / .05); tick++) {
    const time = tick * .05;
    for (let i = 0; i < kinds.length; i++) {
      const c = CORES[kinds[i]];
      if (cooldowns[i] <= time + .000001) { damage += c.damage; shots++; cooldowns[i] = time + c.interval; if (c.slow) slowUntil = Math.max(slowUntil, time + c.slowDuration); }
    }
    if (time < slowUntil) slowSeconds += .05;
  }
  return { damage, shots, slowSeconds: Math.round(slowSeconds * 100) / 100 };
}
