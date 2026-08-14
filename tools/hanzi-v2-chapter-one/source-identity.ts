import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const GENERATED_PREFIXES = [
  ".git/",
  "artifacts/",
  "dist/",
  "node_modules/",
  "output/",
  "playwright-report/",
  "test-results/",
  "tmp/",
] as const;

function gitPaths(workspaceRoot: string): string[] {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  })
    .split("\0")
    .map((path) => path.replaceAll("\\", "/"))
    .filter(Boolean)
    .filter((path) => !GENERATED_PREFIXES.some((prefix) => path.startsWith(prefix)))
    .filter((path) => existsSync(resolve(workspaceRoot, path)) && statSync(resolve(workspaceRoot, path)).isFile());
}

/** Stable SHA-256 over sorted tracked plus non-ignored source paths and bytes. */
export function computeHanziV2SourceTreeSha256(workspaceRoot = process.cwd()): string {
  const hash = createHash("sha256");
  for (const path of [...new Set(gitPaths(workspaceRoot))].sort()) {
    hash.update(path, "utf8");
    hash.update("\0");
    hash.update(readFileSync(resolve(workspaceRoot, path)));
    hash.update("\0");
  }
  return hash.digest("hex").toUpperCase();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.stdout.write(`${computeHanziV2SourceTreeSha256(resolve(process.argv[2] ?? process.cwd()))}\n`);
}
