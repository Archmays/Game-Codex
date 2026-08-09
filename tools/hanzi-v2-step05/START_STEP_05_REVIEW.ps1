[CmdletBinding()]
param(
  [switch]$NoBrowser,
  [switch]$FixtureMode,
  [switch]$SkipServer,
  [ValidateRange(1024, 65535)][int]$Port = 5176
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Step05Tools.Common.ps1")

if ($SkipServer -and (-not $FixtureMode -or -not $NoBrowser)) {
  throw "-SkipServer is allowed only with both -FixtureMode and -NoBrowser."
}

$repositoryRoot = Get-Step05RepositoryRoot -ScriptDirectory $PSScriptRoot
$taskPaths = Get-Step05TaskPaths -RepositoryRoot $repositoryRoot -Port $Port
$runtime = Get-Step05Runtime -RepositoryRoot $repositoryRoot
$contractTool = Join-Path $PSScriptRoot "step05-contract.ts"
$rawEvidencePath = Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-04\observation\STEP-04_CHILD_FIRST_USE_OBSERVATION.json"
$returnPackagePath = Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-04\STEP-04_CHILD_FIRST_USE_RETURN_TO_CHATGPT.zip"
$freezeTestPath = Join-Path $repositoryRoot "tests\hanzi-radical-battle-v2-step05-freeze.test.ts"

foreach ($requiredFile in @($contractTool, $rawEvidencePath, $returnPackagePath, $freezeTestPath)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "DENY: required STEP 05 input is missing at $requiredFile. No browser was opened."
  }
}

$commitSha = Get-Step05CommitSha -RepositoryRoot $repositoryRoot
$branch = (& git -C $repositoryRoot branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) { throw "Git branch check failed." }
if (-not $FixtureMode -and $branch -cne "main") {
  throw "DENY: real STEP 05 parent review must start from branch main. Current branch is '$branch'. No browser was opened."
}

New-Item -ItemType Directory -Path $taskPaths.TempDirectory -Force | Out-Null
$sessionToken = "s05-review-$(New-Step05Hex -ByteCount 16)"
if ($FixtureMode) {
  $fixtureDirectory = Join-Path $taskPaths.TempDirectory "fixtures\$sessionToken"
  New-Item -ItemType Directory -Path $fixtureDirectory -Force | Out-Null
  $readinessPath = Join-Path $fixtureDirectory "STEP-05-REVIEW-READINESS.json"
  $sessionStatePath = Join-Path $fixtureDirectory "review-session.json"
} else {
  if (Test-Path -LiteralPath $taskPaths.ActiveSessionPath -PathType Leaf) {
    throw "DENY: an active real STEP 05 review session exists. Run FINISH or resolve it before starting another."
  }
  $scopedStatus = Get-Step05ScopedStatus -RepositoryRoot $repositoryRoot
  if ($scopedStatus.Count -gt 0) {
    throw "DENY: STEP 05 reviewed paths are uncommitted, so the commit cannot identify the exact candidate. No browser was opened.`n$($scopedStatus -join "`n")"
  }
  $readinessPath = $taskPaths.ReadinessPath
  $sessionStatePath = $taskPaths.ActiveSessionPath
}

& $runtime.NodePath $runtime.TsxCliPath $contractTool readiness `
  --raw-evidence $rawEvidencePath `
  --return-package $returnPackagePath `
  --output $readinessPath `
  --commit $commitSha
if ($LASTEXITCODE -ne 0) {
  $details = if (Test-Path -LiteralPath $readinessPath -PathType Leaf) { Get-Content -LiteralPath $readinessPath -Raw } else { "(no readiness report)" }
  throw "DENY: evidence identity or frozen-source readiness failed. No browser was opened.`n$details"
}
$readiness = Get-Content -LiteralPath $readinessPath -Raw | ConvertFrom-Json
if ($readiness.valid -ne $true) { throw "DENY: STEP 05 review readiness is not valid. No browser was opened." }

$package = Get-Content -LiteralPath (Join-Path $repositoryRoot "package.json") -Raw | ConvertFrom-Json
if (-not $package.scripts.'test:hanzi-v2:step05') {
  throw "DENY: package.json does not expose test:hanzi-v2:step05. No browser was opened."
}
Write-Host "Running the exact STEP 05 semantic/content freeze test before launch..."
& $runtime.PnpmPath exec vitest run $freezeTestPath
if ($LASTEXITCODE -ne 0) { throw "DENY: STEP 05 freeze test failed. No browser was opened." }

$startedAtUtc = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$encodedCommit = [System.Uri]::EscapeDataString([string]$readiness.identity.candidateCommit)
$encodedEvidence = [System.Uri]::EscapeDataString([string]$readiness.identity.evidenceSha256)
$encodedRevision = [System.Uri]::EscapeDataString([string]$readiness.identity.candidateRevision)
$fixtureQuery = if ($FixtureMode) { "&fixture=1" } else { "" }
$reviewUrl = "http://127.0.0.1:$Port/?review=hanzi-v2-step05&commit=$encodedCommit&evidence=$encodedEvidence&revision=$encodedRevision$fixtureQuery"
$sessionState = [ordered]@{
  schemaVersion = 1
  initiativeId = "hanzi-radical-battle-v2"
  step = "05"
  fixture = [bool]$FixtureMode
  sessionToken = $sessionToken
  startedAtUtc = $startedAtUtc
  port = $Port
  reviewUrl = $reviewUrl
  identity = $readiness.identity
  evidenceIdentity = $readiness.evidenceIdentity
  sourceSnapshots = $readiness.sourceSnapshots
}
Write-Step05Utf8NoBom -Path $sessionStatePath -Contents (($sessionState | ConvertTo-Json -Depth 20) + "`n")

if (-not $SkipServer) {
  Start-Step05RecordedServer -RepositoryRoot $repositoryRoot -TaskPaths $taskPaths -Runtime $runtime
  Wait-Step05Server -Url $reviewUrl -TaskPaths $taskPaths
}

if ($NoBrowser) {
  Write-Host "No browser was opened by request."
} else {
  Start-Process $reviewUrl
}

Write-Host "STEP 05 changed-only parent review is ready."
Write-Host "Branch: $branch"
Write-Host "Candidate commit: $($readiness.identity.candidateCommit)"
Write-Host "Candidate revision: $($readiness.identity.candidateRevision)"
Write-Host "Evidence SHA-256: $($readiness.identity.evidenceSha256)"
Write-Host "STEP 04 return package SHA-256: $($readiness.evidenceIdentity.childReturnPackageSha256)"
Write-Host "Session state: $sessionStatePath"
Write-Host "Review URL: $reviewUrl"
Write-Host "No parent decision or authorization was preselected or inferred."
