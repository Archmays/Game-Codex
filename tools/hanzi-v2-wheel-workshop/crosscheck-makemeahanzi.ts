import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { CANONICAL_WHEEL_LIBRARY } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/canonical-wheel-library";
import type { WheelStructure } from "../../games/hanzi-radical-battle/v2/wheel-workshop/types";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return resolve(process.argv[index + 1]);
}

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

function rootStructure(decomposition: string): WheelStructure | null {
  const operator = [...decomposition][0];
  if (operator === "⿰" || operator === "⿲") return "left-right";
  if (operator === "⿱" || operator === "⿳") return "top-bottom";
  if (operator === "⿴") return "full-enclosure";
  if (["⿵", "⿶", "⿷", "⿸", "⿹", "⿺"].includes(operator)) return "semi-enclosure";
  return null;
}

const IDS_ARITY = new Map<string, number>([
  ...["⿰", "⿱", "⿴", "⿵", "⿶", "⿷", "⿸", "⿹", "⿺", "⿻"].map((operator) => [operator, 2] as const),
  ["⿲", 3],
  ["⿳", 3],
]);

function parseIdsNode(tokens: readonly string[], start: number): { readonly text: string; readonly end: number } {
  const token = tokens[start];
  if (!token) throw new Error("Unexpected end of IDS");
  const arity = IDS_ARITY.get(token) ?? 0;
  let end = start + 1;
  for (let index = 0; index < arity; index += 1) end = parseIdsNode(tokens, end).end;
  return { text: tokens.slice(start, end).join(""), end };
}

function firstLevelOperands(decomposition: string): readonly string[] | null {
  const tokens = [...decomposition];
  const arity = IDS_ARITY.get(tokens[0]);
  if (!arity) return null;
  const operands: string[] = [];
  let cursor = 1;
  for (let index = 0; index < arity; index += 1) {
    const operand = parseIdsNode(tokens, cursor);
    operands.push(operand.text);
    cursor = operand.end;
  }
  return operands;
}

const DOCUMENTED_COMPONENT_VARIANTS = new Map<string, {
  readonly external: readonly string[];
  readonly audit: readonly string[];
  readonly adjudication: string;
}>([
  ["p1.char.004", { external: ["手", "目"], audit: ["龵", "目"], adjudication: "CNS11643 U+770B IDS ⿱龵目" }],
  ["p2.char.008", { external: ["足", "包"], audit: ["𧾷", "包"], adjudication: "CNS11643 U+8DD1 IDS ⿰𧾷包" }],
  ["p6.char.005", { external: ["广", "⿱付肉"], audit: ["府", "肉"], adjudication: "CNS11643 U+8150 alternative IDS ⿸府肉" }],
  ["p6.char.006", { external: ["羊", "丑"], audit: ["⺶", "丑"], adjudication: "CNS11643 U+7F9E IDS ⿸⺶丑" }],
  ["j1.char.017", { external: ["户", "古"], audit: ["尸", "古"], adjudication: "Academia Sinica U+5C45 character evolution identifies 尸 as the outer semantic form" }],
]);

interface DictionaryEntry {
  readonly character: string;
  readonly decomposition?: string;
}

const dictionaryPath = argument("--dictionary");
const copyingPath = argument("--copying");
const outputPath = argument("--output");
const entries = new Map<string, DictionaryEntry>();
for (const line of readFileSync(dictionaryPath, "utf8").split(/\r?\n/)) {
  if (!line.trim()) continue;
  const entry = JSON.parse(line) as DictionaryEntry;
  entries.set(entry.character, entry);
}

const auditRecords = CANONICAL_WHEEL_LIBRARY.filter((record) => record.sourceMode === "char");
const records = auditRecords.map((record) => {
  const entry = entries.get(record.result);
  const externalStructure = entry?.decomposition ? rootStructure(entry.decomposition) : null;
  const externalOperands = entry?.decomposition ? firstLevelOperands(entry.decomposition) : null;
  const approved = record.auditStatus === "validated" || record.auditStatus === "corrected-derived-record";
  const rootMatches = externalStructure !== null && record.structure === externalStructure;
  const componentsMatch = externalOperands !== null
    && externalOperands.length === record.orderedComponents.length
    && externalOperands.every((component, index) => component === record.orderedComponents[index]);
  const documentedVariant = DOCUMENTED_COMPONENT_VARIANTS.get(record.legacyId);
  const documentedVariantMatches = documentedVariant !== undefined
    && externalOperands?.length === documentedVariant.external.length
    && externalOperands.every((component, index) => component === documentedVariant.external[index])
    && record.orderedComponents.length === documentedVariant.audit.length
    && record.orderedComponents.every((component, index) => component === documentedVariant.audit[index]);
  const status = !entry
    ? "missing-entry"
    : !externalStructure || !externalOperands
      ? "unknown-ids"
      : record.auditStatus === "quarantined"
        ? "expected-quarantine"
        : !rootMatches
          ? "approved-root-mismatch"
          : componentsMatch
            ? "root-and-components-confirmed"
            : documentedVariantMatches
              ? "documented-component-variant"
              : "approved-component-mismatch";
  return {
    legacyId: record.legacyId,
    glyph: record.result,
    auditStatus: record.auditStatus,
    auditStructure: record.structure,
    auditComponents: record.orderedComponents,
    externalDecomposition: entry?.decomposition ?? null,
    externalRootStructure: externalStructure,
    externalFirstLevelOperands: externalOperands,
    rootMatches,
    componentsMatch,
    componentVariantAdjudication: documentedVariantMatches ? documentedVariant.adjudication : null,
    approved,
    status,
  };
});

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    name: "Make Me a Hanzi dictionary.txt",
    repository: "https://github.com/skishore/makemeahanzi",
    commit: "bddc96d41bef78427ed0e034e9f7e31d71fd1b92",
    dictionarySha256: fileSha256(dictionaryPath),
    copyingSha256: fileSha256(copyingPath),
    dictionaryLicense: "LGPL-3.0-or-later",
    graphicsLicense: "Arphic-Public-License",
    graphicsFileUsed: false,
    runtimeUse: "none; temporary audit input only",
  },
  summary: {
    characterRecordCount: records.length,
    dictionaryEntryPresentCount: records.filter((record) => record.status !== "missing-entry").length,
    approvedRootConfirmedCount: records.filter((record) => ["root-and-components-confirmed", "documented-component-variant"].includes(record.status)).length,
    approvedExactComponentConfirmedCount: records.filter((record) => record.status === "root-and-components-confirmed").length,
    documentedComponentVariantCount: records.filter((record) => record.status === "documented-component-variant").length,
    expectedQuarantineCount: records.filter((record) => record.status === "expected-quarantine").length,
    approvedRootMismatchCount: records.filter((record) => record.status === "approved-root-mismatch").length,
    approvedComponentMismatchCount: records.filter((record) => record.status === "approved-component-mismatch").length,
    unknownIdsCount: records.filter((record) => record.status === "unknown-ids").length,
  },
  canonicalAuditSha256: createHash("sha256").update(stableStringify(CANONICAL_WHEEL_LIBRARY)).digest("hex"),
  records,
} as const;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result.summary));
if (result.summary.dictionaryEntryPresentCount !== records.length || result.summary.unknownIdsCount || result.summary.approvedRootMismatchCount || result.summary.approvedComponentMismatchCount) {
  throw new Error(`Make Me a Hanzi cross-check failed: ${JSON.stringify(result.summary)}`);
}
