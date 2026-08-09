import { createRevisionHash } from "../../games/hanzi-radical-battle/v2/content/revision-hash";
import { STEP05_AUDIO_MATRIX_RESULTS } from "./audio-matrix";
import { STEP05_EVIDENCE_SHA256, STEP05_PROVISIONAL_DECISION } from "./review-evidence";

export const STEP05_REVIEW_ITEM_IDS = [
  "real-first-use-evidence",
  "audio-context-regression",
  "private-world-shell",
  "world-navigation",
] as const;

export type Step05ReviewItemId = (typeof STEP05_REVIEW_ITEM_IDS)[number];
export type Step05ReviewDecision = "" | "ACCEPT" | "REVISE" | "REJECT";

export interface Step05ReviewItem {
  readonly id: Step05ReviewItemId;
  readonly title: string;
  readonly tabId: "evidence" | "audio" | "world" | "navigation";
  readonly allowedDecisions: readonly Exclude<Step05ReviewDecision, "">[];
  readonly dependsOn: readonly Step05ReviewItemId[];
  readonly revisionHash: string;
}

export const STEP05_REVIEW_ITEMS: readonly Step05ReviewItem[] = [
  {
    id: "real-first-use-evidence",
    title: "真实证据与 provisional decision",
    tabId: "evidence",
    allowedDecisions: ["ACCEPT", "REVISE"],
    dependsOn: [],
    revisionHash: createRevisionHash("step05-review-evidence-v1", {
      evidenceSha256: STEP05_EVIDENCE_SHA256,
      decision: STEP05_PROVISIONAL_DECISION,
    }),
  },
  {
    id: "audio-context-regression",
    title: "Audio context regression",
    tabId: "audio",
    allowedDecisions: ["ACCEPT", "REVISE"],
    dependsOn: [],
    revisionHash: createRevisionHash("step05-review-audio-v1", STEP05_AUDIO_MATRIX_RESULTS.map((row) => ({
      id: row.id,
      expectedCharacterId: row.expectedCharacterId,
      expectedSource: row.expectedSource,
      actualCharacterId: row.actualCharacterId,
      actualSource: row.actualSource,
      passed: row.passed,
    }))),
  },
  {
    id: "private-world-shell",
    title: "我的游戏世界",
    tabId: "world",
    allowedDecisions: ["ACCEPT", "REVISE", "REJECT"],
    dependsOn: [],
    revisionHash: createRevisionHash("step05-review-world-v1", {
      route: "?world=my-game-world",
      title: "我的游戏世界",
      objects: ["ink-forest", "four-character-spellbook", "classic-game-treasure-box"],
      completedSaveRequires: ["completedRuns>0", "ming", "hua", "lin", "xing"],
    }),
  },
  {
    id: "world-navigation",
    title: "世界导航",
    tabId: "navigation",
    allowedDecisions: ["ACCEPT", "REVISE"],
    dependsOn: ["private-world-shell"],
    revisionHash: createRevisionHash("step05-review-navigation-v1", {
      forest: "?play=hanzi-v2-golden-slice&mode=play&from=world",
      treasure: "?hub=classic&from=world",
      return: "?world=my-game-world",
    }),
  },
] as const;

export const STEP05_REVIEW_CANDIDATE_REVISION = createRevisionHash(
  "step05-parent-review-candidate-v1",
  STEP05_REVIEW_ITEMS.map((item) => ({
    id: item.id,
    revisionHash: item.revisionHash,
    dependsOn: item.dependsOn,
  })),
);

export function getStep05ReviewItem(id: Step05ReviewItemId): Step05ReviewItem {
  const item = STEP05_REVIEW_ITEMS.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown STEP 05 review item: ${id}`);
  return item;
}
