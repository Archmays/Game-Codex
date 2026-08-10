import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  STATIC_MACHINE_REPORT_RELATIVE_PATH,
  STATIC_MACHINE_REPORT_SCROLL_CASES,
  STATIC_MACHINE_REPORT_URL_PATH,
  buildStaticMachineReportScrollEvidence,
  readFileIdentity,
  validateStaticMachineReportScrollEvidence,
  type StaticReportScrollCase,
  type StaticReportScrollInputTrace,
  type StaticReportScrollRow,
} from "../tools/game-machine-review/static-report-scroll-evidence";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporaryWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "game-codex-static-report-"));
  temporaryRoots.push(root);
  mkdirSync(resolve(root, "artifacts/game-machine-review/step-07/screenshots/static-machine-report"), { recursive: true });
  mkdirSync(resolve(root, "artifacts/game-machine-review/step-07/traces/static-machine-report"), { recursive: true });
  writeFileSync(resolve(root, STATIC_MACHINE_REPORT_RELATIVE_PATH), "<!doctype html><html><body><button data-static-final-action>top</button></body></html>", "utf8");
  return root;
}

function method(input: StaticReportScrollCase["requiredInputs"][number]): StaticReportScrollInputTrace["method"] {
  if (input === "mouse-wheel") return "Playwright mouse.wheel";
  if (input === "PageDown") return "Playwright keyboard PageDown";
  if (input === "End") return "Playwright keyboard End";
  return "Chromium CDP Input.dispatchTouchEvent";
}

function passingRow(
  root: string,
  contract: StaticReportScrollCase,
  sourceTreeSha256: string,
  reportHtmlSha256: string,
  index: number,
): StaticReportScrollRow {
  const prefix = `artifacts/game-machine-review/step-07/screenshots/static-machine-report/case-${index}`;
  const screenshotPaths = {
    fullPage: `${prefix}-full-page.png`,
    top: `${prefix}-top.png`,
    bottom: `${prefix}-bottom.png`,
    finalAction: `${prefix}-final-action.png`,
  };
  for (const [kind, path] of Object.entries(screenshotPaths)) {
    writeFileSync(resolve(root, path), Buffer.from(`unique screenshot ${index} ${kind}`));
  }
  const tracePath = `artifacts/game-machine-review/step-07/traces/static-machine-report/case-${index}.zip`;
  writeFileSync(resolve(root, tracePath), Buffer.from(`unique trace ${index}`));
  const screenshots = {
    fullPage: readFileIdentity(screenshotPaths.fullPage, root),
    top: readFileIdentity(screenshotPaths.top, root),
    bottom: readFileIdentity(screenshotPaths.bottom, root),
    finalAction: readFileIdentity(screenshotPaths.finalAction, root),
  };
  const trace = readFileIdentity(tracePath, root);
  const inputs = contract.requiredInputs.map((input) => ({
    input,
    method: method(input),
    before: 0,
    after: input === "End" ? 1500 : 240,
    maxScrollTop: 1500,
    passed: true,
  }));
  const actualUrl = `http://127.0.0.1:5175${STATIC_MACHINE_REPORT_URL_PATH}?evidenceSha=${reportHtmlSha256}`;
  return {
    key: contract.key,
    sourceTreeSha256,
    reportHtmlSha256,
    contextId: `static-report-${contract.project}-${contract.viewport}`,
    isolatedBrowserContext: true,
    project: contract.project,
    viewport: contract.viewport,
    width: contract.width,
    height: contract.height,
    hasTouch: contract.hasTouch,
    actualUrl,
    pageMode: "adult-tool-page",
    htmlHasAdultToolClass: true,
    bodyHasAdultToolClass: true,
    scrollOwner: "document.documentElement",
    scrollHeight: 2068,
    clientHeight: 568,
    maxScrollTop: 1500,
    horizontalOverflowPx: 0,
    horizontalOverflowElements: [],
    nestedVerticalScrollOwners: [],
    inputs,
    finalAction: {
      selector: "[data-static-final-action]",
      keyboardFocusMethod: "Tab",
      visible: true,
      enabled: true,
      focused: true,
      focusVisible: true,
      unobscured: true,
      clicked: true,
      beforeClick: 1500,
      afterClick: 0,
    },
    network: {
      sameOrigin: "SAME_ORIGIN_ALLOWED",
      external: "EXTERNAL_NETWORK_FORBIDDEN",
      sameOriginRequests: [actualUrl, "ws://127.0.0.1:5175/"],
      externalRequests: [],
    },
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    screenshots,
    trace,
    evidenceFiles: [...Object.values(screenshots).map((identity) => identity.path), trace.path].sort(),
    status: "PASS",
  };
}

function passingFixture() {
  const root = temporaryWorkspace();
  const sourceTreeSha256 = "A".repeat(64);
  const reportHtml = readFileIdentity(STATIC_MACHINE_REPORT_RELATIVE_PATH, root);
  const rows = STATIC_MACHINE_REPORT_SCROLL_CASES.map((contract, index) => passingRow(
    root,
    contract,
    sourceTreeSha256,
    reportHtml.sha256,
    index,
  ));
  const report = buildStaticMachineReportScrollEvidence(rows, sourceTreeSha256, reportHtml, "2026-08-10T00:00:00.000Z");
  return { root, sourceTreeSha256, reportHtml, rows, report };
}

describe("STEP 07 generated static report scroll evidence", () => {
  it("accepts only the exact five-row, source-bound, current-file matrix", () => {
    const fixture = passingFixture();
    expect(fixture.report.status).toBe("PASS");
    expect(fixture.report.coverage.actualRowKeys).toEqual(STATIC_MACHINE_REPORT_SCROLL_CASES.map((entry) => entry.key));
    expect(validateStaticMachineReportScrollEvidence(fixture.report, fixture.root, fixture.sourceTreeSha256)).toEqual([]);
  });

  it("rejects duplicated coverage and a touch row without a real CDP swipe", () => {
    const fixture = passingFixture();
    const duplicatedRows = [fixture.rows[0], fixture.rows[0], ...fixture.rows.slice(2)];
    const duplicated = buildStaticMachineReportScrollEvidence(duplicatedRows, fixture.sourceTreeSha256, fixture.reportHtml);
    expect(duplicated.status).toBe("FAIL");
    expect(validateStaticMachineReportScrollEvidence(duplicated, fixture.root, fixture.sourceTreeSha256)).toContain("static report evidence contains duplicate rows");

    const touchIndex = STATIC_MACHINE_REPORT_SCROLL_CASES.findIndex((entry) => entry.hasTouch);
    const withoutSwipeRows = [...fixture.rows];
    withoutSwipeRows[touchIndex] = {
      ...withoutSwipeRows[touchIndex],
      inputs: withoutSwipeRows[touchIndex].inputs.filter((input) => input.input !== "touch-swipe"),
    };
    const withoutSwipe = buildStaticMachineReportScrollEvidence(withoutSwipeRows, fixture.sourceTreeSha256, fixture.reportHtml);
    expect(withoutSwipe.status).toBe("FAIL");
    expect(validateStaticMachineReportScrollEvidence(withoutSwipe, fixture.root, fixture.sourceTreeSha256)).toContain(`static report row ${touchIndex} does not prove its canonical contract`);
  });

  it("rejects a changed HTML byte identity and evidence outside the STEP 07 output", () => {
    const fixture = passingFixture();
    writeFileSync(resolve(fixture.root, STATIC_MACHINE_REPORT_RELATIVE_PATH), "changed after browser evidence", "utf8");
    expect(validateStaticMachineReportScrollEvidence(fixture.report, fixture.root, fixture.sourceTreeSha256)).toContain(`static report HTML identity does not match the current file: ${STATIC_MACHINE_REPORT_RELATIVE_PATH}`);

    const second = passingFixture();
    const outsidePath = resolve(second.root, "outside-trace.zip");
    writeFileSync(outsidePath, "outside", "utf8");
    const rows = [...second.rows];
    rows[0] = { ...rows[0], trace: readFileIdentity(outsidePath, second.root) };
    rows[0] = {
      ...rows[0],
      evidenceFiles: [...Object.values(rows[0].screenshots).map((identity) => identity.path), rows[0].trace.path].sort(),
    };
    const outside = buildStaticMachineReportScrollEvidence(rows, second.sourceTreeSha256, second.reportHtml);
    const errors = validateStaticMachineReportScrollEvidence(outside, second.root, second.sourceTreeSha256);
    expect(errors.some((error) => error.includes("escapes the STEP 07 output directory"))).toBe(true);
  });

  it("rejects non-distinct screenshots and a final control that was not clicked", () => {
    const fixture = passingFixture();
    const rows = [...fixture.rows];
    rows[0] = {
      ...rows[0],
      screenshots: { ...rows[0].screenshots, finalAction: rows[0].screenshots.bottom },
      finalAction: { ...rows[0].finalAction, clicked: false, afterClick: 1500 },
    };
    rows[0] = {
      ...rows[0],
      evidenceFiles: [...Object.values(rows[0].screenshots).map((identity) => identity.path), rows[0].trace.path].sort(),
    };
    const report = buildStaticMachineReportScrollEvidence(rows, fixture.sourceTreeSha256, fixture.reportHtml);
    expect(report.status).toBe("FAIL");
    expect(validateStaticMachineReportScrollEvidence(report, fixture.root, fixture.sourceTreeSha256)).toContain("static report row 0 does not prove its canonical contract");
  });
});
