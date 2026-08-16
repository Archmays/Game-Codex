import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PLAYABLE_WHEEL_MANIFEST } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return resolve(process.argv[index + 1]);
}

const unihanDir = argument("--unihan-dir");
const sourceZip = argument("--source-zip");
const outputPath = argument("--output");
const readingsPath = resolve(unihanDir, "Unihan_Readings.txt");
const readingsText = readFileSync(readingsPath, "utf8");
const version = readingsText.match(/^# Unicode Version ([^\r\n]+)/m)?.[1] ?? "unknown";
const fieldsByCodePoint = new Map<string, Map<string, string>>();

for (const line of readingsText.split(/\r?\n/)) {
  if (!line.startsWith("U+")) continue;
  const [codePoint, field, value] = line.split("\t");
  if (!codePoint || !field || !value) continue;
  const fields = fieldsByCodePoint.get(codePoint) ?? new Map<string, string>();
  fields.set(field, value);
  fieldsByCodePoint.set(codePoint, fields);
}

function codePointFor(glyph: string): string {
  return `U+${glyph.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
}

function hanyuReadings(value: string): readonly string[] {
  return value.split(/\s+/).flatMap((entry) => {
    const colon = entry.indexOf(":");
    return (colon >= 0 ? entry.slice(colon + 1) : entry).split(",");
  }).filter(Boolean);
}

const records = PLAYABLE_WHEEL_MANIFEST.map((record) => {
  const codePoint = codePointFor(record.glyph);
  const fields = fieldsByCodePoint.get(codePoint);
  const kMandarin = fields?.get("kMandarin") ?? null;
  const kHanyuPinyin = fields?.get("kHanyuPinyin") ?? null;
  const mandarinReadings = kMandarin?.split(/\s+/).filter(Boolean) ?? [];
  const documentedReadings = kHanyuPinyin ? hanyuReadings(kHanyuPinyin) : [];
  const status = mandarinReadings.includes(record.pinyin)
    ? "default-reading-confirmed"
    : documentedReadings.includes(record.pinyin)
      ? "contextual-reading-confirmed"
      : "reading-mismatch";
  return {
    recordId: record.id,
    glyph: record.glyph,
    codePoint,
    playablePinyin: record.pinyin,
    familiarWord: record.familiarWord,
    kMandarin,
    kHanyuPinyin,
    status,
  };
});

const missingCodePoints = records.filter((record) => !fieldsByCodePoint.has(record.codePoint));
const mismatches = records.filter((record) => record.status === "reading-mismatch");
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    name: "Unicode Unihan Database",
    unicodeVersion: version,
    readingsFile: "Unihan_Readings.txt",
    sourceZipName: "Unihan.zip",
    sourceZipSha256: createHash("sha256").update(readFileSync(sourceZip)).digest("hex"),
    sourceUrl: `https://www.unicode.org/Public/${version}/ucd/Unihan.zip`,
    termsUrl: "https://www.unicode.org/terms_of_use.html",
    runtimeUse: "none; temporary audit input only",
  },
  summary: {
    playableRecordCount: records.length,
    codePointPresentCount: records.length - missingCodePoints.length,
    defaultReadingConfirmedCount: records.filter((record) => record.status === "default-reading-confirmed").length,
    contextualReadingConfirmedCount: records.filter((record) => record.status === "contextual-reading-confirmed").length,
    mismatchCount: mismatches.length,
  },
  playableManifestSha256: createHash("sha256").update(stableStringify(PLAYABLE_WHEEL_MANIFEST)).digest("hex"),
  records,
} as const;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result.summary));
if (missingCodePoints.length || mismatches.length) {
  throw new Error(`Unihan cross-check failed: missing=${missingCodePoints.length}, mismatches=${mismatches.length}`);
}
