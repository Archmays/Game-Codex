/** Audit-only module. Child runtime must never import this file or pinyinCards. */
import { pinyinCards } from "../../../../../packages/data/learningGames";
import { PINYIN_READING_MANIFEST } from "./manifest";

export type LegacyDisposition = "validated-overlap" | "corrected-derived" | "legacy-only-context" | "quarantined";
export type LegacyIssueCode = "MISSING_FIXED_CONTEXT" | "POLYPHONE_WITHOUT_CONTEXT" | "TONE_SANDHI_CONTEXT" | "NEUTRAL_TONE_CONTEXT" | "PINYIN_MISMATCH" | "MEANING_MISMATCH" | "ENGLISH_GLOSS_MISMATCH" | "DUPLICATE_GLYPH" | "HOMOPHONE_AMBIGUITY" | "UNSUPPORTED_DECOMPOSITION" | "GRADE_OR_FAMILIARITY_UNVERIFIED";

export interface LegacyPinyinAuditRecord {
  readonly id: string;
  readonly sourceIndex: number;
  readonly original: (typeof pinyinCards)[number];
  readonly disposition: LegacyDisposition;
  readonly issueCodes: readonly LegacyIssueCode[];
  readonly canonicalRecordId?: string;
}

export const LEGACY_PINYIN_AUDIT: readonly LegacyPinyinAuditRecord[] = pinyinCards.map((original, sourceIndex) => {
  const canonical = PINYIN_READING_MANIFEST.find((record) => record.glyph === original.char);
  const duplicateGlyph = pinyinCards.filter((card) => card.char === original.char).length > 1;
  const homophone = pinyinCards.filter((card) => card.pinyin === original.pinyin).length > 1;
  const issueCodes: LegacyIssueCode[] = ["MISSING_FIXED_CONTEXT", "GRADE_OR_FAMILIARITY_UNVERIFIED"];
  if (duplicateGlyph) issueCodes.push("DUPLICATE_GLYPH");
  if (homophone) issueCodes.push("HOMOPHONE_AMBIGUITY");
  if (["一", "不"].includes(original.char)) issueCodes.push("TONE_SANDHI_CONTEXT");
  if (original.pinyin === "de") issueCodes.push("NEUTRAL_TONE_CONTEXT");
  if (canonical && canonical.citationPinyinMarked !== original.pinyin) issueCodes.push("PINYIN_MISMATCH");
  const disposition: LegacyDisposition = canonical
    ? canonical.citationPinyinMarked === original.pinyin ? "validated-overlap" : "corrected-derived"
    : ["一", "不", "的"].includes(original.char) ? "quarantined" : "legacy-only-context";
  return { id: `legacy-pinyin.${String(sourceIndex).padStart(3, "0")}`, sourceIndex, original, disposition, issueCodes: [...new Set(issueCodes)], canonicalRecordId: canonical?.id };
});

export function legacyAuditSummary() {
  const byDisposition = Object.fromEntries(["validated-overlap", "corrected-derived", "legacy-only-context", "quarantined"].map((value) => [value, LEGACY_PINYIN_AUDIT.filter((record) => record.disposition === value).length]));
  return {
    sourcePath: "packages/data/learningGames.ts#pinyinCards",
    recordCount: LEGACY_PINYIN_AUDIT.length,
    stableIdsUnique: new Set(LEGACY_PINYIN_AUDIT.map((record) => record.id)).size === LEGACY_PINYIN_AUDIT.length,
    byDisposition,
    duplicateGlyphs: [...new Set(pinyinCards.filter((card) => pinyinCards.filter((other) => other.char === card.char).length > 1).map((card) => card.char))],
    homophoneGroups: [...new Set(pinyinCards.map((card) => card.pinyin))].filter((pinyin) => pinyinCards.filter((card) => card.pinyin === pinyin).length > 1),
    overlapWithCore72: LEGACY_PINYIN_AUDIT.filter((record) => record.canonicalRecordId).length,
    legacyOnlyGlyphs: LEGACY_PINYIN_AUDIT.filter((record) => !record.canonicalRecordId).map((record) => record.original.char),
  };
}
