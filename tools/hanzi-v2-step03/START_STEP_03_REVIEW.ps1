[CmdletBinding()]
param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Step03Tools.Common.ps1")

$repositoryRoot = Get-Step03RepositoryRoot -ScriptDirectory $PSScriptRoot
$taskPaths = Get-Step03TaskPaths -RepositoryRoot $repositoryRoot
$runtime = Get-Step03Runtime -RepositoryRoot $repositoryRoot
$reviewUrl = "http://127.0.0.1:$($taskPaths.Port)/?review=hanzi-v2-step03"

Start-Step03RecordedServer -RepositoryRoot $repositoryRoot -TaskPaths $taskPaths -Runtime $runtime
Wait-Step03Server -Url $reviewUrl -TaskPaths $taskPaths

if (-not $NoBrowser) {
  Start-Process $reviewUrl
}

Write-Host "STEP 03 parent review is ready."
Write-Host "Open: $reviewUrl"
Write-Host "Review the golden-slice candidate, then export STEP-03_PARENT_REVIEW_FEEDBACK.json."
Write-Host "When finished, run FINISH_STEP_03_REVIEW.cmd to validate and package the local feedback."
