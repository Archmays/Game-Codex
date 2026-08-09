[CmdletBinding()]
param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Step03Tools.Common.ps1")

$repositoryRoot = Get-Step03RepositoryRoot -ScriptDirectory $PSScriptRoot
$taskPaths = Get-Step03TaskPaths -RepositoryRoot $repositoryRoot
$runtime = Get-Step03Runtime -RepositoryRoot $repositoryRoot
$canonicalFeedback = Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-03\review\STEP-03_PARENT_REVIEW_FEEDBACK.json"
if (-not (Test-Path -LiteralPath $canonicalFeedback -PathType Leaf)) {
  Write-Error "DENY: canonical STEP 03 parent feedback was not found. No child route or observation sheet was opened."
  exit 1
}

New-Item -ItemType Directory -Path $taskPaths.TempDirectory -Force | Out-Null
$gateReportPath = Join-Path $taskPaths.TempDirectory "child-first-use-gate-validation.json"
$contractTool = Join-Path $PSScriptRoot "step03-review-contract.ts"
& $runtime.NodePath $runtime.TsxCliPath $contractTool validate --feedback $canonicalFeedback --output $gateReportPath
if ($LASTEXITCODE -ne 0) {
  throw "Child first-use gate validation could not run. No child route or observation sheet was opened."
}
$gateReport = Get-Content -LiteralPath $gateReportPath -Raw | ConvertFrom-Json
if (-not $gateReport.valid -or [string]$gateReport.authorizeChildFirstUse -cne "YES") {
  Write-Error "DENY: canonical feedback is incomplete, identity-mismatched, or does not explicitly authorize child first use with YES. No child route or observation sheet was opened."
  exit 1
}

$childUrl = "http://127.0.0.1:$($taskPaths.Port)/?play=hanzi-v2-golden-slice"
$observationSheet = Join-Path $repositoryRoot "docs\hanzi-radical-battle-v2\step-03\child-first-use\02-FIRST-USE-OBSERVATION-SHEET.html"
if (-not (Test-Path -LiteralPath $observationSheet -PathType Leaf)) {
  throw "Observation sheet was not found: $observationSheet"
}

Start-Step03RecordedServer -RepositoryRoot $repositoryRoot -TaskPaths $taskPaths -Runtime $runtime
Wait-Step03Server -Url $childUrl -TaskPaths $taskPaths
if (-not $NoBrowser) {
  Start-Process $childUrl
  Start-Process $observationSheet
}

Write-Host "Child first-use observation is authorized for this local session only."
Write-Host "Child route: $childUrl"
Write-Host "Observation sheet: $observationSheet"
Write-Host "Do not upload, record, capture, or enter personal identifiers. This tool creates no child profile."
