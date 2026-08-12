import { existsSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { AbilityId } from "../../games/hanzi-radical-battle/v2/golden-slice/content/types";

export const RUN_COMPLETE_CRITICAL_CONTROL_ROUTE = "?play=hanzi-v2-golden-slice&mode=play&from=world";
export const RUN_COMPLETE_CRITICAL_CONTROL_STATE = "run_complete";
export const RUN_COMPLETE_CRITICAL_CONTROL_FIXTURE = "SYNTHETIC_TOOLING_TEST_ONLY";

export const RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS = [
  { scenarioId: "320x568--guardian-light", viewport: "320x568", width: 320, height: 568, selectedAbilityId: "guardian-light" },
  { scenarioId: "390x844--guardian-light", viewport: "390x844", width: 390, height: 844, selectedAbilityId: "guardian-light" },
  { scenarioId: "390x844--star-path", viewport: "390x844", width: 390, height: 844, selectedAbilityId: "star-path" },
  { scenarioId: "390x844--ink-echo", viewport: "390x844", width: 390, height: 844, selectedAbilityId: "ink-echo" },
  { scenarioId: "768x1024--guardian-light", viewport: "768x1024", width: 768, height: 1024, selectedAbilityId: "guardian-light" },
  { scenarioId: "1440x900--guardian-light", viewport: "1440x900", width: 1440, height: 900, selectedAbilityId: "guardian-light" },
  { scenarioId: "1440x900--star-path", viewport: "1440x900", width: 1440, height: 900, selectedAbilityId: "star-path" },
  { scenarioId: "1440x900--ink-echo", viewport: "1440x900", width: 1440, height: 900, selectedAbilityId: "ink-echo" },
] as const satisfies readonly {
  readonly scenarioId: string;
  readonly viewport: string;
  readonly width: number;
  readonly height: number;
  readonly selectedAbilityId: AbilityId;
}[];

export interface CriticalControlRect {
  readonly selector: string;
  readonly label: string;
  readonly kind: "REPLAY" | "RETURN";
  readonly abilityId: AbilityId | null;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly display: string;
  readonly visibility: string;
  readonly pointerEvents: string;
}

export interface InteriorHitSample {
  readonly controlSelector: string;
  readonly sample: "center" | "left" | "right" | "top" | "bottom";
  readonly x: number;
  readonly y: number;
  readonly owner: string;
  readonly ownedByControl: boolean;
}

export interface CriticalControlScenarioResult {
  readonly scenarioId: string;
  readonly sourceTreeSha256: string;
  readonly viewport: string;
  readonly viewportSize: { readonly width: number; readonly height: number };
  readonly selectedAbilityId: AbilityId;
  readonly cardRect: Pick<CriticalControlRect, "x" | "y" | "width" | "height">;
  readonly controls: readonly CriticalControlRect[];
  readonly sampledInteriorPoints: readonly InteriorHitSample[];
  readonly pairwiseIntersections: readonly string[];
  readonly occludedSamplePoints: readonly string[];
  readonly minimumReplayGapPx: number;
  readonly replayToReturnClearancePx: number;
  readonly horizontalOverflowPx: number;
  readonly cardHorizontalOverflowPx: number;
  readonly screenshot: string;
  readonly status: "PASS" | "FAIL";
}

export type CriticalActivationInput = "DESKTOP_POINTER" | "MOBILE_TOUCH" | "KEYBOARD_SPACE" | "KEYBOARD_ENTER";
export type CriticalActivationControlKind = "REPLAY_A" | "REPLAY_B" | "RETURN";

export interface CriticalActivationCheck {
  readonly scenarioId: string;
  readonly input: CriticalActivationInput;
  readonly controlKind: CriticalActivationControlKind;
  readonly controlSelector: string;
  readonly expectedAbilityId: AbilityId | null;
  readonly observedPhase: string | null;
  readonly observedSelectedAbilityId: AbilityId | null;
  readonly worldVisible: boolean;
  readonly worldRepaired: boolean;
  readonly replayActionObserved: boolean;
  readonly siblingAbilityActivated: boolean;
  readonly completedRunsBefore: number;
  readonly completedRunsAfter: number;
  readonly status: "PASS" | "FAIL";
}

export interface KeyboardNavigationCheck {
  readonly scenarioId: string;
  readonly tabOrder: readonly string[];
  readonly focusChecks: readonly {
    readonly selector: string;
    readonly focusVisible: boolean;
    readonly focusRingContained: boolean;
    readonly hitOwnershipPass: boolean;
  }[];
  readonly status: "PASS" | "FAIL";
}

export interface CriticalControlEvidenceReport {
  readonly schemaVersion: 1;
  readonly recordType: "RUN_COMPLETE_CRITICAL_CONTROL_EVIDENCE";
  readonly sourceTreeSha256: string;
  readonly generatedAtUtc: string;
  readonly fixtureClassification: typeof RUN_COMPLETE_CRITICAL_CONTROL_FIXTURE;
  readonly route: typeof RUN_COMPLETE_CRITICAL_CONTROL_ROUTE;
  readonly state: typeof RUN_COMPLETE_CRITICAL_CONTROL_STATE;
  readonly status: "PASS" | "FAIL";
  readonly scenarios: readonly CriticalControlScenarioResult[];
  readonly activationChecks: readonly CriticalActivationCheck[];
  readonly keyboardNavigation: readonly KeyboardNavigationCheck[];
  readonly branchChecks: readonly {
    readonly id: "ordinary-without-return-href" | "child-first-use";
    readonly status: "PASS" | "FAIL";
    readonly detail: string;
  }[];
  readonly evidenceFiles: readonly string[];
  readonly summary: {
    readonly scenarioCount: number;
    readonly passed: number;
    readonly failed: number;
    readonly pairwiseIntersectionCount: number;
    readonly occludedSamplePointCount: number;
    readonly activationCheckCount: number;
  };
  readonly validationErrors?: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function right(rect: Pick<CriticalControlRect, "x" | "width">): number {
  return rect.x + rect.width;
}

function bottom(rect: Pick<CriticalControlRect, "y" | "height">): number {
  return rect.y + rect.height;
}

function intersectionArea(left: CriticalControlRect, rightControl: CriticalControlRect): number {
  const width = Math.max(0, Math.min(right(left), right(rightControl)) - Math.max(left.x, rightControl.x));
  const height = Math.max(0, Math.min(bottom(left), bottom(rightControl)) - Math.max(left.y, rightControl.y));
  return width * height;
}

function replayGap(left: CriticalControlRect, rightControl: CriticalControlRect): number {
  const horizontal = Math.max(0, Math.max(left.x, rightControl.x) - Math.min(right(left), right(rightControl)));
  const vertical = Math.max(0, Math.max(left.y, rightControl.y) - Math.min(bottom(left), bottom(rightControl)));
  return Math.max(horizontal, vertical);
}

function evidenceFileExists(path: string, workspaceRoot: string): boolean {
  const absolute = isAbsolute(path) ? path : resolve(workspaceRoot, path);
  return existsSync(absolute) && statSync(absolute).isFile() && statSync(absolute).size > 0;
}

export function validateCriticalControlEvidenceReport(
  value: unknown,
  expectedSourceTreeSha256: string,
  workspaceRoot?: string,
): string[] {
  const errors: string[] = [];
  const expectedSource = expectedSourceTreeSha256.toUpperCase();
  if (!isRecord(value)) return ["report must be an object"];
  if (value.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (value.recordType !== "RUN_COMPLETE_CRITICAL_CONTROL_EVIDENCE") errors.push("recordType is invalid");
  if (typeof value.sourceTreeSha256 !== "string" || value.sourceTreeSha256.toUpperCase() !== expectedSource) errors.push("report source tree is stale");
  if (typeof value.generatedAtUtc !== "string" || Number.isNaN(Date.parse(value.generatedAtUtc))) errors.push("generatedAtUtc is invalid");
  if (value.fixtureClassification !== RUN_COMPLETE_CRITICAL_CONTROL_FIXTURE) errors.push("fixture classification is invalid");
  if (value.route !== RUN_COMPLETE_CRITICAL_CONTROL_ROUTE) errors.push("route is invalid");
  if (value.state !== RUN_COMPLETE_CRITICAL_CONTROL_STATE) errors.push("state is invalid");
  if (value.status !== "PASS") errors.push("report status must be PASS");

  const scenarios = Array.isArray(value.scenarios) ? value.scenarios : [];
  if (scenarios.length !== RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS.length) errors.push("missing scenario or unexpected scenario count");
  const scenarioIds = scenarios.map((scenario) => isRecord(scenario) ? scenario.scenarioId : null);
  if (new Set(scenarioIds).size !== scenarioIds.length) errors.push("scenario ids must be unique");

  for (const expected of RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS) {
    const raw = scenarios.find((scenario) => isRecord(scenario) && scenario.scenarioId === expected.scenarioId);
    if (!isRecord(raw)) {
      errors.push(`${expected.scenarioId}: missing scenario`);
      continue;
    }
    if (typeof raw.sourceTreeSha256 !== "string" || raw.sourceTreeSha256.toUpperCase() !== expectedSource) errors.push(`${expected.scenarioId}: source tree is stale`);
    if (raw.viewport !== expected.viewport || !isRecord(raw.viewportSize) || raw.viewportSize.width !== expected.width || raw.viewportSize.height !== expected.height) errors.push(`${expected.scenarioId}: viewport is invalid`);
    if (raw.selectedAbilityId !== expected.selectedAbilityId) errors.push(`${expected.scenarioId}: selected ability is invalid`);
    if (raw.status !== "PASS") errors.push(`${expected.scenarioId}: status must be PASS`);
    if (!isRecord(raw.cardRect) || !finite(raw.cardRect.x) || !finite(raw.cardRect.y) || !finite(raw.cardRect.width) || !finite(raw.cardRect.height)) {
      errors.push(`${expected.scenarioId}: card rectangle is invalid`);
      continue;
    }
    const controls = Array.isArray(raw.controls) ? raw.controls.filter(isRecord) as unknown as CriticalControlRect[] : [];
    const replayControls = controls.filter((control) => control.kind === "REPLAY");
    const returnControls = controls.filter((control) => control.kind === "RETURN");
    if (controls.length !== 3 || replayControls.length !== 2 || returnControls.length !== 1) errors.push(`${expected.scenarioId}: expected exactly two replay controls and one return control`);
    if (new Set(controls.map((control) => control.selector)).size !== controls.length) errors.push(`${expected.scenarioId}: control selectors must be unique`);
    for (const control of controls) {
      if (!finite(control.x) || !finite(control.y) || !finite(control.width) || !finite(control.height)) {
        errors.push(`${expected.scenarioId}: ${control.selector} rectangle is invalid`);
        continue;
      }
      if (control.width < 44 || control.height < 44) errors.push(`${expected.scenarioId}: ${control.selector} is smaller than 44px`);
      if (control.display === "none" || control.visibility === "hidden" || control.pointerEvents === "none") errors.push(`${expected.scenarioId}: ${control.selector} is not interactable`);
      if (control.x < -0.5 || control.y < -0.5 || right(control) > expected.width + 0.5 || bottom(control) > expected.height + 0.5) errors.push(`${expected.scenarioId}: ${control.selector} escapes the viewport`);
      if (control.x < (raw.cardRect.x as number) - 0.5 || control.y < (raw.cardRect.y as number) - 0.5 || right(control) > (raw.cardRect.x as number) + (raw.cardRect.width as number) + 0.5 || bottom(control) > (raw.cardRect.y as number) + (raw.cardRect.height as number) + 0.5) errors.push(`${expected.scenarioId}: ${control.selector} escapes the completion card`);
    }
    for (let leftIndex = 0; leftIndex < controls.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < controls.length; rightIndex += 1) {
        if (intersectionArea(controls[leftIndex], controls[rightIndex]) > 0) errors.push(`${expected.scenarioId}: control rectangles intersect`);
      }
    }
    if (!Array.isArray(raw.pairwiseIntersections) || raw.pairwiseIntersections.length > 0) errors.push(`${expected.scenarioId}: pairwise intersections were recorded`);
    if (!Array.isArray(raw.occludedSamplePoints) || raw.occludedSamplePoints.length > 0) errors.push(`${expected.scenarioId}: occluded sample points were recorded`);
    const samples = Array.isArray(raw.sampledInteriorPoints) ? raw.sampledInteriorPoints.filter(isRecord) : [];
    if (samples.length !== 15 || samples.some((sample) => sample.ownedByControl !== true)) errors.push(`${expected.scenarioId}: interior hit ownership is incomplete`);
    const measuredReplayGap = replayControls.length === 2 ? replayGap(replayControls[0], replayControls[1]) : -1;
    if (!finite(raw.minimumReplayGapPx) || raw.minimumReplayGapPx < 8 || measuredReplayGap < 8) errors.push(`${expected.scenarioId}: replay gap is below 8px`);
    const measuredClearance = replayControls.length === 2 && returnControls.length === 1
      ? returnControls[0].y - Math.max(bottom(replayControls[0]), bottom(replayControls[1]))
      : -1;
    if (!finite(raw.replayToReturnClearancePx) || raw.replayToReturnClearancePx < 12 || measuredClearance < 12) errors.push(`${expected.scenarioId}: replay-to-return clearance is below 12px`);
    if (!finite(raw.horizontalOverflowPx) || raw.horizontalOverflowPx > 1 || !finite(raw.cardHorizontalOverflowPx) || raw.cardHorizontalOverflowPx > 1) errors.push(`${expected.scenarioId}: horizontal overflow exceeds 1px`);
    if (typeof raw.screenshot !== "string" || !raw.screenshot.trim()) errors.push(`${expected.scenarioId}: screenshot is missing`);
    else if (workspaceRoot && !evidenceFileExists(raw.screenshot, workspaceRoot)) errors.push(`${expected.scenarioId}: screenshot file is missing`);
  }

  const activationChecks = Array.isArray(value.activationChecks) ? value.activationChecks.filter(isRecord) : [];
  if (activationChecks.length !== RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS.length) errors.push("activation matrix must contain eight checks");
  if (new Set(activationChecks.map((check) => check.scenarioId)).size !== activationChecks.length) errors.push("activation scenario ids must be unique");
  if (activationChecks.some((check) => check.status !== "PASS" || check.siblingAbilityActivated !== false)) errors.push("activation ownership must pass without sibling activation");
  const kindsFor = (input: CriticalActivationInput) => new Set(activationChecks.filter((check) => check.input === input).map((check) => check.controlKind));
  for (const input of ["DESKTOP_POINTER", "MOBILE_TOUCH"] as const) {
    const kinds = kindsFor(input);
    if (!["REPLAY_A", "REPLAY_B", "RETURN"].every((kind) => kinds.has(kind))) errors.push(`${input}: replay A, replay B, and return coverage is required`);
  }
  if (!activationChecks.some((check) => check.input === "KEYBOARD_SPACE" && typeof check.controlKind === "string" && check.controlKind.startsWith("REPLAY"))) errors.push("keyboard Space replay activation is missing");
  if (!activationChecks.some((check) => check.input === "KEYBOARD_ENTER" && check.controlKind === "RETURN")) errors.push("keyboard Enter return activation is missing");

  const keyboardNavigation = Array.isArray(value.keyboardNavigation) ? value.keyboardNavigation.filter(isRecord) : [];
  if (keyboardNavigation.length < 1 || keyboardNavigation.some((check) => check.status !== "PASS")) errors.push("keyboard navigation evidence must pass");
  for (const check of keyboardNavigation) {
    if (!Array.isArray(check.tabOrder) || check.tabOrder.length !== 3) errors.push("keyboard tab order must contain three controls");
    const focusChecks = Array.isArray(check.focusChecks) ? check.focusChecks.filter(isRecord) : [];
    if (focusChecks.length !== 3 || focusChecks.some((focus) => focus.focusVisible !== true || focus.focusRingContained !== true || focus.hitOwnershipPass !== true)) errors.push("keyboard focus proof is incomplete");
  }

  const branchChecks = Array.isArray(value.branchChecks) ? value.branchChecks.filter(isRecord) : [];
  for (const id of ["ordinary-without-return-href", "child-first-use"] as const) {
    if (!branchChecks.some((check) => check.id === id && check.status === "PASS")) errors.push(`${id}: branch protection is missing`);
  }

  if (!isRecord(value.summary)) errors.push("summary is missing");
  else {
    if (value.summary.scenarioCount !== RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS.length || value.summary.passed !== RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS.length || value.summary.failed !== 0) errors.push("summary scenario totals are invalid");
    if (value.summary.pairwiseIntersectionCount !== 0 || value.summary.occludedSamplePointCount !== 0) errors.push("summary geometry failures must be zero");
    if (value.summary.activationCheckCount !== RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS.length) errors.push("summary activation count is invalid");
  }
  const evidenceFiles = Array.isArray(value.evidenceFiles) ? value.evidenceFiles.filter((path): path is string => typeof path === "string" && path.trim().length > 0) : [];
  if (evidenceFiles.length < RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS.length) errors.push("evidenceFiles must include every responsive screenshot");
  if (workspaceRoot) {
    for (const path of evidenceFiles) if (!evidenceFileExists(path, workspaceRoot)) errors.push(`evidence file is missing: ${path}`);
  }
  return [...new Set(errors)];
}
