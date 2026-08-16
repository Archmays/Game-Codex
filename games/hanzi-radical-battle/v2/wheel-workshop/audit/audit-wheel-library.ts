import { HANZI_RADICAL_FORMULA_AUDIT_ENTRIES } from "../../../formula-audit";
import { createRevisionHash } from "../../content/revision-hash";
import freeze from "../library/legacy-wheel-source-freeze.json";
import { LEGACY_WHEEL_SOURCE } from "../library/legacy-wheel-source";
import type { LegacyWheelGradeId, WheelCurriculumStage, WheelSourceMode } from "../library/legacy-wheel-types";
import type { CanonicalWheelAuditRecord, WheelComponentRole, WheelSlotId, WheelSourceEvidence, WheelStructure } from "../types";
import type { WheelIssueCode } from "./issue-codes";

const AUDIT_VERSION = "wheel-library-audit-v1";

interface Correction {
  readonly orderedComponents: readonly [string, string];
  readonly structure: Exclude<WheelStructure, "not-applicable" | "unknown">;
  readonly issueCodes: readonly WheelIssueCode[];
  readonly note: string;
  readonly evidence: "internal-formula" | "manual-structure";
}

const CORRECTIONS: Readonly<Record<string, Correction>> = {
  "p1.char.008": { orderedComponents: ["十", "口"], structure: "top-bottom", issueCodes: ["WRONG_COMPONENT_ORDER", "MISSING_SOURCE"], note: "原始层保留“口 + 十”；派生层按古的上十下口结构改为“十 + 口”。", evidence: "manual-structure" },
  "p3.char.008": { orderedComponents: ["宀", "丁"], structure: "top-bottom", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "NON_GLYPH_COMPONENT_LABEL", "WRONG_COMPONENT_ORDER"], note: "原始层保留“宝盖 + 宁”；派生层使用可显示字形“宀 + 丁”，避免结果字自指。", evidence: "manual-structure" },
  "p4.char.001": { orderedComponents: ["土", "是"], structure: "left-right", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER"], note: "原始层保留“堤 + 土”；派生层改为“土 + 是”。", evidence: "manual-structure" },
  "p4.char.002": { orderedComponents: ["门", "活"], structure: "semi-enclosure", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER", "WRONG_STRUCTURE"], note: "原始层保留“阔 + 门”；派生层采用内部 accepted 公式“门 + 活”的半包围位置。", evidence: "internal-formula" },
  "p4.char.003": { orderedComponents: ["目", "分"], structure: "left-right", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER"], note: "原始层保留“盼 + 目”；派生层改为“目 + 分”。", evidence: "manual-structure" },
  "p4.char.004": { orderedComponents: ["氵", "衮"], structure: "left-right", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER"], note: "原始层保留“滚 + 水”；派生层改为简体字形中的“氵 + 衮”。", evidence: "manual-structure" },
  "p4.char.005": { orderedComponents: ["屯", "页"], structure: "left-right", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER"], note: "原始层保留“顿 + 页”；派生层改为“屯 + 页”。", evidence: "manual-structure" },
  "p4.char.006": { orderedComponents: ["辶", "豕"], structure: "semi-enclosure", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER", "WRONG_STRUCTURE"], note: "原始层保留“逐 + 豖”；派生层按走之旁包围位置使用“辶 + 豕”。", evidence: "manual-structure" },
  "p4.char.007": { orderedComponents: ["氵", "斩"], structure: "left-right", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER"], note: "原始层保留“渐 + 水”；派生层改为“氵 + 斩”。", evidence: "manual-structure" },
  "p4.char.008": { orderedComponents: ["犭", "尤"], structure: "left-right", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER"], note: "原始层保留“犹 + 犭”；派生层改为“犭 + 尤”。", evidence: "manual-structure" },
  "p4.char.009": { orderedComponents: ["山", "朋"], structure: "top-bottom", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER", "WRONG_STRUCTURE"], note: "原始层保留“崩 + 山”；派生层改为“山 + 朋”的上下位置。", evidence: "manual-structure" },
  "p5.char.000": { orderedComponents: ["路", "鸟"], structure: "top-bottom", issueCodes: ["WRONG_STRUCTURE"], note: "内部旧公式把鹭粗分为 lr；派生审核按目标字形改为上路下鸟。", evidence: "manual-structure" },
  "p6.char.000": { orderedComponents: ["毛", "炎"], structure: "left-right", issueCodes: ["WRONG_STRUCTURE"], note: "内部旧公式把毯粗分为 sur；派生审核按目标字形改为左右结构。", evidence: "manual-structure" },
};

const WORD_FRAGMENTS = new Set([
  "j2.word.000", "j2.word.001", "j2.word.002", "j2.word.003",
  "j2.word.005", "j2.word.006", "j2.word.007", "j2.word.008",
]);

const FIXED_CONTEXT_POLYPHONES = new Set([
  "p1.char.013", "p2.char.012", "p2.char.013", "p5.word.003",
  "p6.char.002", "p6.char.007", "j1.word.003", "j1.word.011",
  "j2.char.003", "j2.char.005", "j3.char.003", "j3.char.009", "j3.char.014",
]);

const SOURCE_FREEZE_EVIDENCE: WheelSourceEvidence = {
  sourceId: "legacy-wheel-source-freeze",
  location: "packages/data/learningGames.ts",
  version: `${freeze.sourceHeadSha}:${freeze.sourceGitBlobSha}`,
  license: "repository-source",
  supports: "raw field values, record order, source labels, and byte-bound preservation",
};

const INTERNAL_FORMULA_EVIDENCE: WheelSourceEvidence = {
  sourceId: "hanzi-radical-formula-audit",
  location: "games/hanzi-radical-battle/formula-audit.ts",
  version: freeze.sourceHeadSha,
  license: "repository-source",
  supports: "accepted component combination and coarse structure cross-check",
};

const UNIHAN_EVIDENCE: WheelSourceEvidence = {
  sourceId: "unicode-unihan",
  location: "https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip",
  version: "17.0.0",
  license: "Unicode-3.0",
  supports: "encoded Han identity and Mandarin reading cross-check; not grade alignment or etymology",
};

const MANUAL_STRUCTURE_EVIDENCE: WheelSourceEvidence = {
  sourceId: "simplified-glyph-structure-review",
  location: "target browser font stack and repository structure contract",
  version: AUDIT_VERSION,
  license: "not-applicable",
  supports: "ordered spatial slots and visible simplified glyph structure; not historical etymology",
};

function curriculumStage(gradeId: LegacyWheelGradeId): WheelCurriculumStage {
  if (gradeId === "p1" || gradeId === "p2") return "grades-1-2";
  if (gradeId === "p3" || gradeId === "p4") return "grades-3-4";
  if (gradeId === "p5" || gradeId === "p6") return "grades-5-6";
  return "grades-7-9";
}

function slotsFor(structure: WheelStructure): readonly WheelSlotId[] {
  if (structure === "left-right") return ["left", "right"];
  if (structure === "top-bottom") return ["top", "bottom"];
  if (structure === "full-enclosure" || structure === "semi-enclosure") return ["outer", "inner"];
  if (structure === "not-applicable") return ["context-first", "context-second"];
  return [];
}

function rolesFor(structure: WheelStructure): readonly WheelComponentRole[] {
  if (structure === "left-right") return ["left-component", "right-component"];
  if (structure === "top-bottom") return ["top-component", "bottom-component"];
  if (structure === "full-enclosure" || structure === "semi-enclosure") return ["enclosing-component", "inner-component"];
  if (structure === "not-applicable") return ["context-segment", "context-segment"];
  return [];
}

function structureFromFormula(structure: string, firstComponent: string): WheelStructure {
  if (structure === "lr") return "left-right";
  if (structure === "tb") return "top-bottom";
  if (structure === "sur" && firstComponent === "囗") return "full-enclosure";
  if (structure === "sur") return "semi-enclosure";
  return "unknown";
}

function makeRecord(payload: Omit<CanonicalWheelAuditRecord, "revisionHash">): CanonicalWheelAuditRecord {
  return { ...payload, revisionHash: createRevisionHash(AUDIT_VERSION, payload) };
}

export function auditLegacyWheelLibrary(): readonly CanonicalWheelAuditRecord[] {
  const records: CanonicalWheelAuditRecord[] = [];
  for (const set of LEGACY_WHEEL_SOURCE) {
    for (const mode of ["char", "word"] as const satisfies readonly WheelSourceMode[]) {
      for (const raw of set[mode].validPairs) {
        const common = {
          legacyId: raw.legacyId,
          sourceGradeId: set.id,
          sourceGradeLabel: set.label,
          curriculumStage: curriculumStage(set.id),
          sourceMode: mode,
          result: raw.result,
          pinyin: raw.pinyin,
          familiarWords: raw.words,
          alignmentStatus: "legacy-label-only" as const,
        };
        if (mode === "word") {
          const fragment = WORD_FRAGMENTS.has(raw.legacyId);
          const issueCodes: WheelIssueCode[] = ["GRADE_ALIGNMENT_UNVERIFIED"];
          if (fragment) issueCodes.push("WORD_FRAGMENT", "NON_STANDALONE_LEXEME");
          if (FIXED_CONTEXT_POLYPHONES.has(raw.legacyId)) issueCodes.push("FIXED_CONTEXT_POLYPHONE");
          records.push(makeRecord({
            ...common,
            structure: "not-applicable",
            orderedComponents: [raw.outer, raw.inner],
            slotIds: slotsFor("not-applicable"),
            componentRoles: rolesFor("not-applicable"),
            auditStatus: "not-playable-context-only",
            issueCodes,
            correctionNote: fragment ? "保留为完整成语或句中语境，不把片段作为独立词展示。" : "首版仅作为熟悉词、语境或成功后的词语回声候选。",
            sourceEvidence: [SOURCE_FREEZE_EVIDENCE],
          }));
          continue;
        }

        const correction = CORRECTIONS[raw.legacyId];
        if (correction) {
          const issueCodes = [...correction.issueCodes, "GRADE_ALIGNMENT_UNVERIFIED"] as WheelIssueCode[];
          if (FIXED_CONTEXT_POLYPHONES.has(raw.legacyId)) issueCodes.push("FIXED_CONTEXT_POLYPHONE");
          records.push(makeRecord({
            ...common,
            structure: correction.structure,
            orderedComponents: correction.orderedComponents,
            slotIds: slotsFor(correction.structure),
            componentRoles: rolesFor(correction.structure),
            auditStatus: "corrected-derived-record",
            issueCodes,
            correctionNote: correction.note,
            sourceEvidence: [SOURCE_FREEZE_EVIDENCE, UNIHAN_EVIDENCE, correction.evidence === "internal-formula" ? INTERNAL_FORMULA_EVIDENCE : MANUAL_STRUCTURE_EVIDENCE],
          }));
          continue;
        }

        const formula = HANZI_RADICAL_FORMULA_AUDIT_ENTRIES.find((entry) =>
          entry.status === "accepted"
          && entry.parts.length === 2
          && entry.parts[0] === raw.outer
          && entry.parts[1] === raw.inner
          && entry.result.char.split("/").includes(raw.result));
        if (!formula) {
          records.push(makeRecord({
            ...common,
            structure: "unknown",
            orderedComponents: [raw.outer, raw.inner],
            slotIds: [],
            componentRoles: [],
            auditStatus: "quarantined",
            issueCodes: ["MISSING_SOURCE", "UNKNOWN_STRUCTURE", "GRADE_ALIGNMENT_UNVERIFIED"],
            correctionNote: "当前内部 accepted 来源链未覆盖这条组合；原始记录保留，但不进入可玩层。",
            sourceEvidence: [SOURCE_FREEZE_EVIDENCE, UNIHAN_EVIDENCE],
          }));
          continue;
        }
        const structure = structureFromFormula(formula.result.struct, raw.outer);
        const issueCodes: WheelIssueCode[] = ["GRADE_ALIGNMENT_UNVERIFIED"];
        if (structure === "unknown") issueCodes.push("UNKNOWN_STRUCTURE");
        if (FIXED_CONTEXT_POLYPHONES.has(raw.legacyId)) issueCodes.push("FIXED_CONTEXT_POLYPHONE");
        records.push(makeRecord({
          ...common,
          structure,
          orderedComponents: [raw.outer, raw.inner],
          slotIds: slotsFor(structure),
          componentRoles: rolesFor(structure),
          auditStatus: structure === "unknown" ? "quarantined" : "validated",
          issueCodes,
          correctionNote: null,
          sourceEvidence: [SOURCE_FREEZE_EVIDENCE, INTERNAL_FORMULA_EVIDENCE, UNIHAN_EVIDENCE],
        }));
      }
    }
  }
  return records;
}

