import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = resolve(
  process.cwd(),
  "tools/game-machine-review/PACKAGE_STEP_07_MACHINE_READINESS.ps1",
);

describe("STEP 07 machine-readiness package script", () => {
  it("is valid PowerShell with the canonical fail-closed and owned-temp contract", () => {
    const bytes = readFileSync(scriptPath);
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
    const script = bytes.toString("utf8");
    expect(script).toContain("STEP-07_MACHINE_QA_REAL_SECOND_USE_READINESS_RETURN_TO_CHATGPT.zip");
    expect(script).toContain("verify-readiness");
    expect(script).toContain("origin/main");
    expect(script).toContain("Assert-PushedCleanCommit");
    expect(script).toContain("Invoke-CanonicalReadinessVerification");
    expect(script.match(/Invoke-CanonicalReadinessVerification/g)?.length).toBeGreaterThanOrEqual(3);
    expect(script).toContain("tmp\\game-machine-review\\step-07-readiness");
    expect(script).toContain("^package-[a-f0-9]{32}$");
    expect(script).toContain("STEP-07_MACHINE_READINESS_PACKAGE_MANIFEST.json");
    expect(script).toContain("readinessZipSha256Sidecar");
    expect(script).toContain("outputZipIncludedInPayload = $false");
    expect(script).toContain("realSecondUsePerformed = \"NO\"");
    expect(script).toContain("RETURN-PACKAGE-INVENTORY.json");
    expect(script).toContain("Return-package entries must contain only sourcePath and archivePath");
    expect(script).toContain("raw-candidates|rejected|traces?/");
    expect(script).toContain("skill/references/recovery-and-source-freeze.md");
    expect(script).toContain("cleanup/POST-PACKAGE-CLEANUP-CONTRACT.json");
    expect(script).not.toContain('"cleanup/CLEANUP-RESULT.json"');
    expect(script).not.toContain('"cleanup/PROJECT-HYGIENE-VERDICT.json"');
    expect(script).toContain("assets/MACHINE-ASSET-VERDICT.json");
    expect(script).toContain("[System.Security.Cryptography.SHA256]::Create()");
    expect(script).not.toContain("Get-FileHash");
    expect(script).not.toContain("Copy-PackageTree -SourceRoot $machineRoot");

    if (process.platform === "win32") {
      const quotedPath = scriptPath.replaceAll("'", "''");
      const parse = spawnSync(
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-Command",
          `[ScriptBlock]::Create([System.IO.File]::ReadAllText('${quotedPath}')) | Out-Null`,
        ],
        { encoding: "utf8" },
      );
      expect(parse.status, `${parse.stdout}\n${parse.stderr}`).toBe(0);
    }
  });
});
