$ErrorActionPreference = "Stop"

$taskId = "GAME-CODEX-PLAY-READINESS-POLISH-05"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$reportsRoot = Join-Path $repoRoot "tmp\tasks\$taskId\reports"
$stagingRoot = Join-Path $repoRoot "tmp\tasks\$taskId\package-staging"
$handoffRoot = Join-Path $repoRoot "handoffs"
$zipPath = Join-Path $handoffRoot "GAME_CODEX_PLAY_READINESS_POLISH_05_RETURN_TO_CHATGPT.zip"
$shaPath = "$zipPath.sha256"

$required = @(
  "FINAL_RESULT.json", "FINAL_SUMMARY.md", "GIT_STATE.json", "PAGES_VERDICT.json",
  "PROJECT_LIFECYCLE.json", "PLAY_SURFACE_MANIFEST.json", "PLAY_READINESS_MATRIX.json", "FIRST_USE_AUDIT.json", "FEEDBACK_QUALITY_MATRIX.json", "RETURN_RESUME_VERDICT.json",
  "SAVE_KEY_INVENTORY.json", "SAVE_VAULT_CONTRACT.md", "SAVE_VAULT_VERDICT.json", "PRIVACY_VERDICT.json",
  "ACCESSIBILITY_WCAG22_VERDICT.json", "PERFORMANCE_SAMPLE.json", "LONG_SESSION_STRESS.json", "ASSET_STORAGE_AUDIT.json",
  "FOUR_REVIEWER_RECONCILIATION.json", "TESTS_BUILD_CI.json", "CLEANUP_VERIFY.json", "SOURCE_TREE_SHA256.txt"
)

foreach ($name in $required) {
  $source = Join-Path $reportsRoot $name
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Required report missing: $source" }
}
$screenshots = Join-Path $reportsRoot "selected-screenshots"
if (-not (Test-Path -LiteralPath $screenshots -PathType Container)) { throw "Selected screenshot directory missing: $screenshots" }

if (Test-Path -LiteralPath $stagingRoot) { throw "Package staging must be absent before deterministic package creation: $stagingRoot" }
New-Item -ItemType Directory -Path $stagingRoot | Out-Null
foreach ($name in $required) { Copy-Item -LiteralPath (Join-Path $reportsRoot $name) -Destination (Join-Path $stagingRoot $name) }
Copy-Item -LiteralPath $screenshots -Destination (Join-Path $stagingRoot "selected-screenshots") -Recurse

New-Item -ItemType Directory -Force -Path $handoffRoot | Out-Null
if (Test-Path -LiteralPath $zipPath) { throw "Protected return ZIP already exists: $zipPath" }
if (Test-Path -LiteralPath $shaPath) { throw "Protected return SHA already exists: $shaPath" }
Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
$bytes = (Get-Item -LiteralPath $zipPath).Length
if ($bytes -ge 12MB) { throw "Return ZIP exceeds 12 MiB: $bytes" }
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath $shaPath -Value "$hash  GAME_CODEX_PLAY_READINESS_POLISH_05_RETURN_TO_CHATGPT.zip" -Encoding ascii
Write-Output (@{ verdict = "PASS"; zip = $zipPath; bytes = $bytes; sha256 = $hash } | ConvertTo-Json -Compress)
