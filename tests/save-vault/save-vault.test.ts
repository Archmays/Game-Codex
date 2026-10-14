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
import { vi } from "vitest";

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
  it('round-trips both STEP4 formats, old raw strings and manual feedback without accepting prefix lookalikes', async () => {
    const storage = new MemoryStorage();
    const rows = [
      ['family-games/hanzi-tower-defense/v3', '{ "version":99,"future":"原样" }'],
      ['family-games/hanzi-tower-defense/v2', '{broken old raw'],
      ['family-games/hanzi-word-adventure/v2', '{ "version":2,"preserve":"chapter states" }'],
      ['family-games/hanzi-word-adventure/v1', '{ "version":1,"preserve":"undo" }'],
      ['family-games/hanzi-word-adventure/companions/v1', '{ "version":99,"future":"双角色原文" }'],
      ['family-games/hanzi-tower-defense/tactics/v1', '{broken tactics raw'],
      ['family-games/step4-playtest/feedback-v1', '{ "version":1,"text":"<b>本机手填</b>" }'],
    ];
    for (const [key,value] of rows) storage.setItem(key,value);
    storage.setItem('family-games/hanzi-tower-defense/v3/future', 'unrelated');
    storage.setItem('family-games/hanzi-tower-defense/tactics/v1/future', 'unrelated tactics');
    storage.setItem('family-games/hanzi-word-adventure/companions/v1/future', 'unrelated companions');
    const backup = await createSaveVaultBackup(storage);
    expect(backup.entries).toHaveLength(rows.length);
    const validated = await validateSaveVaultText(serializeSaveVaultBackup(backup));
    expect(validated.preview.futureKeys).toContain('family-games/hanzi-tower-defense/v3');
    expect(validated.preview.futureKeys).toContain('family-games/hanzi-word-adventure/companions/v1');
    const destination = new MemoryStorage();
    destination.setItem('family-games/hanzi-tower-defense/v3/future', 'untouched');
    restoreSaveVault(destination, validated);
    for (const [key,value] of rows) expect(destination.getItem(key)).toBe(value);
    expect(destination.getItem('family-games/hanzi-tower-defense/v3/future')).toBe('untouched');
  });
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
      await entry("family-games/make-target/progress", future),
      await entry("unknown-project/save", "untouched"),
    ]);
    const validated = await validateSaveVaultText(text);
    expect(current.getItem(SAVE_VAULT_PRE_IMPORT_BACKUP_KEY)).toBeNull();
    expect(validated.preview).toMatchObject({
      checksum: "PASS",
      unknownKeys: ["unknown-project/save"],
      futureKeys: ["family-games/english-world/v2", "family-games/make-target/progress"],
    });
    const result = restoreSaveVault(current, validated, new Date("2026-08-22T00:01:00Z"));
    expect(current.getItem("family-games/english-world/v2")).toBe(future);
    expect(current.getItem("family-games/make-target/progress")).toBe(future);
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

  it.each(["write", "readback mismatch", "readback exception"] as const)(
    "restores existing raw values and removes newly created keys after a partial restore %s failure",
    async (failure) => {
      const storage = new MemoryStorage();
      const existingKey = "family-games/english-world/v2";
      const absentKey = "family-games/hanzi-tower-defense/v3";
      const lastKey = "family-games/math-world/v1";
      const originalRaw = '{  "version": 99, "原样": "保留" }\u0000';
      storage.setItem(existingKey, originalRaw);
      storage.setItem(lastKey, "before-math");
      storage.setItem("other-localhost-app/save", "untouched");
      const validated = await validateSaveVaultText(await backupWithEntries([
        await entry(existingKey, "after-english"),
        await entry(absentKey, "after-hanzi"),
        await entry(lastKey, "after-math"),
      ]));
      let injected = false;
      const writes = vi.spyOn(storage, "setItem").mockImplementation((key, value) => {
        if (failure === "write" && key === lastKey && value === "after-math" && !injected) {
          injected = true;
          throw new Error("injected partial write failure");
        }
        storage.values.set(key, value);
      });
      vi.spyOn(storage, "getItem").mockImplementation((key) => {
        const value = storage.values.get(key) ?? null;
        if (failure !== "write" && key === lastKey && value === "after-math" && !injected) {
          injected = true;
          if (failure === "readback exception") throw new Error("injected readback failure");
          return "incorrect readback";
        }
        return value;
      });
      const removals = vi.spyOn(storage, "removeItem");

      expect(() => restoreSaveVault(storage, validated, new Date("2026-08-22T00:01:00Z")))
        .toThrow("已自动回到恢复前的本机记录");

      expect(injected).toBe(true);
      expect(writes).toHaveBeenCalledWith(existingKey, "after-english");
      expect(writes).toHaveBeenCalledWith(absentKey, "after-hanzi");
      expect(removals).toHaveBeenCalledWith(absentKey);
      expect(storage.getItem(existingKey)).toBe(originalRaw);
      expect(storage.getItem(absentKey)).toBeNull();
      expect(storage.getItem(lastKey)).toBe("before-math");
      expect(storage.getItem("other-localhost-app/save")).toBe("untouched");
      expect(JSON.parse(storage.getItem(SAVE_VAULT_PRE_IMPORT_BACKUP_KEY)!)).toEqual({
        format: "game-codex-pre-import-backup",
        version: 1,
        createdAt: "2026-08-22T00:01:00.000Z",
        entries: [
          { key: existingKey, value: originalRaw },
          { key: absentKey, value: null },
          { key: lastKey, value: "before-math" },
        ],
      });
    },
  );

  it.each(["write refusal", "readback mismatch"] as const)(
    "does not write game records when the pre-import backup has a %s",
    async (failure) => {
      const storage = new MemoryStorage();
      const existingKey = "family-games/english-world/v2";
      const absentKey = "family-games/math-world/v1";
      storage.setItem(existingKey, "before-english");
      storage.setItem("other-localhost-app/save", "untouched");
      const validated = await validateSaveVaultText(await backupWithEntries([
        await entry(existingKey, "after-english"),
        await entry(absentKey, "after-math"),
      ]));
      const writes = vi.spyOn(storage, "setItem").mockImplementation((key, value) => {
        if (key === SAVE_VAULT_PRE_IMPORT_BACKUP_KEY && failure === "write refusal") {
          throw new Error("injected snapshot write refusal");
        }
        storage.values.set(key, value);
      });
      vi.spyOn(storage, "getItem").mockImplementation((key) => {
        if (key === SAVE_VAULT_PRE_IMPORT_BACKUP_KEY && failure === "readback mismatch") return null;
        return storage.values.get(key) ?? null;
      });
      const removals = vi.spyOn(storage, "removeItem");

      expect(() => restoreSaveVault(storage, validated)).toThrow(
        failure === "write refusal" ? "snapshot write refusal" : "没有改动任何游戏进度",
      );

      expect(writes).toHaveBeenCalledTimes(1);
      expect(writes.mock.calls[0][0]).toBe(SAVE_VAULT_PRE_IMPORT_BACKUP_KEY);
      expect(removals).not.toHaveBeenCalled();
      expect(storage.getItem(existingKey)).toBe("before-english");
      expect(storage.getItem(absentKey)).toBeNull();
      expect(storage.getItem("other-localhost-app/save")).toBe("untouched");
    },
  );

  it.each(["removal exception", "removal ignored"] as const)(
    "reports incomplete rollback truthfully when a newly created key has a %s",
    async (failure) => {
      const storage = new FailOnceStorage();
      const existingKey = "family-games/english-world/v2";
      const absentKey = "family-games/hanzi-tower-defense/v3";
      const lastKey = "family-games/math-world/v1";
      storage.setItem(existingKey, "before-english");
      storage.setItem(lastKey, "before-math");
      const validated = await validateSaveVaultText(await backupWithEntries([
        await entry(existingKey, "after-english"),
        await entry(absentKey, "after-hanzi"),
        await entry(lastKey, "after-math"),
      ]));
      storage.failKey = lastKey;
      vi.spyOn(storage, "removeItem").mockImplementation((key) => {
        if (key === absentKey) {
          if (failure === "removal exception") throw new Error("injected rollback removal failure");
          return;
        }
        storage.values.delete(key);
      });

      let restoreError: unknown;
      try { restoreSaveVault(storage, validated); } catch (error) { restoreError = error; }

      expect(restoreError).toBeInstanceOf(Error);
      expect((restoreError as Error).message).toBe("恢复失败，而且自动回滚未能完整验证。请保留当前浏览器页面。");
      expect((restoreError as Error).cause).toEqual(new Error("injected write failure"));
      expect(storage.getItem(existingKey)).toBe("before-english");
      expect(storage.getItem(absentKey)).toBe("after-hanzi");
      expect(storage.getItem(lastKey)).toBe("before-math");
      expect(storage.getItem(SAVE_VAULT_PRE_IMPORT_BACKUP_KEY)).not.toBeNull();
    },
  );

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
