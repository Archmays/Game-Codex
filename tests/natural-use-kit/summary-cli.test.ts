import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  NATURAL_USE_EVIDENCE_TRIAGE_RULES,
  createObservationBundle,
  createObservationRecord,
  serializeObservationBundle,
  summarizeObservationBundle,
} from "../../packages/observation/natural-use";
import { summarizeObservationBundleFile } from "../../tools/natural-use/summarize-observation-bundle";
import { validateObservationBundleFile } from "../../tools/natural-use/validate-observation-bundle";

const temporary: string[] = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });

function observation(id: string, dateLocal: string, tag: "hesitated" | "technical-glitch") {
  return createObservationRecord({
    dateLocal,
    buildCommit: "8bf24d2e06dd93638cc75601601518d6e854e7f2",
    surfaceId: "math-world",
    moment: tag === "technical-glitch" ? "technical" : "during-play",
    tags: [tag],
    parentHelp: "light",
    outcome: tag === "technical-glitch" ? "blocked" : "continued",
  }, { id, today: "2026-08-22" });
}

describe("Natural-use validator, descriptive summarizer and 06B gate", () => {
  it("produces descriptive candidates without engagement, mastery, retention or a child profile", async () => {
    const bundle = await createObservationBundle([
      observation("friction-a", "2026-08-20", "hesitated"),
      observation("friction-b", "2026-08-22", "hesitated"),
      observation("technical-a", "2026-08-22", "technical-glitch"),
    ], "8bf24d2e06dd93638cc75601601518d6e854e7f2", new Date("2026-08-22T12:00:00.000Z"));
    const summary = summarizeObservationBundle(bundle);
    expect(summary.evidenceBoundary).toEqual(["DESCRIPTIVE_ONLY", "NOT_STATISTICAL_VALIDATION", "NOT_CHILD_PROFILE"]);
    expect(summary.repeatedFrictionCandidates).toEqual(expect.arrayContaining([expect.objectContaining({ surfaceId: "math-world", tag: "hesitated", count: 2, distinctDates: 2 })]));
    expect(summary.technicalBlockerCandidates).toEqual([expect.objectContaining({ tag: "technical-glitch", count: 1 })]);
    const text = JSON.stringify(summary).toLowerCase();
    expect(text).not.toMatch(/engagementscore|funscore|learningscore|masteryscore|retentionscore|childprofile/);

    const root = mkdtempSync(resolve(tmpdir(), "game-codex-observation-"));
    temporary.push(root);
    const input = resolve(root, "GAME_CODEX_NATURAL_USE_OBSERVATIONS_2026-08-22.json");
    const output = resolve(root, "OBSERVATION_SUMMARY.json");
    writeFileSync(input, serializeObservationBundle(bundle), "utf8");
    expect((await validateObservationBundleFile(input)).recordCount).toBe(3);
    await summarizeObservationBundleFile(input, output);
    expect(JSON.parse(readFileSync(output, "utf8"))).toEqual(summary);
  });

  it("keeps a single anecdote from triggering learning/content redesign", () => {
    expect(NATURAL_USE_EVIDENCE_TRIAGE_RULES.automaticProductChange).toBe(false);
    expect(NATURAL_USE_EVIDENCE_TRIAGE_RULES.uxFriction.minimumMatchingSurfaceAndFrictionObservations).toBe(2);
    expect(NATURAL_USE_EVIDENCE_TRIAGE_RULES.learningOrContentRedesign.oneOrTwoRecordsSufficient).toBe(false);
    expect(NATURAL_USE_EVIDENCE_TRIAGE_RULES.learningOrContentRedesign.requiresDomainCorrectnessReview).toBe(true);
    expect(NATURAL_USE_EVIDENCE_TRIAGE_RULES.preferenceAndReplay.engagementTarget).toBe(false);
  });
});
