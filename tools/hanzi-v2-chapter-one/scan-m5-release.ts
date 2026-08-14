import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHAPTER_ONE_CHARACTERS,
  M3_BUILD_ABILITIES,
  M3_HEROES,
  M5_BEHAVIORS,
  M5_BOSSES,
  reduceM3State,
  replayM3Actions,
  simulateM3Run,
  type M3AbilityId,
} from "../../games/hanzi-radical-battle/v2/chapter-one";
import { computeHanziV2SourceTreeSha256 } from "./source-identity";

const seedsPerHero = Number(process.argv[2] ?? "10000");
if (!Number.isSafeInteger(seedsPerHero) || seedsPerHero < 1) throw new Error("seeds per hero must be a positive integer");

const characters = new Map<string, number>();
const abilities = new Map<M3AbilityId, { offered: number; selected: number; triggered: number }>(M3_BUILD_ABILITIES.map((entry) => [entry.id, { offered: 0, selected: 0, triggered: 0 }]));
const behaviors = new Map(M5_BEHAVIORS.map((entry) => [entry.id, 0]));
const bosses = new Map(M5_BOSSES.map((entry) => [entry.id, 0]));
const routes = new Set<string>();
const encounters = new Set<string>();
const failures: { seed: string; hero: string; mode: string; codes: readonly string[] }[] = [];
let resumeMismatches = 0;

for (const hero of M3_HEROES) {
  for (let index = 0; index < seedsPerHero; index += 1) {
    const mode = index % 2 === 0 ? "story" : "free";
    const seed = `m5-release-${hero.id}-${index.toString().padStart(5, "0")}`;
    const result = simulateM3Run(seed, hero.id, mode);
    if (!result.passed) failures.push({ seed, hero: hero.id, mode, codes: result.failureCodes });
    routes.add(`${mode}:${result.routeSignature}`);
    encounters.add(result.encounterSignature);
    result.finalState.discoveredCharacterIds.forEach((id) => characters.set(id, (characters.get(id) ?? 0) + 1));
    result.finalState.completedBehaviorCycles.forEach((id) => behaviors.set(id, (behaviors.get(id) ?? 0) + 1));
    result.finalState.completedBossIds.forEach((id) => bosses.set(id, (bosses.get(id) ?? 0) + 1));
    result.finalState.abilityEvidence.forEach((entry) => {
      const row = abilities.get(entry.abilityId)!;
      if (entry.offered) row.offered += 1;
      if (entry.selected) row.selected += 1;
      if (entry.triggered) row.triggered += 1;
    });
    if (index < 10) {
      const halfway = Math.floor(result.actions.length / 2);
      const before = result.actions.slice(0, halfway);
      const after = result.actions.slice(halfway);
      const resumed = after.reduce(reduceM3State, replayM3Actions(seed, hero.id, before, mode));
      if (JSON.stringify(resumed) !== JSON.stringify(result.finalState)) resumeMismatches += 1;
    }
  }
}

const missingCharacters = CHAPTER_ONE_CHARACTERS.filter((entry) => !characters.has(entry.id)).map((entry) => entry.id);
const missingAbilities = [...abilities].filter(([, row]) => row.offered === 0 || row.selected === 0 || row.triggered === 0).map(([id]) => id);
const missingBehaviors = [...behaviors].filter(([, count]) => count === 0).map(([id]) => id);
const missingBosses = [...bosses].filter(([, count]) => count === 0).map(([id]) => id);
const passed = failures.length === 0 && resumeMismatches === 0 && missingCharacters.length === 0 && missingAbilities.length === 0 && missingBehaviors.length === 0 && missingBosses.length === 0;
const report = {
  schemaVersion: 1,
  sourceTreeSha256: computeHanziV2SourceTreeSha256(),
  result: passed ? "PASS" : "FAIL",
  seedsPerHero,
  totalSeeds: seedsPerHero * M3_HEROES.length,
  totalCompletedEncounters: seedsPerHero * M3_HEROES.length * 15,
  failures,
  resumeMismatches,
  coverage: {
    characters: Object.fromEntries([...characters].sort()),
    abilities: Object.fromEntries([...abilities].sort()),
    behaviors: Object.fromEntries([...behaviors].sort()),
    bosses: Object.fromEntries([...bosses].sort()),
    routeSignatures: routes.size,
    encounterSignatures: encounters.size,
  },
  missingCharacters,
  missingAbilities,
  missingBehaviors,
  missingBosses,
  generatedAtUtc: new Date().toISOString(),
};
const directory = resolve("test-results/hanzi-v2/chapter-one/validation");
mkdirSync(directory, { recursive: true });
const output = resolve(directory, "PURE-SIMULATION.json");
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, result: report.result, totalSeeds: report.totalSeeds, failures: failures.length, resumeMismatches, characters: characters.size, abilities: abilities.size, behaviors: behaviors.size, bosses: bosses.size, routes: routes.size, encounters: encounters.size }, null, 2));
if (!passed) process.exitCode = 1;
