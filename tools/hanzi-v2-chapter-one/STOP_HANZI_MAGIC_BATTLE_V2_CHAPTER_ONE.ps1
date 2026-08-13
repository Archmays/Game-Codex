[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "ChapterOneLauncher.Common.ps1")
$repositoryRoot = Get-ChapterOneRepositoryRoot
$paths = Get-ChapterOneLauncherPaths -RepositoryRoot $repositoryRoot
if (Stop-ChapterOneOwnedServer -RepositoryRoot $repositoryRoot -Paths $paths -AllowNoRecord) { Write-Host "Stopped and cleaned the dedicated Chapter One service." }
else { Write-Host "No running dedicated service was found; no process was stopped." }
