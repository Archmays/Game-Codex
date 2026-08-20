$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$script:CompleteHost = "127.0.0.1"
$script:CompletePreferredPort = 5196
$script:CompletePortRange = 5196..5205
$script:CompleteRoute = "/?play=hanzi-magic-complete&from=hub"

function Get-CompleteRepositoryRoot {
  $candidate = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
  $required = @(
    (Join-Path $candidate "package.json"),
    (Join-Path $candidate "games\hanzi-radical-battle\complete\app\complete-app.ts")
  )
  if ($required.Where({ -not (Test-Path -LiteralPath $_ -PathType Leaf) }).Count -gt 0) {
    throw "Game-Codex Hanzi Magic Complete repository root was not found from $PSScriptRoot."
  }
  return $candidate.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
}

function Get-CompleteLauncherPaths {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
  $tempDirectory = Join-Path $RepositoryRoot "tmp\hanzi-magic-complete"
  return [ordered]@{
    TempDirectory = $tempDirectory
    ServerRecordPath = Join-Path $tempDirectory "server.json"
    StdoutPath = Join-Path $tempDirectory "server.stdout.log"
    StderrPath = Join-Path $tempDirectory "server.stderr.log"
    ViteCliPath = Join-Path $RepositoryRoot "node_modules\vite\bin\vite.js"
  }
}

function Write-CompleteUtf8NoBom {
  param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Contents)
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $parent = Split-Path -Parent $fullPath
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  [System.IO.File]::WriteAllText($fullPath, $Contents, [System.Text.UTF8Encoding]::new($false))
}

function Get-CompleteRuntime {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
  $node = Get-Command node -ErrorAction SilentlyContinue
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if (-not $node) { throw "Node.js was not found on PATH." }
  if (-not $pnpm) { throw "pnpm was not found on PATH." }
  $vite = Join-Path $RepositoryRoot "node_modules\vite\bin\vite.js"
  if (-not (Test-Path -LiteralPath $vite -PathType Leaf)) {
    Write-Host "Dependencies are missing; installing the locked workspace dependencies..."
    & $pnpm.Source install --frozen-lockfile
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $vite -PathType Leaf)) { throw "Locked dependency installation failed." }
  }
  return [ordered]@{
    NodePath = $node.Source
    NodeVersion = (& $node.Source --version).Trim()
    PnpmVersion = (& $pnpm.Source --version).Trim()
    ViteCliPath = [System.IO.Path]::GetFullPath($vite)
  }
}

function Get-CompleteListenerProcessIds {
  param([Parameter(Mandatory = $true)][int]$Port)
  try {
    return @(Get-NetTCPConnection -State Listen -LocalAddress $script:CompleteHost -LocalPort $Port -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {
    $pattern = "^\s*TCP\s+$([regex]::Escape($script:CompleteHost)):$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
    return @(& netstat.exe -ano -p TCP 2>$null | ForEach-Object { if ($_ -match $pattern) { [int]$Matches[1] } } | Select-Object -Unique)
  }
}

function Get-CompleteProcessDetails {
  param([Parameter(Mandatory = $true)][int]$ProcessId)
  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    $cim = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    return [ordered]@{ Process = $process; CommandLine = [string]$cim.CommandLine; ProcessStartTimeUtc = $process.StartTime.ToUniversalTime().ToString("o") }
  } catch { return $null }
}

function Test-CompleteCommandIdentity {
  param([string]$CommandLine, [string]$ViteCliPath, [string]$RepositoryRoot, [int]$Port)
  if ([string]::IsNullOrWhiteSpace($CommandLine)) { return $false }
  $command = $CommandLine.Replace("/", "\")
  $vite = [System.IO.Path]::GetFullPath($ViteCliPath).Replace("/", "\")
  $root = [System.IO.Path]::GetFullPath($RepositoryRoot).Replace("/", "\")
  return $command.IndexOf($vite, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $command.IndexOf($root, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $command -match '(?i)--host(?:\s+|=)"?127\.0\.0\.1"?(?:\s|$)' -and
    $command -match ('(?i)--port(?:\s+|=)"?{0}"?(?:\s|$)' -f $Port) -and
    $command -match '(?i)--strictPort(?:\s|$)'
}

function Read-CompleteServerRecord {
  param([System.Collections.IDictionary]$Paths)
  if (-not (Test-Path -LiteralPath $Paths.ServerRecordPath -PathType Leaf)) { return $null }
  try { return Get-Content -LiteralPath $Paths.ServerRecordPath -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { throw "The Complete Edition server record is unreadable: $($Paths.ServerRecordPath)" }
}

function Get-CompleteValidatedRecordedServer {
  param([string]$RepositoryRoot, [System.Collections.IDictionary]$Paths)
  $record = Read-CompleteServerRecord -Paths $Paths
  if (-not $record) { return $null }
  if ([int]$record.schemaVersion -ne 1 -or [string]$record.task -cne "hanzi-magic-complete-v3-server") { throw "The Complete Edition server record has an unknown identity." }
  $port = [int]$record.port
  $listeners = @(Get-CompleteListenerProcessIds -Port $port | Where-Object { [int]$_ -gt 0 })
  if ($listeners.Count -eq 0) {
    Remove-Item -LiteralPath $Paths.ServerRecordPath -Force
    return $null
  }
  if ($listeners.Count -ne 1 -or [int]$listeners[0] -ne [int]$record.pid) { throw "The recorded Complete Edition port has ambiguous ownership. Nothing was reused or stopped." }
  $details = Get-CompleteProcessDetails -ProcessId ([int]$record.pid)
  $matches = $details -and
    [string]$details.ProcessStartTimeUtc -ceq [string]$record.processStartTimeUtc -and
    [System.IO.Path]::GetFullPath([string]$record.repositoryRoot) -ceq [System.IO.Path]::GetFullPath($RepositoryRoot) -and
    (Test-CompleteCommandIdentity -CommandLine $details.CommandLine -ViteCliPath $Paths.ViteCliPath -RepositoryRoot $RepositoryRoot -Port $port)
  if (-not $matches) { throw "The recorded Complete Edition process identity does not match the live listener. Nothing was reused or stopped." }
  return [ordered]@{ ProcessId = [int]$record.pid; ProcessStartTimeUtc = [string]$record.processStartTimeUtc; Port = $port; Owned = [bool]$record.owned; Url = [string]$record.url }
}

function Find-CompleteFreePort {
  param([int]$PreferredPort = $script:CompletePreferredPort)
  $candidates = @($PreferredPort) + @($script:CompletePortRange | Where-Object { $_ -ne $PreferredPort })
  foreach ($port in $candidates) {
    if (@(Get-CompleteListenerProcessIds -Port $port).Count -eq 0) { return [int]$port }
  }
  throw "All Complete Edition launcher ports 5196-5205 are occupied. No existing process was changed."
}

function Save-CompleteServerRecord {
  param([string]$RepositoryRoot, [System.Collections.IDictionary]$Paths, [System.Collections.IDictionary]$Server)
  $url = "http://$($script:CompleteHost):$($Server.Port)$($script:CompleteRoute)"
  $record = [ordered]@{
    schemaVersion = 1
    task = "hanzi-magic-complete-v3-server"
    pid = [int]$Server.ProcessId
    processStartTimeUtc = [string]$Server.ProcessStartTimeUtc
    host = $script:CompleteHost
    port = [int]$Server.Port
    url = $url
    repositoryRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
    owned = [bool]$Server.Owned
    recordedAtUtc = [DateTime]::UtcNow.ToString("o")
  }
  Write-CompleteUtf8NoBom -Path $Paths.ServerRecordPath -Contents (($record | ConvertTo-Json -Depth 4) + "`n")
  return $record
}

function Wait-CompleteHttpReady {
  param([Parameter(Mandatory = $true)][string]$Url)
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400 -and $response.Content -match '<div id="app"></div>') { return }
    } catch { }
    Start-Sleep -Milliseconds 250
  }
  throw "The Complete Edition route did not become HTTP ready within 60 seconds."
}

function Stop-CompleteOwnedServer {
  param([string]$RepositoryRoot, [System.Collections.IDictionary]$Paths, [switch]$AllowNoRecord)
  $server = Get-CompleteValidatedRecordedServer -RepositoryRoot $RepositoryRoot -Paths $Paths
  if (-not $server) {
    if ($AllowNoRecord) { return $false }
    throw "No recorded Complete Edition server is running."
  }
  if (-not $server.Owned) { throw "The recorded server was not started by this launcher, so it will not be stopped." }
  Stop-Process -Id $server.ProcessId -Force
  $deadline = [DateTime]::UtcNow.AddSeconds(10)
  while ((Get-Process -Id $server.ProcessId -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 100 }
  if (Get-Process -Id $server.ProcessId -ErrorAction SilentlyContinue) { throw "The exact recorded Complete Edition PID did not stop." }
  Remove-Item -LiteralPath $Paths.ServerRecordPath -Force
  return $true
}
