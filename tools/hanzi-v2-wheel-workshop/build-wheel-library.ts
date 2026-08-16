import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WHEEL_ISSUE_CODES } from "../../games/hanzi-radical-battle/v2/wheel-workshop/audit/issue-codes";
import { CANONICAL_WHEEL_LIBRARY } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/canonical-wheel-library";
import freeze from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/legacy-wheel-source-freeze.json";
import { PLAYABLE_WHEEL_MANIFEST, PLAYABLE_WHEEL_MANIFEST_REVISION } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest";

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TOOL_DIR, "../..");
const OUTPUT_DIR = resolve(ROOT, "artifacts/hanzi-radical-battle-v2/wheel-workshop");

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex");
}

const statusCounts = Object.fromEntries(["validated", "corrected-derived-record", "quarantined", "not-playable-context-only"].map((status) => [status, CANONICAL_WHEEL_LIBRARY.filter((record) => record.auditStatus === status).length]));
const issueCodeCounts = Object.fromEntries(WHEEL_ISSUE_CODES.map((code) => [code, CANONICAL_WHEEL_LIBRARY.filter((record) => record.issueCodes.includes(code)).length]));
const countsByGradeAndMode = Object.fromEntries(freeze.setIds.map((gradeId) => [gradeId, Object.fromEntries(["char", "word"].map((mode) => {
  const records = CANONICAL_WHEEL_LIBRARY.filter((record) => record.sourceGradeId === gradeId && record.sourceMode === mode);
  return [mode, {
    raw: records.length,
    validated: records.filter((record) => record.auditStatus === "validated").length,
    correctedDerived: records.filter((record) => record.auditStatus === "corrected-derived-record").length,
    quarantined: records.filter((record) => record.auditStatus === "quarantined").length,
    contextOnly: records.filter((record) => record.auditStatus === "not-playable-context-only").length,
    playable: mode === "char" ? PLAYABLE_WHEEL_MANIFEST.filter((record) => record.sourceGradeId === gradeId).length : 0,
  }];
}))]));

const audit = {
  schemaVersion: 1,
  auditVersion: "wheel-library-audit-v1",
  generatedAt: freeze.extractedAt,
  sourceFreeze: {
    sourcePath: freeze.sourcePath,
    sourceHeadSha: freeze.sourceHeadSha,
    sourceGitBlobSha: freeze.sourceGitBlobSha,
    rawStableJsonSha256: freeze.stableJsonSha256,
    totalCharRecords: freeze.totalCharRecords,
    totalWordRecords: freeze.totalWordRecords,
    totalRecords: freeze.totalRecords,
  },
  sourcesAndLicenses: [
    { sourceId: "legacy-wheel-source-freeze", version: freeze.sourceHeadSha, license: "repository-source", usage: "authoritative raw preservation" },
    { sourceId: "hanzi-radical-formula-audit", version: freeze.sourceHeadSha, license: "repository-source", usage: "accepted component and coarse structure cross-check" },
    { sourceId: "Unicode-Unicode17-Unihan", version: "17.0.0", license: "Unicode-3.0", url: "https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip", usage: "identity and Mandarin reading cross-check only" },
  ],
  reviewedButNotImported: [
    { sourceId: "Make-Me-a-Hanzi-dictionary", license: "LGPL-3.0-or-later", url: "https://github.com/skishore/makemeahanzi", reason: "license boundary reviewed; network retrieval unavailable in the execution shell, so no values or runtime dependency were imported" },
    { sourceId: "Make-Me-a-Hanzi-graphics", license: "Arphic-Public-License", url: "https://github.com/skishore/makemeahanzi", reason: "not needed for text-structure-only V2.1 workshop and not imported" },
  ],
  alignmentBoundary: "Source grade labels are preserved historical labels. curriculumStage is an organizational grouping only; no per-character 2022 curriculum alignment is claimed.",
  countsByGradeAndMode,
  statusCounts,
  issueCodeCounts,
  canonicalAuditSha256: sha256(CANONICAL_WHEEL_LIBRARY),
  playableManifestRevision: PLAYABLE_WHEEL_MANIFEST_REVISION,
  playableManifestSha256: sha256(PLAYABLE_WHEEL_MANIFEST),
  playableManifestCount: PLAYABLE_WHEEL_MANIFEST.length,
  records: CANONICAL_WHEEL_LIBRARY,
};

const rows = freeze.setIds.flatMap((gradeId) => (["char", "word"] as const).map((mode) => {
  const counts = countsByGradeAndMode[gradeId][mode];
  return `| ${gradeId} ${freeze.setLabels[freeze.setIds.indexOf(gradeId)]} | ${mode} | ${counts.raw} | ${counts.validated} | ${counts.correctedDerived} | ${counts.quarantined} | ${counts.contextOnly} | ${counts.playable} |`;
})).join("\n");
const changed = CANONICAL_WHEEL_LIBRARY.filter((record) => record.auditStatus === "corrected-derived-record" || record.auditStatus === "quarantined");
const fragments = CANONICAL_WHEEL_LIBRARY.filter((record) => record.issueCodes.includes("WORD_FRAGMENT"));
const changedLines = changed.map((record) => `- ${record.legacyId} ${record.result}: **${record.auditStatus}** — ${record.correctionNote ?? "No note"} Issues: ${record.issueCodes.join(", ")}.`).join("\n");
const fragmentLines = fragments.map((record) => `- ${record.legacyId} ${record.result}: retained only as context for ${record.familiarWords.join("、")}; never an independent playable word.`).join("\n");
const summary = `# Wheel Library Audit Summary\n\n## Result\n\n- Raw source: ${freeze.totalCharRecords} char + ${freeze.totalWordRecords} word = ${freeze.totalRecords} records across ${freeze.setIds.length} preserved grade sets.\n- Dispositions: ${statusCounts.validated} validated; ${statusCounts["corrected-derived-record"]} corrected-derived; ${statusCounts.quarantined} quarantined; ${statusCounts["not-playable-context-only"]} context-only.\n- Playable manifest: ${PLAYABLE_WHEEL_MANIFEST.length} records (${PLAYABLE_WHEEL_MANIFEST.filter((record) => record.sourceGradeId === "p1").length} per source grade), revision ${PLAYABLE_WHEEL_MANIFEST_REVISION}.\n- Raw stable JSON SHA-256: ${freeze.stableJsonSha256}.\n- Canonical audit SHA-256: ${audit.canonicalAuditSha256}.\n- Playable manifest SHA-256: ${audit.playableManifestSha256}.\n\n## Grade and mode counts\n\n| Source grade | Mode | Raw | Validated | Corrected | Quarantined | Context only | Playable |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${rows}\n\n## Corrected or quarantined char records\n\n${changedLines}\n\n## Word-fragment isolation\n\n${fragmentLines}\n\n## Source and alignment boundary\n\nThe authoritative raw source is the Git-blob-bound freeze. Internal accepted formulas and the existing Unicode 17.0 Unihan source chain support identity/reading checks. Unicode data is covered by Unicode-3.0. Make Me a Hanzi's dictionary and graphics license split was reviewed, but no external values, graphics, or runtime requests were imported. Historical source-grade labels remain legacy-label-only; curriculum stages organize navigation and do not claim official per-character grade alignment. Machine review does not establish child fun or learning effect.\n`;

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(resolve(OUTPUT_DIR, "WHEEL_LIBRARY_AUDIT.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
writeFileSync(resolve(OUTPUT_DIR, "WHEEL_LIBRARY_AUDIT_SUMMARY.md"), summary, "utf8");
process.stdout.write(`${JSON.stringify({ result: "PASS", outputDir: OUTPUT_DIR, statusCounts, playableManifestCount: PLAYABLE_WHEEL_MANIFEST.length, rawStableJsonSha256: freeze.stableJsonSha256, canonicalAuditSha256: audit.canonicalAuditSha256, playableManifestSha256: audit.playableManifestSha256 })}\n`);
