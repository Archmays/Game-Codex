import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  normalizeFirstUseObservation,
  validateFirstUseObservationV1,
  validateFirstUseObservationV2,
} from "../apps/hanzi-v2-step04-observer/observation-schema";
import {
  V1_NOT_REACHED_NOTICE_WARNING,
  V1_REACH_NOTICE_SPLIT_WARNING,
  migrateFirstUseObservationV1ToV2,
} from "../apps/hanzi-v2-step04-observer/observation-migration";
import type { FirstUseObservationPackageV1 } from "../apps/hanzi-v2-step04-observer/observation-model";
import {
  SYNTHETIC_FIXTURE_LABEL,
  createSyntheticObservationV1Fixture,
} from "./fixtures/hanzi-v2-step05-observation-v1.synthetic";

const syntheticSessionId = `s04-${"e".repeat(32)}`;

describe("Hanzi V2 STEP 05 observation schema v1 to v2 migration", () => {
  it("validates v1, migrates without mutation, and validates canonical v2", () => {
    const source = createSyntheticObservationV1Fixture(syntheticSessionId);
    const before = JSON.stringify(source);
    expect(validateFirstUseObservationV1(source)).toEqual({ ok: true, errors: [] });

    const result = migrateFirstUseObservationV1ToV2(source);

    expect(JSON.stringify(source)).toBe(before);
    expect(result.value.schemaVersion).toBe(2);
    expect(result.value.fixtureLabel).toBe(SYNTHETIC_FIXTURE_LABEL);
    expect(validateFirstUseObservationV2(result.value)).toEqual({ ok: true, errors: [] });
    expect(result.warnings).toEqual(expect.arrayContaining([
      V1_REACH_NOTICE_SPLIT_WARNING,
      V1_NOT_REACHED_NOTICE_WARNING,
    ]));
  });

  it("derives reach from technical events while conservatively mapping v1 NOT_REACHED to UNRECORDED", () => {
    const result = migrateFirstUseObservationV1ToV2(createSyntheticObservationV1Fixture(syntheticSessionId));
    expect(result.value.observations.checkpointReach).toEqual({
      firstScreen: "REACHED",
      firstSpell: "REACHED",
      secondStructure: "REACHED",
      abilityChoice: "REACHED",
      bossIntent: "REACHED",
      safeFailure: "NOT_REACHED",
      campRepair: "REACHED",
      spellbook: "REACHED",
    });
    expect(new Set(Object.values(result.value.observations.checkpointNotice))).toEqual(new Set(["UNRECORDED"]));
  });

  it("preserves human fields and separates replay intent, observed request, and technical action", () => {
    const source = createSyntheticObservationV1Fixture(syntheticSessionId);
    const { value } = migrateFirstUseObservationV1ToV2(source);
    expect(value.observations.usability).toEqual(source.observations.usability);
    expect(value.observations.engagement).toEqual(source.observations.engagement);
    expect(value.observations.learningMechanismVisibility).toEqual(source.observations.learningMechanismVisibility);
    expect(value.wellbeing).toEqual(source.wellbeing);
    expect(value.optionalChildChoices).toEqual(source.optionalChildChoices);
    expect(value.replay).toEqual({
      replayIntent: "AGAIN_NOW",
      parentObservedReplayRequest: "OBSERVED",
      actualReplayAction: false,
    });
  });

  it("normalizes a v1 package once and leaves a validated v2 package canonical", () => {
    const v1 = createSyntheticObservationV1Fixture(syntheticSessionId);
    const first = normalizeFirstUseObservation(v1);
    const second = normalizeFirstUseObservation(first.value);
    expect(first.migrated).toBe(true);
    expect(second.migrated).toBe(false);
    expect(second.value).toEqual(first.value);
  });

  it("marks unreached checkpoints STOPPED_BEFORE when the session stops", () => {
    const source = createSyntheticObservationV1Fixture(syntheticSessionId);
    const stopped: FirstUseObservationPackageV1 = {
      ...source,
      technicalEvents: [
        ...source.technicalEvents.slice(0, 3),
        {
          schemaVersion: 1,
          sessionId: syntheticSessionId,
          sequence: 4,
          relativeMs: 500,
          eventType: "session_stopped",
          safeMetadata: { stopCode: "CHILD_REQUEST" },
        },
      ],
      completion: {
        childRouteLoaded: true,
        runCompleted: false,
        sessionStopped: true,
        relativeDurationMs: 500,
        runCount: 1,
        stopCode: "CHILD_REQUEST",
      },
      wellbeing: { ...source.wellbeing, stopCode: "CHILD_REQUEST" },
    };
    const { value } = migrateFirstUseObservationV1ToV2(stopped);
    expect(value.observations.checkpointReach.firstScreen).toBe("REACHED");
    expect(value.observations.checkpointReach.firstSpell).toBe("STOPPED_BEFORE");
    expect(value.observations.checkpointReach.spellbook).toBe("STOPPED_BEFORE");
  });

  it("keeps the committed fixture schema-only, de-identified, and free of a literal session token", () => {
    const fixtureSource = readFileSync(resolve(import.meta.dirname, "fixtures/hanzi-v2-step05-observation-v1.synthetic.ts"), "utf8");
    expect(fixtureSource).toContain("SYNTHETIC_FROM_SCHEMA_ONLY");
    expect(fixtureSource).not.toMatch(/s04-[a-f0-9]{32}/u);
    expect(fixtureSource).not.toMatch(/(?:姓名|学校|电话|邮箱|childQuote|voiceName|mediaPath)/u);
  });

  it("publishes a closed v2 machine schema with split checkpoint and replay fields", () => {
    const schema = JSON.parse(readFileSync(resolve(import.meta.dirname, "../docs/hanzi-radical-battle-v2/step-05/04-FIRST-USE-OBSERVATION-SCHEMA-V2.json"), "utf8"));
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.schemaVersion.const).toBe(2);
    expect(schema.$defs.observations.required).toEqual(expect.arrayContaining(["checkpointReach", "checkpointNotice"]));
    expect(schema.$defs.replay.required).toEqual(["replayIntent", "parentObservedReplayRequest", "actualReplayAction"]);
    expect(schema.properties.fixtureLabel.oneOf).toContainEqual({ const: "SYNTHETIC_FROM_SCHEMA_ONLY" });
  });
});
