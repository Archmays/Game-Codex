[CmdletBinding()]
param(
  [switch]$NoBrowser,
  [switch]$ExitAfterReady,
  [switch]$KeepServer,
  [int]$PreferredPort = 5186
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "ChapterOneLauncher.Common.ps1")

$repositoryRoot = Get-ChapterOneRepositoryRoot
$paths = Get-ChapterOneLauncherPaths -RepositoryRoot $repositoryRoot
$startedByThisInvocation = $false
$record = $null

try {
  $runtime = Get-ChapterOneRuntime -RepositoryRoot $repositoryRoot
  Write-Host "Hanzi Magic Battle V2.0.0 - Ink Forest Chapter One"
  Write-Host "Node $($runtime.NodeVersion) - pnpm $($runtime.PnpmVersion)"
  $existing = Get-ChapterOneValidatedRecordedServer -RepositoryRoot $repositoryRoot -Paths $paths
  if ($existing) {
    $record = [ordered]@{ pid = $existing.ProcessId; port = $existing.Port; url = $existing.Url; owned = $existing.Owned }
    Write-Host "Reusing the identity-verified local Game-Codex service on port $($existing.Port)."
  } else {
    $port = Find-ChapterOneFreePort -PreferredPort $PreferredPort
    if ($port -ne $PreferredPort) { Write-Host "Port $PreferredPort is occupied. Safely using port $port without stopping another process." }
    New-Item -ItemType Directory -Path $paths.TempDirectory -Force | Out-Null
    Write-ChapterOneUtf8NoBom -Path $paths.StdoutPath -Contents ""
    Write-ChapterOneUtf8NoBom -Path $paths.StderrPath -Contents ""
    $process = Start-Process -FilePath $runtime.NodePath -ArgumentList @($runtime.ViteCliPath, $repositoryRoot, "--host", $script:ChapterOneHost, "--port", "$port", "--strictPort") -WorkingDirectory $repositoryRoot -WindowStyle Hidden -RedirectStandardOutput $paths.StdoutPath -RedirectStandardError $paths.StderrPath -PassThru
    $startedByThisInvocation = $true
    $url = "http://$($script:ChapterOneHost):$port$($script:ChapterOneRoute)"
    try {
      Wait-ChapterOneHttpReady -Url $url
      $listeners = @(Get-ChapterOneListenerProcessIds -Port $port | Where-Object { [int]$_ -gt 0 })
      if ($listeners.Count -ne 1 -or [int]$listeners[0] -ne $process.Id) { throw "The HTTP-ready listener was not the exact process started by this launcher." }
      $details = Get-ChapterOneProcessDetails -ProcessId $process.Id
      if (-not $details -or -not (Test-ChapterOneCommandIdentity -CommandLine $details.CommandLine -ViteCliPath $paths.ViteCliPath -RepositoryRoot $repositoryRoot -Port $port)) { throw "The started process failed the Chapter One identity check." }
      $record = Save-ChapterOneServerRecord -RepositoryRoot $repositoryRoot -Paths $paths -Server ([ordered]@{ ProcessId = $process.Id; ProcessStartTimeUtc = $details.ProcessStartTimeUtc; Port = $port; Owned = $true })
    } catch {
      if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
      throw
    }
    Write-Host "Started the dedicated local service on port $port."
  }

  Wait-ChapterOneHttpReady -Url $record.url
  if (-not $NoBrowser) { Start-Process $record.url; Write-Host "Opened Chapter One in the browser." }
  else { Write-Host "NoBrowser mode: the route is ready without opening a browser." }
  Write-Host "Game URL: $($record.url)"
  Write-Host "Failure logs: $($paths.TempDirectory)"

  if ($KeepServer) { Write-Host "KeepServer mode: the service remains running for the identity-safe STOP script."; return }
  if (-not $ExitAfterReady) { [void](Read-Host "Press Enter after playing. Only a service started by this launcher will be stopped") }
}
catch {
  Write-Host "Launch failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Review the log directory: $($paths.TempDirectory)" -ForegroundColor Yellow
  throw
}
finally {
  if ($startedByThisInvocation -and -not $KeepServer) {
    try {
      if (Stop-ChapterOneOwnedServer -RepositoryRoot $repositoryRoot -Paths $paths -AllowNoRecord) { Write-Host "Cleaned the service created by this launcher." }
    } catch { Write-Warning "Automatic cleanup did not finish: $($_.Exception.Message). Run STOP_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.cmd." }
  }
}
