import { CANONICAL_WHEEL_LIBRARY } from "../library/canonical-wheel-library";
import { PLAYABLE_WHEEL_MANIFEST, getWheelPool } from "../library/playable-wheel-manifest";
import type { WheelGradeSelection, WheelRoundState } from "../types";
import { hashWheelSeed, shuffleWheelItems } from "./wheel-rng";

// These positional forms are valid glyph components, but they belong on the
// left side of a character. The workshop's missing slot is always the second
// (right, bottom, or inner) slot, so they are structurally invalid distractors
// rather than alternative answers.
const POSITIONALLY_INCOMPATIBLE_PARTNERS = ["氵", "扌", "亻", "讠", "忄", "犭", "钅", "饣"] as const;

const APPROVED_PAIR_KEYS = new Set(CANONICAL_WHEEL_LIBRARY
  .filter((record) => record.sourceMode === "char" && (record.auditStatus === "validated" || record.auditStatus === "corrected-derived-record") && record.orderedComponents.length === 2)
  .map((record) => record.orderedComponents.join("|")));

export interface WheelRoundGenerationInput {
  readonly seed: string;
  readonly gradeId: WheelGradeSelection;
  readonly completedRoundCount: number;
  readonly sessionRecordIds: readonly string[];
  readonly recentRecordIds: readonly string[];
}

export function generateWheelRound(input: WheelRoundGenerationInput): WheelRoundState | null {
  const pool = getWheelPool(input.gradeId);
  if (!pool.length) return null;
  const unused = pool.filter((record) => !input.sessionRecordIds.includes(record.id));
  const notRecent = unused.filter((record) => !input.recentRecordIds.includes(record.id));
  const candidates = notRecent.length ? notRecent : unused.length ? unused : pool;
  const target = candidates[hashWheelSeed(`${input.seed}:round:${input.completedRoundCount}:target`) % candidates.length];
  const anchor = target.orderedComponents[0];
  const partner = target.orderedComponents[1];
  const distractors = shuffleWheelItems(POSITIONALLY_INCOMPATIBLE_PARTNERS.filter((glyph) =>
    candidateIsLegalDistractor(anchor, glyph, target.id)), `${input.seed}:round:${input.completedRoundCount}:distractors`).slice(0, 3);
  if (distractors.length !== 3) throw new Error(`Unable to generate three legal distractors for ${target.id}`);
  const cards = shuffleWheelItems([
    { glyph: partner, kind: "partner" as const, removedByHint: false },
    ...distractors.map((glyph) => ({ glyph, kind: "distractor" as const, removedByHint: false })),
  ], `${input.seed}:round:${input.completedRoundCount}:card-order`).map((card, index) => ({
    ...card,
    // IDs are deterministic interaction handles only. They deliberately do not
    // reveal the target record or whether a card is the answer in rendered DOM.
    id: `wheel-card-${index}-${hashWheelSeed(`${input.seed}:round:${input.completedRoundCount}:card:${index}`).toString(36)}`,
  }));
  const gradePool = getWheelPool(input.gradeId);
  const landingIndex = gradePool.findIndex((record) => record.id === target.id);
  const wheelRotationDegrees = 720 + (360 - ((landingIndex * 360) / gradePool.length));
  return {
    recordId: target.id,
    anchorComponentIndex: 0,
    partnerComponentIndex: 1,
    candidateCards: cards,
    selectedCardId: null,
    placed: false,
    landingIndex,
    wheelRotationDegrees,
  };
}

export function candidateIsLegalDistractor(anchor: string, candidate: string, targetRecordId: string): boolean {
  const target = PLAYABLE_WHEEL_MANIFEST.find((record) => record.id === targetRecordId);
  return Boolean(target)
    && candidate !== anchor
    && candidate !== target?.orderedComponents[1]
    && POSITIONALLY_INCOMPATIBLE_PARTNERS.includes(candidate as (typeof POSITIONALLY_INCOMPATIBLE_PARTNERS)[number])
    && !APPROVED_PAIR_KEYS.has(`${anchor}|${candidate}`);
}
