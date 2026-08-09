[CmdletBinding()]
param([switch]$FixtureMode, [switch]$NoBrowser)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Step06Tools.Common.ps1")

$root = Get-Step06RepositoryRoot -ScriptDirectory $PSScriptRoot
$paths = Get-Step06Paths -RepositoryRoot $root
$runtime = Get-Step06Runtime -RepositoryRoot $root
$authorization = Get-Step06ParentAuthorization -Paths $paths
Assert-Step06ParentIdentity -Paths $paths
$head = Get-Step06FinalCommit -RepositoryRoot $root -Paths $paths

Write-Host "STEP 05 feedback: $($authorization.Sha256)"
Write-Host "Parent authorization: 4 ACCEPT; default YES; second-use YES"
Write-Host "Final STEP 06 commit: $head"
Write-Host "Canonical origin: $script:Step06CanonicalOrigin"

& (Join-Path $root "tools\my-game-world\START_MY_GAME_WORLD.ps1") -NoBrowser
if ($LASTEXITCODE -ne 0) { throw "Canonical family server failed to start." }

if ($FixtureMode) {
  New-Item -ItemType Directory -Path $paths.Inbox -Force | Out-Null
  $fixturePath = Join-Path $paths.Inbox "STEP-06_SECOND_USE_OBSERVATION.json"
  & $runtime.Node $runtime.Tsx $paths.Contract generate-fixture $head $fixturePath
  if ($LASTEXITCODE -ne 0) { throw "Synthetic STEP 06 fixture generation failed." }
  Write-Host "SYNTHETIC_TOOLING_TEST_ONLY"
  Write-Host "Fixture dry-run evidence created: $fixturePath"
  Write-Host "No real second-use session was opened or claimed."
  exit 0
}

$observerUrl = "$script:Step06CanonicalOrigin/?observe=hanzi-v2-step06&build=$head"
if (-not $NoBrowser) { Start-Process $observerUrl; Write-Host "Opened the parent observer only." } else { Write-Host "NoBrowser mode: parent observer was not opened." }
Write-Host "Parent observer: $observerUrl"
Write-Host "The child window opens only after parent READY. Do not specify a destination."
