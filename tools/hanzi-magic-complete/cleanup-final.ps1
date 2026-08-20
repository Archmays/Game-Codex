[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$workspacePrefix = $workspace.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$allowedRelativePaths = @("dist", "test-results", "playwright-report", "tmp")
$removed = @()

foreach ($relativePath in $allowedRelativePaths) {
  $target = [IO.Path]::GetFullPath((Join-Path $workspace $relativePath))
  if (-not $target.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Cleanup target escaped the workspace: $target"
  }
  if ([IO.Path]::GetFileName($target) -ne $relativePath) {
    throw "Cleanup target did not resolve to the approved leaf: $target"
  }
  if (-not (Test-Path -LiteralPath $target)) { continue }

  $item = Get-Item -LiteralPath $target -Force
  if (-not $item.PSIsContainer) { throw "Cleanup target is not a directory: $target" }
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Cleanup refuses to recurse into a reparse point: $target"
  }
  Remove-Item -LiteralPath $target -Recurse -Force
  $removed += $relativePath
}

[ordered]@{
  verdict = "PASS_MACHINE"
  workspace = $workspace
  removed = $removed
  retained = @("artifacts/hanzi-magic-battle/v3-complete/report", "artifacts/hanzi-magic-battle/v3-complete/checkpoints", "tests/e2e/hanzi-complete/visual.spec.ts-snapshots")
} | ConvertTo-Json -Compress
