import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PLAY_SURFACE_MANIFEST } from "../../packages/data/playSurfaceManifest";
import { EXPORTABLE_SAVE_KEYS, KNOWN_SAVE_KEYS } from "../../packages/data/saveKeyInventory";
import {
  OBSERVATION_FORMAT,
  OBSERVATION_MAX_RECORDS,
  OBSERVATION_NOTE_MAX_CHARS,
  OBSERVATION_RETENTION_DAYS,
  OBSERVATION_SCHEMA_VERSION,
  OBSERVATION_STORAGE_KEY,
  createObservationBundle,
  createObservationExportPreview,
  createObservationRecord,
  deleteAllObservationRecords,
  loadObservationRecords,
  normalizeObservationNote,
  pruneObservationRecords,
  saveObservationRecord,
  serializeObservationBundle,
  validateObservationBundle,
  validateObservationRecord,
  type NaturalUseObservationRecord,
  type ObservationStorage,
} from "../../packages/observation/natural-use";
import {
  SAVE_VAULT_FORMAT,
  SAVE_VAULT_VERSION,
  clearAllKnownGameSaves,
  createSaveVaultBackup,
  restoreSaveVault,
  validateSaveVaultText,
} from "../../packages/save-vault";

class MemoryStorage implements ObservationStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function record(id: string, dateLocal = "2026-08-22", note?: string): NaturalUseObservationRecord {
  return createObservationRecord({
    dateLocal,
    buildCommit: "8bf24d2e06dd93638cc75601601518d6e854e7f2",
    surfaceId: "math-world",
    moment: "during-play",
    tags: ["hesitated"],
    parentHelp: "none",
    outcome: "continued",
    note,
  }, { id, today: "2026-08-22" });
}

function sha(value: string): string { return createHash("sha256").update(value).digest("hex"); }

describe("Natural-use observation schema and local store", () => {
  it("uses only manifest surfaces and the separate non-family-games key", () => {
    expect(PLAY_SURFACE_MANIFEST).toHaveLength(39);
    expect(OBSERVATION_STORAGE_KEY).toBe("game-codex/parent-observation/v1");
    expect(OBSERVATION_STORAGE_KEY.startsWith("family-games/")).toBe(false);
    expect(KNOWN_SAVE_KEYS.some((entry) => entry.key === OBSERVATION_STORAGE_KEY)).toBe(false);
    expect(EXPORTABLE_SAVE_KEYS.some((entry) => entry.key === OBSERVATION_STORAGE_KEY)).toBe(false);
  });

  it("records nothing on load/open when the parent did not save", () => {
    const storage = new MemoryStorage();
    expect(loadObservationRecords(storage, "2026-08-22")).toEqual([]);
    expect(storage.getItem(OBSERVATION_STORAGE_KEY)).toBeNull();
  });

  it("normalizes plain-text notes, preserves Unicode and rejects the 241-character boundary", () => {
    expect(normalizeObservationNote("  看见\n<script>🙂\u0000  ")).toBe("看见 <script>🙂");
    expect(record("note-240", "2026-08-22", "🙂".repeat(OBSERVATION_NOTE_MAX_CHARS)).note).toHaveLength(OBSERVATION_NOTE_MAX_CHARS * 2);
    expect(() => record("note-241", "2026-08-22", "字".repeat(OBSERVATION_NOTE_MAX_CHARS + 1))).toThrow(/最多 240/);
  });

  it("rejects unknown, private, inferred, exact-time and unsupported fields", () => {
    const base = record("strict-fields");
    expect(() => validateObservationRecord({ ...base, childName: "hidden" })).toThrow(/forbidden field: childName/);
    expect(() => validateObservationRecord({ ...base, liked: true })).toThrow(/unknown field: liked/);
    expect(() => validateObservationRecord({ ...base, dateLocal: "2026-08-22T10:30:00Z" })).toThrow(/YYYY-MM-DD/);
    expect(() => validateObservationRecord({ ...base, surfaceId: "route-auto-captured" })).toThrow(/PLAY_SURFACE_MANIFEST/);
    expect(() => validateObservationRecord({ ...base, tags: ["liked"] })).toThrow(/unsupported tag/);
  });

  it("keeps the inclusive 90-day boundary and prunes day 91", () => {
    const future = { ...record("future"), dateLocal: "2026-08-23" };
    const records = [record("day-89", "2026-05-25"), record("day-90", "2026-05-24"), record("day-91", "2026-05-23"), future];
    expect(OBSERVATION_RETENTION_DAYS).toBe(90);
    expect(pruneObservationRecords(records, "2026-08-22").map((entry) => entry.id)).toEqual(["day-89", "day-90"]);
  });

  it("prunes the oldest saved record at 101 and never retains over 100", () => {
    const storage = new MemoryStorage();
    for (let index = 0; index < 101; index += 1) saveObservationRecord(storage, record(`capacity-${index}`), "2026-08-22");
    const records = loadObservationRecords(storage, "2026-08-22");
    expect(OBSERVATION_MAX_RECORDS).toBe(100);
    expect(records).toHaveLength(100);
    expect(records[0].id).toBe("capacity-1");
    expect(records.at(-1)?.id).toBe("capacity-100");
  });

  it("exports only validated records with a verifiable SHA-256 and transparent preview", async () => {
    const records = [record("export-a", "2026-08-20", "只写发生了什么"), record("export-b")];
    const preview = createObservationExportPreview(records);
    expect(preview).toEqual({ recordCount: 2, earliestDate: "2026-08-20", latestDate: "2026-08-22", distinctSurfaces: 1, optionalNoteCount: 1 });
    const bundle = await createObservationBundle(records, "8bf24d2e06dd93638cc75601601518d6e854e7f2", new Date("2026-08-22T12:00:00.000Z"));
    expect(await validateObservationBundle(JSON.parse(serializeObservationBundle(bundle)))).toEqual(bundle);
    await expect(createObservationBundle([{ ...records[0], school: "private" } as NaturalUseObservationRecord], "8bf24d2e06dd93638cc75601601518d6e854e7f2")).rejects.toThrow(/forbidden field: school/);
    await expect(validateObservationBundle({ ...bundle, records: [{ ...records[0], outcome: "blocked" }, records[1]] })).rejects.toThrow(/SHA-256/);
    await expect(validateObservationBundle({ ...bundle, records: [{ ...records[0], school: "private" }, records[1]] })).rejects.toThrow(/forbidden field: school/);
  });

  it("keeps Save Vault export/import/clear and observation delete-all purpose-separated", async () => {
    const storage = new MemoryStorage();
    const observationRaw = JSON.stringify({ format: OBSERVATION_FORMAT, version: OBSERVATION_SCHEMA_VERSION, records: [record("isolation")] });
    storage.setItem(OBSERVATION_STORAGE_KEY, observationRaw);
    storage.setItem("family-games/math-world/v1", '{"version":1,"kept":"game"}');

    const saveBackup = await createSaveVaultBackup(storage);
    expect(saveBackup.entries.some((entry) => entry.key === OBSERVATION_STORAGE_KEY)).toBe(false);

    const unknownValue = "attempted observation import";
    const unknownEntry = { key: OBSERVATION_STORAGE_KEY, bytes: Buffer.byteLength(unknownValue), sha256: sha(unknownValue), value: unknownValue };
    const manifestSha256 = sha(JSON.stringify({ format: SAVE_VAULT_FORMAT, version: SAVE_VAULT_VERSION, entries: [unknownEntry] }));
    const validated = await validateSaveVaultText(JSON.stringify({ format: SAVE_VAULT_FORMAT, version: SAVE_VAULT_VERSION, exportedAt: new Date().toISOString(), originHint: "local-game-codex", entries: [unknownEntry], manifestSha256 }));
    expect(validated.preview.unknownKeys).toEqual([OBSERVATION_STORAGE_KEY]);
    restoreSaveVault(storage, validated);
    expect(storage.getItem(OBSERVATION_STORAGE_KEY)).toBe(observationRaw);

    clearAllKnownGameSaves(storage, "CONFIRMED_AFTER_EXPORT");
    expect(storage.getItem(OBSERVATION_STORAGE_KEY)).toBe(observationRaw);
    storage.setItem("family-games/math-world/v1", '{"version":1,"kept":"game"}');
    deleteAllObservationRecords(storage);
    expect(storage.getItem(OBSERVATION_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("family-games/math-world/v1")).toBe('{"version":1,"kept":"game"}');
  });
});
