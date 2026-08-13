import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHAPTER_ONE_CHARACTERS,
  M3_BUILD_ABILITIES,
  M3_HEROES,
  simulateM3Run,
  type M3AbilityId,
} from "../../games/hanzi-radical-battle/v2/chapter-one";

const seedsPerHero = Number(process.argv[2] ?? "10000");
if (!Number.isSafeInteger(seedsPerHero) || seedsPerHero < 1) throw new Error("seeds per hero must be a positive integer");

type Coverage = { offered: number; selected: number; triggered: number; stateChanged: number; visibleEffectObserved: number; neverAutoSolved: number; noIllegalAnswer: number };
const blankCoverage = (): Coverage => ({ offered: 0, selected: 0, triggered: 0, stateChanged: 0, visibleEffectObserved: 0, neverAutoSolved: 0, noIllegalAnswer: 0 });
const abilityCoverage = new Map<M3AbilityId, Coverage>(M3_BUILD_ABILITIES.map((ability) => [ability.id, blankCoverage()]));
const characterCoverage = new Map<string, number>();
const heroCoverage = Object.fromEntries(M3_HEROES.map((hero) => [hero.id, { seeds: 0, failures: 0, innateTriggers: 0, routeSignatures: new Set<string>(), abilitySignatures: new Set<string>(), encounterSignatures: new Set<string>() }])) as Record<(typeof M3_HEROES)[number]["id"], { seeds: number; failures: number; innateTriggers: number; routeSignatures: Set<string>; abilitySignatures: Set<string>; encounterSignatures: Set<string> }>;
const failures: { seed: string; heroId: string; codes: readonly string[] }[] = [];

for (const hero of M3_HEROES) {
  const coverage = heroCoverage[hero.id];
  for (let index = 0; index < seedsPerHero; index += 1) {
    const seed = `m3-gate-${hero.id}-${index.toString().padStart(5, "0")}`;
    const result = simulateM3Run(seed, hero.id);
    coverage.seeds += 1;
    if (!result.passed) {
      coverage.failures += 1;
      failures.push({ seed, heroId: hero.id, codes: result.failureCodes });
    }
    coverage.innateTriggers += result.finalState.innateEvidence.triggeredCount;
    coverage.routeSignatures.add(result.routeSignature);
    coverage.abilitySignatures.add(result.abilitySignature);
    coverage.encounterSignatures.add(result.encounterSignature);
    result.finalState.discoveredCharacterIds.forEach((id) => characterCoverage.set(id, (characterCoverage.get(id) ?? 0) + 1));
    for (const evidence of result.finalState.abilityEvidence) {
      const target = abilityCoverage.get(evidence.abilityId)!;
      if (evidence.offered) target.offered += 1;
      if (evidence.selected) target.selected += 1;
      if (evidence.triggered) target.triggered += 1;
      if (evidence.stateChanged) target.stateChanged += 1;
      if (evidence.visibleEffectObserved) target.visibleEffectObserved += 1;
      if (evidence.neverAutoSolved) target.neverAutoSolved += 1;
      if (evidence.noIllegalAnswer) target.noIllegalAnswer += 1;
    }
  }
}

const missingCharacters = CHAPTER_ONE_CHARACTERS.map((entry) => entry.id).filter((id) => !characterCoverage.has(id));
const missingAbilityEvidence = M3_BUILD_ABILITIES.map((entry) => entry.id).filter((id) => {
  const coverage = abilityCoverage.get(id)!;
  return coverage.offered < 1 || coverage.selected < 1 || coverage.triggered < 1 || coverage.stateChanged < 1 || coverage.visibleEffectObserved < 1 || coverage.neverAutoSolved < 1 || coverage.noIllegalAnswer < 1;
});
const heroSummary = Object.fromEntries(M3_HEROES.map((hero) => {
  const coverage = heroCoverage[hero.id];
  return [hero.id, {
    seeds: coverage.seeds,
    failures: coverage.failures,
    innateTriggers: coverage.innateTriggers,
    routeSignatures: coverage.routeSignatures.size,
    abilitySignatures: coverage.abilitySignatures.size,
    encounterSignatures: coverage.encounterSignatures.size,
  }];
}));
const passed = failures.length === 0
  && missingCharacters.length === 0
  && missingAbilityEvidence.length === 0
  && M3_HEROES.every((hero) => heroCoverage[hero.id].seeds === seedsPerHero && heroCoverage[hero.id].innateTriggers > 0);

const report = {
  schemaVersion: 1,
  milestone: "M3",
  result: passed ? "PASS" : "FAIL",
  seedsPerHero,
  totalSeeds: seedsPerHero * M3_HEROES.length,
  totalCompletedEncounters: seedsPerHero * M3_HEROES.length * 12,
  failures,
  heroCoverage: heroSummary,
  characterCoverage: Object.fromEntries([...characterCoverage].sort()),
  abilityCoverage: Object.fromEntries([...abilityCoverage].sort()),
  missingCharacters,
  missingAbilityEvidence,
  generatedAtUtc: new Date().toISOString(),
};
const outputDirectory = resolve("artifacts/hanzi-radical-battle-v2/v2-chapter-one/checkpoints/M3");
mkdirSync(outputDirectory, { recursive: true });
const output = resolve(outputDirectory, `M3-SIMULATION-${seedsPerHero}-PER-HERO.json`);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, result: report.result, seedsPerHero, totalSeeds: report.totalSeeds, totalCompletedEncounters: report.totalCompletedEncounters, failureCount: failures.length, heroCoverage: heroSummary, charactersCovered: characterCoverage.size, abilityEvidenceCovered: abilityCoverage.size, missingCharacters, missingAbilityEvidence }, null, 2));
if (!passed) process.exitCode = 1;
