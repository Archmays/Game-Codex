import { describe, expect, it } from "vitest";
import { FINAL_GOLDEN_MANIFEST, GOLDEN_ABILITIES, GOLDEN_BOSS_PHASES } from "../games/hanzi-radical-battle/v2/golden-slice/content";
import { STEP03_REVIEW_ITEMS, STEP03_REVIEW_TABS } from "../apps/hanzi-v2-step03-review/review-items";
import {
  ABILITY_DECISION_IDS,
  ASSET_DECISION_IDS,
  carryForwardReview,
  createReviewDraft,
  finalizeReviewDraft,
  isCurrentReviewDraft,
  missingReviewDecisions,
} from "../apps/hanzi-v2-step03-review/review-schema";

function completedDraft() {
  const draft = createReviewDraft();
  for (const item of draft.decisions.items) {
    item.decision = "ACCEPT";
    item.notes = `审核 ${item.itemId}`;
  }
  for (const character of draft.decisions.characters) {
    character.decision = "ACCEPT";
    character.notes = `审核 ${character.characterId}`;
  }
  for (const id of ABILITY_DECISION_IDS) draft.abilityDecisions[id] = "ACCEPT";
  for (const id of ASSET_DECISION_IDS) draft.assetDecisions[id] = "ACCEPT";
  draft.audioDecision = "ACCEPT CURRENT CANDIDATE";
  draft.authorizeChildFirstUse = "NOT_YET";
  draft.generalNotes = "技术候选可继续由家长审核；不推断儿童接受。";
  return finalizeReviewDraft(draft);
}

describe("Hanzi Radical Battle V2 STEP 03 parent review", () => {
  it("keeps the bounded manifest, independent formal decisions, and exact nine tabs explicit", () => {
    expect(FINAL_GOLDEN_MANIFEST).toHaveLength(12);
    expect(GOLDEN_ABILITIES).toHaveLength(3);
    expect(GOLDEN_BOSS_PHASES).toHaveLength(2);
    expect(STEP03_REVIEW_TABS.map((tab) => tab.id)).toEqual([
      "scope", "golden-slice", "manifest", "abilities", "boss", "assets", "audio", "child-gate", "summary",
    ]);
    expect(STEP03_REVIEW_ITEMS.map((item) => item.id)).toEqual([
      "slice-preview", "final-manifest", "encounter-structure", "ability-trio", "two-phase-boss", "theme-c", "audio-and-accessibility", "child-use-gate",
    ]);
  });

  it("requires individual character, ability, asset, audio, gate, and written feedback fields", () => {
    const draft = createReviewDraft();
    expect(isCurrentReviewDraft(draft)).toBe(true);
    expect(missingReviewDecisions(draft)).toEqual(expect.arrayContaining([
      "goldenSliceDecision",
      "characterDecisions.ming",
      "abilityDecisions.guardian-light",
      "assetDecisions.meaningMagic",
      "audioDecision",
      "authorizeChildFirstUse",
    ]));

    const finalized = completedDraft();
    expect(finalized.reviewMeta.completed).toBe(true);
    expect(finalized.reviewMeta.missingRequiredDecisionIds).toEqual([]);
    expect(finalized).toMatchObject({
      schemaVersion: 2,
      goldenSliceDecision: "ACCEPT",
      manifestDecision: "ACCEPT",
      abilityDecisions: { "guardian-light": "ACCEPT", "star-path": "ACCEPT", "ink-echo": "ACCEPT" },
      bossDecision: "ACCEPT",
      assetDecisions: { themeC: "ACCEPT", mage: "ACCEPT", meaningMagic: "ACCEPT" },
      audioDecision: "ACCEPT CURRENT CANDIDATE",
      authorizeChildFirstUse: "NOT_YET",
    });
  });

  it("carries only unchanged accepted generic and character records while always returning the child gate", () => {
    const carried = carryForwardReview(completedDraft());
    expect(carried).not.toBeNull();
    expect(carried!.round).toBe(2);
    expect(carried!.authorizeChildFirstUse).toBe("");
    expect(carried!.decisions.items.find((item) => item.itemId === "child-use-gate")).toMatchObject({ decision: "", carriedForward: false });
    expect(carried!.decisions.items.filter((item) => item.carriedForward)).toHaveLength(STEP03_REVIEW_ITEMS.length - 1);
    expect(carried!.decisions.characters.filter((character) => character.carriedForward)).toHaveLength(12);
  });

  it("retains eleven unchanged manifest characters when one prior character revision changed", () => {
    const prior = completedDraft();
    const changedCharacter = prior.decisions.characters.find((character) => character.characterId === "hua");
    if (!changedCharacter) throw new Error("Missing hua character record");
    changedCharacter.revisionHash = "fnv1a:00000000";

    const carried = carryForwardReview(prior);
    expect(carried).not.toBeNull();
    expect(carried!.decisions.characters.find((character) => character.characterId === "hua")).toMatchObject({ decision: "", carriedForward: false });
    expect(carried!.decisions.characters.filter((character) => character.carriedForward)).toHaveLength(11);
  });

  it("fails closed for incompatible identity, incomplete exports, and old schema", () => {
    const incompatible = completedDraft();
    (incompatible.goldenSliceIdentity as { previewRoute: string }).previewRoute = "?play=another-candidate";
    expect(carryForwardReview(incompatible)).toBeNull();

    const incomplete = createReviewDraft();
    expect(carryForwardReview(incomplete)).toBeNull();

    const oldSchema = completedDraft() as unknown as { schemaVersion: number };
    oldSchema.schemaVersion = 1;
    expect(carryForwardReview(oldSchema)).toBeNull();
  });
});
