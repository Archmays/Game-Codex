[CmdletBinding()]
param([switch]$FixtureMode)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Step07Tools.Common.ps1")

$root = Get-Step07RepositoryRoot -ScriptDirectory $PSScriptRoot
$paths = Get-Step07Paths -RepositoryRoot $root
$runtime = Get-Step07Runtime -RepositoryRoot $root
Assert-Step07ParentAuthorization -Paths $paths
$head = Get-Step07Commit -RepositoryRoot $root -RequireFinal:(-not $FixtureMode)

if ($FixtureMode) {
  if (-not (Test-Path -LiteralPath $paths.FixtureObservation -PathType Leaf)) { throw "Synthetic STEP 07 fixture observation was not found. Run START with -FixtureMode first." }
  & $runtime.Node $runtime.Tsx $paths.Contract validate-summary $paths.FixtureObservation $paths.FixtureSummary SYNTHETIC_TOOLING_TEST_ONLY $head
  if ($LASTEXITCODE -ne 0) { throw "Synthetic STEP 07 fixture validation failed." }
  $staging = Join-Path $paths.TempRoot "package-$([Guid]::NewGuid().ToString('N'))"
  try {
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    Copy-Item -LiteralPath $paths.FixtureObservation -Destination (Join-Path $staging "STEP-07_SYNTHETIC_TOOLING_TEST_OBSERVATION.json")
    Copy-Item -LiteralPath $paths.FixtureSummary -Destination (Join-Path $staging "STEP-07-SYNTHETIC-TOOLING-SUMMARY.md")
    if (Test-Path -LiteralPath $paths.FixtureZip -PathType Leaf) { Remove-Item -LiteralPath $paths.FixtureZip -Force }
    Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $paths.FixtureZip -CompressionLevel Optimal
  } finally { Remove-Step07OwnedStaging -TempRoot $paths.TempRoot -Staging $staging }
  Write-Host "Validated evidence kind: SYNTHETIC_TOOLING_TEST_ONLY"
  Write-Host "Fixture package: $($paths.FixtureZip)"
  Write-Host "The real-child return package was not created."
  exit 0
}

Assert-Step07MachineVerdict -Paths $paths -CommitSha $head -RepositoryRoot $root -Runtime $runtime
$input = Resolve-Step07ObservationInput -Paths $paths
$verdictSha256 = Get-Step07Sha256 -Path $paths.Verdict
New-Item -ItemType Directory -Path $paths.ArtifactRoot -Force | Out-Null
& $runtime.Node $runtime.Tsx $paths.Contract validate-summary $input $paths.Summary REAL_CHILD_SECOND_USE $head $verdictSha256
if ($LASTEXITCODE -ne 0) { throw "STEP 07 real observation validation failed. Nothing was packaged." }
Copy-Item -LiteralPath $input -Destination $paths.Observation -Force

# Recheck the immutable machine-evidence binding immediately before packaging.
Assert-Step07MachineVerdict -Paths $paths -CommitSha $head -RepositoryRoot $root -Runtime $runtime
$recheckedVerdictSha256 = Get-Step07Sha256 -Path $paths.Verdict
if ($recheckedVerdictSha256 -cne $verdictSha256) { throw "STEP 07 machine verdict changed during observation packaging." }

$staging = Join-Path $paths.TempRoot "package-$([Guid]::NewGuid().ToString('N'))"
try {
  New-Item -ItemType Directory -Path $staging -Force | Out-Null
  Copy-Item -LiteralPath $paths.Observation -Destination (Join-Path $staging "STEP-07_REAL_SECOND_USE_OBSERVATION.json")
  Copy-Item -LiteralPath $paths.Summary -Destination (Join-Path $staging "STEP-07-REAL-SECOND-USE-SUMMARY.md")
  Copy-Item -LiteralPath $paths.Verdict -Destination (Join-Path $staging "MACHINE-REVIEW-VERDICT.json")
  Copy-Item -LiteralPath $paths.EvidenceManifest -Destination (Join-Path $staging "EVIDENCE-MANIFEST.json")
  if (Test-Path -LiteralPath $paths.RealReturnZip -PathType Leaf) { Remove-Item -LiteralPath $paths.RealReturnZip -Force }
  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $paths.RealReturnZip -CompressionLevel Optimal
} finally { Remove-Step07OwnedStaging -TempRoot $paths.TempRoot -Staging $staging }

Write-Host "Validated evidence kind: REAL_CHILD_SECOND_USE"
Write-Host "Input SHA-256: $(Get-Step07Sha256 -Path $input)"
Write-Host "Return package: $($paths.RealReturnZip)"
Write-Host "No automatic child PASS, learning, retention, or expansion conclusion was produced."
if (Test-Path -LiteralPath $paths.RuntimeGrant -PathType Leaf) { Remove-Item -LiteralPath $paths.RuntimeGrant -Force }
