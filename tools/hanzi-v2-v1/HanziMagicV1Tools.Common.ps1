$ErrorActionPreference = "Stop"

$script:HanziV1Host = "127.0.0.1"
$script:HanziV1Port = 5180
$script:HanziV1Origin = "http://127.0.0.1:5180"
$script:HanziV1Url = "http://127.0.0.1:5180/?play=hanzi-v2-v1&from=hub"

function Get-HanziV1RepositoryRoot {
  $candidate = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
  if (-not (Test-Path -LiteralPath (Join-Path $candidate "package.json") -PathType Leaf) -or
      -not (Test-Path -LiteralPath (Join-Path $candidate "games\hanzi-radical-battle\v2\v1\index.ts") -PathType Leaf)) {
    throw "Game-Codex repository root was not found from $PSScriptRoot."
  }
  return $candidate.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
}

function Get-HanziV1Paths {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
  $tempDirectory = Join-Path $RepositoryRoot "tmp\hanzi-v2-v1"
  return [ordered]@{
    TempDirectory = $tempDirectory
    ServerRecordPath = Join-Path $tempDirectory "server.json"
    StdoutPath = Join-Path $tempDirectory "server.stdout.log"
    StderrPath = Join-Path $tempDirectory "server.stderr.log"
    ViteCliPath = Join-Path $RepositoryRoot "node_modules\vite\bin\vite.js"
  }
}

function Write-HanziV1Utf8NoBom {
  param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Contents)
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $parent = Split-Path -Parent $fullPath
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  $encoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
  [System.IO.File]::WriteAllText($fullPath, $Contents, $encoding)
}

function Get-HanziV1Runtime {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
  if (-not $nodeCommand) { throw "Node.js was not found on PATH." }
  if (-not $pnpmCommand) { throw "pnpm was not found on PATH." }
  $viteCliPath = Join-Path $RepositoryRoot "node_modules\vite\bin\vite.js"
  if (-not (Test-Path -LiteralPath $viteCliPath -PathType Leaf)) {
    Write-Host "Dependencies are missing; running pnpm install --frozen-lockfile."
    & $pnpmCommand.Source install --frozen-lockfile
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $viteCliPath -PathType Leaf)) { throw "Dependency installation failed." }
  }
  return [ordered]@{
    NodePath = $nodeCommand.Source
    PnpmPath = $pnpmCommand.Source
    NodeVersion = (& $nodeCommand.Source --version).Trim()
    PnpmVersion = (& $pnpmCommand.Source --version).Trim()
    ViteCliPath = [System.IO.Path]::GetFullPath($viteCliPath)
  }
}

function Get-HanziV1ProcessDetails {
  param([Parameter(Mandatory = $true)][int]$ProcessId)
  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    $cim = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    return [ordered]@{ Process = $process; CommandLine = [string]$cim.CommandLine; ProcessStartTimeUtc = $process.StartTime.ToUniversalTime().ToString("o") }
  } catch { return $null }
}

function Get-HanziV1ListenerProcessIds {
  try {
    return @(Get-NetTCPConnection -State Listen -LocalAddress $script:HanziV1Host -LocalPort $script:HanziV1Port -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {
    $pattern = "^\s*TCP\s+$([regex]::Escape($script:HanziV1Host)):$($script:HanziV1Port)\s+\S+\s+LISTENING\s+(\d+)\s*$"
    return @(& netstat.exe -ano -p TCP 2>$null | ForEach-Object { if ($_ -match $pattern) { [int]$Matches[1] } } | Select-Object -Unique)
  }
}

function Test-HanziV1CommandIdentity {
  param([string]$CommandLine, [string]$ViteCliPath, [string]$RepositoryRoot)
  if ([string]::IsNullOrWhiteSpace($CommandLine)) { return $false }
  $command = $CommandLine.Replace("/", "\")
  $vite = [System.IO.Path]::GetFullPath($ViteCliPath).Replace("/", "\")
  $root = [System.IO.Path]::GetFullPath($RepositoryRoot).Replace("/", "\")
  return $command.IndexOf($vite, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $command.IndexOf($root, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $command -match '(?i)--host(?:\s+|=)"?127\.0\.0\.1"?(?:\s|$)' -and
    $command -match '(?i)--port(?:\s+|=)"?5180"?(?:\s|$)' -and
    $command -match '(?i)--strictPort(?:\s|$)'
}

function Get-HanziV1ValidatedServer {
  param([string]$RepositoryRoot, [System.Collections.IDictionary]$Paths, [switch]$RequireRecord)
  $listeners = @(Get-HanziV1ListenerProcessIds | Where-Object { [int]$_ -gt 0 })
  if ($listeners.Count -eq 0) { return $null }
  if ($listeners.Count -ne 1) { throw "Port 5180 has ambiguous listeners. Nothing was reused or stopped." }
  $processId = [int]$listeners[0]
  $details = Get-HanziV1ProcessDetails -ProcessId $processId
  if (-not $details -or -not (Test-HanziV1CommandIdentity -CommandLine $details.CommandLine -ViteCliPath $Paths.ViteCliPath -RepositoryRoot $RepositoryRoot)) {
    throw "Port 5180 is not owned by the exact Hanzi V1 launcher process. Nothing was reused or stopped."
  }
  $record = $null
  if (Test-Path -LiteralPath $Paths.ServerRecordPath -PathType Leaf) {
    try { $record = Get-Content -LiteralPath $Paths.ServerRecordPath -Raw | ConvertFrom-Json } catch { throw "The V1 server record is unreadable." }
  } elseif ($RequireRecord) { throw "No V1 server record exists, so the listener will not be stopped." }
  if ($record) {
    $matches = [int]$record.schemaVersion -eq 1 -and [string]$record.task -ceq "hanzi-magic-v2-v1-server" -and
      [int]$record.pid -eq $processId -and [string]$record.processStartTimeUtc -ceq [string]$details.ProcessStartTimeUtc -and
      [string]$record.origin -ceq $script:HanziV1Origin -and [System.IO.Path]::GetFullPath([string]$record.repositoryRoot) -ceq [System.IO.Path]::GetFullPath($RepositoryRoot)
    if (-not $matches) { throw "The V1 server record does not match the live process. Nothing was reused or stopped." }
  }
  return [ordered]@{ ProcessId = $processId; ProcessStartTimeUtc = $details.ProcessStartTimeUtc; Record = $record }
}

function Save-HanziV1ServerRecord {
  param([string]$RepositoryRoot, [System.Collections.IDictionary]$Paths, [System.Collections.IDictionary]$Server)
  $record = [ordered]@{ schemaVersion = 1; task = "hanzi-magic-v2-v1-server"; pid = [int]$Server.ProcessId; processStartTimeUtc = [string]$Server.ProcessStartTimeUtc; host = $script:HanziV1Host; port = $script:HanziV1Port; origin = $script:HanziV1Origin; url = $script:HanziV1Url; repositoryRoot = [System.IO.Path]::GetFullPath($RepositoryRoot); recordedAtUtc = [DateTime]::UtcNow.ToString("o") }
  Write-HanziV1Utf8NoBom -Path $Paths.ServerRecordPath -Contents (($record | ConvertTo-Json -Depth 4) + "`n")
}

function Wait-HanziV1Server {
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $script:HanziV1Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { return }
    } catch { Start-Sleep -Milliseconds 250 }
  }
  throw "The V1 child route did not become HTTP ready within 60 seconds."
}
