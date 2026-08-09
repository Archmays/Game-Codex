import {
  STEP05_EVIDENCE_SHA256,
  STEP05_REVIEW_CANDIDATE_REVISION,
  STEP05_REVIEW_ITEMS,
  carryForwardStep05Feedback,
  createStep05ReviewDraft,
  finalizeStep05ReviewDraft,
  isStep05ParentReviewFeedback,
  missingStep05ReviewFields,
  parseStep05ReviewIdentity,
  type Step05ReviewDraft,
} from "../apps/hanzi-v2-step05-review";

const COMMIT = "a".repeat(40);
const REVISION = STEP05_REVIEW_CANDIDATE_REVISION;

function identity() {
  return { candidateCommit: COMMIT, evidenceSha256: STEP05_EVIDENCE_SHA256, candidateRevision: REVISION };
}

function completeDraft(): Step05ReviewDraft {
  const draft = createStep05ReviewDraft(identity());
  return {
    ...draft,
    decisions: draft.decisions.map((decision) => ({
      ...decision,
      decision: "ACCEPT" as const,
      notes: `家长 changed-only 记录：${decision.itemId}`,
    })),
    authorizeDefaultWorldEntry: "NO",
    authorizeSecondUseCheck: "NO",
    generalNotes: "本轮只确认变更项；两项后续授权均保持关闭。",
  };
}

describe("Hanzi V2 STEP 05 parent changed-only gate", () => {
  it("fails closed until four decisions, notes, and both authorizations exist", () => {
    const draft = createStep05ReviewDraft(identity());
    expect(draft.decisions).toHaveLength(4);
    expect(missingStep05ReviewFields(draft)).toEqual(expect.arrayContaining([
      "real-first-use-evidence.decision",
      "audio-context-regression.decision",
      "private-world-shell.decision",
      "world-navigation.decision",
      "authorizeDefaultWorldEntry",
      "authorizeSecondUseCheck",
    ]));
    expect(() => finalizeStep05ReviewDraft(draft)).toThrow(/incomplete/u);
  });

  it("exports a fixed, complete, identity-bound schema", () => {
    const feedback = finalizeStep05ReviewDraft(completeDraft(), new Date("2026-08-09T00:00:00.000Z"));
    expect(isStep05ParentReviewFeedback(feedback)).toBe(true);
    expect(feedback.identity).toEqual(identity());
    expect(feedback.reviewMeta).toEqual({ completed: true, exportedAtUtc: "2026-08-09T00:00:00.000Z", missingRequiredFieldIds: [] });
    expect(feedback.decisions.map((decision) => decision.itemId)).toEqual(STEP05_REVIEW_ITEMS.map((item) => item.id));
  });

  it("parses only the canonical evidence identity and rejects missing route identity", () => {
    expect(parseStep05ReviewIdentity(`commit=${COMMIT}&evidence=${STEP05_EVIDENCE_SHA256}&revision=${REVISION}`)).toMatchObject({ valid: true });
    expect(parseStep05ReviewIdentity("")).toMatchObject({ valid: false });
    expect(parseStep05ReviewIdentity(`commit=${COMMIT}&evidence=${"0".repeat(64)}&revision=${REVISION}`)).toMatchObject({ valid: false });
  });

  it("carries forward only exact accepted unaffected decisions and never authorizations", () => {
    const previous = finalizeStep05ReviewDraft(completeDraft());
    const round2 = carryForwardStep05Feedback(previous, identity(), ["audio-context-regression", "private-world-shell"]);
    const byId = Object.fromEntries(round2.decisions.map((decision) => [decision.itemId, decision]));
    expect(byId["real-first-use-evidence"]).toMatchObject({ decision: "ACCEPT", carriedForward: true });
    expect(byId["audio-context-regression"]).toMatchObject({ decision: "", carriedForward: false });
    expect(byId["private-world-shell"]).toMatchObject({ decision: "", carriedForward: false });
    expect(byId["world-navigation"]).toMatchObject({ decision: "", carriedForward: false });
    expect(round2.authorizeDefaultWorldEntry).toBe("");
    expect(round2.authorizeSecondUseCheck).toBe("");
    expect(round2.generalNotes).toBe("");
  });
});
