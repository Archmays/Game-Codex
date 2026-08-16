import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRevisionHash } from "../../games/hanzi-radical-battle/v2/content/revision-hash";
import { CANONICAL_WHEEL_LIBRARY } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/canonical-wheel-library";
import freeze from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/legacy-wheel-source-freeze.json";
import { LEGACY_WHEEL_SOURCE } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/legacy-wheel-source";
import { PLAYABLE_WHEEL_MANIFEST, PLAYABLE_WHEEL_MANIFEST_VERSION, WHEEL_GRADE_OPTIONS, getWheelPool } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest";

// Human-reviewed contracts are deliberately static and independent of the
// audit builder, so a bad audited tuple cannot validate itself.
const EXPECTED_PLAYABLE_CONTRACTS = [
  ["p1.char.000", "明", "míng", "光明", "left-right", ["日", "月"], ["left", "right"]],
  ["p1.char.001", "尖", "jiān", "笔尖", "top-bottom", ["小", "大"], ["top", "bottom"]],
  ["p1.char.002", "灭", "miè", "灭火", "top-bottom", ["一", "火"], ["top", "bottom"]],
  ["p1.char.017", "字", "zì", "写字", "top-bottom", ["宀", "子"], ["top", "bottom"]],
  ["p2.char.000", "清", "qīng", "清水", "left-right", ["氵", "青"], ["left", "right"]],
  ["p2.char.001", "晴", "qíng", "晴天", "left-right", ["日", "青"], ["left", "right"]],
  ["p2.char.009", "抱", "bào", "拥抱", "left-right", ["扌", "包"], ["left", "right"]],
  ["p2.char.011", "松", "sōng", "松树", "left-right", ["木", "公"], ["left", "right"]],
  ["p3.char.007", "草", "cǎo", "草原", "top-bottom", ["艹", "早"], ["top", "bottom"]],
  ["p3.char.004", "猫", "māo", "花猫", "left-right", ["犭", "苗"], ["left", "right"]],
  ["p3.char.006", "花", "huā", "花朵", "top-bottom", ["艹", "化"], ["top", "bottom"]],
  ["p3.char.013", "安", "ān", "安全", "top-bottom", ["宀", "女"], ["top", "bottom"]],
  ["p4.char.000", "潮", "cháo", "潮湿", "left-right", ["氵", "朝"], ["left", "right"]],
  ["p4.char.010", "洋", "yáng", "海洋", "left-right", ["氵", "羊"], ["left", "right"]],
  ["p4.char.013", "做", "zuò", "做事", "left-right", ["亻", "故"], ["left", "right"]],
  ["p4.char.017", "闻", "wén", "新闻", "semi-enclosure", ["门", "耳"], ["outer", "inner"]],
  ["p5.char.001", "嗜", "shì", "嗜好", "left-right", ["口", "耆"], ["left", "right"]],
  ["p5.char.004", "恩", "ēn", "恩惠", "top-bottom", ["因", "心"], ["top", "bottom"]],
  ["p5.char.008", "英", "yīng", "英雄", "top-bottom", ["艹", "央"], ["top", "bottom"]],
  ["p5.char.006", "盲", "máng", "盲人", "top-bottom", ["亡", "目"], ["top", "bottom"]],
  ["p6.char.001", "陈", "chén", "陈列", "left-right", ["阝", "东"], ["left", "right"]],
  ["p6.char.003", "虹", "hóng", "彩虹", "left-right", ["虫", "工"], ["left", "right"]],
  ["p6.char.013", "盆", "pén", "花盆", "top-bottom", ["分", "皿"], ["top", "bottom"]],
  ["p6.char.009", "霜", "shuāng", "冰霜", "top-bottom", ["雨", "相"], ["top", "bottom"]],
  ["j1.char.000", "酝", "yùn", "酝酿", "left-right", ["酉", "云"], ["left", "right"]],
  ["j1.char.010", "枫", "fēng", "枫叶", "left-right", ["木", "风"], ["left", "right"]],
  ["j1.char.003", "喉", "hóu", "喉咙", "left-right", ["口", "侯"], ["left", "right"]],
  ["j1.char.007", "朗", "lǎng", "朗润", "left-right", ["良", "月"], ["left", "right"]],
  ["j2.char.000", "溃", "kuì", "溃退", "left-right", ["氵", "贵"], ["left", "right"]],
  ["j2.char.002", "督", "dū", "督战", "top-bottom", ["叔", "目"], ["top", "bottom"]],
  ["j2.char.004", "酷", "kù", "酷似", "left-right", ["酉", "告"], ["left", "right"]],
  ["j2.char.006", "娴", "xián", "娴熟", "left-right", ["女", "闲"], ["left", "right"]],
  ["j3.char.013", "阅", "yuè", "阅读", "semi-enclosure", ["门", "兑"], ["outer", "inner"]],
  ["j3.char.003", "汗", "hán", "可汗", "left-right", ["氵", "干"], ["left", "right"]],
  ["j3.char.004", "锦", "jǐn", "锦绣", "left-right", ["钅", "帛"], ["left", "right"]],
  ["j3.char.010", "圆", "yuán", "圆形", "full-enclosure", ["囗", "员"], ["outer", "inner"]],
] as const;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

function stripLegacyIds() {
  return LEGACY_WHEEL_SOURCE.map((set) => ({
    id: set.id,
    label: set.label,
    char: { outerOptions: [...set.char.outerOptions], innerOptions: [...set.char.innerOptions], validPairs: set.char.validPairs.map(({ legacyId: _legacyId, ...record }) => record) },
    word: { outerOptions: [...set.word.outerOptions], innerOptions: [...set.word.innerOptions], validPairs: set.word.validPairs.map(({ legacyId: _legacyId, ...record }) => record) },
  }));
}

describe("Wheel Workshop three-layer library", () => {
  it("preserves every source field, record, set, and order behind the Git-bound freeze", () => {
    expect(LEGACY_WHEEL_SOURCE.map((set) => set.id)).toEqual(freeze.setIds);
    expect(LEGACY_WHEEL_SOURCE.map((set) => set.label)).toEqual(freeze.setLabels);
    expect(LEGACY_WHEEL_SOURCE).toHaveLength(9);
    for (const set of LEGACY_WHEEL_SOURCE) {
      expect(set.char.validPairs).toHaveLength(freeze.countsBySetAndMode[set.id].char);
      expect(set.word.validPairs).toHaveLength(freeze.countsBySetAndMode[set.id].word);
    }
    const hash = createHash("sha256").update(stableStringify(stripLegacyIds())).digest("hex");
    expect(hash).toBe(freeze.stableJsonSha256);
    expect(LEGACY_WHEEL_SOURCE.flatMap((set) => set.char.validPairs)).toHaveLength(freeze.totalCharRecords);
    expect(LEGACY_WHEEL_SOURCE.flatMap((set) => set.word.validPairs)).toHaveLength(freeze.totalWordRecords);
  });

  it("assigns unique stable IDs and exactly one audit disposition to all 270 raw records", () => {
    const raw = LEGACY_WHEEL_SOURCE.flatMap((set) => [...set.char.validPairs, ...set.word.validPairs]);
    expect(raw).toHaveLength(270);
    expect(new Set(raw.map((record) => record.legacyId)).size).toBe(raw.length);
    expect(CANONICAL_WHEEL_LIBRARY).toHaveLength(raw.length);
    expect(new Set(CANONICAL_WHEEL_LIBRARY.map((record) => record.legacyId))).toEqual(new Set(raw.map((record) => record.legacyId)));
    expect(CANONICAL_WHEEL_LIBRARY.every((record) => record.alignmentStatus === "legacy-label-only")).toBe(true);
  });

  it("keeps source errors in raw data while correcting or isolating them in the audit layer", () => {
    const rawNing = LEGACY_WHEEL_SOURCE[2].char.validPairs[8];
    expect(rawNing).toMatchObject({ legacyId: "p3.char.008", outer: "宝盖", inner: "宁", result: "宁" });
    expect(CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === rawNing.legacyId)).toMatchObject({ auditStatus: "corrected-derived-record", orderedComponents: ["宀", "丁"] });
    for (const id of Array.from({ length: 9 }, (_, index) => `p4.char.${String(index + 1).padStart(3, "0")}`)) {
      const audited = CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === id)!;
      expect(audited.auditStatus, id).toBe("corrected-derived-record");
      expect(audited.orderedComponents, id).not.toContain(audited.result);
    }
    expect(CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === "p3.char.000")).toMatchObject({ auditStatus: "quarantined", issueCodes: expect.arrayContaining(["MISSING_SOURCE"]) });
    expect(CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === "p3.char.001")).toMatchObject({ auditStatus: "corrected-derived-record", orderedComponents: ["⺼", "巴"] });
    expect(CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === "p1.char.004")).toMatchObject({ auditStatus: "corrected-derived-record", orderedComponents: ["龵", "目"] });
    expect(CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === "p2.char.008")).toMatchObject({ auditStatus: "corrected-derived-record", orderedComponents: ["𧾷", "包"] });
    expect(CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === "p3.char.002")).toMatchObject({ auditStatus: "corrected-derived-record", orderedComponents: ["⺼", "要"] });
    expect(CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === "p6.char.000")).toMatchObject({ auditStatus: "corrected-derived-record", structure: "semi-enclosure" });
    expect(CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === "p6.char.006")).toMatchObject({ auditStatus: "corrected-derived-record", structure: "semi-enclosure", orderedComponents: ["⺶", "丑"] });
    expect(CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === "j1.char.009")).toMatchObject({ auditStatus: "corrected-derived-record", orderedComponents: ["氵", "历"] });
    expect(CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === "j2.char.003")).toMatchObject({ auditStatus: "corrected-derived-record", structure: "semi-enclosure" });
    expect(CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === "j3.char.014")).toMatchObject({ auditStatus: "corrected-derived-record", pinyin: "mèn", familiarWords: ["苦闷"] });
    for (const id of ["p3.word.002", "p4.word.001"]) expect(CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === id)?.issueCodes).toContain("MEANING_MISMATCH");
  });

  it("keeps word fragments context-only and outside the playable manifest", () => {
    for (const result of ["摧枯", "拉朽", "锐不", "可当", "不苟", "惊心", "动魄"]) {
      const record = CANONICAL_WHEEL_LIBRARY.find((entry) => entry.result === result)!;
      expect(record).toMatchObject({ auditStatus: "not-playable-context-only", issueCodes: expect.arrayContaining(["WORD_FRAGMENT", "NON_STANDALONE_LEXEME"]) });
      expect(PLAYABLE_WHEEL_MANIFEST.some((entry) => entry.glyph === result)).toBe(false);
    }
  });

  it("publishes four validated two-slot characters per grade with stable revision hashes", () => {
    expect(PLAYABLE_WHEEL_MANIFEST).toHaveLength(36);
    for (const gradeId of freeze.setIds) expect(PLAYABLE_WHEEL_MANIFEST.filter((record) => record.sourceGradeId === gradeId), gradeId).toHaveLength(4);
    expect(new Set(PLAYABLE_WHEEL_MANIFEST.map((record) => record.id)).size).toBe(36);
    for (const record of PLAYABLE_WHEEL_MANIFEST) {
      const audit = CANONICAL_WHEEL_LIBRARY.find((entry) => entry.legacyId === record.legacyId)!;
      expect(["validated", "corrected-derived-record"]).toContain(audit.auditStatus);
      expect(audit.issueCodes).not.toContain("CIRCULAR_DECOMPOSITION");
      expect(audit.issueCodes).not.toContain("FONT_RENDER_RISK");
      expect(record.orderedComponents).toHaveLength(2);
      expect(record.slotIds).toHaveLength(2);
      expect(record.componentRoles).toHaveLength(2);
      expect(record.orderedComponents).not.toContain(record.glyph);
      expect(record.orderedComponents.every((glyph) => glyph !== "宝盖" && [...glyph].length === 1)).toBe(true);
      expect(record.sourceEvidence.length).toBeGreaterThanOrEqual(3);
      const { revisionHash: _revisionHash, ...payload } = record;
      expect(record.revisionHash).toBe(createRevisionHash(PLAYABLE_WHEEL_MANIFEST_VERSION, payload));
    }
    expect(PLAYABLE_WHEEL_MANIFEST.some((record) => ["p1.char.004", "p2.char.008", "p3.char.001", "p6.char.006", "j1.char.002"].includes(record.legacyId))).toBe(false);
    expect(PLAYABLE_WHEEL_MANIFEST.map((record) => [record.legacyId, record.glyph, record.pinyin, record.familiarWord, record.structure, record.orderedComponents, record.slotIds])).toEqual(EXPECTED_PLAYABLE_CONTRACTS);
  });

  it("keeps child-facing scroll names from revealing any target glyph before a spin", () => {
    for (const option of WHEEL_GRADE_OPTIONS) {
      for (const record of getWheelPool(option.id)) expect(option.worldName, `${option.id} leaks ${record.glyph}`).not.toContain(record.glyph);
    }
  });
});
