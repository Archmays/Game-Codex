$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Contents
  )

  $encoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
  [System.IO.File]::WriteAllText($Path, $Contents, $encoding)
}

function Get-Sha256 {
  param([Parameter(Mandatory = $true)][string]$Path)

  $stream = [System.IO.File]::OpenRead($Path)
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

function Get-Step03RepositoryRoot {
  param([Parameter(Mandatory = $true)][string]$ScriptDirectory)

  return (Resolve-Path -LiteralPath (Join-Path $ScriptDirectory "..\..")).Path
}

function Get-Step03TaskPaths {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

  $tempDirectory = Join-Path $RepositoryRoot "tmp\hanzi-v2-step03"
  return [ordered]@{
    TempDirectory = $tempDirectory
    PidPath = Join-Path $tempDirectory "review-server.json"
    StdoutPath = Join-Path $tempDirectory "review-server.stdout.log"
    StderrPath = Join-Path $tempDirectory "review-server.stderr.log"
    Port = 5174
  }
}

function Get-Step03Runtime {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCommand) {
    throw "Node.js was not found on PATH. Install Node.js, then run this script again."
  }
  $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
  if (-not $pnpmCommand) {
    throw "pnpm was not found on PATH. Install pnpm, then run this script again."
  }

  $nodeVersion = (& $nodeCommand.Source --version).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "Node.js version check failed with exit code $LASTEXITCODE."
  }
  $pnpmVersion = (& $pnpmCommand.Source --version).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm version check failed with exit code $LASTEXITCODE."
  }

  $viteCliPath = Join-Path $RepositoryRoot "node_modules\vite\bin\vite.js"
  $tsxCliPath = Join-Path $RepositoryRoot "node_modules\tsx\dist\cli.mjs"
  if (-not (Test-Path -LiteralPath $viteCliPath -PathType Leaf)) {
    throw "Vite CLI was not found at $viteCliPath. Dependencies are not installed; this tool never installs them."
  }
  if (-not (Test-Path -LiteralPath $tsxCliPath -PathType Leaf)) {
    throw "tsx CLI was not found at $tsxCliPath. Dependencies are not installed; this tool never installs them."
  }

  Write-Host "Node check: $nodeVersion"
  Write-Host "pnpm check: $pnpmVersion"
  Write-Host "Dependencies: existing local node_modules only; no install was run."
  return [ordered]@{
    NodePath = $nodeCommand.Source
    PnpmPath = $pnpmCommand.Source
    ViteCliPath = $viteCliPath
    TsxCliPath = $tsxCliPath
  }
}

function Get-ProcessCommandLine {
  param([Parameter(Mandatory = $true)][int]$ProcessId)

  try {
    return (Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop).CommandLine
  } catch {
    return ""
  }
}

function Test-Step03RecordedServer {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$TaskPaths
  )

  if (-not (Test-Path -LiteralPath $TaskPaths.PidPath -PathType Leaf)) {
    return $false
  }

  try {
    $record = Get-Content -LiteralPath $TaskPaths.PidPath -Raw | ConvertFrom-Json
    $process = Get-Process -Id ([int]$record.pid) -ErrorAction Stop
    $commandLine = Get-ProcessCommandLine -ProcessId $process.Id
    $sameTask = [string]$record.task -ceq "hanzi-v2-step03-review"
    $sameRoot = [string]$record.repositoryRoot -ceq $RepositoryRoot
    $samePort = [int]$record.port -eq [int]$TaskPaths.Port
    $isVite = $commandLine -match "(?i)vite(?:\.js)?"
    $hasHost = $commandLine -match "(?i)--host(?:\s+|=)127\.0\.0\.1"
    $hasPort = $commandLine -match "(?i)--port(?:\s+|=)$($TaskPaths.Port)(?:\s|$)"
    $hasStrictPort = $commandLine -match "(?i)--strictPort"
    return $sameTask -and $sameRoot -and $samePort -and $isVite -and $hasHost -and $hasPort -and $hasStrictPort
  } catch {
    return $false
  }
}

function Start-Step03RecordedServer {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$TaskPaths,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Runtime
  )

  New-Item -ItemType Directory -Path $TaskPaths.TempDirectory -Force | Out-Null
  if (Test-Step03RecordedServer -RepositoryRoot $RepositoryRoot -TaskPaths $TaskPaths) {
    return
  }
  if (Test-Path -LiteralPath $TaskPaths.PidPath -PathType Leaf) {
    Remove-Item -LiteralPath $TaskPaths.PidPath -Force
  }

  Write-Utf8NoBom -Path $TaskPaths.StdoutPath -Contents ""
  Write-Utf8NoBom -Path $TaskPaths.StderrPath -Contents ""
  $startOptions = @{
    FilePath = $Runtime.NodePath
    ArgumentList = @($Runtime.ViteCliPath, "--host", "127.0.0.1", "--port", "$($TaskPaths.Port)", "--strictPort")
    WorkingDirectory = $RepositoryRoot
    WindowStyle = "Hidden"
    RedirectStandardOutput = $TaskPaths.StdoutPath
    RedirectStandardError = $TaskPaths.StderrPath
    PassThru = $true
  }
  $viteProcess = Start-Process @startOptions
  $record = [ordered]@{
    task = "hanzi-v2-step03-review"
    pid = $viteProcess.Id
    port = $TaskPaths.Port
    repositoryRoot = $RepositoryRoot
    viteCliPath = $Runtime.ViteCliPath
    startedAtUtc = [DateTime]::UtcNow.ToString("o")
  } | ConvertTo-Json -Depth 3
  Write-Utf8NoBom -Path $TaskPaths.PidPath -Contents $record
}

function Wait-Step03Server {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$TaskPaths
  )

  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  $stderr = if (Test-Path -LiteralPath $TaskPaths.StderrPath) { (Get-Content -LiteralPath $TaskPaths.StderrPath -Tail 30) -join "`n" } else { "(no stderr log)" }
  throw "The local STEP 03 Vite server did not respond within 60 seconds. See $($TaskPaths.StderrPath)`n$stderr"
}

function Stop-Step03RecordedServer {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$TaskPaths
  )

  if (-not (Test-Path -LiteralPath $TaskPaths.PidPath -PathType Leaf)) {
    Write-Host "No recorded STEP 03 Vite server was found."
    return
  }

  try {
    $record = Get-Content -LiteralPath $TaskPaths.PidPath -Raw | ConvertFrom-Json
    $process = Get-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue
    if ($null -eq $process) {
      Remove-Item -LiteralPath $TaskPaths.PidPath -Force -ErrorAction SilentlyContinue
      Write-Host "The recorded STEP 03 Vite server is no longer running."
      return
    }

    $commandLine = Get-ProcessCommandLine -ProcessId $process.Id
    $sameTask = [string]$record.task -ceq "hanzi-v2-step03-review"
    $sameRoot = [string]$record.repositoryRoot -ceq $RepositoryRoot
    $samePort = [int]$record.port -eq [int]$TaskPaths.Port
    $isVite = $commandLine -match "(?i)vite(?:\.js)?"
    $hasHost = $commandLine -match "(?i)--host(?:\s+|=)127\.0\.0\.1"
    $hasPort = $commandLine -match "(?i)--port(?:\s+|=)$($TaskPaths.Port)(?:\s|$)"
    $hasStrictPort = $commandLine -match "(?i)--strictPort"
    if (-not ($sameTask -and $sameRoot -and $samePort -and $isVite -and $hasHost -and $hasPort -and $hasStrictPort)) {
      Write-Warning "The recorded PID $($process.Id) is not the matching STEP 03 Vite process. It was not stopped."
      return
    }

    Stop-Process -Id $process.Id -Force
    Remove-Item -LiteralPath $TaskPaths.PidPath -Force
    Write-Host "Stopped recorded STEP 03 Vite server PID $($process.Id)."
  } catch {
    Write-Warning "Could not stop the recorded STEP 03 Vite server: $($_.Exception.Message)"
  }
}
