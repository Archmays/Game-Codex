import { mkdirSync, writeFileSync } from "node:fs";
import { balanceEvidence } from "./balance";
const evidence = balanceEvidence();
const evidenceRoot=process.env.TD_EVIDENCE_DIR ?? "tmp/tasks/GAME-CODEX-STEP1";
mkdirSync(evidenceRoot, { recursive: true });
writeFileSync(`${evidenceRoot}/balance.json`, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ range: evidence.range, builds: evidence.builds.map(({ waves, ...summary }) => summary), separate: evidence.separate }, null, 2));
if (evidence.builds.some(b => b.result !== "won") || evidence.range.some(r => r.after.damage <= r.before.damage * 1.15)
  || evidence.placement[1].kills <= evidence.placement[2].kills
  || evidence.control[3].traveled >= evidence.control[2].traveled) process.exitCode = 1;
