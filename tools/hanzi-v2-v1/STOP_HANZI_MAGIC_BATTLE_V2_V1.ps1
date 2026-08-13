[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "HanziMagicV1Tools.Common.ps1")
$repositoryRoot = Get-HanziV1RepositoryRoot
$paths = Get-HanziV1Paths -RepositoryRoot $repositoryRoot
if (-not (Test-Path -LiteralPath $paths.ServerRecordPath -PathType Leaf)) { Write-Host "No recorded Hanzi Magic V1 server was found. Nothing was stopped."; return }
$server = Get-HanziV1ValidatedServer -RepositoryRoot $repositoryRoot -Paths $paths -RequireRecord
if (-not $server) { throw "The recorded V1 server is no longer listening. The stale record was preserved." }
Stop-Process -Id ([int]$server.ProcessId) -Force
$deadline = [DateTime]::UtcNow.AddSeconds(10)
while ((Get-Process -Id ([int]$server.ProcessId) -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 100 }
if (Get-Process -Id ([int]$server.ProcessId) -ErrorAction SilentlyContinue) { throw "The exact recorded V1 PID did not stop." }
Remove-Item -LiteralPath $paths.ServerRecordPath -Force
Write-Host "Stopped the exact Hanzi Magic V1 server PID $($server.ProcessId)."
