export type EnglishThemeId = "animals" | "home" | "food" | "actions" | "colors";
export type EnglishPartOfSpeech = "noun" | "verb" | "adjective" | "number" | "other";
export type EnglishDecodingBand = "simple-regular" | "common-pattern" | "irregular-supported" | "optional-advanced";
export type EnglishStoryBand = "story-core" | "optional";

export interface GraphemeUnit {
  readonly id: string;
  readonly letters: string;
  readonly phonemeIds: readonly string[];
  readonly role: "regular" | "common-pattern" | "irregular-heart";
  readonly childHint?: string;
}
export interface EnglishWordRecord {
  readonly id: string;
  readonly lemma: string;
  readonly displayWord: string;
  readonly senseId: string;
  readonly partOfSpeech: EnglishPartOfSpeech;
  readonly themeId: EnglishThemeId;
  readonly childGlossZh: string;
  readonly childDefinitionEn: string;
  readonly imageBrief: string;
  readonly imageAssetId: string | null;
  readonly visualKind: "asset" | "quantity" | "color";
  readonly pronunciationLocale: "en-US";
  readonly arpabet: readonly string[];
  readonly phonemeCount: number;
  readonly graphemeUnits: readonly GraphemeUnit[];
  readonly stressPattern: readonly number[];
  readonly decodingBand: EnglishDecodingBand;
  readonly storyBand: EnglishStoryBand;
  readonly sentenceIds: readonly string[];
  readonly sourceIds: readonly string[];
  readonly riskFlags: readonly string[];
  readonly revisionHash: string;
  readonly distractorUnits: readonly string[];
}

export interface EnglishSentenceRecord {
  readonly id: string;
  readonly text: string;
  readonly targetWordId: string;
  readonly targetSlotIndex: number;
  readonly supportWordIds: readonly string[];
  readonly worldActionId: string;
  readonly scaffoldZh?: string;
  readonly decodabilityStatus: "mostly-core-patterns" | "mixed-with-supported-words" | "meaning-first";
  readonly sourceNote: "project-authored";
  readonly reviewStatus: "accepted";
  readonly revisionHash: string;
}

export interface EnglishThemeRecord {
  readonly id: EnglishThemeId;
  readonly title: string;
  readonly subtitle: string;
  readonly accent: string;
  readonly transformationCopy: string;
}

export interface SupportWordRecord {
  readonly id: string;
  readonly display: string;
  readonly decodingNote: "regular" | "supported" | "not-assessed";
}
