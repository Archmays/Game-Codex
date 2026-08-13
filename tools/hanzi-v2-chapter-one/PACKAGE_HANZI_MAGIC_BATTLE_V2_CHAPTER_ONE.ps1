[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$releaseRoot = Join-Path $workspaceRoot "artifacts\hanzi-radical-battle-v2\v2-chapter-one"
$reportRoot = Join-Path $releaseRoot "report"
$zipName = "HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE_V2_COMPLETE_RETURN_TO_CHATGPT.zip"
$zipPath = Join-Path $releaseRoot $zipName
$sidecarPath = "$zipPath.sha256"
$stagingRoot = Join-Path $releaseRoot ".package-staging"

$required = @(
  "report\FINAL-RESULT.json",
  "report\FINAL-SUMMARY.md",
  "report\SOURCE-TREE-SHA256.txt",
  "report\index.html",
  "report\data\GIT-STATE.json",
  "report\data\PAGES-VERDICT.json",
  "report\data\PURE-SIMULATION.json",
  "report\data\MACHINE-PLAYTHROUGH-MATRIX.json",
  "report\data\CONTENT-COVERAGE.json",
  "report\data\GAMEPLAY-COVERAGE.json",
  "report\data\SAVE-NETWORK-PRIVACY.json",
  "report\data\ASSET-MANIFEST.json",
  "report\data\REVIEWER-RECONCILIATION.json",
  "report\data\VISUAL-ARIA-round-1.json",
  "report\data\VISUAL-ARIA-round-2.json",
  "report\data\CRITICAL-GEOMETRY-round-1.json",
  "report\data\CRITICAL-GEOMETRY-round-2.json",
  "report\data\LAUNCHER-LIFECYCLE.json",
  "report\data\TEST-BUILD-RESULTS.json",
  "report\data\CLEANUP-PLAN.json",
  "report\data\CLEANUP-RESULT.json",
  "report\data\CLEANUP-VERDICT.json",
  "report\screenshots",
  "report\baselines\chapter-one",
  "checkpoints\M0\GATE-RESULT.json",
  "checkpoints\M1\GATE-RESULT.json",
  "checkpoints\M2\GATE-RESULT.json",
  "checkpoints\M2\CHARACTER-SOURCE-LEDGER.json",
  "checkpoints\M2\M2-HAND-UNIQUE-SOLUTION-AUDIT.json",
  "checkpoints\M3\GATE-RESULT.json",
  "checkpoints\M4\GATE-RESULT.json",
  "checkpoints\M5\GATE-RESULT.json",
  "assets\prompt-pack.md",
  "assets\raw-selected",
  "tools\README.md",
  "tools\START_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.cmd",
  "tools\START_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.ps1",
  "tools\STOP_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.cmd",
  "tools\STOP_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.ps1",
  "tools\ChapterOneLauncher.Common.ps1"
)

foreach ($entry in $required) {
  $source = if ($entry.StartsWith("tools\")) { Join-Path $workspaceRoot ("tools\hanzi-v2-chapter-one\" + $entry.Substring(6)) } else { Join-Path $releaseRoot $entry }
  if (-not (Test-Path -LiteralPath $source)) { throw "Required return-package entry is missing: $source" }
}

if (Test-Path -LiteralPath $stagingRoot) {
  $resolved = (Resolve-Path $stagingRoot).Path
  if (-not $resolved.StartsWith((Resolve-Path $releaseRoot).Path, [StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to clean staging outside the release root." }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingRoot | Out-Null

try {
  foreach ($entry in $required) {
    $source = if ($entry.StartsWith("tools\")) { Join-Path $workspaceRoot ("tools\hanzi-v2-chapter-one\" + $entry.Substring(6)) } else { Join-Path $releaseRoot $entry }
    $destination = Join-Path $stagingRoot $entry
    $parent = Split-Path -Parent $destination
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
  }
  $runtimeSource = Join-Path $workspaceRoot "public\assets\hanzi-radical-battle\v2\theme-c\chapter-one"
  $runtimeDestination = Join-Path $stagingRoot "runtime-assets"
  New-Item -ItemType Directory -Path $runtimeDestination | Out-Null
  $runtimeFiles = @(Get-ChildItem -LiteralPath $runtimeSource -File -Filter "*.webp" | Sort-Object Name)
  if ($runtimeFiles.Count -ne 72) { throw "Expected exactly 72 runtime assets, found $($runtimeFiles.Count)." }
  $runtimeFiles | Copy-Item -Destination $runtimeDestination -Force
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  if (Test-Path -LiteralPath $sidecarPath) { Remove-Item -LiteralPath $sidecarPath -Force }
  Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
  $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToUpperInvariant()
  $bytes = (Get-Item -LiteralPath $zipPath).Length
  [System.IO.File]::WriteAllText($sidecarPath, "$hash  $zipName`n", [System.Text.UTF8Encoding]::new($false))
  [ordered]@{ zipPath = $zipPath; bytes = $bytes; sha256 = $hash; result = "PASS" } | ConvertTo-Json -Compress
}
finally {
  if (Test-Path -LiteralPath $stagingRoot) {
    $resolved = (Resolve-Path $stagingRoot).Path
    if ($resolved.StartsWith((Resolve-Path $releaseRoot).Path, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $resolved -Recurse -Force }
  }
}
