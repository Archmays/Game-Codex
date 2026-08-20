import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const input = resolve("test-results/hanzi-complete/acceptance-matrix-results");
const output = resolve("artifacts/hanzi-magic-battle/v3-complete/checkpoints/BROWSER_MATRIX.json");
const requiredProfiles = ["NOVICE_POINTER", "HESITANT_WITH_HINTS", "KEYBOARD_ONLY", "MOBILE_TOUCH", "MUTED", "REDUCED_MOTION", "RETURNING_V1", "RETURNING_V2", "RETURNING_WHEEL", "RETURNING_V2_PLUS_WHEEL", "CORRUPT_SAVE", "FUTURE_SAVE_READ_ONLY", "CHAPTER_TWO", "CHAPTER_THREE", "EPILOGUE", "FREE_ADVENTURE", "COMPONENT_TRAILS", "WORD_RESONANCE", "WORLD_RETURN"] as const;
const results = readdirSync(input).filter((name) => /^[PWS]\d{2}\.json$/.test(name)).map((name) => JSON.parse(readFileSync(resolve(input, name), "utf8")) as { id: string; kind: string; profiles: string[]; input: string; viewport: string; result: string }).sort((left, right) => left.id.localeCompare(right.id));
const ids = new Set(results.map((result) => result.id));
const profiles = new Set(results.flatMap((result) => result.profiles));
if (results.length !== 36 || ids.size !== 36 || results.some((result) => result.result !== "PASS") || requiredProfiles.some((profile) => !profiles.has(profile))) throw new Error(`Browser matrix incomplete: results=${results.length}, ids=${ids.size}, profiles=${profiles.size}`);
const report = { schemaVersion: 1, verdict: "PASS_MACHINE", playthroughs: results.length, requiredMinimum: 36, requiredProfiles, coveredProfiles: [...profiles].sort(), results };
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8"); process.stdout.write(`${JSON.stringify({ verdict: report.verdict, playthroughs: report.playthroughs, profiles: report.coveredProfiles.length, output })}\n`);
