import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";
import { COMPLETE_NEW_CHARACTER_NODES, COMPLETE_NEW_READING_SENSES } from "../../games/hanzi-radical-battle/complete/content-graph/new-characters";

const MAKE_ME_A_HANZI_URL = "https://raw.githubusercontent.com/skishore/makemeahanzi/bddc96d41bef78427ed0e034e9f7e31d71fd1b92/dictionary.txt";
const MAKE_ME_A_HANZI_SHA256 = "744bb05d5b0742e9ee35c37791f94d56a173349b3367569e7ca11e510364d203";
const UNIHAN_URL = "https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip";
const UNIHAN_SHA256 = "f7a48b2b545acfaa77b2d607ae28747404ce02baefee16396c5d2d7a8ef34b5e";
const OUTPUT = resolve("artifacts/hanzi-magic-complete-v3/content/M2_SELECTED_SOURCE_LEDGER.json");

interface MakeMeAHanziRecord {
  readonly character: string;
  readonly decomposition: string;
  readonly pinyin: readonly string[];
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function readZipEntry(zip: Buffer, wantedName: string): Buffer {
  let end = zip.length - 22;
  while (end >= Math.max(0, zip.length - 65_557) && zip.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error("Unihan ZIP has no end-of-central-directory record");
  const entryCount = zip.readUInt16LE(end + 10);
  let cursor = zip.readUInt32LE(end + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Unihan ZIP central directory is malformed");
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const fileNameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");
    if (name === wantedName) {
      if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Unihan ZIP local entry ${name} is malformed`);
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = zip.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(compressed);
      if (method === 8) return inflateRawSync(compressed);
      throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);
    }
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error(`Unihan ZIP entry not found: ${wantedName}`);
}

function normalizePinyin(value: string): string {
  return value
    .toLowerCase()
    .replace(/u:/g, "u")
    .replace(/v/g, "u")
    .normalize("NFD")
    .replace(/[\u0300-\u036f\d\s,'·]/g, "");
}

const COMPONENT_EQUIVALENCE: Readonly<Record<string, string>> = {
  "𧾷": "足旁",
  "⻊": "足旁",
  "足": "足旁",
  "龵": "手旁",
  "扌": "手旁",
};

function normalizeComponent(glyph: string): string {
  return COMPONENT_EQUIVALENCE[glyph] ?? glyph;
}

function containsComponentMultiset(decomposition: string, expected: readonly string[]): boolean {
  const available = new Map<string, number>();
  for (const glyph of Array.from(decomposition).slice(1)) {
    if (/^[⿰-⿻]$/u.test(glyph)) continue;
    const normalized = normalizeComponent(glyph);
    available.set(normalized, (available.get(normalized) ?? 0) + 1);
  }
  for (const glyph of expected) {
    const normalized = normalizeComponent(glyph);
    const count = available.get(normalized) ?? 0;
    if (count < 1) return false;
    available.set(normalized, count - 1);
  }
  return true;
}

function structureMatches(structure: string, decomposition: string): boolean {
  const operator = Array.from(decomposition)[0];
  if (structure === "left-right") return operator === "⿰";
  if (structure === "top-bottom") return operator === "⿱";
  if (structure === "full-enclosure") return operator === "⿴";
  return ["⿵", "⿶", "⿷", "⿸", "⿹", "⿺"].includes(operator);
}

async function fetchBytes(url: string): Promise<Buffer> {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) throw new Error(`Source request failed ${response.status}: ${url}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (process.platform !== "win32") throw error;
    return execFileSync("curl.exe", ["--fail", "--silent", "--show-error", "--location", url], {
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
    });
  }
}

async function main(): Promise<void> {
  const [dictionaryBytes, unihanBytes] = await Promise.all([fetchBytes(MAKE_ME_A_HANZI_URL), fetchBytes(UNIHAN_URL)]);
  const dictionaryHash = sha256(dictionaryBytes);
  const unihanHash = sha256(unihanBytes);
  if (dictionaryHash !== MAKE_ME_A_HANZI_SHA256) throw new Error(`Make Me a Hanzi SHA mismatch: ${dictionaryHash}`);
  if (unihanHash !== UNIHAN_SHA256) throw new Error(`Unihan SHA mismatch: ${unihanHash}`);

  const selectedGlyphs = new Set(COMPLETE_NEW_CHARACTER_NODES.map((character) => character.glyph));
  const dictionary = new Map<string, MakeMeAHanziRecord>();
  for (const line of dictionaryBytes.toString("utf8").split(/\r?\n/)) {
    if (!line) continue;
    const record = JSON.parse(line) as MakeMeAHanziRecord;
    if (selectedGlyphs.has(record.character)) dictionary.set(record.character, record);
  }

  const unihanReadings = new Map<string, string[]>();
  const readingsText = readZipEntry(unihanBytes, "Unihan_Readings.txt").toString("utf8");
  for (const line of readingsText.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [codePoint, property, value] = line.split("\t");
    if (property === "kMandarin" && value) unihanReadings.set(codePoint, value.split(/\s+/));
  }

  const records = COMPLETE_NEW_CHARACTER_NODES.map((character) => {
    const reading = COMPLETE_NEW_READING_SENSES.find((candidate) => candidate.characterId === character.id)!;
    const mmh = dictionary.get(character.glyph);
    const unihan = unihanReadings.get(character.unicodeCodePoint) ?? [];
    const expectedReading = normalizePinyin(reading.pinyin);
    const expectedComponents = character.components.map((component) => component.sourceGlyph);
    const checks = {
      makeMeAHanziRecordPresent: Boolean(mmh),
      makeMeAHanziStructureMatch: Boolean(mmh && structureMatches(character.structure, mmh.decomposition)),
      makeMeAHanziComponentMatch: Boolean(mmh && containsComponentMultiset(mmh.decomposition, expectedComponents)),
      makeMeAHanziReadingMatch: Boolean(mmh && mmh.pinyin.some((value) => normalizePinyin(value) === expectedReading)),
      unihanReadingPresent: unihan.length > 0,
      unihanReadingMatch: unihan.some((value) => normalizePinyin(value) === expectedReading),
    };
    return {
      characterId: character.id,
      glyph: character.glyph,
      unicodeCodePoint: character.unicodeCodePoint,
      expected: { structure: character.structure, components: expectedComponents, pinyin: reading.pinyin, fixedPhrase: reading.fixedPhrase },
      makeMeAHanzi: { decomposition: mmh?.decomposition ?? null, pinyin: mmh?.pinyin ?? [] },
      unihan: { kMandarin: unihan },
      checks,
      passed: Object.values(checks).every(Boolean),
    };
  });

  const output = {
    schemaVersion: 1,
    purpose: "Frozen external cross-check for the 36 genuinely new V3 CharacterNodes; not a runtime dependency or etymology claim.",
    sources: {
      makeMeAHanzi: { url: MAKE_ME_A_HANZI_URL, commit: "bddc96d41bef78427ed0e034e9f7e31d71fd1b92", sha256: dictionaryHash },
      unihan: { url: UNIHAN_URL, version: "17.0.0", sha256: unihanHash, entry: "Unihan_Readings.txt" },
    },
    selectedCharacterCount: records.length,
    passedCharacterCount: records.filter((record) => record.passed).length,
    allPassed: records.every((record) => record.passed),
    records,
  };
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ output: OUTPUT, selected: records.length, passed: output.passedCharacterCount, allPassed: output.allPassed })}\n`);
  if (!output.allPassed) process.exitCode = 1;
}

await main();
