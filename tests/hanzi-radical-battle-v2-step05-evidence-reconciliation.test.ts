import {
  PARENT_REPLAY_REQUEST_WITHOUT_ACTION_WARNING,
  REPLAY_INTENT_WITHOUT_ACTION_WARNING,
  deriveFirstUseTechnicalTimeline,
  reconcileFirstUseEvidence,
} from "../apps/hanzi-v2-step04-observer/evidence-reconciliation";
import { buildFirstUseSummaryMarkdown } from "../apps/hanzi-v2-step04-observer/export";
import {
  V1_REACH_NOTICE_SPLIT_WARNING,
  migrateFirstUseObservationV1ToV2,
} from "../apps/hanzi-v2-step04-observer/observation-migration";
import type { FirstUseObservationPackageV2 } from "../apps/hanzi-v2-step04-observer/observation-model";
import { createSyntheticObservationV1Fixture } from "./fixtures/hanzi-v2-step05-observation-v1.synthetic";

const syntheticSessionId = `s04-${"f".repeat(32)}`;

function migratedFixture(): FirstUseObservationPackageV2 {
  return migrateFirstUseObservationV1ToV2(createSyntheticObservationV1Fixture(syntheticSessionId)).value;
}

describe("Hanzi V2 STEP 05 evidence reconciliation", () => {
  it("derives the technical timeline without reading human observation fields", () => {
    const value = migratedFixture();
    const timeline = deriveFirstUseTechnicalTimeline(value.technicalEvents);
    expect(timeline.firstActionMs).toBe(100);
    expect(timeline.firstSpellMs).toBe(1_000);
    expect(timeline.spells).toEqual([
      { characterId: "ming", relativeMs: 1_000 },
      { characterId: "hua", relativeMs: 2_000 },
    ]);
    expect(timeline.ability).toEqual({ abilityId: "star-path", relativeMs: 3_000 });
    expect(timeline.bossPhases[0]).toEqual({ bossPhase: "lin", intentMs: 4_000, completedMs: null });
    expect(timeline.campRepairMs).toBe(5_000);
    expect(timeline.spellbookMs).toBe(6_000);
    expect(timeline.completionMs).toBe(7_000);
    expect(timeline.invalidPlacementCount).toBe(0);
    expect(timeline.replayEventCount).toBe(0);
  });

  it("emits explicit warnings when human replay intent/request has no technical replay action", () => {
    const value = migratedFixture();
    expect(value.replay).toEqual({
      replayIntent: "AGAIN_NOW",
      parentObservedReplayRequest: "OBSERVED",
      actualReplayAction: false,
    });
    expect(value.evidenceConsistencyWarnings).toEqual(expect.arrayContaining([
      REPLAY_INTENT_WITHOUT_ACTION_WARNING,
      PARENT_REPLAY_REQUEST_WITHOUT_ACTION_WARNING,
    ]));
  });

  it("allows only replay_selected technical evidence to set actualReplayAction", () => {
    const value = migratedFixture();
    const humanClaimOnly = reconcileFirstUseEvidence({
      ...value,
      replay: { ...value.replay, actualReplayAction: true },
    });
    expect(humanClaimOnly.replay.actualReplayAction).toBe(false);

    const replayed = reconcileFirstUseEvidence({
      ...value,
      sessionIdentity: { ...value.sessionIdentity, runCount: 2 },
      completion: { ...value.completion, runCount: 2 },
      technicalEvents: [
        ...value.technicalEvents,
        {
          schemaVersion: 1,
          sessionId: syntheticSessionId,
          sequence: 11,
          relativeMs: 7_100,
          eventType: "replay_selected",
          safeMetadata: { origin: "spontaneous", replayIndex: 1 },
        },
      ],
    });
    expect(replayed.replay.actualReplayAction).toBe(true);
    expect(replayed.evidenceConsistencyWarnings).toContain(V1_REACH_NOTICE_SPLIT_WARNING);
    expect(replayed.evidenceConsistencyWarnings).not.toContain(REPLAY_INTENT_WITHOUT_ACTION_WARNING);
    expect(replayed.evidenceConsistencyWarnings).not.toContain(PARENT_REPLAY_REQUEST_WITHOUT_ACTION_WARNING);
  });

  it("renders reach, replay reconciliation, consistency warnings, and non-conclusions separately", () => {
    const summary = buildFirstUseSummaryMarkdown(migratedFixture());
    expect(summary).toContain("Checkpoint reach (technical-derived, read-only)");
    expect(summary).toContain("Checkpoint notice (human observation)");
    expect(summary).toContain("## Replay reconciliation");
    expect(summary).toContain("replayIntent: AGAIN_NOW");
    expect(summary).toContain("parentObservedReplayRequest: OBSERVED");
    expect(summary).toContain("actualReplayAction: false");
    expect(summary).toContain("## Evidence consistency warnings");
    expect(summary).toContain(REPLAY_INTENT_WITHOUT_ACTION_WARNING);
    expect(summary).toContain("## Explicitly not concluded");
  });
});
