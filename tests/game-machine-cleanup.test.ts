import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  CLEANUP_PLAN_RELATIVE_PATH,
  CLEANUP_RESULT_RELATIVE_PATH,
  PROJECT_HYGIENE_RELATIVE_PATH,
  type CleanupPathSpec,
  type CleanupPolicy,
  applyStep07Cleanup,
  planStep07Cleanup,
  verifyStep07Cleanup,
} from "../tools/game-machine-review/cleanup";

const temporaryRoots: string[] = [];

function tempWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "game-machine-cleanup-"));
  temporaryRoots.push(workspace);
  return workspace;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    const resolved = resolve(root);
    expect(resolved.startsWith(resolve(tmpdir()))).toBe(true);
    rmSync(resolved, { recursive: true, force: true });
  }
});

function write(workspace: string, path: string, contents: string): void {
  const fullPath = resolve(workspace, path);
  mkdirSync(resolve(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, contents, "utf8");
}

function required(path: string, reason: string): CleanupPathSpec {
  return { path, reason, required: true };
}

function optional(path: string, reason: string): CleanupPathSpec {
  return { path, reason, required: false };
}

function fixturePolicy(): CleanupPolicy {
  return {
    policyId: "TEMP_FIXTURE_POLICY_V1",
    canonical: [required("artifacts/machine/canonical.json", "canonical verdict")],
    returnPackage: [optional("artifacts/machine/final.zip", "return ZIP")],
    history: [required("artifacts/machine/history.json", "lineage")],
    transient: [optional("artifacts/machine/transient", "raw transient evidence")],
    protectedHuman: [required("artifacts/human/parent-feedback.json", "parent feedback")],
    assets: {
      common: [required("artifacts/assets/manifest.json", "asset manifest")],
      selected: [required("artifacts/assets/selected", "selected candidates")],
    },
    rawAssetCandidatesRoot: "artifacts/assets/raw",
    selectedAssetsRoot: "artifacts/assets/selected",
    readinessZipPath: "artifacts/machine/final.zip",
  };
}

function createFixture(workspace: string): CleanupPolicy {
  const policy = fixturePolicy();
  write(workspace, ".gitignore", "artifacts/\n");
  write(workspace, "tracked.txt", "pushed source\n");
  write(workspace, "artifacts/machine/canonical.json", "{\"status\":\"PASS\"}\n");
  write(workspace, "artifacts/machine/history.json", "{\"repairs\":3}\n");
  write(workspace, "artifacts/machine/transient/raw.log", "transient\n");
  write(workspace, "artifacts/human/parent-feedback.json", "{\"protected\":true}\n");
  write(workspace, "artifacts/assets/manifest.json", "{\"families\":16}\n");
  write(workspace, "artifacts/assets/selected/chosen.webp", "chosen candidate\n");
  write(workspace, "artifacts/assets/raw/chosen-copy.webp", "chosen candidate\n");
  write(workspace, "artifacts/assets/raw/rejected.webp", "rejected candidate\n");
  return policy;
}

function initializePushedMain(workspace: string): void {
  execFileSync("git", ["init", "-b", "main"], { cwd: workspace });
  execFileSync("git", ["config", "user.email", "cleanup-test@example.invalid"], { cwd: workspace });
  execFileSync("git", ["config", "user.name", "Cleanup Test"], { cwd: workspace });
  execFileSync("git", ["add", ".gitignore", "tracked.txt"], { cwd: workspace });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: workspace });
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" }).trim();
  execFileSync("git", ["update-ref", "refs/remotes/origin/main", head], { cwd: workspace });
}

describe("STEP 07 cleanup transaction", () => {
  it("plans exact T0-T4 inventories without deleting any real target", () => {
    const workspace = tempWorkspace();
    const policy = createFixture(workspace);

    const plan = planStep07Cleanup({
      workspaceRoot: workspace,
      policy,
      now: new Date("2026-08-10T00:00:00.000Z"),
    });

    expect(plan.status).toBe("READY_FOR_APPLY");
    expect(Object.keys(plan.tiers)).toEqual([
      "T0_CANONICAL",
      "T1_RETURN_PACKAGE",
      "T2_HISTORY_ARCHIVE",
      "T3_TRANSIENT_DELETE",
      "T4_PROTECTED_HUMAN",
    ]);
    expect(plan.guardrails).toMatchObject({
      exactPathsOnly: true,
      recursiveGlobAuthority: false,
      readinessZipRequiredBeforeApply: true,
      protectedHumanEvidenceDeletionForbidden: true,
      hashesRecheckedBeforeDelete: true,
    });
    expect(plan.deletionAllowlist.map((entry) => entry.path)).toEqual([
      "artifacts/assets/raw/rejected.webp",
      "artifacts/machine/transient",
    ]);
    expect(plan.deletionAllowlist.every((entry) => /^[A-F0-9]{64}$/.test(entry.sha256))).toBe(true);
    expect(existsSync(resolve(workspace, "artifacts/machine/transient/raw.log"))).toBe(true);
    expect(existsSync(resolve(workspace, "artifacts/assets/raw/rejected.webp"))).toBe(true);
    expect(existsSync(resolve(workspace, "artifacts/human/parent-feedback.json"))).toBe(true);
    expect(existsSync(resolve(workspace, CLEANUP_PLAN_RELATIVE_PATH))).toBe(true);
  });

  it("requires the final ZIP and fails closed when protected inventory changes", () => {
    const workspace = tempWorkspace();
    const policy = createFixture(workspace);
    planStep07Cleanup({ workspaceRoot: workspace, policy });

    expect(() => applyStep07Cleanup({ workspaceRoot: workspace, policy })).toThrow(/readiness ZIP must exist/i);

    write(workspace, "artifacts/machine/final.zip", "immutable return package\n");
    write(workspace, "artifacts/human/parent-feedback.json", "changed after plan\n");
    expect(() => applyStep07Cleanup({ workspaceRoot: workspace, policy })).toThrow(/Protected inventory identity changed/i);
    expect(existsSync(resolve(workspace, "artifacts/machine/transient/raw.log"))).toBe(true);
  });

  it("applies only exact hashed targets, preserves the ZIP, and verifies project hygiene", () => {
    const workspace = tempWorkspace();
    const policy = createFixture(workspace);
    initializePushedMain(workspace);
    const plan = planStep07Cleanup({ workspaceRoot: workspace, policy });
    write(workspace, "artifacts/machine/final.zip", "immutable return package\n");

    const result = applyStep07Cleanup({
      workspaceRoot: workspace,
      policy,
      now: new Date("2026-08-10T00:01:00.000Z"),
    });

    expect(result.status).toBe("PASS");
    expect(result.cleanupState).toBe("TRANSIENT_EVIDENCE_CLEANED");
    expect(result.protectedEvidenceState).toBe("PROTECTED_EVIDENCE_PRESERVED");
    expect(result.readinessZip.unchanged).toBe(true);
    expect(result.readinessZip.sha256After).toBe(result.readinessZip.sha256Before);
    expect(result.deletedEvidenceManifest).toEqual(
      plan.deletionAllowlist.map((entry) => ({
        path: entry.path,
        kind: entry.kind,
        originalSha256: entry.sha256,
        bytes: entry.bytes,
        reasonDeleted: entry.reason,
      })),
    );
    expect(existsSync(resolve(workspace, "artifacts/machine/transient"))).toBe(false);
    expect(existsSync(resolve(workspace, "artifacts/assets/raw/rejected.webp"))).toBe(false);
    expect(existsSync(resolve(workspace, "artifacts/assets/raw/chosen-copy.webp"))).toBe(true);
    expect(existsSync(resolve(workspace, "artifacts/human/parent-feedback.json"))).toBe(true);
    expect(existsSync(resolve(workspace, CLEANUP_RESULT_RELATIVE_PATH))).toBe(true);

    const verdict = verifyStep07Cleanup({
      workspaceRoot: workspace,
      policy,
      now: new Date("2026-08-10T00:02:00.000Z"),
    });
    expect(verdict.status).toBe("PASS");
    expect(verdict.projectHygieneVerdict).toBe("PROJECT_CLEAN");
    expect(Object.values(verdict.checks).every((value) => value === "PASS")).toBe(true);
    expect(existsSync(resolve(workspace, PROJECT_HYGIENE_RELATIVE_PATH))).toBe(true);

    write(workspace, "artifacts/machine/final.zip", "mutated return package\n");
    const failed = verifyStep07Cleanup({ workspaceRoot: workspace, policy });
    expect(failed.status).toBe("FAIL");
    expect(failed.checks.readinessZip).toBe("FAIL");
  });

  it("never authorizes a protected evidence path as a transient target", () => {
    const workspace = tempWorkspace();
    const policy = createFixture(workspace);
    policy.transient = [optional("artifacts/human/parent-feedback.json", "unsafe target")];

    expect(() => planStep07Cleanup({ workspaceRoot: workspace, policy })).toThrow(/Protected evidence/i);
    expect(readFileSync(resolve(workspace, "artifacts/human/parent-feedback.json"), "utf8")).toContain("protected");
  });
});

