import { FINAL_GOLDEN_MANIFEST } from "../../games/hanzi-radical-battle/v2/golden-slice/content";
import { STEP03_REVIEW_IDENTITY } from "./review-identity";
import { STEP03_REVIEW_ITEMS, type Step03ReviewItemId } from "./review-items";

export const REVIEW_FILE_NAME = "STEP-03_PARENT_REVIEW_FEEDBACK.json";
export const REVIEW_DRAFT_KEY = "family-games/hanzi-radical-battle-v2-step03-review/draft";

export type ReviewDecision = "" | "ACCEPT" | "REVISE" | "REJECT";
export type AudioDecision = "" | "ACCEPT CURRENT CANDIDATE" | "NEED RECORDED AUDIO" | "REVISE" | "REJECT";
export type ChildUseDecision = "" | "YES" | "NO" | "NOT_YET";

export const ABILITY_DECISION_IDS = ["guardian-light", "star-path", "ink-echo"] as const;
export const ASSET_DECISION_IDS = ["themeC", "mage", "companion", "commonMonster", "boss", "camp", "abilityCards", "meaningMagic"] as const;
export const CHARACTER_DECISION_IDS = FINAL_GOLDEN_MANIFEST.map((character) => character.id) as readonly string[];
export const REQUIRED_REVIEW_FIELD_COUNT = (STEP03_REVIEW_ITEMS.length * 2) + (CHARACTER_DECISION_IDS.length * 2)
  + ABILITY_DECISION_IDS.length + ASSET_DECISION_IDS.length + 2;

export type AbilityDecisionId = typeof ABILITY_DECISION_IDS[number];
export type AssetDecisionId = typeof ASSET_DECISION_IDS[number];
export type AbilityDecisions = Record<AbilityDecisionId, ReviewDecision>;
export type AssetDecisions = Record<AssetDecisionId, ReviewDecision>;

export interface Step03ReviewDecision {
  itemId: Step03ReviewItemId;
  revisionHash: string;
  decision: ReviewDecision;
  notes: string;
  carriedForward: boolean;
}

export interface Step03CharacterReviewDecision {
  characterId: string;
  revisionHash: string;
  decision: ReviewDecision;
  notes: string;
  carriedForward: boolean;
}

export interface Step03ReviewDraft {
  schemaVersion: 2;
  initiativeId: "hanzi-radical-battle-v2";
  round: number;
  goldenSliceIdentity: typeof STEP03_REVIEW_IDENTITY;
  goldenSliceDecision: ReviewDecision;
  manifestDecision: ReviewDecision;
  abilityDecisions: AbilityDecisions;
  bossDecision: ReviewDecision;
  assetDecisions: AssetDecisions;
  audioDecision: AudioDecision;
  authorizeChildFirstUse: ChildUseDecision;
  generalNotes: string;
  decisions: {
    items: Step03ReviewDecision[];
    characters: Step03CharacterReviewDecision[];
  };
  reviewMeta: {
    technicalState: "GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW";
    completed: boolean;
    missingRequiredDecisionIds: string[];
    importedRound: number | null;
    affectedItemIds: string[];
  };
}

function emptyAbilityDecisions(): AbilityDecisions {
  return { "guardian-light": "", "star-path": "", "ink-echo": "" };
}

function emptyAssetDecisions(): AssetDecisions {
  return { themeC: "", mage: "", companion: "", commonMonster: "", boss: "", camp: "", abilityCards: "", meaningMagic: "" };
}

function cloneIdentity(): typeof STEP03_REVIEW_IDENTITY {
  return { ...STEP03_REVIEW_IDENTITY, sourceSnapshots: { ...STEP03_REVIEW_IDENTITY.sourceSnapshots } };
}

function createDecision(itemId: Step03ReviewItemId): Step03ReviewDecision {
  const item = STEP03_REVIEW_ITEMS.find((entry) => entry.id === itemId);
  if (!item) throw new Error(`Unknown STEP 03 review item: ${itemId}`);
  return { itemId, revisionHash: item.revisionHash, decision: "", notes: "", carriedForward: false };
}

function createCharacterDecision(characterId: string): Step03CharacterReviewDecision {
  const character = FINAL_GOLDEN_MANIFEST.find((entry) => entry.id === characterId);
  if (!character) throw new Error(`Unknown STEP 03 manifest character: ${characterId}`);
  return { characterId, revisionHash: character.revisionHash, decision: "", notes: "", carriedForward: false };
}

export function createReviewDraft(): Step03ReviewDraft {
  return {
    schemaVersion: 2,
    initiativeId: "hanzi-radical-battle-v2",
    round: 1,
    goldenSliceIdentity: cloneIdentity(),
    goldenSliceDecision: "",
    manifestDecision: "",
    abilityDecisions: emptyAbilityDecisions(),
    bossDecision: "",
    assetDecisions: emptyAssetDecisions(),
    audioDecision: "",
    authorizeChildFirstUse: "",
    generalNotes: "",
    decisions: {
      items: STEP03_REVIEW_ITEMS.map((item) => createDecision(item.id)),
      characters: CHARACTER_DECISION_IDS.map(createCharacterDecision),
    },
    reviewMeta: {
      technicalState: "GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW",
      completed: false,
      missingRequiredDecisionIds: [],
      importedRound: null,
      affectedItemIds: [],
    },
  };
}

function decisionValue(draft: Step03ReviewDraft, itemId: Step03ReviewItemId): ReviewDecision {
  return draft.decisions.items.find((item) => item.itemId === itemId)?.decision ?? "";
}

export function aggregateReviewDecision(decisions: readonly ReviewDecision[]): ReviewDecision {
  if (!decisions.length || decisions.some((decision) => !decision)) return "";
  if (decisions.some((decision) => decision === "REJECT")) return "REJECT";
  if (decisions.some((decision) => decision === "REVISE")) return "REVISE";
  return "ACCEPT";
}

export function audioDecisionToReviewDecision(audioDecision: AudioDecision): ReviewDecision {
  if (audioDecision === "ACCEPT CURRENT CANDIDATE") return "ACCEPT";
  if (audioDecision === "REJECT") return "REJECT";
  if (audioDecision === "NEED RECORDED AUDIO" || audioDecision === "REVISE") return "REVISE";
  return "";
}

/** Fixed top-level fields are the formal parent/observer interchange contract. */
export function synchronizeFormalFields(draft: Step03ReviewDraft): Step03ReviewDraft {
  return {
    ...draft,
    goldenSliceDecision: decisionValue(draft, "slice-preview"),
    manifestDecision: aggregateReviewDecision(draft.decisions.characters.map((character) => character.decision)),
    abilityDecisions: { ...draft.abilityDecisions },
    bossDecision: decisionValue(draft, "two-phase-boss"),
    assetDecisions: { ...draft.assetDecisions },
    audioDecision: draft.audioDecision,
    decisions: {
      ...draft.decisions,
      items: draft.decisions.items.map((item) => {
        if (item.itemId === "final-manifest") return { ...item, decision: aggregateReviewDecision(draft.decisions.characters.map((character) => character.decision)) };
        if (item.itemId === "ability-trio") return { ...item, decision: aggregateReviewDecision(ABILITY_DECISION_IDS.map((id) => draft.abilityDecisions[id])) };
        if (item.itemId === "theme-c") return { ...item, decision: aggregateReviewDecision(ASSET_DECISION_IDS.map((id) => draft.assetDecisions[id])) };
        if (item.itemId === "audio-and-accessibility") return { ...item, decision: audioDecisionToReviewDecision(draft.audioDecision) };
        return item;
      }),
    },
  };
}

export function missingReviewDecisions(draft: Step03ReviewDraft): string[] {
  const normalized = synchronizeFormalFields(draft);
  const missing: string[] = [];
  for (const item of normalized.decisions.items) {
    if (!item.decision) {
      const formalId: Partial<Record<Step03ReviewItemId, string>> = {
        "slice-preview": "goldenSliceDecision",
        "final-manifest": "manifestDecision",
        "two-phase-boss": "bossDecision",
        "audio-and-accessibility": "audioDecision",
      };
      missing.push(formalId[item.itemId] ?? `item:${item.itemId}`);
    }
    if (!item.notes.trim()) missing.push(`notes:${item.itemId}`);
  }
  for (const character of normalized.decisions.characters) {
    if (!character.decision) missing.push(`characterDecisions.${character.characterId}`);
    if (!character.notes.trim()) missing.push(`notes:character:${character.characterId}`);
  }
  for (const id of ABILITY_DECISION_IDS) if (!normalized.abilityDecisions[id]) missing.push(`abilityDecisions.${id}`);
  for (const id of ASSET_DECISION_IDS) if (!normalized.assetDecisions[id]) missing.push(`assetDecisions.${id}`);
  if (!normalized.authorizeChildFirstUse) missing.push("authorizeChildFirstUse");
  if (!normalized.generalNotes.trim()) missing.push("generalNotes");
  return [...new Set(missing)];
}

export function finalizeReviewDraft(draft: Step03ReviewDraft): Step03ReviewDraft {
  const normalized = synchronizeFormalFields(draft);
  const missingRequiredDecisionIds = missingReviewDecisions(normalized);
  return {
    ...normalized,
    goldenSliceIdentity: cloneIdentity(),
    reviewMeta: {
      ...normalized.reviewMeta,
      technicalState: "GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW",
      completed: missingRequiredDecisionIds.length === 0,
      missingRequiredDecisionIds,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  if (typeof left !== typeof right) return false;
  if (left === null || right === null || typeof left !== "object") return Object.is(left, right);
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((entry, index) => sameJson(entry, right[index]));
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && sameJson(leftRecord[key], rightRecord[key]));
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isReviewDecision(value: unknown): value is ReviewDecision {
  return value === "" || value === "ACCEPT" || value === "REVISE" || value === "REJECT";
}

function hasItemShape(items: unknown, currentOnly: boolean): items is Array<Record<string, unknown>> {
  if (!Array.isArray(items) || items.length !== STEP03_REVIEW_ITEMS.length || items.some((item) => !isRecord(item))) return false;
  const ids = items.map((item) => item.itemId);
  return ids.every((id) => typeof id === "string") && new Set(ids).size === ids.length && STEP03_REVIEW_ITEMS.every((item) => ids.includes(item.id))
    && items.every((item) => hasExactKeys(item, ["itemId", "revisionHash", "decision", "notes", "carriedForward"])
      && typeof item.revisionHash === "string" && /^fnv1a:[0-9a-f]{8}$/.test(item.revisionHash)
      && isReviewDecision(item.decision) && typeof item.notes === "string" && typeof item.carriedForward === "boolean")
    && (!currentOnly || STEP03_REVIEW_ITEMS.every((item) => items.some((entry) => entry.itemId === item.id && entry.revisionHash === item.revisionHash)));
}

function hasCharacterShape(characters: unknown, currentOnly: boolean): characters is Array<Record<string, unknown>> {
  if (!Array.isArray(characters) || !characters.length || characters.some((character) => !isRecord(character))) return false;
  const ids = characters.map((character) => character.characterId);
  if (!ids.every((id) => typeof id === "string") || new Set(ids).size !== ids.length || ids.some((id) => !CHARACTER_DECISION_IDS.includes(id))) return false;
  if (currentOnly && (characters.length !== CHARACTER_DECISION_IDS.length || CHARACTER_DECISION_IDS.some((id) => !ids.includes(id)))) return false;
  return characters.every((character) => hasExactKeys(character, ["characterId", "revisionHash", "decision", "notes", "carriedForward"])
    && typeof character.revisionHash === "string" && /^fnv1a:[0-9a-f]{8}$/.test(character.revisionHash)
    && isReviewDecision(character.decision) && typeof character.notes === "string" && typeof character.carriedForward === "boolean")
    && (!currentOnly || FINAL_GOLDEN_MANIFEST.every((expected) => characters.some((character) => character.characterId === expected.id && character.revisionHash === expected.revisionHash)));
}

function hasExactDecisionMap(value: unknown, ids: readonly string[]): boolean {
  return isRecord(value) && hasExactKeys(value, ids) && ids.every((id) => isReviewDecision(value[id]));
}

function hasCompatibleIdentity(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, Object.keys(STEP03_REVIEW_IDENTITY)) || !isRecord(value.sourceSnapshots)
    || !hasExactKeys(value.sourceSnapshots, Object.keys(STEP03_REVIEW_IDENTITY.sourceSnapshots))) return false;
  return value.schemaVersion === 2 && value.reviewContractVersion === STEP03_REVIEW_IDENTITY.reviewContractVersion
    && value.initiativeId === STEP03_REVIEW_IDENTITY.initiativeId && value.technicalState === STEP03_REVIEW_IDENTITY.technicalState
    && value.implementationReviewVersion === STEP03_REVIEW_IDENTITY.implementationReviewVersion
    && value.previewRoute === STEP03_REVIEW_IDENTITY.previewRoute && value.selectedTheme === "C"
    && typeof value.goldenSliceManifestVersion === "string" && typeof value.goldenSliceManifestRevisionHash === "string"
    && Object.values(value.sourceSnapshots).every((entry) => typeof entry === "string");
}

function hasExpectedFormalFields(value: Record<string, unknown>): boolean {
  if (!hasExactDecisionMap(value.abilityDecisions, ABILITY_DECISION_IDS) || !hasExactDecisionMap(value.assetDecisions, ASSET_DECISION_IDS)
    || !isReviewDecision(value.goldenSliceDecision) || !isReviewDecision(value.manifestDecision) || !isReviewDecision(value.bossDecision)
    || !(value.audioDecision === "" || value.audioDecision === "ACCEPT CURRENT CANDIDATE" || value.audioDecision === "NEED RECORDED AUDIO" || value.audioDecision === "REVISE" || value.audioDecision === "REJECT")
    || !(value.authorizeChildFirstUse === "" || value.authorizeChildFirstUse === "YES" || value.authorizeChildFirstUse === "NO" || value.authorizeChildFirstUse === "NOT_YET")
    || typeof value.generalNotes !== "string") return false;
  const expected = synchronizeFormalFields(value as unknown as Step03ReviewDraft);
  return value.goldenSliceDecision === expected.goldenSliceDecision && value.manifestDecision === expected.manifestDecision
    && value.bossDecision === expected.bossDecision && value.audioDecision === expected.audioDecision
    && sameJson(value.abilityDecisions, expected.abilityDecisions) && sameJson(value.assetDecisions, expected.assetDecisions)
    && sameJson((value.decisions as { items: unknown }).items, expected.decisions.items);
}

function hasDraftShape(value: unknown, currentOnly: boolean): value is Step03ReviewDraft {
  if (!isRecord(value) || !hasExactKeys(value, [
    "schemaVersion", "initiativeId", "round", "goldenSliceIdentity", "goldenSliceDecision", "manifestDecision", "abilityDecisions",
    "bossDecision", "assetDecisions", "audioDecision", "authorizeChildFirstUse", "generalNotes", "decisions", "reviewMeta",
  ]) || value.schemaVersion !== 2 || value.initiativeId !== "hanzi-radical-battle-v2" || !Number.isInteger(value.round) || (value.round as number) < 1) return false;
  if (!(currentOnly ? sameJson(value.goldenSliceIdentity, STEP03_REVIEW_IDENTITY) : hasCompatibleIdentity(value.goldenSliceIdentity))
    || !isRecord(value.decisions) || !hasExactKeys(value.decisions, ["items", "characters"])
    || !hasItemShape(value.decisions.items, currentOnly) || !hasCharacterShape(value.decisions.characters, currentOnly)) return false;
  if (!isRecord(value.reviewMeta) || !hasExactKeys(value.reviewMeta, ["technicalState", "completed", "missingRequiredDecisionIds", "importedRound", "affectedItemIds"])
    || value.reviewMeta.technicalState !== "GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW" || typeof value.reviewMeta.completed !== "boolean"
    || !Array.isArray(value.reviewMeta.missingRequiredDecisionIds) || (value.reviewMeta.importedRound !== null && (!Number.isInteger(value.reviewMeta.importedRound) || (value.reviewMeta.importedRound as number) < 1))
    || !Array.isArray(value.reviewMeta.affectedItemIds) || value.reviewMeta.affectedItemIds.some((entry) => typeof entry !== "string")) return false;
  return hasExpectedFormalFields(value);
}

export function isCurrentReviewDraft(value: unknown): value is Step03ReviewDraft {
  return hasDraftShape(value, true);
}

export function carryForwardReview(value: unknown): Step03ReviewDraft | null {
  if (!hasDraftShape(value, false)) return null;
  const prior = value;
  if (!finalizeReviewDraft(prior).reviewMeta.completed) return null;
  const next = createReviewDraft();
  next.round = prior.round + 1;
  next.reviewMeta.importedRound = prior.round;

  const changedIds = new Set<Step03ReviewItemId>();
  for (const item of STEP03_REVIEW_ITEMS) {
    const previous = prior.decisions.items.find((entry) => entry.itemId === item.id);
    if (previous?.revisionHash !== item.revisionHash) changedIds.add(item.id);
  }
  const affectedIds = new Set<Step03ReviewItemId>(changedIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of STEP03_REVIEW_ITEMS) {
      if (!affectedIds.has(item.id) && (item.alwaysReview || item.dependsOn.some((dependency) => affectedIds.has(dependency)))) {
        affectedIds.add(item.id);
        changed = true;
      }
    }
  }
  next.decisions.items = next.decisions.items.map((decision) => {
    const previous = prior.decisions.items.find((entry) => entry.itemId === decision.itemId && entry.revisionHash === decision.revisionHash);
    return previous?.decision === "ACCEPT" && previous.notes.trim() && !affectedIds.has(decision.itemId)
      ? { ...decision, decision: "ACCEPT", notes: previous.notes, carriedForward: true }
      : decision;
  });
  next.decisions.characters = next.decisions.characters.map((character) => {
    const previous = prior.decisions.characters.find((entry) => entry.characterId === character.characterId && entry.revisionHash === character.revisionHash);
    return previous?.decision === "ACCEPT" && previous.notes.trim()
      ? { ...character, decision: "ACCEPT", notes: previous.notes, carriedForward: true }
      : character;
  });
  if (next.decisions.items.find((item) => item.itemId === "ability-trio")?.carriedForward) next.abilityDecisions = { ...prior.abilityDecisions };
  if (next.decisions.items.find((item) => item.itemId === "theme-c")?.carriedForward) next.assetDecisions = { ...prior.assetDecisions };
  if (next.decisions.items.find((item) => item.itemId === "audio-and-accessibility")?.carriedForward) next.audioDecision = prior.audioDecision;
  next.reviewMeta.affectedItemIds = [...affectedIds].map((id) => `item:${id}`);
  return synchronizeFormalFields(next);
}
