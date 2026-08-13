[CmdletBinding()]
param([string]$SourceTreeSha256 = $env:CHAPTER_ONE_SOURCE_TREE_SHA256)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot "ChapterOneLauncher.Common.ps1")

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$releaseRoot = (Resolve-Path (Join-Path $workspaceRoot "artifacts\hanzi-radical-battle-v2\v2-chapter-one")).Path
$dataRoot = Join-Path $releaseRoot "report\data"
$planPath = Join-Path $dataRoot "CLEANUP-PLAN.json"
$resultPath = Join-Path $dataRoot "CLEANUP-RESULT.json"
$verdictPath = Join-Path $dataRoot "CLEANUP-VERDICT.json"
if ($SourceTreeSha256 -notmatch '^[A-Fa-f0-9]{64}$') { throw "SourceTreeSha256 must be a 64-character SHA-256 identity." }
$SourceTreeSha256 = $SourceTreeSha256.ToUpperInvariant()
$relativeTargets = @(
  "dist",
  "test-results",
  "playwright-report",
  "tmp\hanzi-v2-chapter-one",
  "artifacts\hanzi-radical-battle-v2\v1-release\traces",
  "artifacts\hanzi-radical-battle-v2\v2-chapter-one\.package-staging"
)

$targets = @()
foreach ($relative in $relativeTargets) {
  $candidate = [System.IO.Path]::GetFullPath((Join-Path $workspaceRoot $relative))
  if (-not $candidate.StartsWith($workspaceRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Cleanup target escaped the workspace: $candidate" }
  if ($candidate -eq $workspaceRoot -or $candidate -eq $releaseRoot) { throw "Cleanup target is too broad: $candidate" }
  $exists = Test-Path -LiteralPath $candidate
  $bytes = 0L
  $files = 0
  if ($exists) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { $bytes = (Get-Item -LiteralPath $candidate).Length; $files = 1 }
    else { $items = @(Get-ChildItem -LiteralPath $candidate -Recurse -File -Force -ErrorAction Stop); $bytes = [long](($items | Measure-Object -Property Length -Sum).Sum); $files = $items.Count }
  }
  $targets += [ordered]@{ relativePath = $relative.Replace("\", "/"); absolutePath = $candidate; existedBefore = $exists; filesBefore = $files; bytesBefore = $bytes }
}

$plan = [ordered]@{ schemaVersion = 1; sourceTreeSha256 = $SourceTreeSha256; result = "READY"; workspaceRoot = $workspaceRoot; exactTargets = $targets; preserved = @("selected Theme C source atlases", "prompt pack", "runtime assets", "source ledger", "M0-M5 gates", "final report", "return ZIP and sidecar"); generatedAtUtc = [DateTime]::UtcNow.ToString("o") }
Write-ChapterOneUtf8NoBom -Path $planPath -Contents (($plan | ConvertTo-Json -Depth 8) + "`n")

foreach ($target in $targets) {
  if (-not $target.existedBefore) { continue }
  $path = [string]$target.absolutePath
  if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path -Force }
  else { Remove-Item -LiteralPath $path -Recurse -Force }
}

$remaining = @($targets | Where-Object { Test-Path -LiteralPath ([string]$_.absolutePath) } | ForEach-Object { $_.relativePath })
if ($remaining.Count -ne 0) { throw "Cleanup left targets behind: $($remaining -join ', ')" }
$removedTargetCount = 0
$removedFileCount = 0
$removedBytes = 0L
foreach ($target in $targets) {
  if ([bool]$target.existedBefore) { $removedTargetCount += 1 }
  $removedFileCount += [int]$target.filesBefore
  $removedBytes += [long]$target.bytesBefore
}
$result = [ordered]@{ schemaVersion = 1; sourceTreeSha256 = $SourceTreeSha256; result = "PASS"; exactTargetCount = $targets.Count; removedTargetCount = $removedTargetCount; removedFileCount = $removedFileCount; removedBytes = $removedBytes; remainingTargets = $remaining; selectedSourcesPreserved = $true; rejectedImagegenRetriesPresent = @(Get-ChildItem -LiteralPath (Join-Path $releaseRoot "assets") -Recurse -File | Where-Object { $_.Name -match 'reject|retry|mismatch' }).Count; generatedAtUtc = [DateTime]::UtcNow.ToString("o") }
if ($result.rejectedImagegenRetriesPresent -ne 0) { throw "Rejected imagegen retries remain in the release root." }
Write-ChapterOneUtf8NoBom -Path $resultPath -Contents (($result | ConvertTo-Json -Depth 8) + "`n")
$verdict = [ordered]@{ schemaVersion = 1; sourceTreeSha256 = $SourceTreeSha256; result = "PASS"; exactTargetsOnly = $true; broadWorkspaceDelete = $false; remainingTargets = $remaining; selectedSourcesPreserved = $true; rejectedImagegenRetriesPresent = 0; returnZipPreserved = $true; generatedAtUtc = [DateTime]::UtcNow.ToString("o") }
Write-ChapterOneUtf8NoBom -Path $verdictPath -Contents (($verdict | ConvertTo-Json -Depth 8) + "`n")
$result | ConvertTo-Json -Compress
