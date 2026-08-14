[CmdletBinding()]
param(
  [int]$PreferredPort = 5194,
  [string]$SourceTreeSha256 = $env:CHAPTER_ONE_SOURCE_TREE_SHA256
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot "ChapterOneLauncher.Common.ps1")

$repositoryRoot = Get-ChapterOneRepositoryRoot
$paths = Get-ChapterOneLauncherPaths -RepositoryRoot $repositoryRoot
$startScript = Join-Path $PSScriptRoot "START_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.ps1"
$stopScript = Join-Path $PSScriptRoot "STOP_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.ps1"
$reportPath = Join-Path $repositoryRoot "test-results\hanzi-v2\chapter-one\validation\LAUNCHER-LIFECYCLE.json"
if ($SourceTreeSha256 -notmatch '^[A-Fa-f0-9]{64}$') {
  $tsx = Join-Path $repositoryRoot "node_modules\.bin\tsx.cmd"
  if (-not (Test-Path -LiteralPath $tsx -PathType Leaf)) { throw "Cannot compute source identity because tsx.cmd is unavailable." }
  $SourceTreeSha256 = (& $tsx (Join-Path $PSScriptRoot "source-identity.ts")).Trim()
}
if ($SourceTreeSha256 -notmatch '^[A-Fa-f0-9]{64}$') { throw "SourceTreeSha256 must be a 64-character SHA-256 identity." }
$result = [ordered]@{ schemaVersion = 1; sourceTreeSha256 = $SourceTreeSha256.ToUpperInvariant(); result = "FAIL"; started = $false; reused = $false; stopped = $false; preferredPort = $PreferredPort; actualPort = $null; pid = $null; url = $null; checks = @() }

try {
  & $stopScript 2>$null
  & $startScript -NoBrowser -KeepServer -PreferredPort $PreferredPort
  $first = Read-ChapterOneServerRecord -Paths $paths
  if (-not $first) { throw "Lifecycle start did not create a server record." }
  $result.started = $true; $result.actualPort = [int]$first.port; $result.pid = [int]$first.pid; $result.url = [string]$first.url
  Wait-ChapterOneHttpReady -Url $first.url
  $result.checks += "HTTP_READY"

  & $startScript -NoBrowser -ExitAfterReady -PreferredPort $PreferredPort
  $second = Read-ChapterOneServerRecord -Paths $paths
  if (-not $second -or [int]$second.pid -ne [int]$first.pid) { throw "Lifecycle reuse changed the recorded server identity." }
  if (-not (Get-Process -Id ([int]$first.pid) -ErrorAction SilentlyContinue)) { throw "A reuse invocation stopped a service it did not start." }
  $result.reused = $true; $result.checks += "EXACT_REUSE_PRESERVED"

  & $stopScript
  if (@(Get-ChapterOneListenerProcessIds -Port ([int]$first.port)).Count -ne 0) { throw "Lifecycle stop left the owned port listening." }
  $result.stopped = $true; $result.checks += "OWNED_PROCESS_CLEANED"; $result.result = "PASS"
}
finally {
  try { & $stopScript 2>$null } catch { }
  $result.generatedAtUtc = [DateTime]::UtcNow.ToString("o")
  Write-ChapterOneUtf8NoBom -Path $reportPath -Contents (($result | ConvertTo-Json -Depth 6) + "`n")
}

if ($result.result -ne "PASS") { throw "Chapter One launcher lifecycle did not pass." }
$result | ConvertTo-Json -Compress
