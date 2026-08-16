import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WHEEL_ISSUE_CODES } from "../../games/hanzi-radical-battle/v2/wheel-workshop/audit/issue-codes";
import { CANONICAL_WHEEL_LIBRARY } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/canonical-wheel-library";
import freeze from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/legacy-wheel-source-freeze.json";
import { PLAYABLE_WHEEL_MANIFEST, PLAYABLE_WHEEL_MANIFEST_REVISION } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest";

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TOOL_DIR, "../..");
const OUTPUT_DIR = resolve(ROOT, "artifacts/hanzi-radical-battle-v2/wheel-workshop");
const externalStructureCrosscheck = JSON.parse(readFileSync(resolve(OUTPUT_DIR, "WHEEL_EXTERNAL_STRUCTURE_CROSSCHECK.json"), "utf8")) as {
  readonly canonicalAuditSha256: string;
  readonly source: Record<string, unknown>;
  readonly summary: Record<string, number>;
};
const unihanReadingCrosscheck = JSON.parse(readFileSync(resolve(OUTPUT_DIR, "WHEEL_UNIHAN_READING_CROSSCHECK.json"), "utf8")) as {
  readonly playableManifestSha256: string;
  readonly source: Record<string, unknown>;
  readonly summary: Record<string, number>;
};

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
const canonicalAuditSha256 = sha256(CANONICAL_WHEEL_LIBRARY);
const playableManifestSha256 = sha256(PLAYABLE_WHEEL_MANIFEST);
if (externalStructureCrosscheck.canonicalAuditSha256 !== canonicalAuditSha256) throw new Error("STALE_EXTERNAL_STRUCTURE_CROSSCHECK");
if (unihanReadingCrosscheck.playableManifestSha256 !== playableManifestSha256) throw new Error("STALE_UNIHAN_READING_CROSSCHECK");

const audit = {
  schemaVersion: 1,
  auditVersion: "wheel-library-audit-v2",
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
    { sourceId: "Unicode-Unicode17-Unihan", version: "17.0.0", sourceZipSha256: unihanReadingCrosscheck.source.sourceZipSha256, license: "Unicode-3.0", url: "https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip", usage: "temporary identity and Mandarin reading cross-check; no runtime dependency" },
    { sourceId: "Make-Me-a-Hanzi-dictionary", version: externalStructureCrosscheck.source.commit, dictionarySha256: externalStructureCrosscheck.source.dictionarySha256, license: "LGPL-3.0-or-later", url: "https://github.com/skishore/makemeahanzi", usage: "temporary all-162 root IDS and first-level operand cross-check; no bulk data or runtime dependency imported" },
    { sourceId: "CNS11643", version: "2024:U+770B,U+8DD1,U+7F9E,U+8150,U+533B", license: "Taiwan-Government-Data-Open-License-1.0", urls: ["https://www.cns11643.gov.tw/wordView.jsp?ID=86624", "https://www.cns11643.gov.tw/wordView.jsp?ID=90692", "https://www.cns11643.gov.tw/wordView.jsp?ID=89184", "https://www.cns11643.gov.tw/wordView.jsp?ID=92751", "https://www.cns11643.gov.tw/wordView.jsp?ID=205926"], usage: "exact component-form and documented IDS-variant adjudication" },
    { sourceId: "Academia-Sinica-Character-Structure-Database", version: "accessed-2026-08-16:U+5C45", license: "reference-only", url: "https://chardb.iis.sinica.edu.tw/evolution.jsp?cid=10323", usage: "居 尸 outer-form adjudication" },
    { sourceId: "MOE-Concised-Dictionary", version: "2021", license: "reference-only", url: "https://dict.concised.moe.edu.tw/dictView.jsp?ID=18026&la=0&powerMode=0", usage: "fixed-context 可汗 = kè hán lexical pronunciation evidence" },
    { sourceId: "MOE-Revised-Dictionary", version: "2021", license: "reference-only", url: "https://dict.revised.moe.edu.tw/dictView.jsp?ID=99918&la=0&powerMode=0", usage: "fixed-context 翘首 = qiáo shǒu lexical pronunciation evidence" },
  ],
  reviewedButNotImported: [
    { sourceId: "Make-Me-a-Hanzi-graphics", license: "Arphic-Public-License", url: "https://github.com/skishore/makemeahanzi", reason: "dictionary/graphics license split was recorded; graphics were not downloaded, needed, or imported for the text-structure-only workshop" },
  ],
  externalCrosschecks: {
    makeMeAHanzi: externalStructureCrosscheck.summary,
    unihan: unihanReadingCrosscheck.summary,
  },
  alignmentBoundary: "Source grade labels are preserved historical labels. curriculumStage is an organizational grouping only; no per-character 2022 curriculum alignment is claimed.",
  countsByGradeAndMode,
  statusCounts,
  issueCodeCounts,
  canonicalAuditSha256,
  playableManifestRevision: PLAYABLE_WHEEL_MANIFEST_REVISION,
  playableManifestSha256,
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
const summary = `# Wheel Library Audit Summary\n\n## Result\n\n- Raw source: ${freeze.totalCharRecords} char + ${freeze.totalWordRecords} word = ${freeze.totalRecords} records across ${freeze.setIds.length} preserved grade sets.\n- Dispositions: ${statusCounts.validated} validated; ${statusCounts["corrected-derived-record"]} corrected-derived; ${statusCounts.quarantined} quarantined; ${statusCounts["not-playable-context-only"]} context-only.\n- Playable manifest: ${PLAYABLE_WHEEL_MANIFEST.length} records (${PLAYABLE_WHEEL_MANIFEST.filter((record) => record.sourceGradeId === "p1").length} per source grade), revision ${PLAYABLE_WHEEL_MANIFEST_REVISION}.\n- Raw stable JSON SHA-256: ${freeze.stableJsonSha256}.\n- Canonical audit SHA-256: ${audit.canonicalAuditSha256}.\n- Playable manifest SHA-256: ${audit.playableManifestSha256}.\n- External checks: Make Me a Hanzi confirms all ${externalStructureCrosscheck.summary.approvedRootConfirmedCount}/161 audit-approved root structures and first-level operands (${externalStructureCrosscheck.summary.approvedExactComponentConfirmedCount} exact, ${externalStructureCrosscheck.summary.documentedComponentVariantCount} independently adjudicated variants), with ${externalStructureCrosscheck.summary.expectedQuarantineCount} expected quarantine and zero approved mismatch; Unihan confirms ${unihanReadingCrosscheck.summary.codePointPresentCount}/36 code points and all 36 playable readings (${unihanReadingCrosscheck.summary.contextualReadingConfirmedCount} contextual).\n\n## Grade and mode counts\n\n| Source grade | Mode | Raw | Validated | Corrected | Quarantined | Context only | Playable |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${rows}\n\n## Corrected or quarantined char records\n\n${changedLines}\n\n## Word-fragment isolation\n\n${fragmentLines}\n\n## Source and alignment boundary\n\nThe authoritative raw source is the Git-blob-bound freeze. Internal accepted formulas were checked against pinned temporary sources: Unicode Unihan 17.0.0 (Unicode-3.0) for identity/readings and Make Me a Hanzi dictionary commit bddc96d (LGPL-3.0-or-later) for all-162 root IDS and first-level operands. Five documented source variants were adjudicated against CNS11643 or Academia Sinica; the MOE Concised Dictionary supplies the fixed 可汗 reading. External bulk files, graphics, and network requests are absent from the child runtime and return package. Historical source-grade labels remain legacy-label-only; curriculum stages organize navigation and do not claim official per-character grade alignment. Machine review does not establish child fun or learning effect.\n`;

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(resolve(OUTPUT_DIR, "WHEEL_LIBRARY_AUDIT.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
writeFileSync(resolve(OUTPUT_DIR, "WHEEL_LIBRARY_AUDIT_SUMMARY.md"), summary, "utf8");
process.stdout.write(`${JSON.stringify({ result: "PASS", outputDir: OUTPUT_DIR, statusCounts, playableManifestCount: PLAYABLE_WHEEL_MANIFEST.length, rawStableJsonSha256: freeze.stableJsonSha256, canonicalAuditSha256: audit.canonicalAuditSha256, playableManifestSha256: audit.playableManifestSha256 })}\n`);
