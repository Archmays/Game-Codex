import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { summarizeObservationBundle } from "../../packages/observation/natural-use";
import { validateObservationBundleFile } from "./validate-observation-bundle";

function outputPath(input: string, argv: readonly string[]): string {
  const index = argv.indexOf("--output");
  return index >= 0 && argv[index + 1] ? resolve(argv[index + 1]) : resolve(dirname(resolve(input)), "OBSERVATION_SUMMARY.json");
}

export async function summarizeObservationBundleFile(input: string, output: string) {
  const bundle = await validateObservationBundleFile(input);
  const summary = summarizeObservationBundle(bundle);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return summary;
}

const invokedAsScript = process.argv[1]?.replace(/\\/g, "/").endsWith("/summarize-observation-bundle.ts") ?? false;
if (invokedAsScript) {
  const input = process.argv[2];
  if (!input) {
    process.stderr.write("FAIL: provide a validated observation bundle path\n");
    process.exitCode = 1;
  } else {
    const output = outputPath(input, process.argv.slice(3));
    try {
      const summary = await summarizeObservationBundleFile(input, output);
      process.stdout.write(`PASS_DESCRIPTIVE_ONLY: ${summary.recordCount} records; wrote ${output}\n`);
    } catch (error) {
      process.stderr.write(`FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  }
}
