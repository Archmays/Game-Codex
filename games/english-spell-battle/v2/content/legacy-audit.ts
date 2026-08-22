import { ENGLISH_V2_WORDS } from "./words";
import type { EnglishThemeId } from "./types";

export interface LegacyEnglishAuditRecord {
  readonly lemma: string;
  readonly originalCategory: EnglishThemeId;
  readonly semanticSense: "fixed-oewn-sense";
  readonly spellingSoundMapping: "manual-cmudict-aligned";
  readonly visualRepresentation: "formal-generated-asset" | "verified-css-color" | "verified-dom-quantity";
  readonly sentenceRole: "story-sentence-target" | "optional-journal-only";
  readonly mechanismRole: "meaning-build-sentence-response" | "journal-extension";
  readonly riskFlags: readonly string[];
  readonly disposition: "retained-story-core" | "retained-optional";
}

const LEGACY_BY_CATEGORY = {
  animals: ["cat", "dog", "pig", "cow", "duck", "fish", "bear", "rabbit", "frog", "tiger", "horse", "bee"],
  home: ["dad", "mom", "baby", "boy", "girl", "teacher", "friend", "family"],
  colors: ["red", "blue", "green", "yellow", "one", "two", "three", "ten"],
  food: ["apple", "banana", "egg", "milk", "cake", "water", "bread", "rice"],
  actions: ["run", "jump", "walk", "sit", "sleep", "eat", "drink", "sing"],
} as const;
export const LEGACY_ENGLISH_AUDIT: readonly LegacyEnglishAuditRecord[] = Object.entries(LEGACY_BY_CATEGORY).flatMap(([originalCategory, lemmas]) => lemmas.map((lemma) => {
  const word = ENGLISH_V2_WORDS.find((candidate) => candidate.lemma === lemma);
  if (!word) throw new Error(`Legacy word missing from V2: ${lemma}`);
  return {
    lemma,
    originalCategory: originalCategory as EnglishThemeId,
    semanticSense: "fixed-oewn-sense",
    spellingSoundMapping: "manual-cmudict-aligned",
    visualRepresentation: word.visualKind === "asset" ? "formal-generated-asset" : word.visualKind === "color" ? "verified-css-color" : "verified-dom-quantity",
    sentenceRole: word.storyBand === "story-core" ? "story-sentence-target" : "optional-journal-only",
    mechanismRole: word.storyBand === "story-core" ? "meaning-build-sentence-response" : "journal-extension",
    riskFlags: word.riskFlags,
    disposition: word.storyBand === "story-core" ? "retained-story-core" : "retained-optional",
  } satisfies LegacyEnglishAuditRecord;
}));

export interface CandidateWordDecision {
  readonly lemma: string;
  readonly patternContribution: string;
  readonly selected: boolean;
  readonly decision: string;
}

export const ENGLISH_V2_CANDIDATE_POOL: readonly CandidateWordDecision[] = [
  { lemma: "goat", patternContribution: "oa / OW1", selected: true, decision: "Adds a common vowel team with a concrete, distinct animal image." },
  { lemma: "book", patternContribution: "oo / UH1", selected: true, decision: "Adds the short oo pattern and a home-literacy referent." },
  { lemma: "corn", patternContribution: "or / AO1 R", selected: true, decision: "Adds an r-controlled pattern and a distinct food image." },
  { lemma: "clap", patternContribution: "initial consonant cluster cl", selected: true, decision: "Adds a transparent action and a regular consonant cluster." },
  { lemma: "mouse", patternContribution: "ou / AW1", selected: false, decision: "Useful but overlaps the cow vowel outcome without improving theme balance." },
  { lemma: "bird", patternContribution: "ir / ER1", selected: false, decision: "Pattern already represented by girl." },
  { lemma: "snail", patternContribution: "ai / EY1", selected: false, decision: "Candidate retained for a later image and sentence expansion." },
  { lemma: "fox", patternContribution: "x / K S", selected: false, decision: "Regular pattern, but no larger gap than selected candidates." },
  { lemma: "bed", patternContribution: "CVC short e", selected: false, decision: "Simple but adds little beyond current CVC coverage." },
  { lemma: "lamp", patternContribution: "final consonant cluster mp", selected: false, decision: "Useful but less balanced than book for the home theme." },
  { lemma: "sock", patternContribution: "ck / K", selected: false, decision: "The ck pattern is already represented by duck." },
  { lemma: "cup", patternContribution: "CVC short u", selected: false, decision: "Already used as a sentence support word." },
  { lemma: "pear", patternContribution: "ear / EH R", selected: false, decision: "Potentially confusable with bear and not needed for this release." },
  { lemma: "soup", patternContribution: "ou / UW1", selected: false, decision: "Useful later; four-word expansion cap already filled." },
  { lemma: "cookie", patternContribution: "oo / UH1", selected: false, decision: "Book supplies the pattern with fewer syllables." },
  { lemma: "swim", patternContribution: "initial consonant cluster sw", selected: false, decision: "Already used as a sentence support word." },
  { lemma: "hop", patternContribution: "CVC short o", selected: false, decision: "Already used as a sentence support word." },
  { lemma: "black", patternContribution: "initial and final clusters", selected: false, decision: "Color set remains intentionally bounded to four story colors." },
  { lemma: "pink", patternContribution: "final consonant cluster nk", selected: false, decision: "Color set remains intentionally bounded to four story colors." },
  { lemma: "four", patternContribution: "our / AO R", selected: false, decision: "Quantity set already spans one, two, three, and ten." },
  { lemma: "five", patternContribution: "silent-e long i", selected: false, decision: "Silent-e is already represented by cake and rice." },
  { lemma: "boat", patternContribution: "oa / OW1", selected: false, decision: "Already used as a sentence support word; goat keeps target/support roles disjoint." },
  { lemma: "moon", patternContribution: "oo / UW1", selected: false, decision: "Book adds the complementary short oo pattern instead." },
] as const;

export const LEGACY_LEVEL_LABEL_DISPOSITION = {
  rawValue: "Raz aa-A",
  status: "QUARANTINED_UNSUPPORTED",
  reason: "No verified RAZ source or mapping contract was present; V2 makes no branded level claim.",
} as const;
