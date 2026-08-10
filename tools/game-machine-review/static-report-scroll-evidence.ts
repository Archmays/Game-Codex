import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { computeMachineReviewSourceTreeSha256 } from "./source-identity";

export const STATIC_MACHINE_REPORT_RELATIVE_PATH = "artifacts/game-machine-review/step-07/MACHINE-REVIEW-REPORT.html";
export const STATIC_MACHINE_REPORT_SCROLL_RELATIVE_PATH = "artifacts/game-machine-review/step-07/STATIC-MACHINE-REPORT-SCROLL.json";
export const STATIC_MACHINE_REPORT_URL_PATH = "/artifacts/game-machine-review/step-07/MACHINE-REVIEW-REPORT.html";

export type StaticReportScrollInput = "mouse-wheel" | "PageDown" | "End" | "touch-swipe";

export interface StaticReportScrollCase {
  readonly key: string;
  readonly project: "desktop-chromium" | "mobile-touch-chromium";
  readonly viewport: string;
  readonly width: number;
  readonly height: number;
  readonly hasTouch: boolean;
  readonly requiredInputs: readonly StaticReportScrollInput[];
}

export const STATIC_MACHINE_REPORT_SCROLL_CASES = [
  {
    key: "desktop-chromium|320x568",
    project: "desktop-chromium",
    viewport: "320x568",
    width: 320,
    height: 568,
    hasTouch: false,
    requiredInputs: ["mouse-wheel", "PageDown", "End"],
  },
  {
    key: "desktop-chromium|390x844",
    project: "desktop-chromium",
    viewport: "390x844",
    width: 390,
    height: 844,
    hasTouch: false,
    requiredInputs: ["mouse-wheel", "PageDown", "End"],
  },
  {
    key: "desktop-chromium|768x1024",
    project: "desktop-chromium",
    viewport: "768x1024",
    width: 768,
    height: 1024,
    hasTouch: false,
    requiredInputs: ["mouse-wheel", "PageDown", "End"],
  },
  {
    key: "desktop-chromium|1440x900",
    project: "desktop-chromium",
    viewport: "1440x900",
    width: 1440,
    height: 900,
    hasTouch: false,
    requiredInputs: ["mouse-wheel", "PageDown", "End"],
  },
  {
    key: "mobile-touch-chromium|390x844",
    project: "mobile-touch-chromium",
    viewport: "390x844",
    width: 390,
    height: 844,
    hasTouch: true,
    requiredInputs: ["touch-swipe", "PageDown", "End"],
  },
] as const satisfies readonly StaticReportScrollCase[];

export interface FileIdentity {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface StaticReportScrollInputTrace {
  readonly input: StaticReportScrollInput;
  readonly method:
    | "Playwright mouse.wheel"
    | "Playwright keyboard PageDown"
    | "Playwright keyboard End"
    | "Chromium CDP Input.dispatchTouchEvent";
  readonly before: number;
  readonly after: number;
  readonly maxScrollTop: number;
  readonly passed: boolean;
}

export interface StaticReportScrollRow {
  readonly key: string;
  readonly sourceTreeSha256: string;
  readonly reportHtmlSha256: string;
  readonly contextId: string;
  readonly isolatedBrowserContext: true;
  readonly project: StaticReportScrollCase["project"];
  readonly viewport: string;
  readonly width: number;
  readonly height: number;
  readonly hasTouch: boolean;
  readonly actualUrl: string;
  readonly pageMode: "adult-tool-page";
  readonly htmlHasAdultToolClass: boolean;
  readonly bodyHasAdultToolClass: boolean;
  readonly scrollOwner: "document.documentElement";
  readonly scrollHeight: number;
  readonly clientHeight: number;
  readonly maxScrollTop: number;
  readonly horizontalOverflowPx: number;
  readonly horizontalOverflowElements: readonly string[];
  readonly nestedVerticalScrollOwners: readonly string[];
  readonly inputs: readonly StaticReportScrollInputTrace[];
  readonly finalAction: {
    readonly selector: "[data-static-final-action]";
    readonly keyboardFocusMethod: "Tab";
    readonly visible: boolean;
    readonly enabled: boolean;
    readonly focused: boolean;
    readonly focusVisible: boolean;
    readonly unobscured: boolean;
    readonly clicked: boolean;
    readonly beforeClick: number;
    readonly afterClick: number;
  };
  readonly network: {
    readonly sameOrigin: "SAME_ORIGIN_ALLOWED";
    readonly external: "EXTERNAL_NETWORK_FORBIDDEN";
    readonly sameOriginRequests: readonly string[];
    readonly externalRequests: readonly string[];
  };
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly failedRequests: readonly string[];
  readonly screenshots: {
    readonly fullPage: FileIdentity;
    readonly top: FileIdentity;
    readonly bottom: FileIdentity;
    readonly finalAction: FileIdentity;
  };
  readonly trace: FileIdentity;
  readonly evidenceFiles: readonly string[];
  readonly status: "PASS" | "FAIL";
}

export interface StaticMachineReportScrollEvidence {
  readonly schemaVersion: 1;
  readonly step: "07";
  readonly evidenceKind: "STATIC_MACHINE_REPORT_ADULT_TOOL_SCROLL";
  readonly generatedAtUtc: string;
  readonly sourceTreeSha256: string;
  readonly reportHtml: FileIdentity;
  readonly isolatedBrowserContexts: true;
  readonly networkPolicy: {
    readonly sameOrigin: "SAME_ORIGIN_ALLOWED";
    readonly external: "EXTERNAL_NETWORK_FORBIDDEN";
  };
  readonly coverage: {
    readonly expectedRowKeys: readonly string[];
    readonly actualRowKeys: readonly string[];
    readonly missingRowKeys: readonly string[];
    readonly unexpectedRowKeys: readonly string[];
  };
  readonly rows: readonly StaticReportScrollRow[];
  readonly evidenceFiles: readonly string[];
  readonly status: "PASS" | "FAIL";
  readonly machineOnlyConclusion: string;
}

const MACHINE_ONLY_CONCLUSION = "This static generated report uses isolated browser contexts and proves only its technical adult-tool scroll, reflow, focus, input, and network contract. It is not real-child evidence.";

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function relativeArtifactPath(workspaceRoot: string, absolutePath: string): string {
  return relative(workspaceRoot, absolutePath).replaceAll("\\", "/");
}

export function readFileIdentity(path: string, workspaceRoot = process.cwd()): FileIdentity {
  const absolute = isAbsolute(path) ? resolve(path) : resolve(workspaceRoot, path);
  if (!existsSync(absolute) || !statSync(absolute).isFile() || statSync(absolute).size === 0) {
    throw new Error(`Required non-empty evidence file is missing: ${path}`);
  }
  const buffer = readFileSync(absolute);
  return {
    path: relativeArtifactPath(workspaceRoot, absolute),
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
  };
}

function rowEvidenceFiles(row: StaticReportScrollRow): string[] {
  return uniqueSorted([
    row.screenshots.fullPage.path,
    row.screenshots.top.path,
    row.screenshots.bottom.path,
    row.screenshots.finalAction.path,
    row.trace.path,
  ]);
}

function expectedMethod(input: StaticReportScrollInput): StaticReportScrollInputTrace["method"] {
  if (input === "mouse-wheel") return "Playwright mouse.wheel";
  if (input === "PageDown") return "Playwright keyboard PageDown";
  if (input === "End") return "Playwright keyboard End";
  return "Chromium CDP Input.dispatchTouchEvent";
}

function rowStructurallyPasses(row: StaticReportScrollRow, contract: StaticReportScrollCase): boolean {
  const expectedInputs = contract.requiredInputs;
  const exactInputs = row.inputs.length === expectedInputs.length
    && row.inputs.every((input, index) => input.input === expectedInputs[index]
      && input.method === expectedMethod(input.input)
      && input.passed
      && input.after > input.before
      && input.maxScrollTop === row.maxScrollTop
      && (input.input !== "End" || input.after >= row.maxScrollTop - 2));
  const screenshotIdentities = Object.values(row.screenshots);
  return row.sourceTreeSha256.length === 64
    && row.reportHtmlSha256.length === 64
    && row.contextId === `static-report-${contract.project}-${contract.viewport}`
    && row.isolatedBrowserContext
    && row.project === contract.project
    && row.viewport === contract.viewport
    && row.width === contract.width
    && row.height === contract.height
    && row.hasTouch === contract.hasTouch
    && row.pageMode === "adult-tool-page"
    && row.htmlHasAdultToolClass
    && row.bodyHasAdultToolClass
    && row.scrollOwner === "document.documentElement"
    && row.maxScrollTop > 0
    && row.maxScrollTop === row.scrollHeight - row.clientHeight
    && row.horizontalOverflowPx <= 1
    && row.horizontalOverflowElements.length === 0
    && row.nestedVerticalScrollOwners.length === 0
    && exactInputs
    && row.finalAction.selector === "[data-static-final-action]"
    && row.finalAction.keyboardFocusMethod === "Tab"
    && row.finalAction.visible
    && row.finalAction.enabled
    && row.finalAction.focused
    && row.finalAction.focusVisible
    && row.finalAction.unobscured
    && row.finalAction.clicked
    && row.finalAction.beforeClick > 0
    && row.finalAction.afterClick <= 1
    && row.network.sameOrigin === "SAME_ORIGIN_ALLOWED"
    && row.network.external === "EXTERNAL_NETWORK_FORBIDDEN"
    && row.network.sameOriginRequests.length > 0
    && row.network.externalRequests.length === 0
    && row.consoleErrors.length === 0
    && row.pageErrors.length === 0
    && row.failedRequests.length === 0
    && screenshotIdentities.length === 4
    && new Set(screenshotIdentities.map((identity) => identity.path)).size === 4
    && new Set(screenshotIdentities.map((identity) => identity.sha256)).size === 4
    && row.trace.bytes > 0
    && row.trace.sha256.length === 64
    && JSON.stringify(row.evidenceFiles) === JSON.stringify(rowEvidenceFiles(row));
}

export function buildStaticMachineReportScrollEvidence(
  rows: readonly StaticReportScrollRow[],
  sourceTreeSha256: string,
  reportHtml: FileIdentity,
  generatedAtUtc = new Date().toISOString(),
): StaticMachineReportScrollEvidence {
  const expectedRowKeys = STATIC_MACHINE_REPORT_SCROLL_CASES.map((entry) => entry.key);
  const actualRowKeys = rows.map((row) => row.key);
  const actualSet = new Set(actualRowKeys);
  const expectedSet = new Set<string>(expectedRowKeys);
  const missingRowKeys = expectedRowKeys.filter((key) => !actualSet.has(key));
  const unexpectedRowKeys = actualRowKeys.filter((key) => !expectedSet.has(key));
  const duplicateRows = actualSet.size !== actualRowKeys.length;
  const structurallyPassing = !duplicateRows
    && rows.length === STATIC_MACHINE_REPORT_SCROLL_CASES.length
    && rows.every((row, index) => row.key === STATIC_MACHINE_REPORT_SCROLL_CASES[index].key
      && row.sourceTreeSha256 === sourceTreeSha256
      && row.reportHtmlSha256 === reportHtml.sha256
      && row.status === "PASS"
      && rowStructurallyPasses(row, STATIC_MACHINE_REPORT_SCROLL_CASES[index]));
  const evidenceFiles = uniqueSorted([
    reportHtml.path,
    ...rows.flatMap((row) => rowEvidenceFiles(row)),
  ]);
  return {
    schemaVersion: 1,
    step: "07",
    evidenceKind: "STATIC_MACHINE_REPORT_ADULT_TOOL_SCROLL",
    generatedAtUtc,
    sourceTreeSha256,
    reportHtml,
    isolatedBrowserContexts: true,
    networkPolicy: {
      sameOrigin: "SAME_ORIGIN_ALLOWED",
      external: "EXTERNAL_NETWORK_FORBIDDEN",
    },
    coverage: { expectedRowKeys, actualRowKeys, missingRowKeys, unexpectedRowKeys },
    rows: [...rows],
    evidenceFiles,
    status: sourceTreeSha256.length === 64
      && reportHtml.path === STATIC_MACHINE_REPORT_RELATIVE_PATH
      && reportHtml.bytes > 0
      && reportHtml.sha256.length === 64
      && missingRowKeys.length === 0
      && unexpectedRowKeys.length === 0
      && structurallyPassing
      ? "PASS"
      : "FAIL",
    machineOnlyConclusion: MACHINE_ONLY_CONCLUSION,
  };
}

function assertOutputFile(identity: FileIdentity, label: string, workspaceRoot: string): void {
  const outputRoot = resolve(workspaceRoot, "artifacts/game-machine-review/step-07");
  const absolute = isAbsolute(identity.path) ? resolve(identity.path) : resolve(workspaceRoot, identity.path);
  const outputRelative = relative(outputRoot, absolute);
  if (isAbsolute(outputRelative) || outputRelative === ".." || outputRelative.startsWith("../") || outputRelative.startsWith("..\\")) {
    throw new Error(`${label} escapes the STEP 07 output directory: ${identity.path}`);
  }
  const current = readFileIdentity(absolute, workspaceRoot);
  if (current.path !== identity.path || current.bytes !== identity.bytes || current.sha256 !== identity.sha256) {
    throw new Error(`${label} identity does not match the current file: ${identity.path}`);
  }
}

function assertAllowedLocalRequest(rawUrl: string, label: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label} is not a valid URL: ${rawUrl}`);
  }
  if (!(["http:", "ws:"] as const).includes(url.protocol as "http:" | "ws:")
    || url.hostname !== "127.0.0.1"
    || url.port !== "5175") {
    throw new Error(`${label} is not an allowed local request: ${rawUrl}`);
  }
}

export function validateStaticMachineReportScrollEvidence(
  report: StaticMachineReportScrollEvidence,
  workspaceRoot = process.cwd(),
  expectedSourceTreeSha256 = computeMachineReviewSourceTreeSha256(workspaceRoot),
): readonly string[] {
  const errors: string[] = [];
  const check = (condition: unknown, message: string): void => {
    if (!condition) errors.push(message);
  };
  check(report.schemaVersion === 1 && report.step === "07" && report.evidenceKind === "STATIC_MACHINE_REPORT_ADULT_TOOL_SCROLL", "static report evidence schema identity is invalid");
  check(report.sourceTreeSha256 === expectedSourceTreeSha256, "static report evidence source tree is stale");
  check(report.isolatedBrowserContexts === true, "static report evidence did not use isolated contexts");
  check(report.networkPolicy.sameOrigin === "SAME_ORIGIN_ALLOWED" && report.networkPolicy.external === "EXTERNAL_NETWORK_FORBIDDEN", "static report network policy drifted");
  check(report.machineOnlyConclusion === MACHINE_ONLY_CONCLUSION, "static report machine-only conclusion drifted");
  try {
    check(report.reportHtml.path === STATIC_MACHINE_REPORT_RELATIVE_PATH, "static report HTML path is not canonical");
    assertOutputFile(report.reportHtml, "static report HTML", workspaceRoot);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const expectedKeys = STATIC_MACHINE_REPORT_SCROLL_CASES.map((entry) => entry.key);
  const actualKeys = report.rows.map((row) => row.key);
  check(report.rows.length === STATIC_MACHINE_REPORT_SCROLL_CASES.length, "static report evidence must contain exactly five rows");
  check(new Set(actualKeys).size === actualKeys.length, "static report evidence contains duplicate rows");
  check(JSON.stringify(actualKeys) === JSON.stringify(expectedKeys), "static report rows do not match canonical order and coverage");

  for (const [index, contract] of STATIC_MACHINE_REPORT_SCROLL_CASES.entries()) {
    const row = report.rows[index];
    if (!row) continue;
    check(row.key === contract.key && rowStructurallyPasses(row, contract), `static report row ${index} does not prove its canonical contract`);
    check(row.sourceTreeSha256 === report.sourceTreeSha256, `static report row ${index} has stale source identity`);
    check(row.reportHtmlSha256 === report.reportHtml.sha256, `static report row ${index} has stale HTML identity`);
    try {
      const actualUrl = new URL(row.actualUrl);
      check(actualUrl.protocol === "http:" && actualUrl.hostname === "127.0.0.1" && actualUrl.port === "5175" && actualUrl.pathname === STATIC_MACHINE_REPORT_URL_PATH, `static report row ${index} did not navigate to the canonical Vite-served HTML`);
      check(actualUrl.searchParams.get("evidenceSha") === report.reportHtml.sha256, `static report row ${index} URL is not cache-bound to the HTML identity`);
    } catch {
      errors.push(`static report row ${index} actualUrl is invalid`);
    }
    for (const [requestIndex, request] of row.network.sameOriginRequests.entries()) {
      try {
        assertAllowedLocalRequest(request, `static report row ${index} sameOriginRequests[${requestIndex}]`);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    const identities = [
      row.screenshots.fullPage,
      row.screenshots.top,
      row.screenshots.bottom,
      row.screenshots.finalAction,
      row.trace,
    ];
    for (const [identityIndex, identity] of identities.entries()) {
      try {
        assertOutputFile(identity, `static report row ${index} evidence[${identityIndex}]`, workspaceRoot);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const rebuilt = buildStaticMachineReportScrollEvidence(report.rows, report.sourceTreeSha256, report.reportHtml, report.generatedAtUtc);
  check(JSON.stringify(report.coverage) === JSON.stringify(rebuilt.coverage), "static report coverage declaration is not canonical");
  check(JSON.stringify(report.evidenceFiles) === JSON.stringify(rebuilt.evidenceFiles), "static report evidenceFiles do not exactly match HTML, screenshots, and traces");
  check(report.status === rebuilt.status && report.status === "PASS", "static report scroll evidence is not PASS");
  return errors;
}
