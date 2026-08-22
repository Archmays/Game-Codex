[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$reportRoot = [IO.Path]::GetFullPath((Join-Path $workspace "tmp\tasks\GAME-CODEX-ENGLISH-V2-04\reports"))
$handoffRoot = [IO.Path]::GetFullPath((Join-Path $workspace "handoffs"))
$zipName = "GAME_CODEX_ENGLISH_V2_04_RETURN_TO_CHATGPT.zip"
$zipPath = Join-Path $handoffRoot $zipName
$shaPath = "$zipPath.sha256"
$required = @(
  "FINAL_RESULT.json", "FINAL_SUMMARY.md", "GIT_STATE.json", "PAGES_VERDICT.json", "ENGLISH_V2_CONTRACT.md",
  "LEGACY_ENGLISH_SOURCE_FREEZE.json", "LEGACY_ENGLISH_AUDIT_SUMMARY.json", "ENGLISH_WORD_MANIFEST.json", "ENGLISH_PRONUNCIATION_VERDICT.json", "ENGLISH_GRAPHEME_MAP_VERDICT.json", "ENGLISH_SENTENCE_MANIFEST.json", "ENGLISH_CONTENT_COVERAGE.json",
  "VERTICAL_SLICE_VERDICT.json", "MISSION_SIMULATION.json", "MEMORY_ENGLISH_PACK_VERDICT.json", "SAVE_COMPATIBILITY.json", "PORTFOLIO_BEFORE_AFTER.json", "TOP_WORLD_VERDICT.json",
  "ASSET_MANIFEST.json", "ASSET_BUDGET_VERDICT.json", "VISUAL_ARIA_GEOMETRY_VERDICT.json", "PERFORMANCE_LIFECYCLE_VERDICT.json", "FOUR_REVIEWER_RECONCILIATION.json", "TESTS_BUILD_CI.json", "CLEANUP_VERIFY.json", "SOURCE_TREE_SHA256.txt"
)
if (-not (Test-Path -LiteralPath $reportRoot -PathType Container)) { throw "Report root missing: $reportRoot" }
foreach ($name in $required) { if (-not (Test-Path -LiteralPath (Join-Path $reportRoot $name) -PathType Leaf)) { throw "Required report missing: $name" } }
$screenshots = Join-Path $reportRoot "selected-screenshots"
if (@(Get-ChildItem -LiteralPath $screenshots -File).Count -ne 9) { throw "Expected exactly nine selected screenshots." }
New-Item -ItemType Directory -Path $handoffRoot -Force | Out-Null
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$staging = [IO.Path]::GetFullPath((Join-Path $temporaryRoot ("english-v2-package-" + [Guid]::NewGuid().ToString("N"))))
if (-not $staging.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName($staging)).StartsWith("english-v2-package-")) { throw "Unsafe staging path: $staging" }
try {
  New-Item -ItemType Directory -Path $staging | Out-Null
  foreach ($name in $required) { Copy-Item -LiteralPath (Join-Path $reportRoot $name) -Destination (Join-Path $staging $name) }
  Copy-Item -LiteralPath $screenshots -Destination (Join-Path $staging "selected-screenshots") -Recurse
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  if (Test-Path -LiteralPath $shaPath) { Remove-Item -LiteralPath $shaPath -Force }
  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -CompressionLevel Optimal
} finally { if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force } }
$zip = Get-Item -LiteralPath $zipPath
if ($zip.Length -ge 20MB) { throw "Return ZIP exceeds 20 MiB: $($zip.Length) bytes" }
$sha256 = [Security.Cryptography.SHA256]::Create()
$zipStream = [IO.File]::OpenRead($zipPath)
try {
  $hash = -join ($sha256.ComputeHash($zipStream) | ForEach-Object { $_.ToString("X2") })
} finally {
  $zipStream.Dispose()
  $sha256.Dispose()
}
[IO.File]::WriteAllText($shaPath, "$hash *$zipName`n", [Text.UTF8Encoding]::new($false))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })
  foreach ($name in $required) { if ($entries -notcontains $name) { throw "ZIP missing: $name" } }
  if (@($entries | Where-Object { $_ -match '(^|/)(dist|node_modules|test-results|playwright-report|tmp)(/|$)' }).Count) { throw "ZIP contains a forbidden tree." }
} finally { $archive.Dispose() }
[ordered]@{ verdict = "PASS_MACHINE"; zip = $zipPath; bytes = $zip.Length; sha256 = $hash; entries = $entries.Count } | ConvertTo-Json -Compress
