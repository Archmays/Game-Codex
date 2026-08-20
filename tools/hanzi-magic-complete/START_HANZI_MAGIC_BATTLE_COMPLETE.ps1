[CmdletBinding()]
param(
  [switch]$NoBrowser,
  [switch]$ExitAfterReady,
  [switch]$KeepServer,
  [int]$PreferredPort = 5196
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "CompleteLauncher.Common.ps1")

$repositoryRoot = Get-CompleteRepositoryRoot
$paths = Get-CompleteLauncherPaths -RepositoryRoot $repositoryRoot
$startedByThisInvocation = $false
$record = $null

try {
  $runtime = Get-CompleteRuntime -RepositoryRoot $repositoryRoot
  Write-Host "Hanzi Magic Battle V3.0.0 - Complete Ink Forest"
  Write-Host "Node $($runtime.NodeVersion) - pnpm $($runtime.PnpmVersion)"
  $existing = Get-CompleteValidatedRecordedServer -RepositoryRoot $repositoryRoot -Paths $paths
  if ($existing) {
    $record = [ordered]@{ pid = $existing.ProcessId; port = $existing.Port; url = $existing.Url; owned = $existing.Owned }
    Write-Host "Reusing the identity-verified local Game-Codex service on port $($existing.Port)."
  } else {
    $port = Find-CompleteFreePort -PreferredPort $PreferredPort
    if ($port -ne $PreferredPort) { Write-Host "Port $PreferredPort is occupied. Safely using port $port without stopping another process." }
    New-Item -ItemType Directory -Path $paths.TempDirectory -Force | Out-Null
    Write-CompleteUtf8NoBom -Path $paths.StdoutPath -Contents ""
    Write-CompleteUtf8NoBom -Path $paths.StderrPath -Contents ""
    $process = Start-Process -FilePath $runtime.NodePath -ArgumentList @($runtime.ViteCliPath, $repositoryRoot, "--host", $script:CompleteHost, "--port", "$port", "--strictPort") -WorkingDirectory $repositoryRoot -WindowStyle Hidden -RedirectStandardOutput $paths.StdoutPath -RedirectStandardError $paths.StderrPath -PassThru
    $startedByThisInvocation = $true
    $url = "http://$($script:CompleteHost):$port$($script:CompleteRoute)"
    try {
      Wait-CompleteHttpReady -Url $url
      $listeners = @(Get-CompleteListenerProcessIds -Port $port | Where-Object { [int]$_ -gt 0 })
      if ($listeners.Count -ne 1 -or [int]$listeners[0] -ne $process.Id) { throw "The HTTP-ready listener was not the exact process started by this launcher." }
      $details = Get-CompleteProcessDetails -ProcessId $process.Id
      if (-not $details -or -not (Test-CompleteCommandIdentity -CommandLine $details.CommandLine -ViteCliPath $paths.ViteCliPath -RepositoryRoot $repositoryRoot -Port $port)) { throw "The started process failed the Complete Edition identity check." }
      $record = Save-CompleteServerRecord -RepositoryRoot $repositoryRoot -Paths $paths -Server ([ordered]@{ ProcessId = $process.Id; ProcessStartTimeUtc = $details.ProcessStartTimeUtc; Port = $port; Owned = $true })
    } catch {
      if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
      throw
    }
    Write-Host "Started the dedicated local service on port $port."
  }

  Wait-CompleteHttpReady -Url $record.url
  if (-not $NoBrowser) { Start-Process $record.url; Write-Host "Opened the Complete Edition in the browser." }
  else { Write-Host "NoBrowser mode: the route is ready without opening a browser." }
  Write-Host "Game URL: $($record.url)"
  Write-Host "Failure logs: $($paths.TempDirectory)"

  if ($KeepServer) { Write-Host "KeepServer mode: the service remains running for the identity-safe STOP script."; return }
  if (-not $ExitAfterReady) { [void](Read-Host "Press Enter after playing. Only a service started by this launcher will be stopped") }
}
catch {
  Write-Host "Launch failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Review the single log directory: $($paths.TempDirectory)" -ForegroundColor Yellow
  throw
}
finally {
  if ($startedByThisInvocation -and -not $KeepServer) {
    try {
      if (Stop-CompleteOwnedServer -RepositoryRoot $repositoryRoot -Paths $paths -AllowNoRecord) { Write-Host "Cleaned the service created by this launcher." }
    } catch { Write-Warning "Automatic cleanup did not finish: $($_.Exception.Message). Run STOP_HANZI_MAGIC_BATTLE_COMPLETE.cmd." }
  }
}
