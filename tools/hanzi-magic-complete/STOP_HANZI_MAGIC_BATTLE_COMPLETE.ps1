[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "CompleteLauncher.Common.ps1")
$repositoryRoot = Get-CompleteRepositoryRoot
$paths = Get-CompleteLauncherPaths -RepositoryRoot $repositoryRoot
if (Stop-CompleteOwnedServer -RepositoryRoot $repositoryRoot -Paths $paths -AllowNoRecord) { Write-Host "Stopped and cleaned the dedicated Complete Edition service." }
else { Write-Host "No running dedicated Complete Edition service was found; no process was stopped." }
