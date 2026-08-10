[CmdletBinding()]
param([switch]$FixtureMode, [switch]$NoBrowser)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Step07Tools.Common.ps1")

$root = Get-Step07RepositoryRoot -ScriptDirectory $PSScriptRoot
$paths = Get-Step07Paths -RepositoryRoot $root
$runtime = Get-Step07Runtime -RepositoryRoot $root
Assert-Step07ParentAuthorization -Paths $paths
$head = Get-Step07Commit -RepositoryRoot $root -RequireFinal:(-not $FixtureMode)

if ($FixtureMode) {
  New-Item -ItemType Directory -Path $paths.FixtureRoot -Force | Out-Null
  & $runtime.Node $runtime.Tsx $paths.Contract generate-fixture $head $paths.FixtureObservation
  if ($LASTEXITCODE -ne 0) { throw "Synthetic STEP 07 fixture generation failed." }
  Write-Host "SYNTHETIC_TOOLING_TEST_ONLY"
  Write-Host "Fixture observation: $($paths.FixtureObservation)"
  Write-Host "No real second-use session was opened or claimed."
  exit 0
}

Assert-Step07MachineVerdict -Paths $paths -CommitSha $head -RepositoryRoot $root -Runtime $runtime
$launchNonce = New-Step07RuntimeGrant -Paths $paths -CommitSha $head
$verdictSha256 = Get-Step07Sha256 -Path $paths.Verdict
& (Join-Path $root "tools\my-game-world\START_MY_GAME_WORLD.ps1") -NoBrowser
if ($LASTEXITCODE -ne 0) { throw "Canonical family server failed to start." }

$observerUrl = "$script:Step07CanonicalOrigin/?observe=hanzi-v2-step07&build=$head&launch=$launchNonce&verdict=$verdictSha256"
if (-not $NoBrowser) { Start-Process $observerUrl; Write-Host "Opened the simplified STEP 07 parent observer." }
else { Write-Host "NoBrowser mode: parent observer was not opened." }
Write-Host "Parent observer: $observerUrl"
Write-Host "The child window opens only after READY; do not specify a destination or answer."
