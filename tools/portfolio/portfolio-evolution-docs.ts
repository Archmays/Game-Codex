import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const REVIEW_SOURCE_TREE_ALGORITHM = "sha256-git-clean-filter-tree-with-self-normalized-evidence-v1";
export const LOCAL_VALIDATION_EVIDENCE_PATH = "docs/portfolio-evolution/evidence/local-validation-evidence.json";
const REVIEW_SOURCE_TREE_EXCLUSIONS = new Set([
  "docs/portfolio-evolution/portfolio-audit.md",
  "GAME-CODEX-PORTFOLIO-EVOLUTION-GOAL-01_RETURN_TO_CHATGPT.zip",
  "GAME-CODEX-PORTFOLIO-EVOLUTION-GOAL-01_RETURN_TO_CHATGPT.zip.sha256",
]);

export interface PortfolioEvolutionEvidence {
  readonly schemaVersion: number;
  readonly goalId: string;
  readonly auditDate: string;
  readonly sourceBoundStartSha: string;
  readonly evidenceBoundary: Readonly<Record<string, string>>;
  readonly baseline: Readonly<Record<string, unknown>>;
  readonly resultingTruth: Readonly<Record<string, unknown>>;
  readonly benchmarkAccessDate: string;
  readonly benchmarkCases: readonly {
    readonly name: string;
    readonly category: string;
    readonly url: string;
    readonly evidenceLevel: string;
    readonly mechanism: string;
    readonly adopt: string;
    readonly exclude: string;
    readonly uncertainty: string;
  }[];
  readonly researchSources: readonly {
    readonly citation: string;
    readonly url: string;
    readonly evidenceLevel: string;
    readonly supportedClaim: string;
    readonly implication: string;
    readonly boundary: string;
  }[];
  readonly designPrinciples: readonly {
    readonly id: string;
    readonly principle: string;
    readonly portfolioMeaning: string;
  }[];
  readonly scoreDimensions: readonly { readonly id: string; readonly label: string; readonly weight: number }[];
  readonly independentReviews: readonly {
    readonly id: string;
    readonly reviewerId: string;
    readonly reviewRunId: string;
    readonly finalTreeBinding: string;
    readonly identityContract: string;
    readonly sourceTreeAlgorithm: string;
    readonly sourceTreeSha256: string;
    readonly sourceTreeFileCount: number;
    readonly reviewRound: string;
    readonly reviewedAt: string;
    readonly verdict: string;
    readonly scope: readonly string[];
    readonly reviewerIndependence: string;
    readonly keyFinding: string;
    readonly findings: readonly {
      readonly id: string;
      readonly severity: string;
      readonly disposition: string;
      readonly evidence: readonly string[];
      readonly resolution: string;
    }[];
    readonly validationEvidence: readonly string[];
    readonly unresolvedBlockers: readonly string[];
    readonly authenticChildEvidence: string;
  }[];
  readonly definitions: readonly {
    readonly id: string;
    readonly title: string;
    readonly routeState: string;
    readonly score: Readonly<Record<string, number>> & { readonly weightedTotal: number };
    readonly evidence: readonly string[];
    readonly confidence: string;
    readonly classification: string;
    readonly topStrength: string;
    readonly topProblem: string;
    readonly unknowns: readonly string[];
    readonly decision: { readonly primary: string; readonly modifiers: readonly string[] };
    readonly implementation: string;
    readonly routeImpact: string;
    readonly saveImpact: string;
    readonly sharedEngineImpact: string;
    readonly tests: readonly string[];
    readonly rollback: string;
    readonly notDo: readonly string[];
    readonly authenticChildEvidence: string;
  }[];
  readonly surfaceCoverage: {
    readonly manifestSource: string;
    readonly manifestValidatedCount: number;
    readonly primaryRealBrowserSurfaceIds: readonly string[];
    readonly decisionRelevantSecondaryRealBrowserSurfaceIds: readonly string[];
    readonly remainingCoverage: string;
    readonly uncoveredSurfaceIds: readonly string[];
  };
  readonly equationVisibleChangeAudit: Readonly<Record<string, unknown>>;
  readonly reviewReconciliation: {
    readonly agreements: readonly string[];
    readonly resolvedDifference: string;
    readonly humanAcceptanceInferred: boolean;
  };
}

export interface LocalValidationEvidence {
  readonly schemaVersion: number;
  readonly goalId: string;
  readonly evidenceKind: string;
  readonly executedOn: string;
  readonly testedSourceTree: {
    readonly algorithm: string;
    readonly sha256: string;
    readonly fileCount: number;
  };
  readonly scopeBoundary: string;
  readonly finalGatePolicy: string;
  readonly realChildValidation: string;
  readonly gates: readonly {
    readonly id: string;
    readonly command: string;
    readonly status: string;
    readonly exitCode: number;
    readonly result: string;
  }[];
  readonly configurationSkips: readonly {
    readonly profile: string;
    readonly count: number;
    readonly reason: string;
  }[];
  readonly unresolvedFailures: readonly string[];
}

type JsonRecord = Record<string, unknown>;

function schemaError(path: string, expected: string): never {
  throw new Error(`portfolio-evidence.json schema error at ${path}: expected ${expected}`);
}

function record(value: unknown, path: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) schemaError(path, "object");
  return value as JsonRecord;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) schemaError(path, "array");
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) schemaError(path, "non-empty string");
  return value;
}

function number(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) schemaError(path, "finite number");
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") schemaError(path, "boolean");
  return value;
}

function stringArray(value: unknown, path: string): string[] {
  return array(value, path).map((item, index) => string(item, `${path}[${index}]`));
}

function assertPortfolioEvolutionSchema(value: unknown): asserts value is PortfolioEvolutionEvidence {
  const root = record(value, "$");
  number(root.schemaVersion, "$.schemaVersion");
  for (const field of ["goalId", "auditDate", "sourceBoundStartSha", "benchmarkAccessDate"] as const) string(root[field], `$.${field}`);
  record(root.evidenceBoundary, "$.evidenceBoundary");
  record(root.baseline, "$.baseline");
  record(root.resultingTruth, "$.resultingTruth");

  for (const [index, item] of array(root.benchmarkCases, "$.benchmarkCases").entries()) {
    const entry = record(item, `$.benchmarkCases[${index}]`);
    for (const field of ["name", "category", "url", "evidenceLevel", "mechanism", "adopt", "exclude", "uncertainty"] as const) string(entry[field], `$.benchmarkCases[${index}].${field}`);
  }
  for (const [index, item] of array(root.researchSources, "$.researchSources").entries()) {
    const entry = record(item, `$.researchSources[${index}]`);
    for (const field of ["citation", "url", "evidenceLevel", "supportedClaim", "implication", "boundary"] as const) string(entry[field], `$.researchSources[${index}].${field}`);
  }
  for (const [index, item] of array(root.designPrinciples, "$.designPrinciples").entries()) {
    const entry = record(item, `$.designPrinciples[${index}]`);
    for (const field of ["id", "principle", "portfolioMeaning"] as const) string(entry[field], `$.designPrinciples[${index}].${field}`);
  }
  for (const [index, item] of array(root.scoreDimensions, "$.scoreDimensions").entries()) {
    const entry = record(item, `$.scoreDimensions[${index}]`);
    string(entry.id, `$.scoreDimensions[${index}].id`);
    string(entry.label, `$.scoreDimensions[${index}].label`);
    number(entry.weight, `$.scoreDimensions[${index}].weight`);
  }
  for (const [index, item] of array(root.independentReviews, "$.independentReviews").entries()) {
    const entry = record(item, `$.independentReviews[${index}]`);
    for (const field of ["id", "reviewerId", "reviewRunId", "finalTreeBinding", "identityContract", "sourceTreeAlgorithm", "sourceTreeSha256", "reviewRound", "reviewedAt", "verdict", "reviewerIndependence", "keyFinding", "authenticChildEvidence"] as const) string(entry[field], `$.independentReviews[${index}].${field}`);
    number(entry.sourceTreeFileCount, `$.independentReviews[${index}].sourceTreeFileCount`);
    stringArray(entry.scope, `$.independentReviews[${index}].scope`);
    for (const [findingIndex, findingValue] of array(entry.findings, `$.independentReviews[${index}].findings`).entries()) {
      const finding = record(findingValue, `$.independentReviews[${index}].findings[${findingIndex}]`);
      for (const field of ["id", "severity", "disposition", "resolution"] as const) string(finding[field], `$.independentReviews[${index}].findings[${findingIndex}].${field}`);
      stringArray(finding.evidence, `$.independentReviews[${index}].findings[${findingIndex}].evidence`);
    }
    stringArray(entry.validationEvidence, `$.independentReviews[${index}].validationEvidence`);
    stringArray(entry.unresolvedBlockers, `$.independentReviews[${index}].unresolvedBlockers`);
  }
  for (const [index, item] of array(root.definitions, "$.definitions").entries()) {
    const entry = record(item, `$.definitions[${index}]`);
    for (const field of ["id", "title", "routeState", "confidence", "classification", "topStrength", "topProblem", "implementation", "routeImpact", "saveImpact", "sharedEngineImpact", "rollback", "authenticChildEvidence"] as const) string(entry[field], `$.definitions[${index}].${field}`);
    const score = record(entry.score, `$.definitions[${index}].score`);
    for (const [key, scoreValue] of Object.entries(score)) number(scoreValue, `$.definitions[${index}].score.${key}`);
    stringArray(entry.evidence, `$.definitions[${index}].evidence`);
    stringArray(entry.unknowns, `$.definitions[${index}].unknowns`);
    stringArray(entry.tests, `$.definitions[${index}].tests`);
    stringArray(entry.notDo, `$.definitions[${index}].notDo`);
    const decision = record(entry.decision, `$.definitions[${index}].decision`);
    string(decision.primary, `$.definitions[${index}].decision.primary`);
    stringArray(decision.modifiers, `$.definitions[${index}].decision.modifiers`);
  }
  const coverage = record(root.surfaceCoverage, "$.surfaceCoverage");
  string(coverage.manifestSource, "$.surfaceCoverage.manifestSource");
  number(coverage.manifestValidatedCount, "$.surfaceCoverage.manifestValidatedCount");
  stringArray(coverage.primaryRealBrowserSurfaceIds, "$.surfaceCoverage.primaryRealBrowserSurfaceIds");
  stringArray(coverage.decisionRelevantSecondaryRealBrowserSurfaceIds, "$.surfaceCoverage.decisionRelevantSecondaryRealBrowserSurfaceIds");
  string(coverage.remainingCoverage, "$.surfaceCoverage.remainingCoverage");
  stringArray(coverage.uncoveredSurfaceIds, "$.surfaceCoverage.uncoveredSurfaceIds");
  record(root.equationVisibleChangeAudit, "$.equationVisibleChangeAudit");
  const reconciliation = record(root.reviewReconciliation, "$.reviewReconciliation");
  stringArray(reconciliation.agreements, "$.reviewReconciliation.agreements");
  string(reconciliation.resolvedDifference, "$.reviewReconciliation.resolvedDifference");
  boolean(reconciliation.humanAcceptanceInferred, "$.reviewReconciliation.humanAcceptanceInferred");
}

export function loadPortfolioEvolutionEvidence(root: string): PortfolioEvolutionEvidence {
  const parsed: unknown = JSON.parse(readFileSync(resolve(root, "docs/portfolio-evolution/portfolio-evidence.json"), "utf8"));
  assertPortfolioEvolutionSchema(parsed);
  return parsed;
}

export function loadLocalValidationEvidence(root: string): LocalValidationEvidence {
  const parsed: unknown = JSON.parse(readFileSync(resolve(root, LOCAL_VALIDATION_EVIDENCE_PATH), "utf8"));
  const rootRecord = record(parsed, "$localValidation");
  number(rootRecord.schemaVersion, "$localValidation.schemaVersion");
  for (const field of ["goalId", "evidenceKind", "executedOn", "scopeBoundary", "finalGatePolicy", "realChildValidation"] as const) {
    string(rootRecord[field], `$localValidation.${field}`);
  }
  const testedSourceTree = record(rootRecord.testedSourceTree, "$localValidation.testedSourceTree");
  string(testedSourceTree.algorithm, "$localValidation.testedSourceTree.algorithm");
  string(testedSourceTree.sha256, "$localValidation.testedSourceTree.sha256");
  number(testedSourceTree.fileCount, "$localValidation.testedSourceTree.fileCount");
  for (const [index, gateValue] of array(rootRecord.gates, "$localValidation.gates").entries()) {
    const gate = record(gateValue, `$localValidation.gates[${index}]`);
    for (const field of ["id", "command", "status", "result"] as const) string(gate[field], `$localValidation.gates[${index}].${field}`);
    number(gate.exitCode, `$localValidation.gates[${index}].exitCode`);
  }
  for (const [index, skipValue] of array(rootRecord.configurationSkips, "$localValidation.configurationSkips").entries()) {
    const skip = record(skipValue, `$localValidation.configurationSkips[${index}]`);
    string(skip.profile, `$localValidation.configurationSkips[${index}].profile`);
    number(skip.count, `$localValidation.configurationSkips[${index}].count`);
    string(skip.reason, `$localValidation.configurationSkips[${index}].reason`);
  }
  stringArray(rootRecord.unresolvedFailures, "$localValidation.unresolvedFailures");
  return parsed as LocalValidationEvidence;
}

export function computeReviewSourceTreeIdentity(root: string): { readonly sha256: string; readonly fileCount: number } {
  const listed = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: root });
  const paths = listed.toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => !REVIEW_SOURCE_TREE_EXCLUSIONS.has(path))
    .sort((left, right) => left.localeCompare(right, "en"));
  if (paths.some((path) => path.includes("\n") || path.includes("\r"))) throw new Error("Review source binding does not support newline-bearing paths.");

  const evidencePath = "docs/portfolio-evolution/portfolio-evidence.json";
  if (!paths.includes(evidencePath)) throw new Error(`Review source binding is missing ${evidencePath}.`);
  const regularPaths = paths.filter((path) => path !== evidencePath);
  const blobHashes = regularPaths.length === 0
    ? []
    : execFileSync("git", ["hash-object", "--stdin-paths"], {
      cwd: root,
      encoding: "utf8",
      input: regularPaths.join("\n"),
    }).trim().split(/\r?\n/);
  if (blobHashes.length !== regularPaths.length || blobHashes.some((hash) => !/^[0-9a-f]{40,64}$/.test(hash))) {
    throw new Error("Review source binding could not derive one canonical Git blob hash per source path.");
  }

  const evidence = JSON.parse(readFileSync(resolve(root, evidencePath), "utf8")) as JsonRecord;
  const reviews = array(evidence.independentReviews, "$.independentReviews");
  for (const [index, value] of reviews.entries()) {
    const review = record(value, `$.independentReviews[${index}]`);
    review.sourceTreeSha256 = "__SELF_NORMALIZED_REVIEW_SOURCE_TREE_SHA256__";
    review.sourceTreeFileCount = 0;
  }
  const normalizedEvidenceSha256 = createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
  const aggregate = createHash("sha256");
  aggregate.update(`${REVIEW_SOURCE_TREE_ALGORITHM}\n`);
  for (let index = 0; index < regularPaths.length; index += 1) {
    aggregate.update(`${JSON.stringify(regularPaths[index])}\0${blobHashes[index]}\n`);
  }
  aggregate.update(`${JSON.stringify(evidencePath)}\0sha256:${normalizedEvidenceSha256}\n`);
  return { sha256: aggregate.digest("hex"), fileCount: paths.length };
}

function cell(value: unknown): string {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function evidenceLabel(level: string): string {
  return level.replaceAll("_", " ");
}

export function renderBenchmarkAndPrinciples(evidence: PortfolioEvolutionEvidence): string {
  return [
    "# Portfolio Evolution：外部标杆与设计原则",
    "",
    `> 访问日期：${evidence.benchmarkAccessDate}。产品页面只支持“产品当前宣称/展示了什么机制”，不是独立的儿童效果证据；研究结论也不自动外推到 Game-Codex。`,
    "",
    `本轮审看 ${evidence.benchmarkCases.length} 个产品案例与 ${evidence.researchSources.length} 个同行评议研究/综述。证据用途是形成审计准则，不是证明儿童喜欢、理解、学会或长期使用。`,
    "",
    "## 产品 benchmark matrix",
    "",
    "| 案例 | 类型 | 证据 | 机制事实 | 可借鉴 | 不引入 | 未知/边界 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...evidence.benchmarkCases.map((item) => `| [${cell(item.name)}](${item.url}) | \`${cell(item.category)}\` | \`${evidenceLabel(item.evidenceLevel)}\` | ${cell(item.mechanism)} | ${cell(item.adopt)} | ${cell(item.exclude)} | ${cell(item.uncertainty)} |`),
    "",
    "## 研究证据 matrix",
    "",
    "| 来源 | 证据等级 | 支持的结论 | 对现有组合的含义 | 边界 |",
    "| --- | --- | --- | --- | --- |",
    ...evidence.researchSources.map((source) => `| [${cell(source.citation)}](${source.url}) | \`${evidenceLabel(source.evidenceLevel)}\` | ${cell(source.supportedClaim)} | ${cell(source.implication)} | ${cell(source.boundary)} |`),
    "",
    "## 进入 Portfolio 审计的设计原则",
    "",
    ...evidence.designPrinciples.map((item, index) => `${index + 1}. **${item.principle}** ${item.portfolioMeaning}`),
    "",
    "## 尚不确定",
    "",
    "- 商业产品未在本轮独立安装或进行真实儿童首用测试；功能、定价与目录规模可能变化。",
    "- 开放探索与明确进阶的比例必须按 Hanzi、Math、English 各自机制判断，研究不支持一个通用比例。",
    "- My Game World 是否应获得本机持久创作工具，仍是未来产品方向，不由 Toca/Sago/Pok Pok 对照自动决定。",
    "- 相机、麦克风、账户、云档案、遥测与专有硬件继续排除，除非未来另行明确授权并完成隐私/无障碍审计。",
    "",
  ].join("\n");
}

export function renderPortfolioAudit(evidence: PortfolioEvolutionEvidence): string {
  const scoreHeaders = evidence.scoreDimensions.map((dimension) => dimension.label);
  const beforeAfterRows = [
    ["Mount definitions", evidence.baseline.mountDefinitions, evidence.resultingTruth.mountDefinitions],
    ["Classic cards", evidence.baseline.classicCards, evidence.resultingTruth.classicCards],
    ["Play surfaces", evidence.baseline.playSurfaces, evidence.resultingTruth.playSurfaces],
    ["Primary surfaces", evidence.baseline.primarySurfaces, evidence.resultingTruth.primarySurfaces],
    ["Known save keys", evidence.baseline.knownSaveKeys, evidence.resultingTruth.knownSaveKeys],
  ];
  return [
    "# Game-Codex Portfolio 机器优先审计",
    "",
    `> Goal：\`${evidence.goalId}\`；审计日期：${evidence.auditDate}；初始事实绑定：\`${evidence.sourceBoundStartSha}\`。本页由 \`portfolio-evidence.json\` 确定性生成。`,
    "",
    "## 三本证据账",
    "",
    `- \`ENGINEERING_EVIDENCE\`：${evidence.evidenceBoundary.engineeringEvidence}`,
    `- \`PRODUCT_EVIDENCE\`：${evidence.evidenceBoundary.productEvidence}`,
    `- \`AUTHENTIC_CHILD_EVIDENCE\`：\`${evidence.evidenceBoundary.authenticChildEvidence}\`。`,
    "",
    "## 组合前后事实",
    "",
    "| 事实 | Before | After |",
    "| --- | ---: | ---: |",
    ...beforeAfterRows.map(([label, before, after]) => `| ${label} | ${before} | ${after} |`),
    "",
    `After 的活跃儿童产品：${(evidence.resultingTruth.activeChildProducts as string[]).map((id) => `\`${id}\``).join(" / ")}。定义、世界模块、兼容表面、共享引擎和 save inventory 分层维护；取消卡片不删除实现、route 或存档。`,
    "",
    "## 100 分 rubric",
    "",
    "| Dimension | Weight |",
    "| --- | ---: |",
    ...evidence.scoreDimensions.map((dimension) => `| ${cell(dimension.label)} | ${dimension.weight} |`),
    "| **Total** | **100** |",
    "",
    "## Scorecards",
    "",
    `| 定义 | 总分 | ${scoreHeaders.map(cell).join(" | ")} | 信心 | 决策 |`,
    `| --- | ---: | ${scoreHeaders.map(() => "---:").join(" | ")} | --- | --- |`,
    ...evidence.definitions.map((record) => `| ${cell(record.title)}<br>\`${record.id}\` | ${record.score.weightedTotal.toFixed(1)} | ${evidence.scoreDimensions.map((dimension) => record.score[dimension.id]).join(" | ")} | \`${record.confidence}\` | \`${record.decision.primary}\`<br>${record.decision.modifiers.map((item) => `\`${item}\``).join(" ")} |`),
    "",
    "总分只支持排序和讨论；correctness、privacy、route/save compatibility 与 accessibility 可独立否决一个实现。所有评分都是产品推断，不是儿童结果。",
    "",
    "## 逐定义证据与决策合同",
    "",
    ...evidence.definitions.flatMap((record) => [
      `### ${record.title} — \`${record.decision.primary}\``,
      "",
      `- Route/state：${record.routeState}`,
      `- 证据 / 分类 / 信心：${record.evidence.map((pointer) => `\`${pointer}\``).join("；")}；\`${record.classification}\`；\`${record.confidence}\`。`,
      `- Top strength：${record.topStrength}`,
      `- Top problem：${record.topProblem}`,
      `- Unknowns：${record.unknowns.map((unknown) => unknown.replace(/[.。]$/, "")).join("；")}。`,
      `- 实施：${record.implementation}`,
      `- Route impact：${record.routeImpact}`,
      `- Save impact：${record.saveImpact}`,
      `- Shared-engine impact：${record.sharedEngineImpact}`,
      `- Tests：${record.tests.join("；")}。`,
      `- Rollback：${record.rollback}`,
      `- Not-do：${record.notDo.join("；")}。`,
      `- Child-evidence boundary：\`${record.authenticChildEvidence}\`。`,
      "",
    ]),
    "## 两轮独立审查",
    "",
    ...evidence.independentReviews.flatMap((review) => [
      `### ${review.id}`,
      "",
      `- Reviewer：\`${review.reviewerId}\`；run：\`${review.reviewRunId}\`。`,
      `- 最终候选绑定：\`${review.finalTreeBinding}\`；轮次：\`${review.reviewRound}\`；判定：\`${review.verdict}\`；日期：${review.reviewedAt}。`,
      `- Source tree：\`${review.sourceTreeAlgorithm}\` / ${review.sourceTreeFileCount} files / \`${review.sourceTreeSha256}\`。`,
      `- 身份合同：${review.identityContract}`,
      `- 独立性：${review.reviewerIndependence}`,
      `- Rubric：${review.scope.join(" / ")}`,
      `- 关键结论：${review.keyFinding}`,
      `- Findings：${review.findings.map((finding) => `\`${finding.id}\` \`${finding.severity}\` → \`${finding.disposition}\`：${finding.resolution}（${finding.evidence.map((pointer) => `\`${pointer}\``).join("；")}）`).join("；")}`,
      `- 验证证据：${review.validationEvidence.map((pointer) => `\`${pointer}\``).join("；")}。`,
      `- 未关闭 blocker：${review.unresolvedBlockers.length === 0 ? "无" : review.unresolvedBlockers.join("；")}；真实儿童证据：\`${review.authenticChildEvidence}\`。`,
      "",
    ]),
    "## Equation Slider visible-no-change 专项",
    "",
    `- 200 关、${evidence.equationVisibleChangeAudit.sameDisplayTransitions} 条同显示相邻转换、${evidence.equationVisibleChangeAudit.affectedLevels} 个受影响关卡；其中 ${evidence.equationVisibleChangeAudit.initiallyExposedLevels} 关初始可触发。`,
    `- 禁用这些边后 ${evidence.equationVisibleChangeAudit.solvableWithoutSameDisplayEdges}/${evidence.equationVisibleChangeAudit.affectedLevels} 仍可完成；${evidence.equationVisibleChangeAudit.requiredSameDisplayMoveLevels} 关必须依赖；${evidence.equationVisibleChangeAudit.shortestPathBenefitLevels} 关最短路径增加，最大只增加 ${evidence.equationVisibleChangeAudit.maximumShortestPathDelta} 步。`,
    `- 算法：${evidence.equationVisibleChangeAudit.algorithm}`,
    `- 决策：${evidence.equationVisibleChangeAudit.childVisibleDecision}`,
    `- 每关真源：\`${evidence.equationVisibleChangeAudit.authoritativePerLevelEvidence}\`；目录 hash：\`${evidence.equationVisibleChangeAudit.catalogHash}\`。`,
    "",
    "## Surface coverage",
    "",
    `- Manifest：\`${evidence.surfaceCoverage.manifestSource}\`；After 总数：${evidence.surfaceCoverage.manifestValidatedCount}。`,
    `- Primary 真实浏览器：${evidence.surfaceCoverage.primaryRealBrowserSurfaceIds.map((id) => `\`${id}\``).join(" / ")}。`,
    `- 决策相关 secondary 真实浏览器：${evidence.surfaceCoverage.decisionRelevantSecondaryRealBrowserSurfaceIds.map((id) => `\`${id}\``).join(" / ")}。`,
    `- 其余覆盖：${evidence.surfaceCoverage.remainingCoverage}`,
    `- 未覆盖：${evidence.surfaceCoverage.uncoveredSurfaceIds.length === 0 ? "无" : evidence.surfaceCoverage.uncoveredSurfaceIds.join(" / ")}。`,
    "",
    "## 分歧处理",
    "",
    ...evidence.reviewReconciliation.agreements.map((agreement) => `- ${agreement}`),
    "",
    `Equation 分歧：${evidence.reviewReconciliation.resolvedDifference}`,
    "",
    "## 明确保留的未知项",
    "",
    "- 儿童是否在 30 秒内真正理解目标、是否喜欢、是否会回玩、是否学会或保持：`UNKNOWN / NOT PERFORMED / NOT CLAIMED`。",
    "- 自动测试、截图、UI agent、CI 和 Pages 验证只证明工程与产品契约，不证明家庭验收或教育效果。",
    "",
  ].join("\n");
}
