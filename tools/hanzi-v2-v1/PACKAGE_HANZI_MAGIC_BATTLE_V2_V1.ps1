[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$releaseRoot = Join-Path $workspaceRoot "artifacts\hanzi-radical-battle-v2\v1-release"
$zipName = "HANZI_MAGIC_BATTLE_V2_V1_COMPLETE_RETURN_TO_CHATGPT.zip"
$zipPath = Join-Path $releaseRoot $zipName
$sidecarPath = "$zipPath.sha256"
$stagingRoot = Join-Path $releaseRoot ".package-staging"

$required = @(
  "V1-CLOSEOUT.md",
  "V1-MACHINE-VERDICT.json",
  "V1-RELEASE-MANIFEST.json",
  "V1-ASSET-MANIFEST.json",
  "V1-CONTENT-INTEGRITY.json",
  "V1-SAVE-MIGRATION-PROOF.json",
  "V1-VISUAL-ARIA-NO-UPDATE-PROOF.json",
  "V1-CRITICAL-CONTROL-GEOMETRY.json",
  "V1-BROWSER-HARD-GATES.json",
  "V1-PLAYTHROUGH-REPORT.html",
  "USER-PLAY-GUIDE.md",
  "contact-sheet.webp",
  "contact-sheet.webp.json",
  "review",
  "playthroughs",
  "screenshots",
  "baselines",
  "git\FINAL-COMMIT.json",
  "git\ORIGIN-VERIFICATION.json",
  "cleanup\V1-CLEANUP-PLAN.json"
)

foreach ($relativePath in $required) {
  $source = Join-Path $releaseRoot $relativePath
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Required V1 package entry is missing: $source"
  }
}

if (Test-Path -LiteralPath $stagingRoot) {
  $resolvedRelease = (Resolve-Path $releaseRoot).Path
  $resolvedStaging = (Resolve-Path $stagingRoot).Path
  if (-not $resolvedStaging.StartsWith($resolvedRelease, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove staging outside the V1 release directory."
  }
  Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingRoot | Out-Null

try {
  foreach ($relativePath in $required) {
    $source = Join-Path $releaseRoot $relativePath
    $destination = Join-Path $stagingRoot $relativePath
    $parent = Split-Path -Parent $destination
    if (-not (Test-Path -LiteralPath $parent)) {
      New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
  }

  $runtimeDestination = Join-Path $stagingRoot "runtime-assets"
  New-Item -ItemType Directory -Path $runtimeDestination -Force | Out-Null
  $runtimeSource = Join-Path $workspaceRoot "public\assets\hanzi-radical-battle\v2\theme-c\v1"
  $runtimeFiles = @(Get-ChildItem -LiteralPath $runtimeSource -File | Sort-Object Name)
  if ($runtimeFiles.Count -ne 24) { throw "Expected exactly 24 V1 runtime assets, found $($runtimeFiles.Count)." }
  foreach ($runtimeFile in $runtimeFiles) {
    Copy-Item -LiteralPath $runtimeFile.FullName -Destination $runtimeDestination -Force
  }

  $launchers = Join-Path $stagingRoot "launchers"
  New-Item -ItemType Directory -Path $launchers -Force | Out-Null
  foreach ($launcherFile in @(
    "HanziMagicV1Tools.Common.ps1",
    "START_HANZI_MAGIC_BATTLE_V2_V1.cmd",
    "START_HANZI_MAGIC_BATTLE_V2_V1.ps1",
    "STOP_HANZI_MAGIC_BATTLE_V2_V1.cmd",
    "STOP_HANZI_MAGIC_BATTLE_V2_V1.ps1"
  )) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $launcherFile) -Destination $launchers -Force
  }

  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  if (Test-Path -LiteralPath $sidecarPath) { Remove-Item -LiteralPath $sidecarPath -Force }
  Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
  $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToUpperInvariant()
  $bytes = (Get-Item -LiteralPath $zipPath).Length
  [System.IO.File]::WriteAllText($sidecarPath, "$hash  $zipName`n", [System.Text.UTF8Encoding]::new($false))
  [ordered]@{ zipPath = $zipPath; bytes = $bytes; sha256 = $hash; verdict = "PASS" } | ConvertTo-Json -Compress
}
finally {
  if (Test-Path -LiteralPath $stagingRoot) {
    $resolvedRelease = (Resolve-Path $releaseRoot).Path
    $resolvedStaging = (Resolve-Path $stagingRoot).Path
    if ($resolvedStaging.StartsWith($resolvedRelease, [StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
    }
  }
}
