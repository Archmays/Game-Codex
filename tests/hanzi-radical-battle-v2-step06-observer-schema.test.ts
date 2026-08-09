import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STEP06_EVENT_TYPES, STEP06_STOP_CODES } from "../apps/my-game-world/second-use/event-types";
import { validateStep06Observation } from "../apps/hanzi-v2-step06-observer/observation-schema";
import { createStep06Fixture } from "../tools/hanzi-v2-step06/step06-contract";

const root = resolve(import.meta.dirname, "..");
const schema = JSON.parse(readFileSync(resolve(root, "docs/hanzi-radical-battle-v2/step-06/04-SECOND-USE-OBSERVATION-SCHEMA.json"), "utf8"));

describe("Hanzi V2 STEP 06 observation schema", () => {
  it("is closed and contains all 17 required evidence layers", () => {
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toHaveLength(17);
    expect(schema.required).toEqual(expect.arrayContaining(["progressContinuity", "technicalEvents", "derivedActions", "observations", "interventions", "wellbeing", "completion", "privacyConfirmed"]));
    expect(schema.properties.evidenceKind.enum).toEqual(["REAL_CHILD_SECOND_USE", "SYNTHETIC_TOOLING_TEST_ONLY"]);
  });

  it("excludes same-session continuation and pins events and stop codes", () => {
    expect(schema.$defs.intervalBucket.enum).not.toContain("CONTINUOUS_SAME_SESSION");
    expect(schema.$defs.eventType.enum).toEqual(STEP06_EVENT_TYPES);
    expect(schema.$defs.stopCode.enum).toEqual(STEP06_STOP_CODES);
    expect(schema.$defs.technicalEvent.additionalProperties).toBe(false);
  });

  it("enforces the closed nested schema before browser export and FINISH", () => {
    const fixture = createStep06Fixture("0123456789abcdef0123456789abcdef01234567");
    expect(validateStep06Observation(fixture)).toBe(true);
    expect(validateStep06Observation({
      ...fixture,
      parentAuthorization: { ...fixture.parentAuthorization, inferredAuthorization: true },
    })).toBe(false);
  });
});
