import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FIRST_USE_EVENT_TYPES, FIRST_USE_STOP_CODES } from "../games/hanzi-radical-battle/v2/golden-slice/first-use/event-types";

const root = resolve(import.meta.dirname, "..");
const schema = JSON.parse(readFileSync(resolve(root, "docs/hanzi-radical-battle-v2/step-04/04-FIRST-USE-OBSERVATION-SCHEMA.json"), "utf8"));

describe("Hanzi V2 STEP 04 observation schema", () => {
  it("is closed at the top level and contains every required evidence layer", () => {
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(expect.arrayContaining([
      "sessionIdentity", "buildIdentity", "parentAuthorization", "audioPreflight", "technicalEvents",
      "observations", "interventions", "wellbeing", "optionalChildChoices", "completion",
      "privacyConfirmed", "observerNotes",
    ]));
    expect(schema.properties.observerNotes.maxLength).toBe(1000);
    expect(schema.properties.privacyConfirmed.const).toBe(true);
    expect(schema.properties.evidenceKind.enum).toEqual(["REAL_CHILD_OBSERVATION", "SYNTHETIC_TOOLING_TEST_ONLY"]);
  });

  it("pins technical events, stop codes, intervention enums, and at most two formal runs", () => {
    expect(schema.$defs.eventType.enum).toEqual(FIRST_USE_EVENT_TYPES);
    expect(schema.$defs.stopCode.enum).toEqual(FIRST_USE_STOP_CODES);
    expect(schema.$defs.sessionIdentity.properties.runCount.maximum).toBe(2);
    expect(schema.$defs.intervention.properties.code.enum).toEqual(expect.arrayContaining([
      "NONE", "REPEAT_VISIBLE_COPY", "POINT_TO_REGION_ONLY", "TECHNICAL_ASSIST", "ADULT_ANSWER_REQUIRED", "STOPPED",
    ]));
    expect(schema.$defs.technicalEvent.additionalProperties).toBe(false);
  });

  it("has no schema field for profiles, media, exact voice, coordinates, raw keys, quotes, or scores", () => {
    const fieldNames = new Set<string>();
    const visit = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key === "properties" && child && typeof child === "object") Object.keys(child as object).forEach((name) => fieldNames.add(name));
        visit(child);
      }
    };
    visit(schema);
    for (const forbidden of ["name", "age", "school", "userAgent", "voiceName", "coordinates", "rawKey", "mediaPath", "childQuote", "score"]) {
      expect(fieldNames.has(forbidden), forbidden).toBe(false);
    }
  });
});
