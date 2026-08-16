import { HANZI_RADICAL_FORMULA_AUDIT_ENTRIES } from "../../../formula-audit";
import { createRevisionHash } from "../../content/revision-hash";
import { LEGACY_WHEEL_SOURCE, LEGACY_WHEEL_SOURCE_GIT_BLOB_SHA, LEGACY_WHEEL_SOURCE_HEAD_SHA } from "../library/legacy-wheel-source";
import type { LegacyWheelGradeId, WheelCurriculumStage, WheelSourceMode } from "../library/legacy-wheel-types";
import type { CanonicalWheelAuditRecord, WheelComponentRole, WheelSlotId, WheelSourceEvidence, WheelStructure } from "../types";
import type { WheelIssueCode } from "./issue-codes";

const AUDIT_VERSION = "wheel-library-audit-v2";

type CorrectionEvidence = "internal-formula" | "manual-structure" | "mmh-dictionary" | "cns-ids" | "cns-run-ids" | "cns-look-ids" | "cns-medical-ids" | "moe-qiaoshou";

interface Correction {
  readonly orderedComponents: readonly [string, string];
  readonly structure: Exclude<WheelStructure, "not-applicable" | "unknown">;
  readonly issueCodes: readonly WheelIssueCode[];
  readonly note: string;
  readonly evidence: readonly CorrectionEvidence[];
  readonly pinyin?: string;
  readonly familiarWords?: readonly string[];
}

const CORRECTIONS: Readonly<Record<string, Correction>> = {
  "p1.char.008": { orderedComponents: ["十", "口"], structure: "top-bottom", issueCodes: ["WRONG_COMPONENT_ORDER", "MISSING_SOURCE"], note: "原始层保留“口 + 十”；派生层按古的上十下口结构改为“十 + 口”。", evidence: ["manual-structure"] },
  "p1.char.004": { orderedComponents: ["龵", "目"], structure: "top-bottom", issueCodes: ["WRONG_COMPONENT_FORM", "FONT_RENDER_RISK"], note: "原始层保留“手 + 目”；派生层按 CNS IDS ⿱龵目记录手在字内的真实变形。该部件不进入首版可玩池。", evidence: ["cns-look-ids", "mmh-dictionary"] },
  "p2.char.008": { orderedComponents: ["𧾷", "包"], structure: "left-right", issueCodes: ["WRONG_COMPONENT_FORM", "FONT_RENDER_RISK"], note: "原始层保留“足 + 包”；派生层按 CNS IDS ⿰𧾷包记录足字旁的真实位置字形。该扩展区部件不进入首版可玩池。", evidence: ["cns-run-ids", "mmh-dictionary"] },
  "p3.char.001": { orderedComponents: ["⺼", "巴"], structure: "left-right", issueCodes: ["WRONG_COMPONENT_FORM", "FONT_RENDER_RISK"], note: "原始层保留“月 + 巴”；派生层按肉月旁字形改为“⺼ + 巴”。该记录不进入首版可玩池，避免把肉旁教学成月旁。", evidence: ["mmh-dictionary"] },
  "p3.char.002": { orderedComponents: ["⺼", "要"], structure: "left-right", issueCodes: ["WRONG_COMPONENT_FORM", "FONT_RENDER_RISK"], note: "原始层保留“月 + 要”；派生层按肉月旁字形改为“⺼ + 要”。", evidence: ["mmh-dictionary"] },
  "p3.char.008": { orderedComponents: ["宀", "丁"], structure: "top-bottom", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "NON_GLYPH_COMPONENT_LABEL", "WRONG_COMPONENT_ORDER"], note: "原始层保留“宝盖 + 宁”；派生层使用可显示字形“宀 + 丁”，避免结果字自指。", evidence: ["manual-structure"] },
  "p4.char.001": { orderedComponents: ["土", "是"], structure: "left-right", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER"], note: "原始层保留“堤 + 土”；派生层改为“土 + 是”。", evidence: ["manual-structure"] },
  "p4.char.002": { orderedComponents: ["门", "活"], structure: "semi-enclosure", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER", "WRONG_STRUCTURE"], note: "原始层保留“阔 + 门”；派生层采用内部 accepted 公式“门 + 活”的半包围位置。", evidence: ["internal-formula"] },
  "p4.char.003": { orderedComponents: ["目", "分"], structure: "left-right", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER"], note: "原始层保留“盼 + 目”；派生层改为“目 + 分”。", evidence: ["manual-structure"] },
  "p4.char.004": { orderedComponents: ["氵", "衮"], structure: "left-right", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER"], note: "原始层保留“滚 + 水”；派生层改为简体字形中的“氵 + 衮”。", evidence: ["manual-structure"] },
  "p4.char.005": { orderedComponents: ["屯", "页"], structure: "left-right", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER"], note: "原始层保留“顿 + 页”；派生层改为“屯 + 页”。", evidence: ["manual-structure"] },
  "p4.char.006": { orderedComponents: ["辶", "豕"], structure: "semi-enclosure", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER", "WRONG_STRUCTURE"], note: "原始层保留“逐 + 豖”；派生层按走之旁包围位置使用“辶 + 豕”。", evidence: ["manual-structure"] },
  "p4.char.007": { orderedComponents: ["氵", "斩"], structure: "left-right", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER"], note: "原始层保留“渐 + 水”；派生层改为“氵 + 斩”。", evidence: ["manual-structure"] },
  "p4.char.008": { orderedComponents: ["犭", "尤"], structure: "left-right", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER"], note: "原始层保留“犹 + 犭”；派生层改为“犭 + 尤”。", evidence: ["manual-structure"] },
  "p4.char.009": { orderedComponents: ["山", "朋"], structure: "top-bottom", issueCodes: ["CIRCULAR_DECOMPOSITION", "RESULT_USED_AS_COMPONENT", "WRONG_COMPONENT_ORDER", "WRONG_STRUCTURE"], note: "原始层保留“崩 + 山”；派生层改为“山 + 朋”的上下位置。", evidence: ["manual-structure"] },
  "p5.char.000": { orderedComponents: ["路", "鸟"], structure: "top-bottom", issueCodes: ["WRONG_STRUCTURE"], note: "内部旧公式把鹭粗分为 lr；派生审核按目标字形改为上路下鸟。", evidence: ["manual-structure", "mmh-dictionary"] },
  "p6.char.000": { orderedComponents: ["毛", "炎"], structure: "semi-enclosure", issueCodes: ["WRONG_STRUCTURE"], note: "原始组件保留；派生审核按外部 IDS ⿺毛炎纠正为左下包围，而非初次审核误标的左右结构。", evidence: ["mmh-dictionary"] },
  "p6.char.006": { orderedComponents: ["⺶", "丑"], structure: "semi-enclosure", issueCodes: ["WRONG_COMPONENT_FORM", "WRONG_STRUCTURE", "FONT_RENDER_RISK"], note: "原始层保留“羊 + 丑”；派生层按 CNS IDS ⿸⺶丑纠正为左上包围。该记录不进入首版可玩池。", evidence: ["cns-ids", "mmh-dictionary"] },
  "j1.char.009": { orderedComponents: ["氵", "历"], structure: "left-right", issueCodes: ["WRONG_COMPONENT_FORM"], note: "原始层保留“氵 + 力”；派生层按简体字形纠正为“氵 + 历”。", evidence: ["mmh-dictionary"] },
  "j2.char.003": { orderedComponents: ["尧", "羽"], structure: "semi-enclosure", issueCodes: ["WRONG_STRUCTURE", "FIXED_CONTEXT_POLYPHONE"], note: "原始组件保留；派生审核按外部 IDS ⿺尧羽纠正为左下包围，并依据教育部词典固定“翘首”语境读 qiáo。", evidence: ["mmh-dictionary", "moe-qiaoshou"] },
  "j3.char.014": { orderedComponents: ["门", "心"], structure: "semi-enclosure", pinyin: "mèn", familiarWords: ["苦闷"], issueCodes: ["PINYIN_MISMATCH", "FIXED_CONTEXT_POLYPHONE"], note: "原始层同时保留“苦闷/闷热”；派生层固定 mèn 的“苦闷”语境，隔离读 mēn 的“闷热”。", evidence: ["mmh-dictionary"] },
  "j3.char.017": { orderedComponents: ["匸", "矢"], structure: "semi-enclosure", issueCodes: ["WRONG_COMPONENT_FORM"], note: "原始层保留“匚 + 矢”；派生层按 CNS 与外部 IDS 纠正为“匸 + 矢”。", evidence: ["cns-medical-ids", "mmh-dictionary"] },
};

const WORD_FRAGMENTS = new Set([
  "j2.word.000", "j2.word.001", "j2.word.002", "j2.word.003",
  "j2.word.005", "j2.word.006", "j2.word.007", "j2.word.008",
]);

const WORD_CONTEXT_ISSUES = new Map<string, string>([
  ["p3.word.002", "原始例句“虚心使人进步”不含目标“骄傲”，仅构成反义对照；保留原始字段并标为语义未对齐的 context-only。"],
  ["p4.word.001", "原始例词“人声鼎沸”只出现“沸”，未完整出现目标“沸腾”；保留原始字段并标为 context-only。"],
]);

const FIXED_CONTEXT_POLYPHONES = new Set([
  "p1.char.013", "p2.char.012", "p2.char.013", "p5.word.003",
  "p6.char.002", "p6.char.007", "j1.word.003", "j1.word.011",
  "j2.char.003", "j2.char.005", "j3.char.003", "j3.char.009", "j3.char.014",
]);

const SOURCE_FREEZE_EVIDENCE: WheelSourceEvidence = {
  sourceId: "legacy-wheel-source-freeze",
  location: "packages/data/learningGames.ts",
  version: `${LEGACY_WHEEL_SOURCE_HEAD_SHA}:${LEGACY_WHEEL_SOURCE_GIT_BLOB_SHA}`,
  license: "repository-source",
  supports: "raw field values, record order, source labels, and byte-bound preservation",
};

const INTERNAL_FORMULA_EVIDENCE: WheelSourceEvidence = {
  sourceId: "hanzi-radical-formula-audit",
  location: "games/hanzi-radical-battle/formula-audit.ts",
  version: LEGACY_WHEEL_SOURCE_HEAD_SHA,
  license: "repository-source",
  supports: "accepted component combination and coarse structure cross-check",
};

const UNIHAN_EVIDENCE: WheelSourceEvidence = {
  sourceId: "unicode-unihan",
  location: "https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip",
  version: "17.0.0",
  license: "Unicode-3.0",
  supports: "encoded Han identity and available Mandarin reading fields; a contextual reading requires separate lexical evidence",
};

const MAKE_ME_HANZI_DICTIONARY_EVIDENCE: WheelSourceEvidence = {
  sourceId: "make-me-a-hanzi-dictionary",
  location: "https://github.com/skishore/makemeahanzi/blob/bddc96d41bef78427ed0e034e9f7e31d71fd1b92/dictionary.txt",
  version: "bddc96d41bef78427ed0e034e9f7e31d71fd1b92:sha256:744bb05d5b0742e9ee35c37791f94d56a173349b3367569e7ca11e510364d203",
  license: "LGPL-3.0-or-later",
  supports: "temporary audit-only simplified-glyph IDS root and component-form cross-check; no runtime data imported",
};

const CNS_IDS_EVIDENCE: WheelSourceEvidence = {
  sourceId: "cns11643-shame-ids",
  location: "https://www.cns11643.gov.tw/wordView.jsp?ID=89184",
  version: "CNS11643-2024:U+7F9E",
  license: "Taiwan-Government-Data-Open-License-1.0",
  supports: "羞 IDS ⿸⺶丑 and exact component form",
};

const CNS_RUN_IDS_EVIDENCE: WheelSourceEvidence = {
  sourceId: "cns11643-run-ids",
  location: "https://www.cns11643.gov.tw/wordView.jsp?ID=90692",
  version: "CNS11643-2024:U+8DD1",
  license: "Taiwan-Government-Data-Open-License-1.0",
  supports: "跑 IDS ⿰𧾷包 and exact positional component form",
};

const CNS_LOOK_IDS_EVIDENCE: WheelSourceEvidence = {
  sourceId: "cns11643-look-ids",
  location: "https://www.cns11643.gov.tw/wordView.jsp?ID=86624",
  version: "CNS11643-2024:U+770B",
  license: "Taiwan-Government-Data-Open-License-1.0",
  supports: "看 IDS ⿱龵目 and exact positional component form",
};

const CNS_MEDICAL_IDS_EVIDENCE: WheelSourceEvidence = {
  sourceId: "cns11643-medical-ids",
  location: "https://www.cns11643.gov.tw/wordView.jsp?ID=205926",
  version: "CNS11643-2024:U+533B",
  license: "Taiwan-Government-Data-Open-License-1.0",
  supports: "医 IDS ⿷匸矢 and exact enclosing component form",
};

const CNS_CORRUPT_IDS_EVIDENCE: WheelSourceEvidence = {
  sourceId: "cns11643-corrupt-ids",
  location: "https://www.cns11643.gov.tw/wordView.jsp?ID=92751",
  version: "CNS11643-2024:U+8150",
  license: "Taiwan-Government-Data-Open-License-1.0",
  supports: "腐 alternative high-level IDS ⿸府肉",
};

const SINICA_JU_EVIDENCE: WheelSourceEvidence = {
  sourceId: "sinica-character-structure-ju",
  location: "https://chardb.iis.sinica.edu.tw/evolution.jsp?cid=10323",
  version: "accessed-2026-08-16:U+5C45",
  license: "reference-only",
  supports: "居 uses 尸 as its outer form; external 户 decomposition is treated as a documented source variant",
};

const MOE_KEHAN_EVIDENCE: WheelSourceEvidence = {
  sourceId: "moe-concised-dictionary-kehan",
  location: "https://dict.concised.moe.edu.tw/dictView.jsp?ID=18026&la=0&powerMode=0",
  version: "MOE-Concised-Dictionary-2021",
  license: "reference-only",
  supports: "fixed lexical context 可汗 and pronunciation kè hán",
};

const MOE_QIAOSHOU_EVIDENCE: WheelSourceEvidence = {
  sourceId: "moe-revised-dictionary-qiaoshou",
  location: "https://dict.revised.moe.edu.tw/dictView.jsp?ID=99918&la=0&powerMode=0",
  version: "MOE-Revised-Dictionary-2021",
  license: "reference-only",
  supports: "fixed lexical context 翘首 and pronunciation qiáo shǒu",
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

function evidenceFor(correction: Correction): readonly WheelSourceEvidence[] {
  return correction.evidence.map((source) => {
    if (source === "internal-formula") return INTERNAL_FORMULA_EVIDENCE;
    if (source === "manual-structure") return MANUAL_STRUCTURE_EVIDENCE;
    if (source === "mmh-dictionary") return MAKE_ME_HANZI_DICTIONARY_EVIDENCE;
    if (source === "cns-ids") return CNS_IDS_EVIDENCE;
    if (source === "cns-run-ids") return CNS_RUN_IDS_EVIDENCE;
    if (source === "cns-look-ids") return CNS_LOOK_IDS_EVIDENCE;
    if (source === "cns-medical-ids") return CNS_MEDICAL_IDS_EVIDENCE;
    return MOE_QIAOSHOU_EVIDENCE;
  });
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
          const contextIssue = WORD_CONTEXT_ISSUES.get(raw.legacyId);
          const issueCodes: WheelIssueCode[] = ["GRADE_ALIGNMENT_UNVERIFIED"];
          if (fragment) issueCodes.push("WORD_FRAGMENT", "NON_STANDALONE_LEXEME");
          if (contextIssue) issueCodes.push("MEANING_MISMATCH");
          if (FIXED_CONTEXT_POLYPHONES.has(raw.legacyId)) issueCodes.push("FIXED_CONTEXT_POLYPHONE");
          records.push(makeRecord({
            ...common,
            structure: "not-applicable",
            orderedComponents: [raw.outer, raw.inner],
            slotIds: slotsFor("not-applicable"),
            componentRoles: rolesFor("not-applicable"),
            auditStatus: "not-playable-context-only",
            issueCodes,
            correctionNote: contextIssue ?? (fragment ? "保留为完整成语或句中语境，不把片段作为独立词展示。" : "首版仅作为熟悉词、语境或成功后的词语回声候选。"),
            sourceEvidence: [SOURCE_FREEZE_EVIDENCE],
          }));
          continue;
        }

        const correction = CORRECTIONS[raw.legacyId];
        if (correction) {
          const issueCodes = [...new Set<WheelIssueCode>([...correction.issueCodes, "GRADE_ALIGNMENT_UNVERIFIED"])] as WheelIssueCode[];
          if (FIXED_CONTEXT_POLYPHONES.has(raw.legacyId) && !issueCodes.includes("FIXED_CONTEXT_POLYPHONE")) issueCodes.push("FIXED_CONTEXT_POLYPHONE");
          records.push(makeRecord({
            ...common,
            pinyin: correction.pinyin ?? common.pinyin,
            familiarWords: correction.familiarWords ?? common.familiarWords,
            structure: correction.structure,
            orderedComponents: correction.orderedComponents,
            slotIds: slotsFor(correction.structure),
            componentRoles: rolesFor(correction.structure),
            auditStatus: "corrected-derived-record",
            issueCodes,
            correctionNote: correction.note,
            sourceEvidence: [SOURCE_FREEZE_EVIDENCE, UNIHAN_EVIDENCE, ...evidenceFor(correction)],
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
        const sourceEvidence = [SOURCE_FREEZE_EVIDENCE, INTERNAL_FORMULA_EVIDENCE, UNIHAN_EVIDENCE];
        if (raw.legacyId === "j3.char.003") sourceEvidence.push(MOE_KEHAN_EVIDENCE);
        if (raw.legacyId === "p6.char.005") sourceEvidence.push(CNS_CORRUPT_IDS_EVIDENCE);
        if (raw.legacyId === "j1.char.017") sourceEvidence.push(SINICA_JU_EVIDENCE);
        records.push(makeRecord({
          ...common,
          structure,
          orderedComponents: [raw.outer, raw.inner],
          slotIds: slotsFor(structure),
          componentRoles: rolesFor(structure),
          auditStatus: structure === "unknown" ? "quarantined" : "validated",
          issueCodes,
          correctionNote: null,
          sourceEvidence,
        }));
      }
    }
  }
  return records;
}
