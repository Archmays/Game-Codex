[CmdletBinding()]
param(
  [string]$TaskId = "GAME-CODEX-EVIDENCE-DRIVEN-UI-POLISH-06B"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$reports = Join-Path $repoRoot "tmp/tasks/$TaskId/reports"
$handoffs = Join-Path $repoRoot "handoffs"
$zip = Join-Path $handoffs "GAME_CODEX_EVIDENCE_DRIVEN_UI_POLISH_06B_RETURN_TO_CHATGPT.zip"
$shaFile = "$zip.sha256"
$required = @(
  "FINAL_RESULT.json", "FINAL_SUMMARY.md", "GIT_STATE.json", "PAGES_VERDICT.json",
  "REAL_OBSERVATION_TRIGGER.json", "ENGLISH_01_04_REPRODUCTION.json", "ENGLISH_ROOT_CAUSE.json", "ENGLISH_FIX_VERDICT.json",
  "UI_OCCLUSION_RISK_INVENTORY.json", "PLAY_SURFACE_HITTEST_MATRIX.json", "CRITICAL_CONTROL_CLICK_MATRIX.json", "FIXED_STICKY_COLLISION_VERDICT.json", "IMAGE_LOADING_LAYOUT_VERDICT.json", "ZOOM_TEXT_LAYOUT_VERDICT.json",
  "NEW_HITTEST_GATE_VERDICT.json", "PRODUCT_REGRESSION.json", "VISUAL_REGRESSION_VERDICT.json", "ACCESSIBILITY_VERDICT.json", "LONG_TRANSITION_HITTEST.json",
  "TESTS_BUILD_CI.json", "CLEANUP_VERIFY.json", "SOURCE_TREE_SHA256.txt"
)

foreach ($name in $required) {
  $path = Join-Path $reports $name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing required report: $name" }
}
$screenshots = Join-Path $reports "selected-screenshots"
if (-not (Test-Path -LiteralPath $screenshots -PathType Container)) { throw "Missing selected-screenshots" }

New-Item -ItemType Directory -Force -Path $handoffs | Out-Null
$stage = Join-Path ([System.IO.Path]::GetTempPath()) "game-codex-06b-package-stage"
if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
foreach ($name in $required) { Copy-Item -LiteralPath (Join-Path $reports $name) -Destination (Join-Path $stage $name) }
Copy-Item -LiteralPath $screenshots -Destination (Join-Path $stage "selected-screenshots") -Recurse

if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
if (Test-Path -LiteralPath $shaFile) { Remove-Item -LiteralPath $shaFile -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Remove-Item -LiteralPath $stage -Recurse -Force

$size = (Get-Item -LiteralPath $zip).Length
if ($size -ge 12MB) { throw "Return ZIP exceeds 12 MiB: $size" }
$hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText($shaFile, "$hash  $([System.IO.Path]::GetFileName($zip))`n", [System.Text.UTF8Encoding]::new($false))

$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })
  foreach ($name in $required) { if ($entries -notcontains $name) { throw "ZIP missing: $name" } }
  if (-not ($entries | Where-Object { $_ -like "selected-screenshots/*" })) { throw "ZIP has no selected screenshots" }
  $unexpected = @($entries | Where-Object { $_ -notin $required -and $_ -notlike "selected-screenshots/*" })
  if ($unexpected.Count) { throw "ZIP contains unexpected entries: $($unexpected -join ', ')" }
} finally {
  $archive.Dispose()
}

Write-Output (@{ zip = $zip; sha256 = $hash; bytes = $size; entries = $entries.Count } | ConvertTo-Json -Compress)
