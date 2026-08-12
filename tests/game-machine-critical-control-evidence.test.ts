import { describe, expect, it } from "vitest";
import {
  RUN_COMPLETE_CRITICAL_CONTROL_FIXTURE,
  RUN_COMPLETE_CRITICAL_CONTROL_ROUTE,
  RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS,
  RUN_COMPLETE_CRITICAL_CONTROL_STATE,
  validateCriticalControlEvidenceReport,
  type CriticalActivationCheck,
  type CriticalControlEvidenceReport,
  type CriticalControlRect,
} from "../tools/game-machine-review/critical-control-evidence";
import type { AbilityId } from "../games/hanzi-radical-battle/v2/golden-slice/content/types";

const SOURCE_TREE = "A".repeat(64);
const ABILITY_NAMES: Record<AbilityId, string> = {
  "guardian-light": "护字光",
  "star-path": "星光路标",
  "ink-echo": "墨点回声",
};
const ABILITY_IDS: readonly AbilityId[] = ["guardian-light", "star-path", "ink-echo"];

function controlsFor(selectedAbilityId: AbilityId): CriticalControlRect[] {
  const remaining = ABILITY_IDS.filter((abilityId) => abilityId !== selectedAbilityId);
  return [
    {
      selector: `[data-replay-ability="${remaining[0]}"]`, label: `${ABILITY_NAMES[remaining[0]]}再冒险`, kind: "REPLAY", abilityId: remaining[0],
      x: 40, y: 150, width: 240, height: 48, display: "block", visibility: "visible", pointerEvents: "auto",
    },
    {
      selector: `[data-replay-ability="${remaining[1]}"]`, label: `${ABILITY_NAMES[remaining[1]]}再冒险`, kind: "REPLAY", abilityId: remaining[1],
      x: 40, y: 208, width: 240, height: 48, display: "block", visibility: "visible", pointerEvents: "auto",
    },
    {
      selector: "[data-return-to-world]", label: "回我的游戏世界", kind: "RETURN", abilityId: null,
      x: 45, y: 280, width: 230, height: 54, display: "flex", visibility: "visible", pointerEvents: "auto",
    },
  ];
}

function activationFor(scenarioId: string, controls: readonly CriticalControlRect[]): CriticalActivationCheck {
  const plan = {
    "320x568--guardian-light": ["KEYBOARD_SPACE", "REPLAY_A"],
    "390x844--guardian-light": ["MOBILE_TOUCH", "REPLAY_A"],
    "390x844--star-path": ["MOBILE_TOUCH", "REPLAY_B"],
    "390x844--ink-echo": ["MOBILE_TOUCH", "RETURN"],
    "768x1024--guardian-light": ["KEYBOARD_ENTER", "RETURN"],
    "1440x900--guardian-light": ["DESKTOP_POINTER", "REPLAY_A"],
    "1440x900--star-path": ["DESKTOP_POINTER", "REPLAY_B"],
    "1440x900--ink-echo": ["DESKTOP_POINTER", "RETURN"],
  } as const;
  const [input, controlKind] = plan[scenarioId as keyof typeof plan];
  const control = controlKind === "REPLAY_A" ? controls[0] : controlKind === "REPLAY_B" ? controls[1] : controls[2];
  const isReplay = controlKind !== "RETURN";
  return {
    scenarioId,
    input,
    controlKind,
    controlSelector: control.selector,
    expectedAbilityId: control.abilityId,
    observedPhase: isReplay ? "boot" : null,
    observedSelectedAbilityId: isReplay ? control.abilityId : null,
    worldVisible: !isReplay,
    worldRepaired: !isReplay,
    replayActionObserved: isReplay,
    siblingAbilityActivated: false,
    completedRunsBefore: 1,
    completedRunsAfter: 1,
    status: "PASS",
  };
}

function validReport(): CriticalControlEvidenceReport {
  const scenarios = RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS.map((expected) => {
    const controls = controlsFor(expected.selectedAbilityId);
    return {
      scenarioId: expected.scenarioId,
      sourceTreeSha256: SOURCE_TREE,
      viewport: expected.viewport,
      viewportSize: { width: expected.width, height: expected.height },
      selectedAbilityId: expected.selectedAbilityId,
      cardRect: { x: 20, y: 80, width: 280, height: 300 },
      controls,
      sampledInteriorPoints: controls.flatMap((control) => (["center", "left", "right", "top", "bottom"] as const).map((sample) => ({
        controlSelector: control.selector,
        sample,
        x: control.x + control.width / 2,
        y: control.y + control.height / 2,
        owner: control.selector,
        ownedByControl: true,
      }))),
      pairwiseIntersections: [],
      occludedSamplePoints: [],
      minimumReplayGapPx: 10,
      replayToReturnClearancePx: 24,
      horizontalOverflowPx: 0,
      cardHorizontalOverflowPx: 0,
      screenshot: `artifacts/game-machine-review/step-07/critical-control/screenshots/run-complete-${expected.scenarioId}.png`,
      status: "PASS" as const,
    };
  });
  const activationChecks = scenarios.map((scenario) => activationFor(scenario.scenarioId, scenario.controls));
  const keyboardScenario = scenarios[0];
  return {
    schemaVersion: 1,
    recordType: "RUN_COMPLETE_CRITICAL_CONTROL_EVIDENCE",
    sourceTreeSha256: SOURCE_TREE,
    generatedAtUtc: "2026-08-12T00:00:00.000Z",
    fixtureClassification: RUN_COMPLETE_CRITICAL_CONTROL_FIXTURE,
    route: RUN_COMPLETE_CRITICAL_CONTROL_ROUTE,
    state: RUN_COMPLETE_CRITICAL_CONTROL_STATE,
    status: "PASS",
    scenarios,
    activationChecks,
    keyboardNavigation: [{
      scenarioId: keyboardScenario.scenarioId,
      tabOrder: keyboardScenario.controls.map((control) => control.selector),
      focusChecks: keyboardScenario.controls.map((control) => ({ selector: control.selector, focusVisible: true, focusRingContained: true, hitOwnershipPass: true })),
      status: "PASS",
    }],
    branchChecks: [
      { id: "ordinary-without-return-href", status: "PASS", detail: "Replay group only; no empty return row." },
      { id: "child-first-use", status: "PASS", detail: "Existing one-replay copy and no return control are preserved." },
    ],
    evidenceFiles: scenarios.map((scenario) => scenario.screenshot),
    summary: {
      scenarioCount: scenarios.length,
      passed: scenarios.length,
      failed: 0,
      pairwiseIntersectionCount: 0,
      occludedSamplePointCount: 0,
      activationCheckCount: activationChecks.length,
    },
  };
}

function mutableReport(): any {
  return JSON.parse(JSON.stringify(validReport()));
}

describe("run-complete critical-control evidence", () => {
  it("accepts a complete source-bound report", () => {
    expect(validateCriticalControlEvidenceReport(validReport(), SOURCE_TREE)).toEqual([]);
  });

  it("fails when any two controls overlap", () => {
    const report = mutableReport();
    report.scenarios[0].controls[1].y = 170;
    expect(validateCriticalControlEvidenceReport(report, SOURCE_TREE)).toContain("320x568--guardian-light: control rectangles intersect");
  });

  it("fails when an interior sample is occluded", () => {
    const report = mutableReport();
    report.scenarios[0].occludedSamplePoints.push("replay-a:center");
    report.scenarios[0].sampledInteriorPoints[0].ownedByControl = false;
    expect(validateCriticalControlEvidenceReport(report, SOURCE_TREE)).toContain("320x568--guardian-light: occluded sample points were recorded");
  });

  it("fails on the wrong source tree", () => {
    expect(validateCriticalControlEvidenceReport(validReport(), "B".repeat(64))).toContain("report source tree is stale");
  });

  it("fails when a required scenario is missing", () => {
    const report = mutableReport();
    report.scenarios.pop();
    expect(validateCriticalControlEvidenceReport(report, SOURCE_TREE)).toContain("missing scenario or unexpected scenario count");
  });
});
