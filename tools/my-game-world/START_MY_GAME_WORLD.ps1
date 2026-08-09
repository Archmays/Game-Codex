[CmdletBinding()]
param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "MyGameWorldTools.Common.ps1")

$repositoryRoot = Get-MyGameWorldRepositoryRoot -ScriptDirectory $PSScriptRoot
$paths = Get-MyGameWorldPaths -RepositoryRoot $repositoryRoot
$runtime = Get-MyGameWorldRuntime -RepositoryRoot $repositoryRoot
$paths.ViteCliPath = $runtime.ViteCliPath

Write-Host "Node: $($runtime.NodeVersion)"
Write-Host "pnpm: $($runtime.PnpmVersion)"
Write-Host "Canonical family origin: $script:MyGameWorldOrigin"

$existingServer = Get-MyGameWorldValidatedServer -RepositoryRoot $repositoryRoot -Paths $paths
if ($existingServer) {
  if (-not $existingServer.Record) {
    Save-MyGameWorldServerRecord -RepositoryRoot $repositoryRoot -Paths $paths -Server $existingServer -StartedByFamilyLauncher $false
  }
  Write-Host "Reusing the exact Game-Codex Vite server on 127.0.0.1:5175."
} else {
  New-Item -ItemType Directory -Path $paths.TempDirectory -Force | Out-Null
  Write-MyGameWorldUtf8NoBom -Path $paths.StdoutPath -Contents ""
  Write-MyGameWorldUtf8NoBom -Path $paths.StderrPath -Contents ""

  $process = Start-Process -FilePath $runtime.NodePath `
    -ArgumentList @($runtime.ViteCliPath, $repositoryRoot, "--host", $script:MyGameWorldHost, "--port", "$script:MyGameWorldPort", "--strictPort") `
    -WorkingDirectory $repositoryRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $paths.StdoutPath `
    -RedirectStandardError $paths.StderrPath `
    -PassThru

  try {
    Wait-MyGameWorldServer
    $startedServer = Get-MyGameWorldValidatedServer -RepositoryRoot $repositoryRoot -Paths $paths
    if (-not $startedServer -or [int]$startedServer.ProcessId -ne $process.Id) {
      throw "The server that answered on port 5175 was not the process started by this launcher."
    }
    Save-MyGameWorldServerRecord -RepositoryRoot $repositoryRoot -Paths $paths -Server $startedServer -StartedByFamilyLauncher $true
  } catch {
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    throw
  }
  Write-Host "Started the exact Game-Codex Vite server on 127.0.0.1:5175."
}

Wait-MyGameWorldServer
if (-not $NoBrowser) {
  Start-Process $script:MyGameWorldUrl
  Write-Host "Opened My Game World in the default browser."
} else {
  Write-Host "NoBrowser mode: the server is ready, but no browser was opened."
}

Write-Host "Exact URL: $script:MyGameWorldUrl"
Write-Host "Progress was not cleared or rewritten. Continue using the same browser profile and this exact origin."
