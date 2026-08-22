$ErrorActionPreference = "Stop"

$taskId = "GAME-CODEX-NATURAL-USE-OBSERVATION-KIT-06A"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$taskRoot = Join-Path $repoRoot "tmp\tasks\$taskId"
$reportsRoot = Join-Path $taskRoot "reports"
$stagingRoot = Join-Path $taskRoot "package-staging"
$screenshots = Join-Path $taskRoot "selected-screenshots"
$handoffRoot = Join-Path $repoRoot "handoffs"
$zipName = "GAME_CODEX_NATURAL_USE_OBSERVATION_KIT_06A_RETURN_TO_CHATGPT.zip"
$zipPath = Join-Path $handoffRoot $zipName
$shaPath = "$zipPath.sha256"

$required = @(
  "FINAL_RESULT.json", "FINAL_SUMMARY.md", "GIT_STATE.json", "PAGES_VERDICT.json",
  "OBSERVATION_PRIVACY_CONTRACT.json", "OBSERVATION_SCHEMA.json", "OBSERVATION_RETENTION_VERDICT.json", "OBSERVATION_EXPORT_VERDICT.json", "OBSERVATION_SAVE_VAULT_EXCLUSION.json", "OBSERVATION_SECURITY_VERDICT.json",
  "OBSERVATION_TOOL_UI_VERDICT.json", "OBSERVATION_CLI_VALIDATOR_VERDICT.json", "OBSERVATION_SUMMARIZER_VERDICT.json", "EVIDENCE_TRIAGE_RULES.json",
  "PRODUCT_REGRESSION.json", "TESTS_BUILD_CI.json", "CLEANUP_VERIFY.json", "SOURCE_TREE_SHA256.txt"
)

foreach ($name in $required) {
  $source = Join-Path $reportsRoot $name
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Required report missing: $source" }
}
if (-not (Test-Path -LiteralPath $screenshots -PathType Container)) { throw "Selected screenshot directory missing: $screenshots" }
$selected = Get-ChildItem -LiteralPath $screenshots -File
if ($selected.Count -ne 5) { throw "Exactly five selected screenshots are required; found $($selected.Count)" }
if (Test-Path -LiteralPath $stagingRoot) { throw "Package staging must be absent before deterministic package creation: $stagingRoot" }
New-Item -ItemType Directory -Path $stagingRoot | Out-Null
foreach ($name in $required) { Copy-Item -LiteralPath (Join-Path $reportsRoot $name) -Destination (Join-Path $stagingRoot $name) }
Copy-Item -LiteralPath $screenshots -Destination (Join-Path $stagingRoot "selected-screenshots") -Recurse

New-Item -ItemType Directory -Force -Path $handoffRoot | Out-Null
if (Test-Path -LiteralPath $zipPath) { throw "Protected return ZIP already exists: $zipPath" }
if (Test-Path -LiteralPath $shaPath) { throw "Protected return SHA already exists: $shaPath" }
Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
$bytes = (Get-Item -LiteralPath $zipPath).Length
if ($bytes -ge 8MB) { throw "Return ZIP exceeds 8 MiB: $bytes" }
$stream = [System.IO.File]::OpenRead($zipPath)
try {
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try { $hashBytes = $sha256.ComputeHash($stream) } finally { $sha256.Dispose() }
} finally {
  $stream.Dispose()
}
$hash = ([System.BitConverter]::ToString($hashBytes)).Replace("-", "").ToLowerInvariant()
[System.IO.File]::WriteAllText($shaPath, "$hash  $zipName`r`n", [System.Text.Encoding]::ASCII)
Write-Output (@{ verdict = "PASS"; zip = $zipPath; bytes = $bytes; sha256 = $hash } | ConvertTo-Json -Compress)
