import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  M1_ABILITIES,
  M1_BEHAVIORS,
  simulateM1Run,
} from "../../games/hanzi-radical-battle/v2/chapter-one";

const count = Number(process.argv[2] ?? "5000");
if (!Number.isSafeInteger(count) || count < 1) throw new Error("seed count must be a positive integer");

const characterCoverage = new Map<string, number>();
const abilityCoverage = new Map<string, number>();
const behaviorCoverage = new Map<string, number>();
const routeSignatures = new Set<string>();
const abilitySignatures = new Set<string>();
const encounterSignatures = new Set<string>();
const failures: { seed: string; codes: readonly string[] }[] = [];

for (let index = 0; index < count; index += 1) {
  const seed = `m1-gate-${index.toString().padStart(5, "0")}`;
  const result = simulateM1Run(seed);
  if (!result.passed) failures.push({ seed, codes: result.failureCodes });
  result.finalState.discoveredCharacterIds.forEach((id) => characterCoverage.set(id, (characterCoverage.get(id) ?? 0) + 1));
  result.finalState.triggeredAbilityIds.forEach((id) => abilityCoverage.set(id, (abilityCoverage.get(id) ?? 0) + 1));
  result.finalState.completedBehaviorCycles.forEach((id) => behaviorCoverage.set(id, (behaviorCoverage.get(id) ?? 0) + 1));
  routeSignatures.add(result.routeSignature);
  abilitySignatures.add(result.abilitySignature);
  encounterSignatures.add(result.encounterSignature);
}

const missingAbilities = M1_ABILITIES.map((entry) => entry.id).filter((id) => !abilityCoverage.has(id));
const missingBehaviors = M1_BEHAVIORS.map((entry) => entry.id).filter((id) => !behaviorCoverage.has(id));
const passed = failures.length === 0
  && characterCoverage.size === 12
  && missingAbilities.length === 0
  && missingBehaviors.length === 0
  && routeSignatures.size > 1
  && abilitySignatures.size > 1
  && encounterSignatures.size > 1;

const report = {
  schemaVersion: 1,
  milestone: "M1",
  result: passed ? "PASS" : "FAIL",
  seeds: count,
  failures,
  characterCoverage: Object.fromEntries([...characterCoverage].sort()),
  abilityCoverage: Object.fromEntries([...abilityCoverage].sort()),
  behaviorCoverage: Object.fromEntries([...behaviorCoverage].sort()),
  variation: {
    routeSignatures: routeSignatures.size,
    abilitySignatures: abilitySignatures.size,
    encounterSignatures: encounterSignatures.size,
  },
  missingAbilities,
  missingBehaviors,
  generatedAtUtc: new Date().toISOString(),
};

const output = resolve("artifacts/hanzi-radical-battle-v2/v2-chapter-one/checkpoints/M1/M1-SIMULATION-5000.json");
mkdirSync(resolve(output, ".."), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, ...report }, null, 2));
if (!passed) process.exitCode = 1;
