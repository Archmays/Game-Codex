export type CompleteChapterId = "chapter-one" | "chapter-two" | "chapter-three";
export type CompleteCharacterBand = "story-required" | "optional" | "legacy-wheel-only";
export type CompleteStructure = "left-right" | "top-bottom" | "full-enclosure" | "semi-enclosure";
export type CompleteSlotId = "left" | "right" | "top" | "bottom" | "outer" | "inner";
export type ComponentRelationKind =
  | "same-form"
  | "standard-variant"
  | "semantic-component"
  | "phonetic-component"
  | "both"
  | "modern-visual-link-only"
  | "uncertain";

export interface SourceRecord {
  readonly id: string;
  readonly sourceKind: "repository" | "unicode" | "language-standard" | "dictionary" | "structure-crosscheck";
  readonly title: string;
  readonly version: string;
  readonly location: string;
  readonly supports: readonly string[];
  readonly limitation: string;
}

export interface ReadingSense {
  readonly id: string;
  readonly characterId: string;
  readonly pinyin: string;
  readonly fixedPhrase: string;
  readonly shortMeaning: string;
  readonly pronunciationRisk: "low-in-fixed-phrase" | "fixed-context-polyphone";
  readonly sourceIds: readonly string[];
}

export interface ComponentNode {
  readonly id: string;
  readonly glyph: string;
  readonly label: string;
  readonly roleLabel: "component" | "component-variant" | "whole-character-component";
  readonly sourceIds: readonly string[];
}

export interface ComponentRelation {
  readonly id: string;
  readonly familyId: string;
  readonly characterId: string;
  readonly componentId: string;
  readonly kind: ComponentRelationKind;
  readonly childFacingClaim: string;
  readonly sourceIds: readonly string[];
}

export interface CharacterComponentPlacement {
  readonly instanceId: string;
  readonly componentId: string;
  readonly glyph: string;
  readonly sourceGlyph: string;
  readonly slotId: CompleteSlotId;
  readonly order: 1 | 2 | 3;
  readonly role: "semantic" | "phonetic" | "both" | "structural" | "uncertain";
}

export interface CharacterNode {
  readonly id: string;
  readonly glyph: string;
  readonly unicodeCodePoint: `U+${string}`;
  readonly chapterId: CompleteChapterId | null;
  readonly band: CompleteCharacterBand;
  readonly worldTag: string;
  readonly structure: CompleteStructure;
  readonly components: readonly CharacterComponentPlacement[];
  readonly readingSenseIds: readonly string[];
  readonly familiarWord: string;
  readonly shortMeaning: string;
  readonly illustrationBrief: string;
  readonly magicName: string;
  readonly magicEffect: string;
  readonly meaningImageDisclaimer: "这是字义联想，不是字源说明";
  readonly familiarity: "high" | "near" | "advanced-optional";
  readonly ambiguityRisk: string;
  readonly sourceIds: readonly string[];
  readonly provenance: readonly string[];
  readonly revisionHash: string;
}

export interface ComponentFamily {
  readonly id: string;
  readonly name: string;
  readonly band: "story-core" | "optional-advanced";
  readonly componentIds: readonly string[];
  readonly memberCharacterIds: readonly string[];
  readonly relationIds: readonly string[];
  readonly worldRepresentation: string;
  readonly browserStateId: string;
  readonly childFacingExplanation: string;
  readonly sourceIds: readonly string[];
  readonly revisionHash: string;
}

export interface WordNode {
  readonly id: string;
  readonly glyphs: readonly [string, string];
  readonly characterIds: readonly [string, string];
  readonly readingSenseIds: readonly [string, string];
  readonly pinyin: string;
  readonly shortMeaning: string;
  readonly context: string;
  readonly worldMagic: string;
  readonly band: "story" | "optional-postgame";
  readonly reverseOrderStatus: "rejected-not-word" | "rejected-wrong-context";
  readonly ambiguityRisk: string;
  readonly sourceIds: readonly string[];
  readonly sourceNote: string;
  readonly revisionHash: string;
}

export interface AuditDisposition {
  readonly recordId: string;
  readonly status: "accepted" | "corrected-derived" | "quarantined" | "context-only";
  readonly issueCodes: readonly string[];
  readonly note: string;
  readonly sourceIds: readonly string[];
  readonly revisionHash: string;
}

export interface PlayableManifest {
  readonly id: string;
  readonly version: string;
  readonly characterIds: readonly string[];
  readonly familyIds: readonly string[];
  readonly wordIds: readonly string[];
  readonly sourceIds: readonly string[];
  readonly revisionHash: string;
}
