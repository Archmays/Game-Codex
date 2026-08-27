import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadPortfolioEvolutionEvidence, renderBenchmarkAndPrinciples, renderPortfolioAudit } from "./portfolio-evolution-docs";

const root = resolve(import.meta.dirname, "../..");
const output = resolve(root, "docs/portfolio-evolution");
const evidence = loadPortfolioEvolutionEvidence(root);
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "benchmark-and-design-principles.md"), `${renderBenchmarkAndPrinciples(evidence)}\n`, "utf8");
writeFileSync(resolve(output, "portfolio-audit.md"), `${renderPortfolioAudit(evidence)}\n`, "utf8");
process.stdout.write(`Portfolio Evolution benchmark and audit docs generated from portfolio-evidence.json (${evidence.benchmarkCases.length} cases, ${evidence.researchSources.length} research sources, ${evidence.definitions.length} definitions).\n`);
