import {
  CANDIDATE_CHARACTERS,
  CANDIDATE_MANIFEST_VERSION,
} from "../../games/hanzi-radical-battle/v2/content/candidate-characters";
import { STEP02_STORYBOARD } from "../../games/hanzi-radical-battle/v2/content/storyboard";

export const REVIEW_FILE_NAME = "STEP-02_PARENT_REVIEW_FEEDBACK.json";
export const REVIEW_DRAFT_KEY = "family-games/hanzi-radical-battle-v2-step02-review/draft";

export type CharacterDecision = "" | "ACCEPT" | "ACCEPT_WITH_EDIT" | "REJECT";
export type StoryboardDecision = "" | "ACCEPT" | "REVISE" | "REJECT";
export type CoreDecision = "" | "ACCEPT" | "REVISE" | "REJECT";
export type VisualSelection = "" | "A" | "B" | "C" | "MIX" | "REDO";
export type AuthorizationDecision = "" | "YES" | "NO" | "NOT_YET";

export interface Step02ReviewDraft {
  schemaVersion: 1;
  initiativeId: "hanzi-radical-battle-v2";
  round: number;
  pilotIdentity: {
    anchorCharacterId: "ming";
    scenarioId: "pilot-ming-left-right";
    candidateManifestVersion: string;
    selectedTheme: string;
  };
  decisions: {
    corePilot: { decision: CoreDecision; notes: string };
    visualDirection: { selection: VisualSelection; notes: string };
    characters: Array<{
      itemId: string;
      revisionHash: string;
      decision: CharacterDecision;
      notes: string;
      carriedForward: boolean;
    }>;
    storyboard: Array<{
      itemId: string;
      revisionHash: string;
      decision: StoryboardDecision;
      notes: string;
      carriedForward: boolean;
    }>;
    authorizeStep03: AuthorizationDecision;
    generalNotes: string;
  };
  reviewMeta: {
    technicalState: "CORE_SPELL_PILOT_READY_FOR_PARENT_REVIEW";
    completed: boolean;
    missingRequiredDecisionIds: string[];
    importedRound: number | null;
    affectedItemIds: string[];
  };
}

export function createReviewDraft(): Step02ReviewDraft {
  return {
    schemaVersion: 1,
    initiativeId: "hanzi-radical-battle-v2",
    round: 1,
    pilotIdentity: {
      anchorCharacterId: "ming",
      scenarioId: "pilot-ming-left-right",
      candidateManifestVersion: CANDIDATE_MANIFEST_VERSION,
      selectedTheme: "A",
    },
    decisions: {
      corePilot: { decision: "", notes: "" },
      visualDirection: { selection: "", notes: "" },
      characters: CANDIDATE_CHARACTERS.map((candidate) => ({
        itemId: candidate.id,
        revisionHash: candidate.revisionHash,
        decision: "",
        notes: "",
        carriedForward: false,
      })),
      storyboard: STEP02_STORYBOARD.map((beat) => ({
        itemId: beat.id,
        revisionHash: beat.revisionHash,
        decision: "",
        notes: "",
        carriedForward: false,
      })),
      authorizeStep03: "",
      generalNotes: "",
    },
    reviewMeta: {
      technicalState: "CORE_SPELL_PILOT_READY_FOR_PARENT_REVIEW",
      completed: false,
      missingRequiredDecisionIds: [],
      importedRound: null,
      affectedItemIds: [],
    },
  };
}

export function missingReviewDecisions(draft: Step02ReviewDraft): string[] {
  const missing: string[] = [];
  if (!draft.decisions.corePilot.decision) missing.push("corePilot");
  if (!draft.decisions.visualDirection.selection) missing.push("visualDirection");
  draft.decisions.characters.forEach((item) => {
    if (!item.decision) missing.push(`character:${item.itemId}`);
  });
  draft.decisions.storyboard.forEach((item) => {
    if (!item.decision) missing.push(`storyboard:${item.itemId}`);
  });
  if (!draft.decisions.authorizeStep03) missing.push("authorizeStep03");
  return missing;
}

export function finalizeReviewDraft(draft: Step02ReviewDraft): Step02ReviewDraft {
  const missingRequiredDecisionIds = missingReviewDecisions(draft);
  return {
    ...draft,
    pilotIdentity: {
      ...draft.pilotIdentity,
      selectedTheme: draft.decisions.visualDirection.selection || draft.pilotIdentity.selectedTheme,
    },
    reviewMeta: {
      ...draft.reviewMeta,
      completed: missingRequiredDecisionIds.length === 0,
      missingRequiredDecisionIds,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExpectedItemIds(items: unknown, expectedIds: readonly string[]): items is Array<Record<string, unknown>> {
  if (!Array.isArray(items) || items.length !== expectedIds.length || items.some((item) => !isRecord(item))) {
    return false;
  }
  const ids = items.map((item) => item.itemId);
  return ids.every((id) => typeof id === "string") && new Set(ids).size === ids.length && expectedIds.every((id) => ids.includes(id));
}

export function isCurrentReviewDraft(value: unknown): value is Step02ReviewDraft {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.initiativeId !== "hanzi-radical-battle-v2") return false;
  const pilotIdentity = value.pilotIdentity;
  const decisions = value.decisions;
  if (!isRecord(pilotIdentity) || !isRecord(decisions)) return false;
  if (pilotIdentity.anchorCharacterId !== "ming" || pilotIdentity.scenarioId !== "pilot-ming-left-right") return false;
  if (pilotIdentity.candidateManifestVersion !== CANDIDATE_MANIFEST_VERSION) return false;
  const characters = decisions.characters;
  const storyboard = decisions.storyboard;
  if (!hasExpectedItemIds(characters, CANDIDATE_CHARACTERS.map((item) => item.id))) return false;
  if (!hasExpectedItemIds(storyboard, STEP02_STORYBOARD.map((item) => item.id))) return false;
  return CANDIDATE_CHARACTERS.every((candidate) =>
    characters.some(
      (item) => item.itemId === candidate.id && item.revisionHash === candidate.revisionHash,
    ),
  ) && STEP02_STORYBOARD.every((beat) =>
    storyboard.some((item) => item.itemId === beat.id && item.revisionHash === beat.revisionHash),
  );
}

export function carryForwardReview(value: unknown): Step02ReviewDraft | null {
  if (!isRecord(value) || value.initiativeId !== "hanzi-radical-battle-v2") return null;
  const previous = value as unknown as Step02ReviewDraft;
  if (!Number.isInteger(previous.round) || previous.round < 1 || !isRecord(previous.decisions)) return null;
  if (!isRecord(previous.pilotIdentity) || previous.pilotIdentity.anchorCharacterId !== "ming" || previous.pilotIdentity.scenarioId !== "pilot-ming-left-right") return null;
  if (!hasExpectedItemIds(previous.decisions.characters, CANDIDATE_CHARACTERS.map((item) => item.id))) return null;
  if (!hasExpectedItemIds(previous.decisions.storyboard, STEP02_STORYBOARD.map((item) => item.id))) return null;
  const next = createReviewDraft();
  next.round = previous.round + 1;
  next.reviewMeta.importedRound = previous.round;
  const previousCharacters = previous.decisions.characters;
  const changedCandidateIds = new Set(
    CANDIDATE_CHARACTERS.filter((candidate) => {
      const prior = previousCharacters.find((item) => item.itemId === candidate.id);
      return prior?.revisionHash !== candidate.revisionHash;
    }).map((candidate) => candidate.id),
  );
  next.decisions.characters = next.decisions.characters.map((item) => {
    const prior = previousCharacters.find(
      (candidate) => candidate.itemId === item.itemId && candidate.revisionHash === item.revisionHash,
    );
    return prior?.decision === "ACCEPT"
      ? { ...item, decision: "ACCEPT", notes: prior.notes ?? "", carriedForward: true }
      : item;
  });
  const previousStoryboard = previous.decisions.storyboard;
  const dependencyAffectedStoryboardIds = new Set(
    STEP02_STORYBOARD.filter((beat) => beat.dependsOnCandidateIds.some((id) => changedCandidateIds.has(id))).map(
      (beat) => beat.id,
    ),
  );
  next.decisions.storyboard = next.decisions.storyboard.map((item) => {
    const prior = previousStoryboard.find(
      (beat) => beat.itemId === item.itemId && beat.revisionHash === item.revisionHash,
    );
    return prior?.decision === "ACCEPT" && !dependencyAffectedStoryboardIds.has(item.itemId)
      ? { ...item, decision: "ACCEPT", notes: prior.notes ?? "", carriedForward: true }
      : item;
  });
  next.reviewMeta.affectedItemIds = [
    ...[...changedCandidateIds].map((id) => `character:${id}`),
    ...(changedCandidateIds.has("ming") ? ["corePilot"] : []),
    ...[...dependencyAffectedStoryboardIds].map((id) => `storyboard:${id}`),
  ];
  return next;
}
