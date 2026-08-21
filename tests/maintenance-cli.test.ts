import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  RETURN_SHA,
  RETURN_ZIP,
  TASK_ID,
  applyPlan,
  assertDeletionAllowed,
  type CleanupPlan,
} from "../tools/maintenance/repository-maintenance";

const roots: string[] = [];

function fixture(): { base: string; repo: string; archive: string } {
  const base = mkdtempSync(join(tmpdir(), "game-codex-maintenance-"));
  roots.push(base);
  const repo = resolve(base, "repo");
  const archive = resolve(base, "archive");
  mkdirSync(resolve(repo, ".git"), { recursive: true });
  return { base, repo, archive };
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function plan(repo: string, archive: string, path: string, contents: string, action: "delete" | "archive-delete" = "delete"): CleanupPlan {
  return {
    schemaVersion: 1,
    taskId: TASK_ID,
    repositoryRoot: repo,
    archiveRoot: archive,
    generatedAt: "2026-08-22T00:00:00.000Z",
    includeActiveTask: false,
    entries: [{
      path,
      bytes: Buffer.byteLength(contents),
      sha256: sha256(contents),
      tier: action === "delete" ? "T3_TRANSIENT_DELETE" : "T2_HISTORY_ARCHIVE",
      action,
      reason: "test fixture",
    }],
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("repository maintenance safety", () => {
  it("rejects traversal, wildcards, .git, and protected package paths", () => {
    const { repo } = fixture();
    expect(() => assertDeletionAllowed(repo, "../escape.txt")).toThrow(/traversal/);
    expect(() => assertDeletionAllowed(repo, "tmp/**/*.zip")).toThrow(/wildcard/);
    expect(() => assertDeletionAllowed(repo, ".git/config")).toThrow(/\.git/);
    expect(() => assertDeletionAllowed(repo, RETURN_ZIP)).toThrow(/Protected/);
    expect(() => assertDeletionAllowed(repo, RETURN_SHA)).toThrow(/Protected/);
  });

  it("refuses a symlink or junction that escapes the repository", () => {
    const { base, repo } = fixture();
    const outside = resolve(base, "outside");
    mkdirSync(outside);
    writeFileSync(resolve(outside, "victim.txt"), "outside", "utf8");
    symlinkSync(outside, resolve(repo, "escape"), "junction");
    expect(() => assertDeletionAllowed(repo, "escape/victim.txt")).toThrow(/Symlink|junction/);
  });

  it("refuses apply when current bytes do not match the approved SHA-256", () => {
    const { repo, archive } = fixture();
    const target = resolve(repo, "tmp", "mismatch.tmp");
    mkdirSync(resolve(repo, "tmp"));
    writeFileSync(target, "changed", "utf8");
    const approved = plan(repo, archive, "tmp/mismatch.tmp", "original");
    expect(() => applyPlan(approved)).toThrow(/SHA-256 mismatch/);
    expect(readFileSync(target, "utf8")).toBe("changed");
  });

  it("archives by content hash, verifies the copy, then deletes the exact source", () => {
    const { repo, archive } = fixture();
    const target = resolve(repo, "source", "raw.bin");
    mkdirSync(resolve(repo, "source"));
    writeFileSync(target, "canonical raw bytes", "utf8");
    const approved = plan(repo, archive, "source/raw.bin", "canonical raw bytes", "archive-delete");
    const result = applyPlan(approved, "2026-08-22T00:00:01.000Z");
    expect(existsSync(target)).toBe(false);
    expect(readFileSync(resolve(archive, "objects", "sha256", sha256("canonical raw bytes")), "utf8")).toBe("canonical raw bytes");
    expect(result).toMatchObject({ archivedFiles: 1, deletedFiles: 1, alreadyAbsent: 0 });
  });

  it("is idempotent after a verified archive-delete", () => {
    const { repo, archive } = fixture();
    const target = resolve(repo, "source", "raw.bin");
    mkdirSync(resolve(repo, "source"));
    writeFileSync(target, "same bytes", "utf8");
    const approved = plan(repo, archive, "source/raw.bin", "same bytes", "archive-delete");
    applyPlan(approved);
    const second = applyPlan(approved);
    expect(second).toMatchObject({ archivedFiles: 1, deletedFiles: 0, alreadyAbsent: 1 });
  });

  it("preserves the prior archive manifest when a later plan only deletes transients", () => {
    const { repo, archive } = fixture();
    mkdirSync(resolve(repo, "source"));
    writeFileSync(resolve(repo, "source", "raw.bin"), "archived", "utf8");
    applyPlan(plan(repo, archive, "source/raw.bin", "archived", "archive-delete"));
    mkdirSync(resolve(repo, "tmp"));
    writeFileSync(resolve(repo, "tmp", "later.tmp"), "transient", "utf8");
    applyPlan(plan(repo, archive, "tmp/later.tmp", "transient", "delete"));
    const manifest = JSON.parse(readFileSync(resolve(archive, "reports", "archive-manifest.json"), "utf8")) as { entries: unknown[] };
    expect(manifest.entries).toHaveLength(1);
  });
});
