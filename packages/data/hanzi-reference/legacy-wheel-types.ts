export type LegacyWheelGradeId = "p1" | "p2" | "p3" | "p4" | "p5" | "p6" | "j1" | "j2" | "j3";
export type WheelSourceMode = "char" | "word";
export type WheelCurriculumStage = "grades-1-2" | "grades-3-4" | "grades-5-6" | "grades-7-9";

export interface LegacyWheelPair {
  readonly legacyId: `${LegacyWheelGradeId}.${WheelSourceMode}.${string}`;
  readonly outer: string;
  readonly inner: string;
  readonly result: string;
  readonly pinyin: string;
  readonly words: readonly string[];
}

export interface LegacyWheelModeData {
  readonly outerOptions: readonly string[];
  readonly innerOptions: readonly string[];
  readonly validPairs: readonly LegacyWheelPair[];
}

export interface LegacyWheelSet {
  readonly id: LegacyWheelGradeId;
  readonly label: string;
  readonly char: LegacyWheelModeData;
  readonly word: LegacyWheelModeData;
}

export interface LegacyWheelSourceFreeze {
  readonly sourcePath: "packages/data/learningGames.ts";
  readonly sourceGitBlobSha: string;
  readonly sourceHeadSha: string;
  readonly setIds: readonly LegacyWheelGradeId[];
  readonly setLabels: readonly string[];
  readonly countsBySetAndMode: Readonly<Record<LegacyWheelGradeId, Readonly<Record<WheelSourceMode, number>>>>;
  readonly totalCharRecords: number;
  readonly totalWordRecords: number;
  readonly totalRecords: number;
  readonly stableJsonSha256: string;
  readonly fieldInventory: readonly string[];
  readonly extractedAt: string;
}

