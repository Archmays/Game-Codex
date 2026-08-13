$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$script:ChapterOneHost = "127.0.0.1"
$script:ChapterOnePreferredPort = 5186
$script:ChapterOnePortRange = 5186..5195
$script:ChapterOneRoute = "/?play=hanzi-v2-chapter-one&from=hub"

function Get-ChapterOneRepositoryRoot {
  $candidate = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
  $required = @(
    (Join-Path $candidate "package.json"),
    (Join-Path $candidate "games\hanzi-radical-battle\v2\chapter-one\m3-app.ts")
  )
  if ($required.Where({ -not (Test-Path -LiteralPath $_ -PathType Leaf) }).Count -gt 0) {
    throw "Game-Codex Chapter One repository root was not found from $PSScriptRoot."
  }
  return $candidate.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
}

function Get-ChapterOneLauncherPaths {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
  $tempDirectory = Join-Path $RepositoryRoot "tmp\hanzi-v2-chapter-one"
  return [ordered]@{
    TempDirectory = $tempDirectory
    ServerRecordPath = Join-Path $tempDirectory "server.json"
    StdoutPath = Join-Path $tempDirectory "server.stdout.log"
    StderrPath = Join-Path $tempDirectory "server.stderr.log"
    ViteCliPath = Join-Path $RepositoryRoot "node_modules\vite\bin\vite.js"
  }
}

function Write-ChapterOneUtf8NoBom {
  param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Contents)
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $parent = Split-Path -Parent $fullPath
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  [System.IO.File]::WriteAllText($fullPath, $Contents, [System.Text.UTF8Encoding]::new($false))
}

function Get-ChapterOneRuntime {
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

function Get-ChapterOneListenerProcessIds {
  param([Parameter(Mandatory = $true)][int]$Port)
  try {
    return @(Get-NetTCPConnection -State Listen -LocalAddress $script:ChapterOneHost -LocalPort $Port -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {
    $pattern = "^\s*TCP\s+$([regex]::Escape($script:ChapterOneHost)):$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
    return @(& netstat.exe -ano -p TCP 2>$null | ForEach-Object { if ($_ -match $pattern) { [int]$Matches[1] } } | Select-Object -Unique)
  }
}

function Get-ChapterOneProcessDetails {
  param([Parameter(Mandatory = $true)][int]$ProcessId)
  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    $cim = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    return [ordered]@{ Process = $process; CommandLine = [string]$cim.CommandLine; ProcessStartTimeUtc = $process.StartTime.ToUniversalTime().ToString("o") }
  } catch { return $null }
}

function Test-ChapterOneCommandIdentity {
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

function Read-ChapterOneServerRecord {
  param([System.Collections.IDictionary]$Paths)
  if (-not (Test-Path -LiteralPath $Paths.ServerRecordPath -PathType Leaf)) { return $null }
  try { return Get-Content -LiteralPath $Paths.ServerRecordPath -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { throw "The Chapter One server record is unreadable: $($Paths.ServerRecordPath)" }
}

function Get-ChapterOneValidatedRecordedServer {
  param([string]$RepositoryRoot, [System.Collections.IDictionary]$Paths)
  $record = Read-ChapterOneServerRecord -Paths $Paths
  if (-not $record) { return $null }
  if ([int]$record.schemaVersion -ne 1 -or [string]$record.task -cne "hanzi-magic-v2-chapter-one-server") { throw "The Chapter One server record has an unknown identity." }
  $port = [int]$record.port
  $listeners = @(Get-ChapterOneListenerProcessIds -Port $port | Where-Object { [int]$_ -gt 0 })
  if ($listeners.Count -eq 0) {
    Remove-Item -LiteralPath $Paths.ServerRecordPath -Force
    return $null
  }
  if ($listeners.Count -ne 1 -or [int]$listeners[0] -ne [int]$record.pid) { throw "The recorded Chapter One port has ambiguous ownership. Nothing was reused or stopped." }
  $details = Get-ChapterOneProcessDetails -ProcessId ([int]$record.pid)
  $matches = $details -and
    [string]$details.ProcessStartTimeUtc -ceq [string]$record.processStartTimeUtc -and
    [System.IO.Path]::GetFullPath([string]$record.repositoryRoot) -ceq [System.IO.Path]::GetFullPath($RepositoryRoot) -and
    (Test-ChapterOneCommandIdentity -CommandLine $details.CommandLine -ViteCliPath $Paths.ViteCliPath -RepositoryRoot $RepositoryRoot -Port $port)
  if (-not $matches) { throw "The recorded Chapter One process identity does not match the live listener. Nothing was reused or stopped." }
  return [ordered]@{ ProcessId = [int]$record.pid; ProcessStartTimeUtc = [string]$record.processStartTimeUtc; Port = $port; Owned = [bool]$record.owned; Url = [string]$record.url }
}

function Find-ChapterOneFreePort {
  param([int]$PreferredPort = $script:ChapterOnePreferredPort)
  $candidates = @($PreferredPort) + @($script:ChapterOnePortRange | Where-Object { $_ -ne $PreferredPort })
  foreach ($port in $candidates) {
    if (@(Get-ChapterOneListenerProcessIds -Port $port).Count -eq 0) { return [int]$port }
  }
  throw "All Chapter One launcher ports 5186-5195 are occupied. No existing process was changed."
}

function Save-ChapterOneServerRecord {
  param([string]$RepositoryRoot, [System.Collections.IDictionary]$Paths, [System.Collections.IDictionary]$Server)
  $url = "http://$($script:ChapterOneHost):$($Server.Port)$($script:ChapterOneRoute)"
  $record = [ordered]@{
    schemaVersion = 1
    task = "hanzi-magic-v2-chapter-one-server"
    pid = [int]$Server.ProcessId
    processStartTimeUtc = [string]$Server.ProcessStartTimeUtc
    host = $script:ChapterOneHost
    port = [int]$Server.Port
    url = $url
    repositoryRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
    owned = [bool]$Server.Owned
    recordedAtUtc = [DateTime]::UtcNow.ToString("o")
  }
  Write-ChapterOneUtf8NoBom -Path $Paths.ServerRecordPath -Contents (($record | ConvertTo-Json -Depth 4) + "`n")
  return $record
}

function Wait-ChapterOneHttpReady {
  param([Parameter(Mandatory = $true)][string]$Url)
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400 -and $response.Content -match '<div id="app"></div>') { return }
    } catch { }
    Start-Sleep -Milliseconds 250
  }
  throw "The Chapter One route did not become HTTP ready within 60 seconds."
}

function Stop-ChapterOneOwnedServer {
  param([string]$RepositoryRoot, [System.Collections.IDictionary]$Paths, [switch]$AllowNoRecord)
  $server = Get-ChapterOneValidatedRecordedServer -RepositoryRoot $RepositoryRoot -Paths $Paths
  if (-not $server) {
    if ($AllowNoRecord) { return $false }
    throw "No recorded Chapter One server is running."
  }
  if (-not $server.Owned) { throw "The recorded server was not started by this launcher, so it will not be stopped." }
  Stop-Process -Id $server.ProcessId -Force
  $deadline = [DateTime]::UtcNow.AddSeconds(10)
  while ((Get-Process -Id $server.ProcessId -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 100 }
  if (Get-Process -Id $server.ProcessId -ErrorAction SilentlyContinue) { throw "The exact recorded Chapter One PID did not stop." }
  Remove-Item -LiteralPath $Paths.ServerRecordPath -Force
  return $true
}
