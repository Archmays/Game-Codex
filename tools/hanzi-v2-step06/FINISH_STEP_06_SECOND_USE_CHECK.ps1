[CmdletBinding()]
param([switch]$FixtureMode)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Step06Tools.Common.ps1")

$root = Get-Step06RepositoryRoot -ScriptDirectory $PSScriptRoot
$paths = Get-Step06Paths -RepositoryRoot $root
$runtime = Get-Step06Runtime -RepositoryRoot $root
$authorization = Get-Step06ParentAuthorization -Paths $paths
Assert-Step06ParentIdentity -Paths $paths
$head = Get-Step06FinalCommit -RepositoryRoot $root -Paths $paths
$input = Resolve-Step06ObservationInput -Paths $paths -FixtureMode:$FixtureMode
$expectedKind = if ($FixtureMode) { "SYNTHETIC_TOOLING_TEST_ONLY" } else { "REAL_CHILD_SECOND_USE" }

New-Item -ItemType Directory -Path $paths.ArtifactRoot -Force | Out-Null
& $runtime.Node $runtime.Tsx $paths.Contract validate-summary $input $paths.Summary $expectedKind $head
if ($LASTEXITCODE -ne 0) { throw "STEP 06 observation validation failed. Nothing was packaged." }
Copy-Item -LiteralPath $input -Destination $paths.Observation -Force

$staging = Join-Path $paths.TempRoot "package-$([Guid]::NewGuid().ToString('N'))"
try {
  New-Item -ItemType Directory -Path $staging -Force | Out-Null
  Copy-Item -LiteralPath $paths.Observation -Destination (Join-Path $staging "STEP-06_SECOND_USE_OBSERVATION.json")
  Copy-Item -LiteralPath $paths.Summary -Destination (Join-Path $staging "STEP-06-SECOND-USE-SUMMARY.md")
  Copy-Item -LiteralPath $paths.ParentIdentity -Destination (Join-Path $staging "STEP-06-PARENT-AUTHORIZATION-IDENTITY.json")
  Copy-Item -LiteralPath $paths.DefaultIdentity -Destination (Join-Path $staging "STEP-06-DEFAULT-WORLD-IDENTITY.json")
  if (Test-Path -LiteralPath $paths.ReturnZip -PathType Leaf) { Remove-Item -LiteralPath $paths.ReturnZip -Force }
  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $paths.ReturnZip -CompressionLevel Optimal
} finally {
  Remove-Step06OwnedStaging -TempRoot $paths.TempRoot -Staging $staging
}

Write-Host "Validated evidence kind: $expectedKind"
Write-Host "Input SHA-256: $(Get-Step06Sha256 -Path $input)"
Write-Host "Summary: $($paths.Summary)"
Write-Host "Return package: $($paths.ReturnZip)"
Write-Host "No automatic PASS/FAIL or promotion decision was produced."
