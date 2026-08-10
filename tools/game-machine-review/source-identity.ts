import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const MACHINE_REVIEW_GENERATED_PREFIXES = [
  ".git/",
  ".playwright-cli/",
  "artifacts/",
  "dist/",
  "node_modules/",
  "output/",
  "playwright-report/",
  "test-results/",
  "tmp/",
] as const;

function normalizeGitPaths(contents: string): string[] {
  return contents
    .split("\0")
    .map((path) => path.replaceAll("\\", "/"))
    .filter(Boolean);
}

function isGeneratedPath(path: string): boolean {
  return MACHINE_REVIEW_GENERATED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function listUntrackedMachineReviewSourceFiles(workspaceRoot = process.cwd()): string[] {
  return normalizeGitPaths(execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  }))
    .filter((path) => !isGeneratedPath(path))
    .sort();
}

export function listMachineReviewSourceFiles(workspaceRoot = process.cwd()): string[] {
  const paths = normalizeGitPaths(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  }))
    .filter((path) => !isGeneratedPath(path))
    .filter((path) => existsSync(resolve(workspaceRoot, path)) && statSync(resolve(workspaceRoot, path)).isFile());
  return [...new Set(paths)].sort();
}

export function computeMachineReviewSourceTreeSha256(workspaceRoot = process.cwd()): string {
  const hash = createHash("sha256");
  for (const path of listMachineReviewSourceFiles(workspaceRoot)) {
    hash.update(path, "utf8");
    hash.update("\0");
    hash.update(readFileSync(resolve(workspaceRoot, path)));
    hash.update("\0");
  }
  return hash.digest("hex").toUpperCase();
}

function main(): void {
  process.stdout.write(`${computeMachineReviewSourceTreeSha256(resolve(process.argv[2] ?? process.cwd()))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
