import { CORES, RECIPES, type CoreKind } from "../../games/hanzi-tower-defense/content";
import { DEFAULT_SEED, deploy, firingRange, fuse, newBattle, startWave, updateBattle, type BattleState } from "../../games/hanzi-tower-defense/model";

export type BuildRoute = "flame-wildwood" | "volcano-grove" | "separate";
export function arrange(state: BattleState, route: BuildRoute, positions: number[] = [1, 3, 0, 6, 2, 4, 7, 5]): void {
  const combine = (aKind: CoreKind, bKind: CoreKind) => {
    const a = state.cores.find(c => c.kind === aKind), b = state.cores.find(c => c.kind === bKind && c.id !== a?.id);
    return a && b ? fuse(state, a.id, b.id, a.slot ?? b.slot) : null;
  };
  if (route !== "separate") {
    for (let i = 0; i < 20; i++) {
      if (route === "flame-wildwood") { if (combine("fire", "fire")) continue; if (combine("mountain", "grove")) continue; if (combine("wood", "wood")) continue; }
      else { if (combine("fire", "mountain")) continue; if (combine("wood", "wood")) continue; }
      if (combine("water", "wood")) continue;
      break;
    }
  }
  const ordered = [...state.cores].sort((a,b) => {
    const output = (k: CoreKind) => CORES[k].damage / CORES[k].interval;
    return output(b.kind) - output(a.kind) || a.id - b.id;
  });
  for (const core of ordered) if (core.slot === null) {
    const slot = positions.find(p => !state.cores.some(c => c.slot === p));
    if (slot !== undefined) deploy(state, core.id, slot);
  }
}
export function runBuild(seed: number, route: BuildRoute, positions?: number[]) {
  const state = newBattle(seed); const waves = []; let frames = 0;
  // Only legal player actions at wave boundaries, no added cores / health / damage / time acceleration in the model.
  while (state.phase !== "won" && state.phase !== "lost" && frames++ < 30000) {
    if (state.phase === "ready") { arrange(state, route, positions); startWave(state); }
    const events = updateBattle(state, .05);
    if (events.some(e => e.type === "wave-end")) waves.push({ wave: state.wave, health: state.health, kills: state.kills, leaks: state.leaks, elapsed: +state.elapsed.toFixed(2), cores: state.cores.length });
  }
  return { seed, route, result: state.phase, health: state.health, kills: state.kills, leaks: state.leaks, seconds: +state.elapsed.toFixed(2), waves };
}
export function balanceEvidence() {
  const seeds = [DEFAULT_SEED, 1, 7, 42, 2026, 0, 0xffffffff, 8191, 314159, 65535, 123456, 987654];
  return {
    range: RECIPES.map(recipe => ({ recipe: recipe.id, seconds: 30, condition: "one immortal target, every core always in range, no overkill or armor", before: firingRange(recipe.inputs), after: firingRange([recipe.result]), slowBefore: Math.max(...recipe.inputs.map(k => CORES[k].slow)), slowAfter: CORES[recipe.result].slow })),
    builds: seeds.flatMap(seed => (["flame-wildwood", "volcano-grove"] as const).map(route => runBuild(seed, route))),
    separate: runBuild(DEFAULT_SEED, "separate"),
    placement: [0, 1, 7].map(slot => {
      const state = newBattle(); deploy(state, 1, slot); startWave(state);
      while (state.phase === "battle") updateBattle(state, .05);
      return { slot: slot + 1, loadout: "one fire core, identical remaining materials in bag", kills: state.kills, leaks: state.leaks, health: state.health, seconds: +state.elapsed.toFixed(2) };
    }),
    control: ([[], ["water"], ["water", "wood"], ["wash"]] as CoreKind[][]).map(kinds => {
      const state = newBattle();
      // Unit-test fixture: same non-dying moving target and starting position, no spawning.
      state.cores = kinds.map((kind, i) => ({ id: i+1, kind, slot: i === 0 ? 0 : 1, cooldown: 0 }));
      startWave(state); state.spawned = 12;
      state.enemies = [{ id:1, kind:"swarm", distance:150, hp:1e9, maxHp:1e9, slow:0, slowUntil:0 }];
      for(let tick=0;tick<200;tick++) updateBattle(state,.05);
      return { kinds, seconds:10, traveled:+(state.enemies[0].distance-150).toFixed(2) };
    }),
  };
}
