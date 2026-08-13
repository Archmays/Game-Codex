export type ChapterCharacterStructure = "left-right" | "top-bottom" | "full-enclosure" | "semi-enclosure";
export type ChapterSlotId = "left" | "right" | "top" | "bottom" | "outer" | "inner";
export type ChapterRegionId = "glimmer-grove" | "echo-garden" | "wind-trail";
export type ChapterContentAcceptance = "v1-accepted-carried-forward" | "machine-verified-v2";
export type FamiliarityBand = "high" | "near";
export type PronunciationRisk = "low-in-fixed-phrase" | "fixed-context-polyphone";

export interface ChapterOrderedComponent {
  readonly id: string;
  readonly glyph: string;
  readonly sourceGlyph: string;
  readonly slotId: ChapterSlotId;
  readonly order: 1 | 2 | 3;
}

export interface ChapterSourceMapping {
  readonly unicodeCodePoint: `U+${string}`;
  readonly unihanMandarin: string;
  readonly unihanSource: "Unicode 17.0.0 Unihan_Readings.txt kMandarin";
  readonly unihanZipSha256: "F7A48B2B545ACFAA77B2D607AE28747404CE02BAEFEE16396C5D2D7A8EF34B5E";
  readonly moeSource: "教育部 通用规范汉字表 2013";
  readonly motherLibraryPath: "games/hanzi-radical-battle/game-data.ts";
  readonly formulaAuditPath: "games/hanzi-radical-battle/formula-audit.ts";
  readonly visualHintPath: `public/assets/hanzi-radical-battle/visuals/${string}.png`;
  readonly sourceOrderedParts: readonly string[];
  readonly formulaAuditStatus: "accepted";
  readonly formulaAuditSource: "existing" | "hanzi-wheel" | "manual-audit";
  readonly sourceLimit: "sources-support-standard-identity-reading-combination-and-meaning-link-not-etymology-or-child-validation";
}

export interface ChapterCharacter {
  readonly id: string;
  readonly glyph: string;
  readonly pinyinWithToneMarks: string;
  readonly spokenPhrase: string;
  readonly familiarWord: string;
  readonly shortMeaning: string;
  readonly regionId: ChapterRegionId;
  readonly structure: ChapterCharacterStructure;
  readonly orderedComponents: readonly ChapterOrderedComponent[];
  readonly slotIds: readonly ChapterSlotId[];
  readonly sourceCombinationKey: string;
  readonly sourceMapping: ChapterSourceMapping;
  readonly magicId: string;
  readonly magicName: string;
  readonly magicEffect: string;
  readonly meaningAssetKey: string;
  readonly familiarityBand: FamiliarityBand;
  readonly pronunciationRisk: PronunciationRisk;
  readonly ambiguityRisk: string;
  readonly etymologyClaim: null;
  readonly acceptanceStatus: ChapterContentAcceptance;
  readonly revisionHash: string;
}

export interface ChapterHandCard {
  readonly id: string;
  readonly glyph: string;
  readonly sourceGlyph: string;
  readonly kind: "target" | "distractor";
  readonly expectedSlotId: ChapterSlotId | null;
}

export interface ChapterEncounterHand {
  readonly id: string;
  readonly characterId: string;
  readonly variant: number;
  readonly cards: readonly [ChapterHandCard, ChapterHandCard, ChapterHandCard, ChapterHandCard, ChapterHandCard];
  readonly revisionHash: string;
}

export interface ChapterSpellbookEntry {
  readonly characterId: string;
  readonly glyph: string;
  readonly pinyinWithToneMarks: string;
  readonly spokenPhrase: string;
  readonly familiarWord: string;
  readonly shortMeaning: string;
  readonly structure: ChapterCharacterStructure;
  readonly componentGlyphs: readonly string[];
  readonly magicName: string;
  readonly magicEffect: string;
  readonly meaningAssetKey: string;
  readonly replayFormation: true;
  readonly replayMeaningMagic: true;
}
