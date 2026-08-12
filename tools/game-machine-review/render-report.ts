import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MachineReviewManifest } from "./machine-review-manifest";
import type { HardGateEvaluation, MachineVerdictResult, NetworkGateSummary, EvidenceSummary } from "./evaluate-hard-gates";
import type { MergedSemanticReview } from "./merge-review-findings";
import type { Step07ExceptionalRepairMetadata } from "./evidence-identity";

export interface MachineReviewReport extends Partial<Step07ExceptionalRepairMetadata> {
  readonly schemaVersion: 1;
  readonly step: "07";
  readonly generatedAtUtc: string;
  readonly sourceIdentity: {
    readonly commitSha: string;
    readonly sourceTreeSha256: string;
  };
  readonly evidenceTreeSha256: string;
  readonly evidenceManifestSha256: string;
  readonly manifest: MachineReviewManifest;
  readonly hardGates: HardGateEvaluation;
  readonly scrollMatrix: EvidenceSummary;
  readonly catalogSmoke: EvidenceSummary;
  readonly agentPlaythroughs: EvidenceSummary;
  readonly deepRouteAccessibility: EvidenceSummary;
  readonly criticalControlGeometry: EvidenceSummary;
  readonly network: NetworkGateSummary;
  readonly privacy: EvidenceSummary;
  readonly semanticReview: MergedSemanticReview;
  readonly unresolvedCriticalReviewerConflict: boolean;
  readonly finalFullTests: EvidenceSummary;
  readonly finalBuild: EvidenceSummary;
  readonly verdict: MachineVerdictResult;
  readonly realSecondUsePerformed: false;
  readonly limitations: readonly string[];
}

export interface MachineReviewVerdictArtifact extends Partial<Step07ExceptionalRepairMetadata> {
  readonly schemaVersion: 1;
  readonly step: "07";
  readonly verdict: MachineReviewReport["verdict"]["verdict"];
  readonly escalationReason: MachineReviewReport["verdict"]["escalationReason"];
  readonly failedConditions: readonly string[];
  readonly repairRound: number;
  readonly finalCommit: string;
  readonly sourceTreeSha256: string;
  readonly evidenceTreeSha256: string;
  readonly evidenceManifestSha256: string;
  readonly derivedOutputSealSha256: string;
  readonly generatedAtUtc: string;
  readonly realSecondUsePerformed: "NO";
}

interface DerivedOutputSeal {
  readonly schemaVersion: 1;
  readonly step: "07";
  readonly sourceTreeSha256: string;
  readonly evidenceTreeSha256: string;
  readonly entries: readonly {
    readonly path: string;
    readonly bytes: number;
    readonly sha256: string;
  }[];
}

function sha256(contents: string): string {
  return createHash("sha256").update(contents, "utf8").digest("hex").toUpperCase();
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderMachineReviewJson(report: MachineReviewReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function renderMachineReviewMarkdown(report: MachineReviewReport): string {
  const failed = report.verdict.failedConditions.length ? report.verdict.failedConditions.map((condition) => `- ${condition}`).join("\n") : "- none";
  const findings = report.semanticReview.findings.length
    ? report.semanticReview.findings.map((finding) => `- [${finding.severity}] ${finding.id}: ${finding.route} / ${finding.state} — ${finding.whyItMatters}`).join("\n")
    : "- none";
  const exceptionalRepair = report.exceptionalRepairs
    ? `
## Human-authorized exceptional repairs

- repairRoundsConsumed: \`${report.repairRoundsConsumed}\`
- humanExceptionalRepairs: \`${report.humanExceptionalRepairs}\`
- ordinaryAutoReviseLoop: \`${report.ordinaryAutoReviseLoop}\`
- closedRecoveryAuthorizations: \`${report.closedRecoveryAuthorizations}\`
- finalClosureAuthorizations: \`${report.finalClosureAuthorizations}\`
${report.exceptionalRepairs.map((repair) => `
### ${repair.exceptionalRepairId}

- originalBlocker: \`${repair.originalBlocker}\`
- rootCause: \`${repair.rootCause}\`
- resolution: \`${repair.resolution}\`
- authorizationEvidenceFile: \`${repair.authorizationEvidenceFile}\``).join("\n")}
`
    : "";
  return `# STEP 07 Machine Review Summary

- Verdict: \`${report.verdict.verdict}\`
- Commit: \`${report.sourceIdentity.commitSha}\`
- Source tree SHA-256: \`${report.sourceIdentity.sourceTreeSha256}\`
- Evidence tree SHA-256: \`${report.evidenceTreeSha256}\`
- Evidence manifest SHA-256: \`${report.evidenceManifestSha256}\`
- Hard gates: \`${report.hardGates.passed}/${report.hardGates.required}\`
- Scroll matrix: \`${report.scrollMatrix.status}\`
- Catalog smoke: \`${report.catalogSmoke.status}\`
- Agent playthroughs: \`${report.agentPlaythroughs.status}\`
- Deep route and accessibility matrix: \`${report.deepRouteAccessibility.status}\`
- Critical-control geometry: \`${report.criticalControlGeometry.status}\`
- External requests: \`${report.network.externalRequests.length}\`
- Real second-use performed: \`false\`
${exceptionalRepair}

## Failed conditions

${failed}

## Semantic findings

${findings}

## Explicit limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}

export function renderMachineReviewHtml(report: MachineReviewReport): string {
  const pageModeContract = readFileSync(resolve(process.cwd(), "src/page-mode.css"), "utf8");
  const hardRows = report.hardGates.results.map((gate) => `<tr><td>${escapeHtml(gate.id)}</td><td><strong data-status="${gate.status}">${gate.status}</strong></td><td>${escapeHtml(gate.detail)}</td><td>${gate.evidenceFiles.map(escapeHtml).join("<br>")}</td></tr>`).join("");
  const findingRows = report.semanticReview.findings.length
    ? report.semanticReview.findings.map((finding) => `<article><h3>${escapeHtml(finding.id)} · ${finding.severity}</h3><p><strong>${escapeHtml(finding.route)} / ${escapeHtml(finding.state)}</strong></p><p>${escapeHtml(finding.visibleEvidence)}</p><p>${escapeHtml(finding.whyItMatters)}</p><p>Evidence: ${finding.evidenceFiles.map(escapeHtml).join(", ")}</p></article>`).join("")
    : "<p>No semantic findings were recorded.</p>";
  const exceptionalRepair = report.exceptionalRepairs
    ? `<section class="card"><h2>Human-authorized exceptional repairs</h2><dl><dt>repairRoundsConsumed</dt><dd><code>${report.repairRoundsConsumed}</code></dd><dt>humanExceptionalRepairs</dt><dd><code>${report.humanExceptionalRepairs}</code></dd><dt>ordinaryAutoReviseLoop</dt><dd><code>${report.ordinaryAutoReviseLoop}</code></dd><dt>closedRecoveryAuthorizations</dt><dd><code>${report.closedRecoveryAuthorizations}</code></dd><dt>finalClosureAuthorizations</dt><dd><code>${report.finalClosureAuthorizations}</code></dd></dl>${report.exceptionalRepairs.map((repair) => `<h3>${escapeHtml(repair.exceptionalRepairId)}</h3><dl><dt>originalBlocker</dt><dd><code>${escapeHtml(repair.originalBlocker)}</code></dd><dt>rootCause</dt><dd><code>${escapeHtml(repair.rootCause)}</code></dd><dt>resolution</dt><dd><code>${escapeHtml(repair.resolution)}</code></dd><dt>authorizationEvidenceFile</dt><dd><code>${escapeHtml(repair.authorizationEvidenceFile)}</code></dd></dl>`).join("")}</section>`
    : "";
  return `<!doctype html><html class="adult-tool-page" lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>STEP 07 Machine Review</title><style>
${pageModeContract}
*{box-sizing:border-box}body.adult-tool-page{color:#17292f;background:#eef3f4;font-family:system-ui,sans-serif}.report{width:min(1180px,100%);margin:0 auto;padding:24px 16px 72px}.hero,.card,article{min-width:0;max-width:100%;margin:0 0 18px;padding:20px;border:1px solid #c7d5d7;border-radius:16px;background:#fff;overflow-wrap:anywhere;word-break:break-word}.hero{color:#f4fbfa;background:#123a42}table{width:100%;table-layout:fixed;border-collapse:collapse}th,td{min-width:0;padding:10px;border:1px solid #d7e0e1;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-break:break-word}button{min-width:24px;min-height:44px;padding:9px 15px;border:0;border-radius:10px;color:#fff;background:#126273;font:inherit;font-weight:800;cursor:pointer}[data-status="PASS"]{color:#145733}[data-status="FAIL"]{color:#8a2f3d}code{overflow-wrap:anywhere}
</style></head><body class="adult-tool-page"><div id="app"><main class="report"><header class="hero"><p>GAME-CODEX · STEP 07</p><h1>Machine-First Game Review</h1><p>Read-only evidence report. No parent decision controls.</p></header><section class="card"><h2>Verdict</h2><p><strong>${report.verdict.verdict}</strong></p><p>Commit <code>${escapeHtml(report.sourceIdentity.commitSha)}</code></p><p>Deep route/accessibility matrix: <strong>${report.deepRouteAccessibility.status}</strong></p><p>Critical-control geometry: <strong>${report.criticalControlGeometry.status}</strong></p><p>SAME_ORIGIN_ALLOWED / EXTERNAL_NETWORK_FORBIDDEN · external requests: ${report.network.externalRequests.length}</p></section>${exceptionalRepair}<section class="card"><h2>Hard gates</h2><table><thead><tr><th>Gate</th><th>Status</th><th>Detail</th><th>Evidence</th></tr></thead><tbody>${hardRows}</tbody></table></section><section class="card"><h2>Semantic review</h2>${findingRows}</section><section class="card"><h2>Explicit limitations</h2><ul>${report.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("")}</ul><p>Real second-use performed: false.</p></section><section class="card"><h2>Report end</h2><p>The final action uses the same adult-tool focus and scroll contract.</p><button type="button" data-static-final-action>Return to report top</button></section></main></div><script>document.querySelector('[data-static-final-action]').addEventListener('click',()=>window.scrollTo({top:0,behavior:'auto'}));</script></body></html>`;
}

export function writeMachineReviewReport(report: MachineReviewReport, outputDirectory: string): void {
  const directory = resolve(outputDirectory);
  mkdirSync(directory, { recursive: true });
  const derivedOutputs = {
    "MACHINE-REVIEW-REPORT.json": renderMachineReviewJson(report),
    "MACHINE-REVIEW-SUMMARY.md": renderMachineReviewMarkdown(report),
    "MACHINE-REVIEW-REPORT.html": renderMachineReviewHtml(report),
    "route-inventory.json": `${JSON.stringify(report.manifest, null, 2)}\n`,
  } as const;
  for (const [name, contents] of Object.entries(derivedOutputs)) writeFileSync(resolve(directory, name), contents, "utf8");
  const derivedOutputSeal: DerivedOutputSeal = {
    schemaVersion: 1,
    step: "07",
    sourceTreeSha256: report.sourceIdentity.sourceTreeSha256,
    evidenceTreeSha256: report.evidenceTreeSha256,
    entries: Object.entries(derivedOutputs).map(([path, contents]) => ({
      path,
      bytes: Buffer.byteLength(contents, "utf8"),
      sha256: sha256(contents),
    })).sort((left, right) => left.path.localeCompare(right.path)),
  };
  const sealContents = `${JSON.stringify(derivedOutputSeal, null, 2)}\n`;
  writeFileSync(resolve(directory, "DERIVED-OUTPUT-SEAL.json"), sealContents, "utf8");
  const verdictArtifact: MachineReviewVerdictArtifact = {
    schemaVersion: 1,
    step: "07",
    verdict: report.verdict.verdict,
    escalationReason: report.verdict.escalationReason,
    failedConditions: report.verdict.failedConditions,
    repairRound: report.verdict.repairRound,
    finalCommit: report.sourceIdentity.commitSha,
    sourceTreeSha256: report.sourceIdentity.sourceTreeSha256,
    evidenceTreeSha256: report.evidenceTreeSha256,
    evidenceManifestSha256: report.evidenceManifestSha256,
    derivedOutputSealSha256: sha256(sealContents),
    generatedAtUtc: report.generatedAtUtc,
    realSecondUsePerformed: "NO",
    repairRoundsConsumed: report.repairRoundsConsumed,
    humanExceptionalRepairs: report.humanExceptionalRepairs,
    ordinaryAutoReviseLoop: report.ordinaryAutoReviseLoop,
    closedRecoveryAuthorizations: report.closedRecoveryAuthorizations,
    finalClosureAuthorizations: report.finalClosureAuthorizations,
    exceptionalRepairs: report.exceptionalRepairs,
  };
  writeFileSync(resolve(directory, "MACHINE-REVIEW-VERDICT.json"), `${JSON.stringify(verdictArtifact, null, 2)}\n`, "utf8");
}
