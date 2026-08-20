[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$reportRoot = [IO.Path]::GetFullPath((Join-Path $workspace "artifacts\hanzi-magic-battle\v3-complete\report"))
$handoffRoot = [IO.Path]::GetFullPath((Join-Path $workspace "handoffs"))
$zipName = "HANZI_MAGIC_BATTLE_COMPLETE_V3_RETURN_TO_CHATGPT.zip"
$zipPath = Join-Path $handoffRoot $zipName
$shaPath = "$zipPath.sha256"
$requiredFiles = @(
  "index.html",
  "FINAL_RESULT.json",
  "FINAL_SUMMARY.md",
  "SOURCE_TREE_SHA256.txt",
  "GIT_STATE.json",
  "PAGES_VERDICT.json",
  "RELEASE_IDENTITY.json",
  "CONTENT_IDENTITY_AND_DEDUPE.json",
  "72_CHARACTER_MANIFEST.json",
  "36_NEW_CHARACTER_LEDGER.json",
  "18_COMPONENT_FAMILY_LEDGER.json",
  "36_WORD_RESONANCE_LEDGER.json",
  "WHEEL_EXPANSION_LEDGER.json",
  "CHARACTER_SOLVER_VERDICT.json",
  "FAMILY_SOLVER_VERDICT.json",
  "WORD_SOLVER_VERDICT.json",
  "CHAPTER_COVERAGE.json",
  "ABILITY_BEHAVIOR_BOSS_COVERAGE.json",
  "16_REPAIR_AND_SPELLBOOK_COVERAGE.json",
  "SAVE_MIGRATION_VERDICT.json",
  "ASSET_BUDGET_VERDICT.json",
  "SIMULATION_COVERAGE.json",
  "BROWSER_MATRIX.json",
  "VISUAL_ARIA_GEOMETRY_VERDICT.json",
  "FOUR_REVIEWER_RECONCILIATION.json",
  "PERFORMANCE_NETWORK_PRIVACY.json",
  "TESTS_BUILD_CI.json",
  "LAUNCHER_VERDICT.json",
  "CLEANUP_RESULT.json"
)

if (-not (Test-Path -LiteralPath $reportRoot -PathType Container)) { throw "Formal report directory is missing: $reportRoot" }
foreach ($name in $requiredFiles) {
  $path = Join-Path $reportRoot $name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required package file is missing: $name" }
}
$screenshots = Join-Path $reportRoot "selected-screenshots"
if (-not (Test-Path -LiteralPath $screenshots -PathType Container)) { throw "Selected screenshot directory is missing." }
if (@(Get-ChildItem -LiteralPath $screenshots -File).Count -lt 1) { throw "Selected screenshot directory is empty." }

New-Item -ItemType Directory -Path $handoffRoot -Force | Out-Null
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$staging = [IO.Path]::GetFullPath((Join-Path $tempBase ("hanzi-magic-v3-package-" + [Guid]::NewGuid().ToString("N"))))
if (-not $staging.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName($staging)).StartsWith("hanzi-magic-v3-package-")) { throw "Unsafe package staging path: $staging" }

try {
  New-Item -ItemType Directory -Path $staging | Out-Null
  foreach ($name in $requiredFiles) { Copy-Item -LiteralPath (Join-Path $reportRoot $name) -Destination (Join-Path $staging $name) }
  Copy-Item -LiteralPath $screenshots -Destination (Join-Path $staging "selected-screenshots") -Recurse
  if (Test-Path -LiteralPath $zipPath -PathType Leaf) { Remove-Item -LiteralPath $zipPath -Force }
  if (Test-Path -LiteralPath $shaPath -PathType Leaf) { Remove-Item -LiteralPath $shaPath -Force }
  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -CompressionLevel Optimal
}
finally {
  if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
}

$zip = Get-Item -LiteralPath $zipPath
if ($zip.Length -ge 50MB) { throw "Return ZIP exceeds the 50 MiB target: $($zip.Length) bytes" }
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToUpperInvariant()
[IO.File]::WriteAllText($shaPath, "$hash *$zipName`n", [Text.UTF8Encoding]::new($false))

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })
  foreach ($name in $requiredFiles) {
    if ($entries -notcontains $name) { throw "ZIP readback is missing required file: $name" }
  }
  if (-not @($entries | Where-Object { $_ -like "selected-screenshots/*" }).Count) { throw "ZIP readback is missing selected screenshots." }
  if (@($entries | Where-Object { $_ -match '(^|/)(node_modules|\.git|dist|test-results|playwright-report|tmp)(/|$)' }).Count) { throw "ZIP contains a forbidden generated or repository directory." }
}
finally { $archive.Dispose() }

[ordered]@{ verdict = "PASS_MACHINE"; zip = $zipPath; bytes = $zip.Length; sha256 = $hash; entries = $entries.Count } | ConvertTo-Json -Compress
