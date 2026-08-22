import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const runtimeFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", "apps", "games", "packages", "src"], { cwd: ROOT, encoding: "utf8" })
  .split(/\r?\n/).filter((path) => /\.(?:ts|tsx|js|html)$/.test(path));
const denylistDefinitionFiles = new Set([
  "packages/observation/natural-use/types.ts",
  "games/hanzi-radical-battle/v2/golden-slice/first-use/privacy.ts",
]);
const collectionPatterns = [
  /navigator\.sendBeacon/i,
  /fetch\s*\(\s*["'`]https?:\/\//i,
  /new\s+WebSocket\s*\(/i,
  /navigator\.geolocation/i,
  /getUserMedia\s*\(/i,
  /new\s+MediaRecorder\s*\(/i,
  /getDisplayMedia\s*\(/i,
  /\b(?:analytics|telemetry|tracking|sessionDuration|routeHistory|clickHistory|deviceId|fingerprint)\b/i,
];

const matches = runtimeFiles.flatMap((path) => {
  const source = readFileSync(resolve(ROOT, path), "utf8");
  return source.split(/\r?\n/).flatMap((line, index) => {
    if (denylistDefinitionFiles.has(path) && /geolocation|deviceId|sessionDuration|routeHistory|clickHistory/.test(line)) return [];
    return collectionPatterns.some((pattern) => pattern.test(line)) ? [{ path, line: index + 1 }] : [];
  });
});

if (matches.length) throw new Error(`Ordinary runtime privacy scan failed: ${JSON.stringify(matches)}`);
process.stdout.write(`PASS: ${runtimeFiles.length} ordinary runtime files; prohibited collection matches 0.\n`);
