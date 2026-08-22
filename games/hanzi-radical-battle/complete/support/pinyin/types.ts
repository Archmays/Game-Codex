export type ToneNumber = 1 | 2 | 3 | 4 | 5;
export type PinyinBand = "starter" | "story" | "optional-advanced";
export type SoundRhymeMode = "assemble" | "tone" | "contrast";

export interface PinyinReadingRecord {
  readonly id: string;
  readonly characterId: string;
  readonly readingSenseId: string;
  readonly glyph: string;
  readonly fixedPhrase: string;
  readonly citationPinyinMarked: string;
  readonly citationPinyinNumbered: string;
  readonly spokenPhrasePinyin?: string;
  readonly phonologicalOnset: string | null;
  readonly teachingInitial: string | null;
  readonly canonicalFinal: string;
  readonly writtenFinal: string;
  readonly medial: "i" | "u" | "ü" | null;
  readonly tone: ToneNumber;
  readonly toneMarkVowelIndex: number | null;
  readonly zeroInitial: boolean;
  readonly yWOrthography: boolean;
  readonly umlautOmissionRule: "none" | "jqxy-u-means-ü";
  readonly contractionRule: "none" | "iou-to-iu" | "uei-to-ui" | "uen-to-un";
  readonly wholeSyllableTeaching: boolean;
  readonly neutralTone: boolean;
  readonly sandhiStatus: "citation-only" | "fixed-context-explicit" | "not-applicable";
  readonly band: PinyinBand;
  readonly sourceIds: readonly string[];
  readonly riskFlags: readonly string[];
  readonly revisionHash: string;
}

export interface PinyinContrastPair {
  readonly id: string;
  readonly leftRecordId: string;
  readonly rightRecordId: string;
  readonly dimension: "initial" | "final";
  readonly leftValue: string;
  readonly rightValue: string;
  readonly explanation: string;
  readonly sourceIds: readonly string[];
}

export interface PinyinChallenge {
  readonly id: string;
  readonly mode: SoundRhymeMode;
  readonly recordId: string;
  readonly initialOptions: readonly string[];
  readonly finalOptions: readonly string[];
  readonly toneOptions: readonly ToneNumber[];
  readonly contrastPairId?: string;
  readonly contrastOptions?: readonly string[];
  readonly correctContrast?: string;
}

export interface PinyinSourceRecord {
  readonly id: string;
  readonly sourceKind: "language-standard" | "curriculum" | "dictionary" | "repository" | "research";
  readonly title: string;
  readonly version: string;
  readonly date: string;
  readonly location: string;
  readonly supports: readonly string[];
  readonly limitation: string;
  readonly access: string;
}
