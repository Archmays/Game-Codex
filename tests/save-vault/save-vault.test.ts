import {
  SAVE_VAULT_FORMAT,
  SAVE_VAULT_VERSION,
  SaveVaultValidationError,
  clearAllKnownGameSaves,
  createSaveVaultBackup,
  restoreSaveVault,
  serializeSaveVaultBackup,
  validateSaveVaultText,
  type SaveVaultEntry,
  type SaveVaultStorage,
} from "../../packages/save-vault";
import { SAVE_VAULT_PRE_IMPORT_BACKUP_KEY } from "../../packages/data/saveKeyInventory";

class MemoryStorage implements SaveVaultStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

class FailOnceStorage extends MemoryStorage {
  failKey: string | null = null;
  override setItem(key: string, value: string): void {
    if (this.failKey === key) { this.failKey = null; throw new Error("injected write failure"); }
    super.setItem(key, value);
  }
}

async function sha(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function backupWithEntries(entries: SaveVaultEntry[]): Promise<string> {
  entries.sort((left, right) => left.key.localeCompare(right.key, "en"));
  return JSON.stringify({
    format: SAVE_VAULT_FORMAT,
    version: SAVE_VAULT_VERSION,
    exportedAt: "2026-08-22T00:00:00.000Z",
    originHint: "local-test",
    entries,
    manifestSha256: await sha(JSON.stringify({ format: SAVE_VAULT_FORMAT, version: SAVE_VAULT_VERSION, entries })),
  });
}

async function entry(key: string, value: string): Promise<SaveVaultEntry> {
  return { key, bytes: new TextEncoder().encode(value).byteLength, sha256: await sha(value), value };
}

describe("Parent Save Vault", () => {
  it("exports only exact known keys and preserves raw bytes", async () => {
    const storage = new MemoryStorage();
    const raw = "{  \"version\": 2, \"kept\": \"原样\" }\u0000";
    storage.setItem("family-games/english-world/v2", raw);
    storage.setItem("other-localhost-app/save", "never export");
    const backup = await createSaveVaultBackup(storage, { now: new Date("2026-08-22T00:00:00Z"), originHint: "test" });
    expect(backup.entries).toHaveLength(1);
    expect(backup.entries[0]).toMatchObject({ key: "family-games/english-world/v2", value: raw });
    expect(serializeSaveVaultBackup(backup).endsWith("\n")).toBe(true);
    expect((await validateSaveVaultText(serializeSaveVaultBackup(backup))).knownEntries[0].value).toBe(raw);
  });

  it("previews without writes, skips unknown keys, and restores future known saves raw", async () => {
    const current = new MemoryStorage();
    current.setItem("family-games/english-world/v2", "current");
    const future = "{\"version\":99,\"future\":true}";
    const text = await backupWithEntries([
      await entry("family-games/english-world/v2", future),
      await entry("unknown-project/save", "untouched"),
    ]);
    const validated = await validateSaveVaultText(text);
    expect(current.getItem(SAVE_VAULT_PRE_IMPORT_BACKUP_KEY)).toBeNull();
    expect(validated.preview).toMatchObject({ checksum: "PASS", unknownKeys: ["unknown-project/save"], futureKeys: ["family-games/english-world/v2"] });
    const result = restoreSaveVault(current, validated, new Date("2026-08-22T00:01:00Z"));
    expect(current.getItem("family-games/english-world/v2")).toBe(future);
    expect(current.getItem("unknown-project/save")).toBeNull();
    expect(current.getItem(SAVE_VAULT_PRE_IMPORT_BACKUP_KEY)).toContain("current");
    expect(result).toMatchObject({ skippedUnknownKeys: ["unknown-project/save"], readbackVerified: true, reloadRequired: true });
  });

  it("rejects invalid JSON, unsafe keys, future vault versions, and checksum changes", async () => {
    await expect(validateSaveVaultText("not-json")).rejects.toBeInstanceOf(SaveVaultValidationError);
    const unsafe = await backupWithEntries([await entry("../script", "value")]);
    await expect(validateSaveVaultText(unsafe)).rejects.toThrow("不安全");
    const future = JSON.stringify({ format: SAVE_VAULT_FORMAT, version: 999, entries: [] });
    await expect(validateSaveVaultText(future)).rejects.toThrow("更新版本");
    const valid = await backupWithEntries([await entry("family-games/math-world/v1", "abc")]);
    await expect(validateSaveVaultText(valid.replace('"abc"', '"abd"'))).rejects.toThrow("条目校验失败");
  });

  it("rolls back every target if a restore write fails", async () => {
    const storage = new FailOnceStorage();
    storage.setItem("family-games/math-world/v1", "before-math");
    storage.setItem("family-games/english-world/v2", "before-english");
    const validated = await validateSaveVaultText(await backupWithEntries([
      await entry("family-games/math-world/v1", "after-math"),
      await entry("family-games/english-world/v2", "after-english"),
    ]));
    storage.failKey = "family-games/math-world/v1";
    expect(() => restoreSaveVault(storage, validated)).toThrow("已自动回到恢复前");
    expect(storage.getItem("family-games/math-world/v1")).toBe("before-math");
    expect(storage.getItem("family-games/english-world/v2")).toBe("before-english");
  });

  it("clears only present exact known keys after export confirmation", () => {
    const storage = new MemoryStorage();
    storage.setItem("family-games/math-world/v1", "known");
    storage.setItem("other-localhost-app/save", "untouched");
    expect(() => clearAllKnownGameSaves(storage, "NO" as never)).toThrow("家长确认");
    const result = clearAllKnownGameSaves(storage, "CONFIRMED_AFTER_EXPORT", new Date("2026-08-22T00:02:00Z"));
    expect(result).toEqual({ clearedKeys: ["family-games/math-world/v1"], unknownStorageTouched: 0 });
    expect(storage.getItem("family-games/math-world/v1")).toBeNull();
    expect(storage.getItem("other-localhost-app/save")).toBe("untouched");
    expect(storage.getItem(SAVE_VAULT_PRE_IMPORT_BACKUP_KEY)).toContain("known");
  });
});
