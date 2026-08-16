import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRevisionHash } from "../../games/hanzi-radical-battle/v2/content/revision-hash";
import { CANONICAL_WHEEL_LIBRARY } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/canonical-wheel-library";
import freeze from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/legacy-wheel-source-freeze.json";
import { LEGACY_WHEEL_SOURCE } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/legacy-wheel-source";
import { PLAYABLE_WHEEL_MANIFEST, PLAYABLE_WHEEL_MANIFEST_VERSION } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest";

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
      expect(record.orderedComponents).toHaveLength(2);
      expect(record.slotIds).toHaveLength(2);
      expect(record.componentRoles).toHaveLength(2);
      expect(record.orderedComponents).not.toContain(record.glyph);
      expect(record.orderedComponents.every((glyph) => glyph !== "宝盖" && [...glyph].length === 1)).toBe(true);
      expect(record.sourceEvidence.length).toBeGreaterThanOrEqual(3);
      const { revisionHash: _revisionHash, ...payload } = record;
      expect(record.revisionHash).toBe(createRevisionHash(PLAYABLE_WHEEL_MANIFEST_VERSION, payload));
    }
  });
});

