import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  HANZI_RADICAL_COMBINATION_ENTRIES,
  combinationKey,
  getHanziRadicalCombination,
} from "../games/hanzi-radical-battle/game-data";
import { HANZI_RADICAL_FORMULA_AUDIT_ENTRIES } from "../games/hanzi-radical-battle/formula-audit";
import { HANZI_RADICAL_VISUAL_HINTS } from "../games/hanzi-radical-battle/visual-hints";
import {
  CANDIDATE_CHARACTERS,
  CANDIDATE_MANIFEST_VERSION,
  PILOT_ANCHOR,
  computeCandidateRevisionHash,
} from "../games/hanzi-radical-battle/v2/content/candidate-characters";
import { PILOT_SCENARIOS } from "../games/hanzi-radical-battle/v2/content/pilot-scenarios";
import {
  STEP02_STORYBOARD,
  STORYBOARD_MANIFEST_VERSION,
  computeStoryboardRevisionHash,
} from "../games/hanzi-radical-battle/v2/content/storyboard";
import { VISUAL_DIRECTIONS } from "../games/hanzi-radical-battle/v2/content/visual-directions";
import reviewIdentity from "../apps/hanzi-v2-step02-review/review-identity.json";
import { carryForwardReview, createReviewDraft } from "../apps/hanzi-v2-step02-review/review-schema";

const root = resolve(import.meta.dirname, "..");

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
  );
}

function subsets<T>(items: readonly T[], size: number, start = 0, picked: T[] = []): T[][] {
  if (picked.length === size) return [[...picked]];
  const result: T[][] = [];
  for (let index = start; index <= items.length - (size - picked.length); index += 1) {
    result.push(...subsets(items, size, index + 1, [...picked, items[index]]));
  }
  return result;
}

describe("Hanzi V2 STEP 02 content manifest", () => {
  it("anchors the pilot to the accepted mother-library combination for 明", () => {
    expect(PILOT_ANCHOR).toMatchObject({
      id: "ming",
      glyph: "明",
      structure: "left-right",
      sourceCombinationKey: "日月",
      pinyinReview: "pending-parent-review",
      etymologyClaim: null,
    });
    expect(PILOT_ANCHOR.components.map((part) => [part.glyph, part.slotId])).toEqual([
      ["日", "left"],
      ["月", "right"],
    ]);
    expect(getHanziRadicalCombination(["日", "月"])?.char).toBe("明");
    expect(HANZI_RADICAL_FORMULA_AUDIT_ENTRIES).toContainEqual(
      expect.objectContaining({ parts: ["日", "月"], status: "accepted" }),
    );
    expect(HANZI_RADICAL_VISUAL_HINTS["明"]).toMatchObject({ label: "明：明亮" });
  });

  it("contains exactly 15 traceable provisional candidates with the promised distributions", () => {
    expect(CANDIDATE_CHARACTERS).toHaveLength(15);
    expect(new Set(CANDIDATE_CHARACTERS.map((candidate) => candidate.id)).size).toBe(15);
    expect(CANDIDATE_CHARACTERS.filter((candidate) => candidate.familiarityBand === "high")).toHaveLength(9);
    expect(CANDIDATE_CHARACTERS.filter((candidate) => candidate.familiarityBand === "near")).toHaveLength(3);
    expect(CANDIDATE_CHARACTERS.filter((candidate) => candidate.familiarityBand === "new")).toHaveLength(3);
    expect(CANDIDATE_CHARACTERS.filter((candidate) => candidate.tier === "recommended")).toHaveLength(10);
    expect(CANDIDATE_CHARACTERS.filter((candidate) => candidate.tier === "conditional")).toHaveLength(3);
    expect(CANDIDATE_CHARACTERS.filter((candidate) => candidate.tier === "reserve")).toHaveLength(2);
    expect(CANDIDATE_CHARACTERS.filter((candidate) => candidate.recommendedForFinalManifest)).toHaveLength(10);
    expect(CANDIDATE_CHARACTERS.filter((candidate) => candidate.recommendedForFinalManifest).length).toBeLessThanOrEqual(12);
    expect(new Set(CANDIDATE_CHARACTERS.map((candidate) => candidate.structure))).toEqual(
      new Set(["left-right", "top-bottom", "full-enclosure", "semi-enclosure"]),
    );

    for (const candidate of CANDIDATE_CHARACTERS) {
      const glyphs = candidate.components.map((part) => part.glyph);
      expect(candidate.sourceOrderedParts).toEqual(glyphs);
      expect(combinationKey(glyphs)).toBe(candidate.sourceCombinationKey);
      const motherEntry = HANZI_RADICAL_COMBINATION_ENTRIES.find(
        (entry) => entry.result?.char.split("/").includes(candidate.glyph) && combinationKey(entry.parts) === candidate.sourceCombinationKey,
      );
      expect(motherEntry, candidate.glyph).toBeTruthy();
      expect(motherEntry?.parts, candidate.glyph).toEqual(candidate.sourceOrderedParts);
      expect(
        HANZI_RADICAL_FORMULA_AUDIT_ENTRIES.some(
          (entry) => entry.result.char.split("/").includes(candidate.glyph) && combinationKey(entry.parts) === candidate.sourceCombinationKey,
        ),
        candidate.glyph,
      ).toBe(true);
      expect(HANZI_RADICAL_VISUAL_HINTS[candidate.glyph], candidate.glyph).toBeTruthy();
      expect(existsSync(resolve(root, "public", candidate.sourceEvidence.visualAssetPath.slice(1))), candidate.glyph).toBe(true);
      expect(candidate.familiarityIsProvisional).toBe(true);
      expect(candidate.reviewStatus).toBe("pending");
      expect(candidate.pinyin.trim(), candidate.glyph).toBeTruthy();
      expect(candidate.familiarWord.trim(), candidate.glyph).toBeTruthy();
      expect(candidate.shortMeaning.trim(), candidate.glyph).toBeTruthy();
      expect(candidate.components.length, candidate.glyph).toBeGreaterThanOrEqual(2);
      expect(candidate.character).toBe(candidate.glyph);
      expect(candidate.simplifiedLocale).toBe("zh-Hans-CN");
      expect(candidate.childFitRationale).toContain("仍须家长");
      expect(candidate.magicConcept).toContain(candidate.glyph);
      expect(candidate.worldEffect).toContain(candidate.familiarWord);
      expect(candidate.visualHintPath).toBe(candidate.sourceEvidence.visualAssetPath);
      expect(candidate.visualHintVerified).toBe(true);
      expect(candidate.components.every((component) => component.slot === component.slotId)).toBe(true);
      expect(candidate.etymologyClaim).toBeNull();
      expect(candidate.revisionHash).toMatch(/^fnv1a:[0-9a-f]{8}$/);
    }
  });

  it("proves every five-card preview hand has only its intended two/three-part result", () => {
    for (const scenario of PILOT_SCENARIOS) {
      const matches = new Set<string>();
      const glyphs = scenario.cards.map((card) => card.glyph);
      for (const size of [2, 3]) {
        for (const subset of subsets(glyphs, size)) {
          for (const ordered of permutations(subset)) {
            const result = getHanziRadicalCombination(ordered);
            if (result) result.char.split("/").forEach((char) => matches.add(char));
          }
        }
      }
      const target = CANDIDATE_CHARACTERS.find((candidate) => candidate.id === scenario.characterId)?.glyph;
      expect([...matches], `${scenario.id}: ${[...matches].join(",")}`).toEqual([target]);
      expect(scenario.cards).toHaveLength(5);
      expect(scenario.noAlternativeTwoOrThreePartCombination).toBe(true);
    }
  });

  it("keeps visual review and storyboard content bounded", () => {
    expect(VISUAL_DIRECTIONS.map((theme) => theme.id)).toEqual(["A", "B", "C"]);
    expect(VISUAL_DIRECTIONS.every((theme) => theme.productionStatus === "procedural-review-direction-only")).toBe(true);
    expect(STEP02_STORYBOARD).toHaveLength(7);
    expect(new Set(STEP02_STORYBOARD.map((beat) => beat.id)).size).toBe(7);
  });

  it("binds revision hashes to full review payloads and invalidates dependent Round 2 items", () => {
    const { revisionHash, ...anchorPayload } = PILOT_ANCHOR;
    expect(computeCandidateRevisionHash({ ...anchorPayload, pinyin: "changed" })).not.toBe(revisionHash);
    expect(
      computeCandidateRevisionHash({ ...anchorPayload, ambiguityRisks: [...anchorPayload.ambiguityRisks, "changed"] }),
    ).not.toBe(revisionHash);

    const firstBattle = STEP02_STORYBOARD.find((beat) => beat.id === "story-first-battle")!;
    const { revisionHash: storyHash, ...storyPayload } = firstBattle;
    expect(computeStoryboardRevisionHash({ ...storyPayload, reviewQuestion: "changed" })).not.toBe(storyHash);

    const previous = createReviewDraft();
    previous.decisions.characters.forEach((item) => (item.decision = "ACCEPT"));
    previous.decisions.storyboard.forEach((item) => (item.decision = "ACCEPT"));
    previous.decisions.characters.find((item) => item.itemId === "ming")!.revisionHash = "fnv1a:00000000";
    const next = carryForwardReview(previous)!;
    expect(next.decisions.characters.find((item) => item.itemId === "ming")?.carriedForward).toBe(false);
    expect(next.decisions.storyboard.find((item) => item.itemId === "story-first-battle")?.carriedForward).toBe(false);
    expect(next.decisions.storyboard.find((item) => item.itemId === "story-camp")?.carriedForward).toBe(true);
    expect(next.reviewMeta.affectedItemIds).toEqual(
      expect.arrayContaining(["character:ming", "corePilot", "storyboard:story-first-battle"]),
    );

    expect(reviewIdentity.candidateManifestVersion).toBe(CANDIDATE_MANIFEST_VERSION);
    expect(reviewIdentity.storyboardManifestVersion).toBe(STORYBOARD_MANIFEST_VERSION);
    expect(reviewIdentity.characters).toEqual(
      CANDIDATE_CHARACTERS.map(({ id: itemId, revisionHash: hash }) => ({ itemId, revisionHash: hash })),
    );
    expect(reviewIdentity.storyboard).toEqual(
      STEP02_STORYBOARD.map(({ id: itemId, revisionHash: hash }) => ({ itemId, revisionHash: hash })),
    );
  });
});
