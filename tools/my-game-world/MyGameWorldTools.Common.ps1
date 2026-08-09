$ErrorActionPreference = "Stop"

$script:MyGameWorldHost = "127.0.0.1"
$script:MyGameWorldPort = 5175
$script:MyGameWorldOrigin = "http://127.0.0.1:5175"
$script:MyGameWorldUrl = "http://127.0.0.1:5175/"

function Get-MyGameWorldRepositoryRoot {
  param([Parameter(Mandatory = $true)][string]$ScriptDirectory)

  $candidate = [System.IO.Path]::GetFullPath((Join-Path $ScriptDirectory "..\.."))
  if (-not (Test-Path -LiteralPath (Join-Path $candidate "package.json") -PathType Leaf)) {
    throw "Game-Codex repository root was not found from $ScriptDirectory."
  }
  if (-not (Test-Path -LiteralPath (Join-Path $candidate "src\main.ts") -PathType Leaf)) {
    throw "The resolved directory is not the expected Game-Codex repository: $candidate"
  }
  return $candidate.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
}

function Get-MyGameWorldPaths {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

  $tempDirectory = Join-Path $RepositoryRoot "tmp\my-game-world"
  return [ordered]@{
    TempDirectory = $tempDirectory
    ServerRecordPath = Join-Path $tempDirectory "server.json"
    StdoutPath = Join-Path $tempDirectory "server.stdout.log"
    StderrPath = Join-Path $tempDirectory "server.stderr.log"
    ViteCliPath = Join-Path $RepositoryRoot "node_modules\vite\bin\vite.js"
  }
}

function Write-MyGameWorldUtf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Contents
  )

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $parent = Split-Path -Parent $fullPath
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  $encoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
  $temporaryPath = "$fullPath.tmp-$([Guid]::NewGuid().ToString('N'))"
  try {
    [System.IO.File]::WriteAllText($temporaryPath, $Contents, $encoding)
    Move-Item -LiteralPath $temporaryPath -Destination $fullPath -Force
  } finally {
    if (Test-Path -LiteralPath $temporaryPath -PathType Leaf) {
      Remove-Item -LiteralPath $temporaryPath -Force
    }
  }
}

function Get-MyGameWorldRuntime {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCommand) { throw "Node.js was not found on PATH." }
  $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
  if (-not $pnpmCommand) { throw "pnpm was not found on PATH." }

  $nodeVersion = (& $nodeCommand.Source --version).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($nodeVersion)) {
    throw "Node.js version check failed."
  }
  $pnpmVersion = (& $pnpmCommand.Source --version).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($pnpmVersion)) {
    throw "pnpm version check failed."
  }

  $viteCliPath = Join-Path $RepositoryRoot "node_modules\vite\bin\vite.js"
  if (-not (Test-Path -LiteralPath $viteCliPath -PathType Leaf)) {
    throw "Vite CLI is missing at $viteCliPath. This launcher never installs dependencies."
  }

  return [ordered]@{
    NodePath = $nodeCommand.Source
    PnpmPath = $pnpmCommand.Source
    NodeVersion = $nodeVersion
    PnpmVersion = $pnpmVersion
    ViteCliPath = [System.IO.Path]::GetFullPath($viteCliPath)
  }
}

function Get-MyGameWorldProcessDetails {
  param([Parameter(Mandatory = $true)][int]$ProcessId)

  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    $cim = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    return [ordered]@{
      Process = $process
      CommandLine = [string]$cim.CommandLine
      ExecutablePath = [string]$cim.ExecutablePath
      ProcessStartTimeUtc = $process.StartTime.ToUniversalTime().ToString("o")
    }
  } catch {
    return $null
  }
}

function Get-MyGameWorldListenerProcessIds {
  $processIds = @()
  try {
    $processIds = @(Get-NetTCPConnection -State Listen -LocalAddress $script:MyGameWorldHost -LocalPort $script:MyGameWorldPort -ErrorAction Stop |
      Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {
    $pattern = "^\s*TCP\s+$([regex]::Escape($script:MyGameWorldHost)):$($script:MyGameWorldPort)\s+\S+\s+LISTENING\s+(\d+)\s*$"
    $processIds = @(& netstat.exe -ano -p TCP 2>$null | ForEach-Object {
      if ($_ -match $pattern) { [int]$Matches[1] }
    } | Select-Object -Unique)
  }
  return @($processIds | Where-Object { [int]$_ -gt 0 })
}

function Test-MyGameWorldCommandIdentity {
  param(
    [Parameter(Mandatory = $true)][string]$CommandLine,
    [Parameter(Mandatory = $true)][string]$ViteCliPath,
    [Parameter(Mandatory = $true)][string]$RepositoryRoot
  )

  if ([string]::IsNullOrWhiteSpace($CommandLine)) { return $false }
  $normalizedCommand = $CommandLine.Replace("/", "\")
  $normalizedVite = [System.IO.Path]::GetFullPath($ViteCliPath).Replace("/", "\")
  $normalizedRoot = [System.IO.Path]::GetFullPath($RepositoryRoot).Replace("/", "\")
  $hasVitePath = $normalizedCommand.IndexOf($normalizedVite, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  $hasExplicitRoot = $normalizedCommand -match ("(?i)" + [regex]::Escape($normalizedVite) + '"?\s+"?' + [regex]::Escape($normalizedRoot) + '"?(?:\s|$)')
  $hasNode = $normalizedCommand -match '(?i)(?:^|[\\\s"])(?:node|node\.exe)(?:["\s]|$)'
  $hasHost = $normalizedCommand -match '(?i)--host(?:\s+|=)"?127\.0\.0\.1"?(?:\s|$)'
  $hasPort = $normalizedCommand -match '(?i)--port(?:\s+|=)"?5175"?(?:\s|$)'
  $hasStrictPort = $normalizedCommand -match '(?i)--strictPort(?:\s|$)'
  return $hasVitePath -and $hasExplicitRoot -and $hasNode -and $hasHost -and $hasPort -and $hasStrictPort
}

function Get-MyGameWorldValidatedServer {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Paths,
    [switch]$RequireRecord
  )

  $listenerProcessIds = @(Get-MyGameWorldListenerProcessIds)
  if ($listenerProcessIds.Count -eq 0) { return $null }
  if ($listenerProcessIds.Count -ne 1) {
    throw "Port 5175 has multiple or ambiguous listeners. Nothing was reused or stopped."
  }

  $processId = [int]$listenerProcessIds[0]
  $details = Get-MyGameWorldProcessDetails -ProcessId $processId
  if (-not $details) {
    throw "The process listening on 127.0.0.1:5175 could not be inspected. Nothing was reused or stopped."
  }
  if (-not (Test-MyGameWorldCommandIdentity -CommandLine $details.CommandLine -ViteCliPath $Paths.ViteCliPath -RepositoryRoot $RepositoryRoot)) {
    throw "Port 5175 is occupied by a process that is not the exact Game-Codex Vite server. Nothing was reused or stopped."
  }

  $record = $null
  if (Test-Path -LiteralPath $Paths.ServerRecordPath -PathType Leaf) {
    try { $record = Get-Content -LiteralPath $Paths.ServerRecordPath -Raw | ConvertFrom-Json } catch {
      throw "The family server record is unreadable. Nothing was reused or stopped: $($Paths.ServerRecordPath)"
    }
  } elseif ($RequireRecord) {
    throw "No family server record exists, so the listening process will not be stopped."
  }

  if ($record) {
    $recordMatches =
      [int]$record.schemaVersion -eq 1 -and
      [string]$record.task -ceq "my-game-world-family-server" -and
      [int]$record.pid -eq $processId -and
      [string]$record.processStartTimeUtc -ceq [string]$details.ProcessStartTimeUtc -and
      [string]$record.host -ceq $script:MyGameWorldHost -and
      [int]$record.port -eq $script:MyGameWorldPort -and
      [string]$record.origin -ceq $script:MyGameWorldOrigin -and
      [System.IO.Path]::GetFullPath([string]$record.repositoryRoot) -ceq [System.IO.Path]::GetFullPath($RepositoryRoot) -and
      [System.IO.Path]::GetFullPath([string]$record.viteCliPath) -ceq [System.IO.Path]::GetFullPath($Paths.ViteCliPath)
    if (-not $recordMatches) {
      throw "The family server record does not match the live PID, start time, root, host, port, or Vite command. Nothing was reused or stopped."
    }
  }

  return [ordered]@{
    ProcessId = $processId
    ProcessStartTimeUtc = $details.ProcessStartTimeUtc
    CommandLine = $details.CommandLine
    Record = $record
  }
}

function Save-MyGameWorldServerRecord {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Paths,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Server,
    [Parameter(Mandatory = $true)][bool]$StartedByFamilyLauncher
  )

  $record = [ordered]@{
    schemaVersion = 1
    task = "my-game-world-family-server"
    pid = [int]$Server.ProcessId
    processStartTimeUtc = [string]$Server.ProcessStartTimeUtc
    host = $script:MyGameWorldHost
    port = $script:MyGameWorldPort
    origin = $script:MyGameWorldOrigin
    url = $script:MyGameWorldUrl
    repositoryRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
    viteCliPath = [System.IO.Path]::GetFullPath($Paths.ViteCliPath)
    startedByFamilyLauncher = $StartedByFamilyLauncher
    recordedAtUtc = [DateTime]::UtcNow.ToString("o")
  }
  Write-MyGameWorldUtf8NoBom -Path $Paths.ServerRecordPath -Contents (($record | ConvertTo-Json -Depth 5) + "`n")
}

function Wait-MyGameWorldServer {
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $script:MyGameWorldUrl -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { return }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  throw "The canonical family server did not respond at $script:MyGameWorldUrl within 60 seconds."
}
