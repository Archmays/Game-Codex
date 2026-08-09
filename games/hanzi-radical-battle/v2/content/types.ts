export type CharacterStructure =
  | "left-right"
  | "top-bottom"
  | "full-enclosure"
  | "semi-enclosure";

export type FamiliarityBand = "high" | "near" | "new";
export type CandidateTier = "recommended" | "conditional" | "reserve";
export type RecommendedUse =
  | "pilot-anchor"
  | "first-battle"
  | "second-battle"
  | "boss"
  | "reserve";

export interface CharacterComponent {
  id: string;
  glyph: string;
  role:
    | "component"
    | "side-component"
    | "top-component"
    | "bottom-component"
    | "enclosure-component"
    | "semi-enclosure-component";
  slotId: "left" | "right" | "top" | "bottom" | "outer" | "inner";
  slot: "left" | "right" | "top" | "bottom" | "outer" | "inner";
}

export interface CandidateCharacter {
  id: string;
  character: string;
  glyph: string;
  simplifiedLocale: "zh-Hans-CN";
  pinyin: string;
  pinyinReview: "pending-parent-review";
  familiarWord: string;
  shortMeaning: string;
  structure: CharacterStructure;
  components: readonly CharacterComponent[];
  sourceOrderedParts: readonly string[];
  sourceCombinationKey: string;
  sourceEvidence: {
    gameDataGloss: string;
    visualHintGloss: string;
    formulaAuditStatus: "accepted";
    visualAssetPath: string;
    evidenceLimit: string;
  };
  familiarityBand: FamiliarityBand;
  familiarityIsProvisional: true;
  childFitRationale: string;
  magicConcept: string;
  worldEffect: string;
  visualHintPath: string;
  visualHintVerified: true;
  tier: CandidateTier;
  recommendedForFinalManifest: boolean;
  recommendedUse: RecommendedUse;
  ambiguityRisks: readonly string[];
  pronunciationRisks: readonly string[];
  etymologyClaim: null;
  reviewStatus: "pending";
  revisionHash: string;
}

export interface PilotCard {
  id: string;
  glyph: string;
  expectedSlotId: string | null;
  kind: "target" | "distractor";
}

export interface StructureSlot {
  id: string;
  label: string;
  spatialRole: "left" | "right" | "top" | "bottom" | "outer" | "inner";
}

export interface PilotScenario {
  id: string;
  characterId: string;
  purpose: "child-pilot" | "adult-structure-preview";
  structure: CharacterStructure;
  prompt: string;
  cards: readonly PilotCard[];
  slots: readonly StructureSlot[];
  noAlternativeTwoOrThreePartCombination: true;
  handAuditNote: string;
}

export type VisualDirectionId = "A" | "B" | "C";

export interface VisualDirection {
  id: VisualDirectionId;
  name: string;
  summary: string;
  tokens: {
    sky: string;
    distantInk: string;
    ground: string;
    panel: string;
    primary: string;
    accent: string;
    glow: string;
    text: string;
  };
  reviewQuestion: string;
  productionStatus: "procedural-review-direction-only";
}
