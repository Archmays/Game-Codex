import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  computeMachineReviewSourceTreeSha256,
  listUntrackedMachineReviewSourceFiles,
} from "../../../../tools/game-machine-review/source-identity";

const workspaceRoot = resolve(process.cwd());
const outputDirectory = resolve(workspaceRoot, "artifacts/game-machine-review/step-07/final-closure");
mkdirSync(outputDirectory, { recursive: true });

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: workspaceRoot, encoding: "utf8" });
}

const status = git(["status", "--short"]);
const changedFiles = git(["status", "--porcelain=v1", "--untracked-files=all"]);
const trackedDiff = git(["diff", "--binary", "--no-ext-diff"]);
const untrackedSourceFiles = listUntrackedMachineReviewSourceFiles(workspaceRoot);
const untrackedPatches = untrackedSourceFiles.map((path) => {
  const result = spawnSync("git", ["diff", "--no-index", "--binary", "--", "/dev/null", path], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`Unable to capture untracked source patch for ${path}: ${result.stderr}`);
  }
  return result.stdout;
});
const completeDiff = `${trackedDiff}${untrackedPatches.join("")}`;
const sourceTreeSha256 = computeMachineReviewSourceTreeSha256(workspaceRoot);
const identity = {
  schemaVersion: 1,
  recordType: "STEP07_PRE_CLOSURE_SOURCE_IDENTITY",
  generatedAtUtc: new Date().toISOString(),
  authorizationId: "HUMAN_AUTHORIZED_STEP07_FINAL_CLOSURE_SKILL_CLEANUP_ASSET_FOUNDRY_01",
  branch: git(["branch", "--show-current"]).trim(),
  head: git(["rev-parse", "HEAD"]).trim(),
  originMain: git(["rev-parse", "origin/main"]).trim(),
  reportedDirtySourceTreeSha256: "1ACE8B3AECF0D018446731A30A8FFFDB8206746F0D659A50ABEC8021DA90BB39",
  sourceTreeSha256,
  matchesReportedDirtySourceTree: sourceTreeSha256 === "1ACE8B3AECF0D018446731A30A8FFFDB8206746F0D659A50ABEC8021DA90BB39",
  untrackedSourceFiles,
  snapshots: {
    gitStatusSha256: createHash("sha256").update(status).digest("hex").toUpperCase(),
    changedFilesSha256: createHash("sha256").update(changedFiles).digest("hex").toUpperCase(),
    diffSha256: createHash("sha256").update(completeDiff).digest("hex").toUpperCase(),
  },
  sourceMutationAllowed: false,
};

writeFileSync(resolve(outputDirectory, "PRE-CLOSURE-GIT-STATUS.txt"), status, "utf8");
writeFileSync(resolve(outputDirectory, "PRE-CLOSURE-CHANGED-FILES.txt"), changedFiles, "utf8");
writeFileSync(resolve(outputDirectory, "PRE-CLOSURE-DIFF.patch"), completeDiff, "utf8");
writeFileSync(resolve(outputDirectory, "PRE-CLOSURE-SOURCE-IDENTITY.json"), `${JSON.stringify(identity, null, 2)}\n`, "utf8");
process.stdout.write(`${sourceTreeSha256}\n`);
