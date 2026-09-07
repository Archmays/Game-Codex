import { mkdirSync, writeFileSync } from "node:fs";
import { balanceEvidence } from "./balance";
const evidence = balanceEvidence();
mkdirSync("tmp/tasks/GAME-CODEX-STEP1", { recursive: true });
writeFileSync("tmp/tasks/GAME-CODEX-STEP1/balance.json", JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ range: evidence.range, builds: evidence.builds.map(({ waves, ...summary }) => summary), separate: evidence.separate }, null, 2));
if (evidence.builds.some(b => b.result !== "won") || evidence.range.some(r => r.after.damage <= r.before.damage * 1.15)
  || evidence.placement[1].kills <= evidence.placement[2].kills
  || evidence.control[3].traveled >= evidence.control[2].traveled) process.exitCode = 1;
