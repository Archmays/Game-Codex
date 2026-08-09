$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Contents
  )

  $parent = Split-Path -Parent ([System.IO.Path]::GetFullPath($Path))
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  $encoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
  [System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath($Path), $Contents, $encoding)
}

function Get-Sha256 {
  param([Parameter(Mandatory = $true)][string]$Path)

  $stream = [System.IO.File]::OpenRead([System.IO.Path]::GetFullPath($Path))
  try {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
      return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace("-", "")
    } finally {
      $algorithm.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Get-Step04RepositoryRoot {
  param([Parameter(Mandatory = $true)][string]$ScriptDirectory)

  $root = (Resolve-Path -LiteralPath (Join-Path $ScriptDirectory "..\..")).Path
  if (-not (Test-Path -LiteralPath (Join-Path $root "package.json") -PathType Leaf)) {
    throw "Game-Codex repository root was not found from $ScriptDirectory."
  }
  return $root
}

function Get-Step04TaskPaths {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [ValidateRange(1024, 65535)][int]$Port = 5175
  )

  $tempDirectory = Join-Path $RepositoryRoot "tmp\hanzi-v2-step04"
  return [ordered]@{
    TempDirectory = $tempDirectory
    PidPath = Join-Path $tempDirectory "server.json"
    ActiveSessionPath = Join-Path $tempDirectory "active-session.json"
    ReadinessPath = Join-Path $tempDirectory "readiness-validation.json"
    BuildIdentityPath = Join-Path $tempDirectory "STEP-04-FIRST-USE-BUILD-IDENTITY.json"
    ParentAuthorizationPath = Join-Path $tempDirectory "STEP-04-PARENT-AUTHORIZATION-IDENTITY.json"
    StdoutPath = Join-Path $tempDirectory "server.stdout.log"
    StderrPath = Join-Path $tempDirectory "server.stderr.log"
    Port = $Port
    ViteCliPath = $null
  }
}

function Get-Step04Runtime {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCommand) { throw "Node.js was not found on PATH." }
  $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
  if (-not $pnpmCommand) { throw "pnpm was not found on PATH." }

  $nodeVersion = (& $nodeCommand.Source --version).Trim()
  if ($LASTEXITCODE -ne 0) { throw "Node.js version check failed." }
  $pnpmVersion = (& $pnpmCommand.Source --version).Trim()
  if ($LASTEXITCODE -ne 0) { throw "pnpm version check failed." }

  $viteCliPath = Join-Path $RepositoryRoot "node_modules\vite\bin\vite.js"
  $tsxCliPath = Join-Path $RepositoryRoot "node_modules\tsx\dist\cli.mjs"
  if (-not (Test-Path -LiteralPath $viteCliPath -PathType Leaf)) { throw "Vite CLI is missing at $viteCliPath. This launcher never installs dependencies." }
  if (-not (Test-Path -LiteralPath $tsxCliPath -PathType Leaf)) { throw "tsx CLI is missing at $tsxCliPath. This launcher never installs dependencies." }

  Write-Host "Node: $nodeVersion"
  Write-Host "pnpm: $pnpmVersion"
  Write-Host "Dependencies: existing local node_modules only; no install was run."
  return [ordered]@{
    NodePath = $nodeCommand.Source
    PnpmPath = $pnpmCommand.Source
    ViteCliPath = $viteCliPath
    TsxCliPath = $tsxCliPath
  }
}

function Get-Step04CommitSha {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) { throw "Git was not found; exact build identity cannot be created." }
  $sha = (& $git.Source -C $RepositoryRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $sha -notmatch "^[a-f0-9]{40}$") { throw "A full current Git commit SHA could not be resolved." }
  return $sha
}

function New-Step04Hex {
  param([ValidateRange(8, 64)][int]$ByteCount = 16)

  $bytes = New-Object byte[] $ByteCount
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
}

function Get-ProcessCommandLine {
  param([Parameter(Mandatory = $true)][int]$ProcessId)

  try { return [string](Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop).CommandLine } catch { return "" }
}

function Test-Step04PortInUse {
  param([Parameter(Mandatory = $true)][int]$Port)

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(350)) { return $false }
    try { $client.EndConnect($async); return $true } catch { return $false }
  } finally {
    $client.Dispose()
  }
}

function Test-Step04RecordedServer {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$TaskPaths
  )

  if (-not (Test-Path -LiteralPath $TaskPaths.PidPath -PathType Leaf)) { return $false }
  try {
    $record = Get-Content -LiteralPath $TaskPaths.PidPath -Raw | ConvertFrom-Json
    $process = Get-Process -Id ([int]$record.pid) -ErrorAction Stop
    $commandLine = Get-ProcessCommandLine -ProcessId $process.Id
    $processStart = $process.StartTime.ToUniversalTime().ToString("o")
    $sameTask = [string]$record.task -ceq "hanzi-v2-step04-observer"
    $sameRoot = [string]$record.repositoryRoot -ceq $RepositoryRoot
    $samePort = [int]$record.port -eq [int]$TaskPaths.Port
    $sameStart = [string]$record.processStartTimeUtc -ceq $processStart
    $sameVite = [string]$record.viteCliPath -ceq [string]$TaskPaths.ViteCliPath
    $isNodeVite = $commandLine -match "(?i)node(?:\.exe)?" -and $commandLine -match "(?i)vite(?:\.js)?"
    $hasHost = $commandLine -match "(?i)--host(?:\s+|=)127\.0\.0\.1"
    $hasPort = $commandLine -match "(?i)--port(?:\s+|=)$($TaskPaths.Port)(?:\s|$)"
    $hasStrictPort = $commandLine -match "(?i)--strictPort"
    return $sameTask -and $sameRoot -and $samePort -and $sameStart -and $sameVite -and $isNodeVite -and $hasHost -and $hasPort -and $hasStrictPort
  } catch {
    return $false
  }
}

function Start-Step04RecordedServer {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$TaskPaths,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Runtime
  )

  New-Item -ItemType Directory -Path $TaskPaths.TempDirectory -Force | Out-Null
  $TaskPaths.ViteCliPath = $Runtime.ViteCliPath
  if (Test-Step04RecordedServer -RepositoryRoot $RepositoryRoot -TaskPaths $TaskPaths) {
    Write-Host "Reusing the exact recorded STEP 04 server on port $($TaskPaths.Port)."
    return
  }
  if (Test-Step04PortInUse -Port $TaskPaths.Port) {
    throw "Port $($TaskPaths.Port) is occupied by an unowned or mismatched process. Nothing was stopped. Choose another -Port."
  }

  Write-Utf8NoBom -Path $TaskPaths.StdoutPath -Contents ""
  Write-Utf8NoBom -Path $TaskPaths.StderrPath -Contents ""
  $process = Start-Process -FilePath $Runtime.NodePath `
    -ArgumentList @($Runtime.ViteCliPath, "--host", "127.0.0.1", "--port", "$($TaskPaths.Port)", "--strictPort") `
    -WorkingDirectory $RepositoryRoot -WindowStyle Hidden `
    -RedirectStandardOutput $TaskPaths.StdoutPath -RedirectStandardError $TaskPaths.StderrPath -PassThru
  $processStart = $process.StartTime.ToUniversalTime().ToString("o")
  $record = [ordered]@{
    schemaVersion = 1
    task = "hanzi-v2-step04-observer"
    pid = $process.Id
    processStartTimeUtc = $processStart
    port = $TaskPaths.Port
    repositoryRoot = $RepositoryRoot
    viteCliPath = $Runtime.ViteCliPath
    startedAtUtc = [DateTime]::UtcNow.ToString("o")
  }
  Write-Utf8NoBom -Path $TaskPaths.PidPath -Contents (($record | ConvertTo-Json -Depth 5) + "`n")
}

function Wait-Step04Server {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$TaskPaths
  )

  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { return }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  $stderr = if (Test-Path -LiteralPath $TaskPaths.StderrPath) { (Get-Content -LiteralPath $TaskPaths.StderrPath -Tail 30) -join "`n" } else { "(no stderr log)" }
  throw "The local STEP 04 server did not respond within 60 seconds. See $($TaskPaths.StderrPath)`n$stderr"
}

function Stop-Step04RecordedServer {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$TaskPaths
  )

  if (-not (Test-Path -LiteralPath $TaskPaths.PidPath -PathType Leaf)) {
    Write-Host "No recorded STEP 04 server was found."
    return
  }
  $TaskPaths.ViteCliPath = Join-Path $RepositoryRoot "node_modules\vite\bin\vite.js"
  if (-not (Test-Step04RecordedServer -RepositoryRoot $RepositoryRoot -TaskPaths $TaskPaths)) {
    Write-Warning "Recorded PID/port ownership does not match the live process. Nothing was stopped."
    return
  }
  $record = Get-Content -LiteralPath $TaskPaths.PidPath -Raw | ConvertFrom-Json
  Stop-Process -Id ([int]$record.pid) -Force
  Remove-Item -LiteralPath $TaskPaths.PidPath -Force
  Write-Host "Stopped owned STEP 04 server PID $($record.pid)."
}

function Assert-Step04NonCanonicalFixtureRoot {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$OutputRoot
  )

  $canonical = [System.IO.Path]::GetFullPath((Join-Path $RepositoryRoot "artifacts\hanzi-radical-battle-v2\step-04"))
  $candidate = [System.IO.Path]::GetFullPath($OutputRoot)
  if ($candidate -ceq $canonical -or $candidate.StartsWith($canonical + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "FixtureMode refuses the canonical STEP 04 artifact root and its children."
  }
}

function Remove-Step04OwnedStagingDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$TaskTempDirectory,
    [Parameter(Mandatory = $true)][string]$StagingDirectory
  )

  $temp = [System.IO.Path]::GetFullPath($TaskTempDirectory)
  $stage = [System.IO.Path]::GetFullPath($StagingDirectory)
  if (-not $stage.StartsWith($temp + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $stage) -notmatch "^package-[a-f0-9]{32}$") {
    throw "Refusing to remove a directory not uniquely owned by STEP 04 staging: $stage"
  }
  if (Test-Path -LiteralPath $stage -PathType Container) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
