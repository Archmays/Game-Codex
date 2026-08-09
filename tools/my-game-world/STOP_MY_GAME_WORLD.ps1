[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "MyGameWorldTools.Common.ps1")

$repositoryRoot = Get-MyGameWorldRepositoryRoot -ScriptDirectory $PSScriptRoot
$paths = Get-MyGameWorldPaths -RepositoryRoot $repositoryRoot

if (-not (Test-Path -LiteralPath $paths.ServerRecordPath -PathType Leaf)) {
  Write-Host "No recorded My Game World server was found. Nothing was stopped."
  Write-Host "Game progress and browser storage were not changed."
  return
}

$server = Get-MyGameWorldValidatedServer -RepositoryRoot $repositoryRoot -Paths $paths -RequireRecord
if (-not $server) {
  throw "The recorded server is no longer listening on 127.0.0.1:5175. The stale record was preserved for manual inspection."
}

Stop-Process -Id ([int]$server.ProcessId) -Force
$deadline = [DateTime]::UtcNow.AddSeconds(10)
while ((Get-Process -Id ([int]$server.ProcessId) -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline) {
  Start-Sleep -Milliseconds 100
}
if (Get-Process -Id ([int]$server.ProcessId) -ErrorAction SilentlyContinue) {
  throw "The exact recorded server PID $($server.ProcessId) did not stop. Its record was preserved."
}

Remove-Item -LiteralPath $paths.ServerRecordPath -Force
Write-Host "Stopped the exact recorded My Game World server PID $($server.ProcessId)."
Write-Host "Game progress and browser storage were not changed."
