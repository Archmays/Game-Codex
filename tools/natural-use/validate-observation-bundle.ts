import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { validateObservationBundle } from "../../packages/observation/natural-use";

const MAX_BUNDLE_BYTES = 1024 * 1024;

export async function validateObservationBundleFile(path: string) {
  const absolute = resolve(path);
  if (statSync(absolute).size > MAX_BUNDLE_BYTES) throw new Error("Observation bundle exceeds the 1 MiB validator limit.");
  let value: unknown;
  try { value = JSON.parse(readFileSync(absolute, "utf8")); } catch { throw new Error("Observation bundle is not valid JSON."); }
  return validateObservationBundle(value);
}

const invokedAsScript = process.argv[1]?.replace(/\\/g, "/").endsWith("/validate-observation-bundle.ts") ?? false;
if (invokedAsScript) {
  const input = process.argv[2];
  if (!input) {
    process.stderr.write("FAIL: provide a path to GAME_CODEX_NATURAL_USE_OBSERVATIONS_YYYY-MM-DD.json\n");
    process.exitCode = 1;
  } else {
    try {
      const bundle = await validateObservationBundleFile(input);
      process.stdout.write(`PASS: ${bundle.recordCount} records; records SHA-256 ${bundle.integrity.recordsSha256}\n`);
    } catch (error) {
      process.stderr.write(`FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  }
}
