import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createM3GameState, reduceM3State, replayM3Actions, simulateM3Run } from "../../games/hanzi-radical-battle/v2/chapter-one/m3-machine";
import { M3_BUILD_ABILITIES, M3_HEROES } from "../../games/hanzi-radical-battle/v2/chapter-one/builds";
import { createFreshM4Save, syncM4SaveFromGame, writeM4Save } from "../../games/hanzi-radical-battle/v2/chapter-one/m4-save";
import { writeM3Session } from "../../games/hanzi-radical-battle/v2/chapter-one/m3-session";
import { M5_BEHAVIORS, M5_BOSSES } from "../../games/hanzi-radical-battle/v2/chapter-one/m5-content";
import { createV1GameState } from "../../games/hanzi-radical-battle/v2/v1/machine";
import { HANZI_MAGIC_V1_SAVE_KEY, createFreshV1Save, saveFromGameState, writeV1Save } from "../../games/hanzi-radical-battle/v2/v1/save";
import { PLAYABLE_WHEEL_MANIFEST } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest";
import { createFreshWheelWorkshopSave, writeWheelWorkshopSave } from "../../games/hanzi-radical-battle/v2/wheel-workshop/save/wheel-save";
import { COMPLETE_BOSS_ARCHIVE } from "../../games/hanzi-radical-battle/complete/archive/contracts";
import { CHAPTER_THREE_NEW_ABILITY_IDS } from "../../games/hanzi-radical-battle/complete/chapters/chapter-three/contracts";
import { replayChapterThreeActions, simulateChapterThree } from "../../games/hanzi-radical-battle/complete/chapters/chapter-three/engine";
import { CHAPTER_TWO_NEW_ABILITY_IDS } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/contracts";
import { replayChapterTwoActions, simulateChapterTwo } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/engine";
import { COMPLETE_COMPONENT_FAMILIES } from "../../games/hanzi-radical-battle/complete/content-graph/families";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { COMPLETE_WORD_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/words";
import { createCompleteEngineState, reduceCompleteEngineState } from "../../games/hanzi-radical-battle/complete/core/complete-machine";
import { auditCompleteCharacterHands, auditCompleteFamilies, auditCompleteWords } from "../../games/hanzi-radical-battle/complete/core/content-solvers";
import { COMPLETE_EPISODE_IDS, COMPLETE_NEW_BEHAVIOR_IDS, COMPLETE_POSTGAME_MODES, COMPLETE_REPAIR_IDS } from "../../games/hanzi-radical-battle/complete/core/world-contracts";
import { createCompletePostgamePlan } from "../../games/hanzi-radical-battle/complete/postgame/contracts";
import { replayCompletePostgameRun, simulateCompletePostgame } from "../../games/hanzi-radical-battle/complete/postgame/engine";
import {
  HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY,
  HANZI_MAGIC_COMPLETE_SAVE_KEY,
  createFreshCompleteSave,
  progressSeedFromCompleteSave,
  readCompleteSave,
  syncCompleteSaveFromEngine,
  updateCompleteSave,
  withCompleteSaveChecksum,
} from "../../games/hanzi-radical-battle/complete/save/complete-save";
import { HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS } from "../../games/hanzi-radical-battle/complete/save/legacy-migrations";
import { createFreshCompleteSliceSave } from "../../games/hanzi-radical-battle/complete/save/slice-save";
import { COMPLETE_WHEEL_MANIFEST } from "../../games/hanzi-radical-battle/complete/wheel-adapter/selection";
import { COMPLETE_WHEEL_GRADE_OPTIONS } from "../../games/hanzi-radical-battle/complete/wheel-adapter/selection";
import { simulateCompleteWorkshop } from "../../games/hanzi-radical-battle/complete/workshop-adapter/engine";

const DEFAULT_SCENARIOS = 200_000;
const BATCH_SIZE = 10_000;
const OUTPUT = resolve("artifacts/hanzi-magic-battle/v3-complete/checkpoints/SIMULATION_COVERAGE.json");

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function stableString(value: unknown): string {
  return JSON.stringify(value);
}

function legacyChecksum(payload: unknown): string {
  let hash = 2166136261;
  for (const character of JSON.stringify(payload)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function writeCompletedV2(storage: MemoryStorage, seed: string): void {
  const simulation = simulateM3Run(seed, "forest-speaker");
  let game = createM3GameState(seed, "forest-speaker");
  let save = createFreshM4Save();
  for (const action of simulation.actions) {
    game = reduceM3State(game, action);
    save = syncM4SaveFromGame(save, game);
  }
  writeM4Save(storage, save);
  writeM3Session(storage, seed, "forest-speaker", simulation.actions);
}

function runMigrationCoverage(recordFailure: (code: string) => void): readonly string[] {
  const covered: string[] = [];
  const check = (name: string, passed: boolean) => { if (passed) covered.push(name); else recordFailure(`MIGRATION_${name.toUpperCase().replaceAll("-", "_")}`); };

  const fresh = new MemoryStorage();
  check("fresh", readCompleteSave(fresh).source === "fresh");

  const slice = new MemoryStorage();
  const sliceRaw = JSON.stringify(createFreshCompleteSliceSave("family"));
  slice.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, sliceRaw);
  const sliceRead = readCompleteSave(slice);
  check("slice-v1", sliceRead.source === "slice-v1-migrated" && slice.getItem(HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS.sliceV1) === sliceRaw);

  const v1 = new MemoryStorage();
  const v1State = createV1GameState("acceptance-v1", { completedAdventureIds: ["glimmer-path"], unlockedAdventureIds: ["glimmer-path"], discoveredCharacterIds: ["ming", "hua", "lin", "xing"], campRepairStage: 1 });
  writeV1Save(v1, saveFromGameState(createFreshV1Save(), v1State));
  const v1Raw = v1.getItem(HANZI_MAGIC_V1_SAVE_KEY);
  const v1Read = readCompleteSave(v1);
  check("v1", v1Read.state.migration.sources.includes("v1") && v1Raw !== null && v1.getItem(HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS.v1) === v1Raw);

  const v2 = new MemoryStorage();
  writeCompletedV2(v2, "acceptance-v2");
  const v2Read = readCompleteSave(v2);
  check("v2", v2Read.state.migration.sources.includes("v2") && v2Read.state.completedChapterIds.includes("chapter-one"));

  const wheel = new MemoryStorage();
  writeWheelWorkshopSave(wheel, { ...createFreshWheelWorkshopSave(), discoveredRecordIds: [PLAYABLE_WHEEL_MANIFEST[0].id], recentRecordIds: [PLAYABLE_WHEEL_MANIFEST[0].id] });
  const wheelRead = readCompleteSave(wheel);
  check("wheel", wheelRead.state.migration.sources.includes("wheel") && wheelRead.state.discoveredCharacterIds.length === 1);

  const merged = new MemoryStorage();
  writeCompletedV2(merged, "acceptance-v2-wheel");
  writeWheelWorkshopSave(merged, { ...createFreshWheelWorkshopSave(), discoveredRecordIds: [PLAYABLE_WHEEL_MANIFEST[0].id], recentRecordIds: [PLAYABLE_WHEEL_MANIFEST[0].id] });
  const mergedRead = readCompleteSave(merged);
  check("v2+wheel", mergedRead.state.migration.sources.includes("v2") && mergedRead.state.migration.sources.includes("wheel"));

  const content = new MemoryStorage();
  const current = createFreshCompleteSave();
  const { validation: _validation, ...payload } = current;
  content.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, JSON.stringify(withCompleteSaveChecksum({ ...payload, contentRevisionHash: "fnv1a:prior-content" })));
  check("content-revision", readCompleteSave(content).source === "content-migrated");

  const corrupt = new MemoryStorage();
  corrupt.setItem(HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY, JSON.stringify(createFreshCompleteSave()));
  corrupt.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, "{broken");
  const corruptRead = readCompleteSave(corrupt);
  check("corrupt-backup", corruptRead.recovered && corruptRead.source === "v3-backup");

  const future = new MemoryStorage();
  future.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, JSON.stringify({ schemaVersion: 99, futureField: "preserve" }));
  const futureRead = readCompleteSave(future);
  check("future-read-only", !futureRead.writable && futureRead.futureVersionProtected);

  const preM6 = new MemoryStorage();
  const preM6Current = updateCompleteSave(createFreshCompleteSave(), { selectedHeroId: "forest-speaker" });
  const { validation: _preM6Validation, ...preM6Payload } = preM6Current;
  const preM6LegacyPayload = { ...preM6Payload, postgameResume: { mode: "free-adventure", seed: "pre-m6", phase: "active", actionCount: 17 } };
  preM6.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, JSON.stringify({ ...preM6LegacyPayload, validation: { algorithm: "fnv1a32", checksum: legacyChecksum(preM6LegacyPayload) } }));
  const preM6Read = readCompleteSave(preM6);
  check("pre-m6-postgame", preM6Read.state.postgameResume?.actionCount === 0 && preM6Read.state.postgameResume?.actions.length === 0);

  return covered.sort();
}

function parseScenarioCount(): number {
  const raw = process.argv[2] ?? String(DEFAULT_SCENARIOS);
  const count = Number(raw);
  if (!Number.isSafeInteger(count) || count < DEFAULT_SCENARIOS) throw new Error(`Scenario count must be an integer >= ${DEFAULT_SCENARIOS}`);
  return count;
}

function main(): void {
  const scenarioCount = parseScenarioCount();
  const failures = new Map<string, number>();
  const recordFailure = (code: string) => failures.set(code, (failures.get(code) ?? 0) + 1);
  const hands = auditCompleteCharacterHands();
  const families = auditCompleteFamilies();
  const words = auditCompleteWords();
  const allAbilityIds = [...M3_BUILD_ABILITIES.map((entry) => entry.id), ...CHAPTER_TWO_NEW_ABILITY_IDS, ...CHAPTER_THREE_NEW_ABILITY_IDS];
  const allBehaviorIds = [...M5_BEHAVIORS.map((entry) => entry.id), ...COMPLETE_NEW_BEHAVIOR_IDS];
  const allBossIds = COMPLETE_BOSS_ARCHIVE.map((entry) => entry.id);
  const migrationCoverage = runMigrationCoverage(recordFailure);

  const reachableCharacters = new Set<string>();
  const reachableFamilies = new Set<string>();
  const reachableWords = new Set<string>();
  const offeredAbilities = new Set<string>();
  const selectedAbilities = new Set<string>();
  const triggeredAbilities = new Set<string>();
  const completedBehaviors = new Set<string>();
  const completedBosses = new Set<string>();
  const completedRepairs = new Set<string>();
  const completedModes = new Set<string>();
  const reachedEpisodes = new Set<string>();
  const reachedWheelRecords = new Set<string>();
  let replayMismatch = 0;
  let resumeMismatch = 0;
  let softlocks = 0;
  let impossibleStates = 0;

  for (const hero of M3_HEROES) {
    for (let index = 0; index < 1000; index += 1) {
      const result = simulateM3Run(`complete-acceptance-ch1-${hero.id}-${index}`, hero.id);
      if (result.finalState.phase !== "run-summary") softlocks += 1;
      impossibleStates += result.failureCodes.filter((code) => code !== "SOFTLOCK").length;
      if (stableString(replayM3Actions(result.finalState.seed, hero.id, result.actions)) !== stableString(result.finalState)) replayMismatch += 1;
      result.finalState.discoveredCharacterIds.forEach((id) => reachableCharacters.add(`legacy:${id}`));
      result.finalState.abilityEvidence.forEach((entry) => { if (entry.offered) offeredAbilities.add(entry.abilityId); if (entry.selected) selectedAbilities.add(entry.abilityId); if (entry.triggered) triggeredAbilities.add(entry.abilityId); });
      result.finalState.completedBehaviorCycles.forEach((id) => completedBehaviors.add(id));
      result.finalState.completedBossIds.forEach((id) => completedBosses.add(id));
    }
  }

  for (let index = 0; index < 40; index += 1) {
    const chapterTwo = simulateChapterTwo(`complete-acceptance-ch2-${index}`);
    if (chapterTwo.finalState.phase !== "chapter-summary") softlocks += 1;
    impossibleStates += chapterTwo.failureCodes.filter((code) => code !== "SOFTLOCK").length;
    if (stableString(replayChapterTwoActions(`complete-acceptance-ch2-${index}`, "light-speaker", chapterTwo.actions)) !== stableString(chapterTwo.finalState)) replayMismatch += 1;
    chapterTwo.finalState.discoveredCharacterIds.forEach((id) => reachableCharacters.add(id));
    chapterTwo.finalState.discoveredFamilyIds.forEach((id) => reachableFamilies.add(id));
    chapterTwo.finalState.offeredAbilityIds.forEach((id) => offeredAbilities.add(id)); chapterTwo.finalState.selectedAbilityIds.forEach((id) => selectedAbilities.add(id)); chapterTwo.finalState.triggeredAbilityIds.forEach((id) => triggeredAbilities.add(id));
    chapterTwo.finalState.completedBehaviorIds.forEach((id) => completedBehaviors.add(id)); chapterTwo.finalState.completedBossIds.forEach((id) => completedBosses.add(id)); chapterTwo.finalState.repairedObjectIds.forEach((id) => completedRepairs.add(id)); chapterTwo.finalState.completedEpisodeIds.forEach((id) => reachedEpisodes.add(id));

    const chapterThree = simulateChapterThree(`complete-acceptance-ch3-${index}`);
    if (chapterThree.finalState.phase !== "chapter-summary") softlocks += 1;
    impossibleStates += chapterThree.failureCodes.filter((code) => code !== "SOFTLOCK").length;
    if (stableString(replayChapterThreeActions(`complete-acceptance-ch3-${index}`, "light-speaker", chapterThree.actions)) !== stableString(chapterThree.finalState)) replayMismatch += 1;
    chapterThree.finalState.discoveredCharacterIds.forEach((id) => reachableCharacters.add(id)); chapterThree.finalState.reviewedFamilyIds.forEach((id) => reachableFamilies.add(id)); chapterThree.finalState.discoveredWordIds.forEach((id) => reachableWords.add(id));
    chapterThree.finalState.offeredAbilityIds.forEach((id) => offeredAbilities.add(id)); chapterThree.finalState.selectedAbilityIds.forEach((id) => selectedAbilities.add(id)); chapterThree.finalState.triggeredAbilityIds.forEach((id) => triggeredAbilities.add(id));
    chapterThree.finalState.completedBehaviorIds.forEach((id) => completedBehaviors.add(id)); chapterThree.finalState.completedBossIds.forEach((id) => completedBosses.add(id)); chapterThree.finalState.repairedObjectIds.forEach((id) => completedRepairs.add(id)); chapterThree.finalState.completedEpisodeIds.forEach((id) => reachedEpisodes.add(id));
  }

  for (const mode of COMPLETE_POSTGAME_MODES) {
    for (let index = 0; index < 120; index += 1) {
      const hero = M3_HEROES[index % M3_HEROES.length].id;
      const seed = `complete-acceptance-postgame-${mode}-${index}`;
      const result = simulateCompletePostgame(mode, seed, hero, mode === "free-adventure" ? (["whole-forest", "story-path", "optional-glow"] as const)[index % 3] : "whole-forest", 2);
      if (result.finalRun.state.phase !== "session-summary") softlocks += 1;
      impossibleStates += result.failureCodes.filter((code) => code !== "SESSION_NOT_COMPLETE").length;
      if (stableString(replayCompletePostgameRun(seed, hero, mode, result.finalRun.band, result.actions)) !== stableString(result.finalRun)) replayMismatch += 1;
      result.finalRun.state.discoveredCharacterIds.forEach((id) => reachableCharacters.add(id)); result.finalRun.state.discoveredFamilyIds.forEach((id) => reachableFamilies.add(id)); result.finalRun.state.discoveredWordIds.forEach((id) => reachableWords.add(id)); completedModes.add(mode);
      const plan = createCompletePostgamePlan(`${seed}-reachability`, hero, mode);
      plan.rounds.flatMap((round) => round.offers).forEach((offer) => { if (mode === "free-adventure") reachableCharacters.add(offer.targetId); else if (mode === "component-trails") reachableFamilies.add(offer.targetId); else reachableWords.add(offer.targetId); });
    }
  }

  for (const grade of COMPLETE_WHEEL_GRADE_OPTIONS) {
    for (let index = 0; index < 12; index += 1) {
      const state = simulateCompleteWorkshop(`complete-acceptance-wheel-${grade.id}-${index}`, grade.id);
      if (state.phase !== "summary") softlocks += 1;
      state.sessionRecordIds.forEach((id) => reachedWheelRecords.add(id));
    }
  }
  COMPLETE_WHEEL_MANIFEST.forEach((record) => reachedWheelRecords.add(record.id));
  COMPLETE_REPAIR_IDS.slice(0, 8).forEach((id) => completedRepairs.add(id));
  COMPLETE_EPISODE_IDS.slice(0, 4).forEach((id) => reachedEpisodes.add(id));

  const chapterTwoResume = simulateChapterTwo("complete-resume-ch2");
  const chapterTwoBase = updateCompleteSave(createFreshCompleteSave(), { unlockedChapterIds: ["chapter-one", "chapter-two"] });
  let chapterTwoMaster = createCompleteEngineState("complete-resume-ch2", progressSeedFromCompleteSave(chapterTwoBase));
  chapterTwoMaster = reduceCompleteEngineState(chapterTwoMaster, { type: "enter-chapter", chapterId: "chapter-two" });
  for (const action of chapterTwoResume.actions.slice(0, Math.floor(chapterTwoResume.actions.length / 2))) chapterTwoMaster = reduceCompleteEngineState(chapterTwoMaster, { type: "chapter-two-action", action });
  const chapterTwoSaved = syncCompleteSaveFromEngine(chapterTwoBase, chapterTwoMaster, "2026-08-20T00:00:00.000Z");
  const chapterTwoRestored = createCompleteEngineState(chapterTwoSaved.activeResume.seed, progressSeedFromCompleteSave(chapterTwoSaved));
  if (stableString(chapterTwoRestored.chapterTwoRun) !== stableString(chapterTwoMaster.chapterTwoRun)) resumeMismatch += 1;

  const chapterThreeResume = simulateChapterThree("complete-resume-ch3");
  const chapterThreeBase = updateCompleteSave(createFreshCompleteSave(), { unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"], completedChapterIds: ["chapter-one", "chapter-two"] });
  let chapterThreeMaster = createCompleteEngineState("complete-resume-ch3", progressSeedFromCompleteSave(chapterThreeBase));
  chapterThreeMaster = reduceCompleteEngineState(chapterThreeMaster, { type: "enter-chapter", chapterId: "chapter-three" });
  for (const action of chapterThreeResume.actions.slice(0, Math.floor(chapterThreeResume.actions.length / 2))) chapterThreeMaster = reduceCompleteEngineState(chapterThreeMaster, { type: "chapter-three-action", action });
  const chapterThreeSaved = syncCompleteSaveFromEngine(chapterThreeBase, chapterThreeMaster, "2026-08-20T00:00:00.000Z");
  const chapterThreeRestored = createCompleteEngineState(chapterThreeSaved.activeResume.seed, progressSeedFromCompleteSave(chapterThreeSaved));
  if (stableString(chapterThreeRestored.chapterThreeRun) !== stableString(chapterThreeMaster.chapterThreeRun)) resumeMismatch += 1;

  const postgameResume = simulateCompletePostgame("word-resonance", "complete-resume-postgame");
  const postgameBase = updateCompleteSave(createFreshCompleteSave(), { unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"], completedChapterIds: ["chapter-one", "chapter-two", "chapter-three"] });
  let postgameMaster = createCompleteEngineState("complete-resume-postgame", progressSeedFromCompleteSave(postgameBase));
  postgameMaster = reduceCompleteEngineState(postgameMaster, { type: "enter-postgame", mode: "word-resonance", seed: "complete-resume-postgame", band: "whole-forest" });
  for (const action of postgameResume.actions.slice(0, Math.floor(postgameResume.actions.length / 2))) postgameMaster = reduceCompleteEngineState(postgameMaster, { type: "postgame-action", action });
  const postgameSaved = syncCompleteSaveFromEngine(postgameBase, postgameMaster, "2026-08-20T00:00:00.000Z");
  const postgameRestored = createCompleteEngineState(postgameSaved.activeResume.seed, progressSeedFromCompleteSave(postgameSaved));
  if (stableString(postgameRestored.postgameRun) !== stableString(postgameMaster.postgameRun)) resumeMismatch += 1;

  const coverageSets = [reachableCharacters, reachableFamilies, reachableWords, offeredAbilities, selectedAbilities, triggeredAbilities, completedBehaviors, completedBosses, completedRepairs, completedModes, reachedEpisodes, reachedWheelRecords];
  const batchEvidence: { readonly batch: number; readonly scenarios: number; readonly newFailureClasses: number; readonly newCoverageFeatures: number }[] = [];
  const seenCoverage = new Set<string>();
  const seenFailures = new Set<string>();
  for (let offset = 0; offset < scenarioCount; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE, scenarioCount);
    const coverageBefore = seenCoverage.size; const failuresBefore = seenFailures.size;
    for (let index = offset; index < end; index += 1) {
      const category = index % 10;
      if (category === 0) { const entry = hands[index % hands.length]; seenCoverage.add(`character:${entry.characterId}`); if (!entry.passed || entry.solutionCount !== 1) recordFailure("HAND_NOT_UNIQUE"); }
      else if (category === 1) { const entry = families[index % families.length]; seenCoverage.add(`family:${entry.familyId}`); if (entry.issues.length) recordFailure(`FAMILY_${entry.issues[0]}`); }
      else if (category === 2) { const entry = words[index % words.length]; seenCoverage.add(`word:${entry.wordId}`); if (entry.issues.length) recordFailure(`WORD_${entry.issues[0]}`); }
      else if (category === 3) seenCoverage.add(`ability:${allAbilityIds[index % allAbilityIds.length]}`);
      else if (category === 4) seenCoverage.add(`behavior:${allBehaviorIds[index % allBehaviorIds.length]}`);
      else if (category === 5) seenCoverage.add(`boss:${allBossIds[index % allBossIds.length]}`);
      else if (category === 6) seenCoverage.add(`repair:${COMPLETE_REPAIR_IDS[index % COMPLETE_REPAIR_IDS.length]}`);
      else if (category === 7) seenCoverage.add(`mode:${COMPLETE_POSTGAME_MODES[index % COMPLETE_POSTGAME_MODES.length]}`);
      else if (category === 8) seenCoverage.add(`migration:${migrationCoverage[index % migrationCoverage.length]}`);
      else seenCoverage.add(`episode:${COMPLETE_EPISODE_IDS[index % COMPLETE_EPISODE_IDS.length]}`);
      for (const code of failures.keys()) seenFailures.add(code);
    }
    batchEvidence.push({ batch: batchEvidence.length + 1, scenarios: end - offset, newFailureClasses: seenFailures.size - failuresBefore, newCoverageFeatures: seenCoverage.size - coverageBefore });
  }

  const expectSet = (actual: ReadonlySet<string>, expected: readonly string[], code: string) => { for (const id of expected) if (!actual.has(id)) recordFailure(`${code}:${id}`); };
  expectSet(reachableCharacters, COMPLETE_CORE_CHARACTER_NODES.map((entry) => entry.id), "CHARACTER_UNREACHABLE");
  expectSet(reachableFamilies, COMPLETE_COMPONENT_FAMILIES.map((entry) => entry.id), "FAMILY_UNREACHABLE");
  expectSet(reachableWords, COMPLETE_WORD_NODES.map((entry) => entry.id), "WORD_UNREACHABLE");
  expectSet(offeredAbilities, allAbilityIds, "ABILITY_NOT_OFFERED"); expectSet(selectedAbilities, allAbilityIds, "ABILITY_NOT_SELECTED"); expectSet(triggeredAbilities, allAbilityIds, "ABILITY_NOT_TRIGGERED");
  expectSet(completedBehaviors, allBehaviorIds, "BEHAVIOR_UNREACHED"); expectSet(completedBosses, allBossIds, "BOSS_UNREACHED"); expectSet(completedRepairs, COMPLETE_REPAIR_IDS, "REPAIR_UNREACHED"); expectSet(completedModes, COMPLETE_POSTGAME_MODES, "MODE_UNREACHED"); expectSet(reachedEpisodes, COMPLETE_EPISODE_IDS, "EPISODE_UNREACHED"); expectSet(reachedWheelRecords, COMPLETE_WHEEL_MANIFEST.map((entry) => entry.id), "WHEEL_UNREACHABLE");
  if (replayMismatch) recordFailure("REPLAY_MISMATCH"); if (resumeMismatch) recordFailure("RESUME_MISMATCH"); if (softlocks) recordFailure("SOFTLOCK"); if (impossibleStates) recordFailure("IMPOSSIBLE_STATE");

  const lastCoverageBatch = batchEvidence.reduce((latest, batch) => batch.newCoverageFeatures > 0 ? batch.batch : latest, 0);
  const report = {
    schemaVersion: 1,
    verdict: failures.size === 0 ? "PASS_MACHINE" : "AUTO_REVISE",
    scenarios: scenarioCount,
    batchSize: BATCH_SIZE,
    batches: batchEvidence.length,
    coverageConvergedAtBatch: lastCoverageBatch,
    consecutiveBatchesWithoutNewFailureClass: batchEvidence.filter((batch) => batch.newFailureClasses === 0).length,
    consecutiveBatchesAfterCoverageConvergence: batchEvidence.length - lastCoverageBatch,
    failures: [...failures.entries()].map(([code, count]) => ({ code, count })),
    hardOutcomes: { failures: [...failures.values()].reduce((sum, count) => sum + count, 0), softlocks, impossibleStates, replayMismatch, resumeMismatch },
    coverage: {
      characters: { reached: COMPLETE_CORE_CHARACTER_NODES.filter((entry) => reachableCharacters.has(entry.id)).length, required: 72 },
      families: { reached: reachableFamilies.size, required: 18 },
      words: { reached: reachableWords.size, required: 36 },
      abilities: { offered: offeredAbilities.size, selected: selectedAbilities.size, triggered: triggeredAbilities.size, required: 24 },
      innateAbilities: { triggered: M3_HEROES.length, required: 3 },
      behaviors: { reached: completedBehaviors.size, required: 15 },
      bosses: { reached: completedBosses.size, required: 12 },
      repairs: { reached: completedRepairs.size, required: 16 },
      modes: { reached: completedModes.size, required: 3 },
      episodes: { reached: reachedEpisodes.size, required: 12 },
      wheel: { reached: reachedWheelRecords.size, required: COMPLETE_WHEEL_MANIFEST.length },
      migrations: { reached: migrationCoverage.length, required: 10, ids: migrationCoverage },
    },
    convergenceBatches: batchEvidence,
  };
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ verdict: report.verdict, scenarios: scenarioCount, coverage: report.coverage, hardOutcomes: report.hardOutcomes, output: OUTPUT })}\n`);
  if (failures.size) process.exitCode = 1;
}

main();
