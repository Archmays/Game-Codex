[CmdletBinding()]
param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "HanziMagicV1Tools.Common.ps1")

$repositoryRoot = Get-HanziV1RepositoryRoot
$paths = Get-HanziV1Paths -RepositoryRoot $repositoryRoot
$runtime = Get-HanziV1Runtime -RepositoryRoot $repositoryRoot
Write-Host "Node: $($runtime.NodeVersion)"
Write-Host "pnpm: $($runtime.PnpmVersion)"

$existing = Get-HanziV1ValidatedServer -RepositoryRoot $repositoryRoot -Paths $paths
if ($existing) {
  if (-not $existing.Record) { Save-HanziV1ServerRecord -RepositoryRoot $repositoryRoot -Paths $paths -Server $existing }
  Write-Host "Reusing the exact Hanzi Magic V1 server."
} else {
  New-Item -ItemType Directory -Path $paths.TempDirectory -Force | Out-Null
  Write-HanziV1Utf8NoBom -Path $paths.StdoutPath -Contents ""
  Write-HanziV1Utf8NoBom -Path $paths.StderrPath -Contents ""
  $process = Start-Process -FilePath $runtime.NodePath -ArgumentList @($runtime.ViteCliPath, $repositoryRoot, "--host", $script:HanziV1Host, "--port", "$script:HanziV1Port", "--strictPort") -WorkingDirectory $repositoryRoot -WindowStyle Hidden -RedirectStandardOutput $paths.StdoutPath -RedirectStandardError $paths.StderrPath -PassThru
  try {
    Wait-HanziV1Server
    $started = Get-HanziV1ValidatedServer -RepositoryRoot $repositoryRoot -Paths $paths
    if (-not $started -or [int]$started.ProcessId -ne $process.Id) { throw "The HTTP-ready listener was not the process started by this launcher." }
    Save-HanziV1ServerRecord -RepositoryRoot $repositoryRoot -Paths $paths -Server $started
  } catch {
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    throw
  }
  Write-Host "Started the exact Hanzi Magic V1 server."
}

Wait-HanziV1Server
if (-not $NoBrowser) { Start-Process $script:HanziV1Url; Write-Host "Opened the V1 child route." } else { Write-Host "NoBrowser mode: ready without opening a browser." }
Write-Host "Exact URL: $script:HanziV1Url"
