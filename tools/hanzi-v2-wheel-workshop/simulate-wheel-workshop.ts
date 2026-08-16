import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlayableWheelRecord, WHEEL_GRADE_OPTIONS } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest";
import { createWheelWorkshopState, reduceWheelWorkshopState, replayWheelWorkshopActions, wheelStateIsPossible } from "../../games/hanzi-radical-battle/v2/wheel-workshop/machine/wheel-machine";
import type { WheelWorkshopAction } from "../../games/hanzi-radical-battle/v2/wheel-workshop/types";

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TOOL_DIR, "../..");
const OUTPUT = resolve(ROOT, "test-results/hanzi-v2/wheel-workshop/WHEEL-SIMULATION.json");
const requested = Number(process.argv[2] ?? "10000");
const totalSeeds = Number.isInteger(requested) && requested > 0 ? requested : 10000;
const failures: { seed: string; reason: string }[] = [];
const seenRecords = new Set<string>();

for (let index = 0; index < totalSeeds; index += 1) {
  const gradeId = WHEEL_GRADE_OPTIONS[index % WHEEL_GRADE_OPTIONS.length].id;
  const seed = `wheel-simulation-${index}`;
  let state = createWheelWorkshopState(seed, { selectedGradeId: gradeId });
  const actions: WheelWorkshopAction[] = [];
  try {
    for (let round = 0; round < 3; round += 1) {
      const spin: WheelWorkshopAction = { type: "spin" }; state = reduceWheelWorkshopState(state, spin); actions.push(spin);
      const settle: WheelWorkshopAction = { type: "settle-spin" }; state = reduceWheelWorkshopState(state, settle); actions.push(settle);
      const partner = state.currentRound?.candidateCards.find((card) => card.kind === "partner");
      if (!partner || !state.currentRound) throw new Error("missing-partner");
      seenRecords.add(state.currentRound.recordId);
      const select: WheelWorkshopAction = { type: "select-card", cardId: partner.id }; state = reduceWheelWorkshopState(state, select); actions.push(select);
      const record = getPlayableWheelRecord(state.currentRound!.recordId);
      const place: WheelWorkshopAction = { type: "place-card", slotId: record.slotIds[1] }; state = reduceWheelWorkshopState(state, place); actions.push(place);
      if (!state.discoveredRecordIds.includes(record.id)) throw new Error("discovery-not-saved-at-success");
      const proceed: WheelWorkshopAction = { type: "continue" }; state = reduceWheelWorkshopState(state, proceed); actions.push(proceed);
      if (!wheelStateIsPossible(state)) throw new Error("impossible-state");
    }
    if (state.phase !== "finished" || state.completedRoundCount !== 3) throw new Error("session-not-finished");
    if (JSON.stringify(replayWheelWorkshopActions(seed, gradeId, actions)) !== JSON.stringify(state)) throw new Error("replay-mismatch");
  } catch (error) {
    failures.push({ seed, reason: error instanceof Error ? error.message : String(error) });
  }
}

const report = { result: failures.length ? "FAIL" : "PASS", totalSeeds, failures, seenRecordCount: seenRecords.size, seenRecordIds: [...seenRecords].sort() };
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ...report, output: OUTPUT })}\n`);
if (failures.length) process.exitCode = 1;
