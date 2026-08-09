[CmdletBinding()]
param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Contents
  )

  $encoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
  [System.IO.File]::WriteAllText($Path, $Contents, $encoding)
}

function Get-ProcessCommandLine {
  param([Parameter(Mandatory = $true)][int]$ProcessId)

  try {
    return (Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop).CommandLine
  } catch {
    return ""
  }
}

function Test-RecordedReviewServer {
  param(
    [Parameter(Mandatory = $true)][string]$PidPath,
    [Parameter(Mandatory = $true)][string]$RepositoryRoot
  )

  if (-not (Test-Path -LiteralPath $PidPath -PathType Leaf)) {
    return $false
  }

  try {
    $record = Get-Content -LiteralPath $PidPath -Raw | ConvertFrom-Json
    $processId = [int]$record.pid
    $process = Get-Process -Id $processId -ErrorAction Stop
    $commandLine = Get-ProcessCommandLine -ProcessId $process.Id
    $sameRoot = [string]$record.repositoryRoot -eq $RepositoryRoot
    $samePort = [int]$record.port -eq 5173
    $isVite = $commandLine -match "(?i)vite(?:\.js)?"
    $hasHost = $commandLine -match "(?i)--host(?:\s+|=)127\.0\.0\.1"
    $hasPort = $commandLine -match "(?i)--port(?:\s+|=)5173"
    $hasStrictPort = $commandLine -match "(?i)--strictPort"

    return $sameRoot -and $samePort -and $isVite -and $hasHost -and $hasPort -and $hasStrictPort
  } catch {
    return $false
  }
}

$scriptDirectory = Split-Path -Parent $PSCommandPath
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDirectory "..\..")).Path
$tempDirectory = Join-Path $repositoryRoot "tmp\hanzi-v2-step02"
$pidPath = Join-Path $tempDirectory "review-server.json"
$stdoutPath = Join-Path $tempDirectory "review-server.stdout.log"
$stderrPath = Join-Path $tempDirectory "review-server.stderr.log"
$reviewUrl = "http://127.0.0.1:5173/?review=hanzi-v2-step02"

New-Item -ItemType Directory -Path $tempDirectory -Force | Out-Null

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found on PATH. Install Node.js, then run this script again."
}

$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCommand) {
  throw "pnpm was not found on PATH. Install pnpm, then run this script again."
}

$nodeModulesPath = Join-Path $repositoryRoot "node_modules"
if (-not (Test-Path -LiteralPath $nodeModulesPath -PathType Container)) {
  Write-Host "node_modules is missing; installing locked dependencies..."
  & $pnpmCommand.Source install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm install --frozen-lockfile failed with exit code $LASTEXITCODE."
  }
}

$viteCliPath = Join-Path $repositoryRoot "node_modules\vite\bin\vite.js"
if (-not (Test-Path -LiteralPath $viteCliPath -PathType Leaf)) {
  throw "Vite CLI was not found at $viteCliPath. Run pnpm install --frozen-lockfile and try again."
}

if (-not (Test-RecordedReviewServer -PidPath $pidPath -RepositoryRoot $repositoryRoot)) {
  if (Test-Path -LiteralPath $pidPath -PathType Leaf) {
    Remove-Item -LiteralPath $pidPath -Force
  }

  Write-Utf8NoBom -Path $stdoutPath -Contents ""
  Write-Utf8NoBom -Path $stderrPath -Contents ""

  $nodeCommand = Get-Command node -ErrorAction Stop
  $startOptions = @{
    FilePath = $nodeCommand.Source
    ArgumentList = @($viteCliPath, "--host", "127.0.0.1", "--port", "5173", "--strictPort")
    WorkingDirectory = $repositoryRoot
    WindowStyle = "Hidden"
    RedirectStandardOutput = $stdoutPath
    RedirectStandardError = $stderrPath
    PassThru = $true
  }
  $viteProcess = Start-Process @startOptions

  $serverRecord = [ordered]@{
    pid = $viteProcess.Id
    port = 5173
    repositoryRoot = $repositoryRoot
    viteCliPath = $viteCliPath
    startedAtUtc = [DateTime]::UtcNow.ToString("o")
  } | ConvertTo-Json -Depth 3
  Write-Utf8NoBom -Path $pidPath -Contents $serverRecord
}

$deadline = [DateTime]::UtcNow.AddSeconds(60)
$serverReady = $false
while ([DateTime]::UtcNow -lt $deadline) {
  try {
    $response = Invoke-WebRequest -Uri $reviewUrl -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
      $serverReady = $true
      break
    }
  } catch {
    Start-Sleep -Milliseconds 500
  }
}

if (-not $serverReady) {
  $stderr = if (Test-Path -LiteralPath $stderrPath) { (Get-Content -LiteralPath $stderrPath -Tail 30) -join "`n" } else { "(no stderr log)" }
  throw "The local review server did not respond within 60 seconds. See $stderrPath`n$stderr"
}

if (-not $NoBrowser) {
  Start-Process $reviewUrl
}

Write-Host "STEP 02 parent review is ready."
Write-Host "Open: $reviewUrl"
Write-Host "Review the Pilot, 15 characters, visual directions, and storyboard; then export STEP-02_PARENT_REVIEW_FEEDBACK.json."
Write-Host "When finished, run FINISH_STEP_02_REVIEW.cmd to package the feedback."
