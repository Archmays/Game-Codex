[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$reportRoot = [IO.Path]::GetFullPath((Join-Path $workspace "tmp\tasks\GAME-CODEX-CHINESE-CONSOLIDATION-03\reports"))
$handoffRoot = [IO.Path]::GetFullPath((Join-Path $workspace "handoffs"))
$zipName = "GAME_CODEX_CHINESE_CONSOLIDATION_03_RETURN_TO_CHATGPT.zip"
$zipPath = Join-Path $handoffRoot $zipName
$shaPath = "$zipPath.sha256"
$required = @(
  "FINAL_RESULT.json", "FINAL_SUMMARY.md", "GIT_STATE.json", "PAGES_VERDICT.json", "CHINESE_CONSOLIDATION_CONTRACT.md", "PORTFOLIO_BEFORE_AFTER.json", "CATALOG_SHADOW_AND_FINAL.json",
  "PINYIN_LEGACY_SOURCE_FREEZE.json", "PINYIN_LEGACY_AUDIT_SUMMARY.json", "PINYIN_CANONICAL_MANIFEST.json", "PINYIN_ORTHOGRAPHY_VERDICT.json", "PINYIN_COVERAGE_MATRIX.json", "PINYIN_CHALLENGE_SOLVER_VERDICT.json", "PINYIN_AUDIO_BOUNDARY.json",
  "MEMORY_ENGINE_CONTRACT.md", "MEMORY_PACK_MANIFEST.json", "MEMORY_AMBIGUITY_VERDICT.json", "MEMORY_ENGINE_SIMULATION.json", "LEGACY_MEMORY_SOURCE_BOUNDARY.json",
  "HANZI_V3_NO_REGRESSION.json", "SAVE_COMPATIBILITY.json", "E2E_MATRIX.json", "VISUAL_ARIA_GEOMETRY_VERDICT.json", "PERFORMANCE_LIFECYCLE_VERDICT.json", "FOUR_REVIEWER_RECONCILIATION.json", "TESTS_BUILD_CI.json", "CLEANUP_VERIFY.json", "SOURCE_TREE_SHA256.txt"
)
if (-not (Test-Path -LiteralPath $reportRoot -PathType Container)) { throw "Report root missing: $reportRoot" }
foreach ($name in $required) { if (-not (Test-Path -LiteralPath (Join-Path $reportRoot $name) -PathType Leaf)) { throw "Required report missing: $name" } }
$screenshots = Join-Path $reportRoot "selected-screenshots"
if (@(Get-ChildItem -LiteralPath $screenshots -File).Count -ne 8) { throw "Expected exactly eight selected screenshots." }
New-Item -ItemType Directory -Path $handoffRoot -Force | Out-Null
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$staging = [IO.Path]::GetFullPath((Join-Path $temporaryRoot ("chinese-support-package-" + [Guid]::NewGuid().ToString("N"))))
if (-not $staging.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName($staging)).StartsWith("chinese-support-package-")) { throw "Unsafe staging path: $staging" }
try {
  New-Item -ItemType Directory -Path $staging | Out-Null
  foreach ($name in $required) { Copy-Item -LiteralPath (Join-Path $reportRoot $name) -Destination (Join-Path $staging $name) }
  Copy-Item -LiteralPath $screenshots -Destination (Join-Path $staging "selected-screenshots") -Recurse
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  if (Test-Path -LiteralPath $shaPath) { Remove-Item -LiteralPath $shaPath -Force }
  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -CompressionLevel Optimal
} finally { if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force } }
$zip = Get-Item -LiteralPath $zipPath
if ($zip.Length -ge 15MB) { throw "Return ZIP exceeds 15 MiB: $($zip.Length) bytes" }
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash.ToUpperInvariant()
[IO.File]::WriteAllText($shaPath, "$hash *$zipName`n", [Text.UTF8Encoding]::new($false))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })
  foreach ($name in $required) { if ($entries -notcontains $name) { throw "ZIP missing: $name" } }
  if (@($entries | Where-Object { $_ -match '(^|/)(dist|node_modules|test-results|playwright-report|tmp)(/|$)' }).Count) { throw "ZIP contains a forbidden tree." }
} finally { $archive.Dispose() }
[ordered]@{ verdict = "PASS_MACHINE"; zip = $zipPath; bytes = $zip.Length; sha256 = $hash; entries = $entries.Count } | ConvertTo-Json -Compress
