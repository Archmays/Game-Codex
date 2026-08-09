[CmdletBinding()]
param(
  [switch]$NoBrowser,
  [switch]$FixtureMode,
  [ValidateRange(1024, 65535)][int]$Port = 5175
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Step04Tools.Common.ps1")

$repositoryRoot = Get-Step04RepositoryRoot -ScriptDirectory $PSScriptRoot
$taskPaths = Get-Step04TaskPaths -RepositoryRoot $repositoryRoot -Port $Port
$runtime = Get-Step04Runtime -RepositoryRoot $repositoryRoot
$contractTool = Join-Path $PSScriptRoot "step04-contract.ts"
$canonicalFeedback = Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-03\review\STEP-03_PARENT_REVIEW_FEEDBACK.json"
$reviewIdentity = Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-03\current-review-identity.json"

if (-not (Test-Path -LiteralPath $canonicalFeedback -PathType Leaf)) {
  throw "DENY: canonical STEP 03 parent feedback is missing. No browser was opened."
}
if (-not (Test-Path -LiteralPath $reviewIdentity -PathType Leaf)) {
  throw "DENY: accepted STEP 03 review identity is missing. No browser was opened."
}
if (-not (Test-Path -LiteralPath $contractTool -PathType Leaf)) {
  throw "STEP 04 contract tool is missing at $contractTool."
}

$sessionId = "s04-$(New-Step04Hex -ByteCount 16)"
$runSeed = New-Step04Hex -ByteCount 8
$launchNonce = New-Step04Hex -ByteCount 16
$startedAtUtc = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

New-Item -ItemType Directory -Path $taskPaths.TempDirectory -Force | Out-Null
if ($FixtureMode) {
  $fixtureDirectory = Join-Path $taskPaths.TempDirectory "fixtures\$sessionId"
  New-Item -ItemType Directory -Path $fixtureDirectory -Force | Out-Null
  $readinessPath = Join-Path $fixtureDirectory "readiness-validation.json"
  $buildIdentityPath = Join-Path $fixtureDirectory "STEP-04-FIRST-USE-BUILD-IDENTITY.json"
  $authorizationPath = Join-Path $fixtureDirectory "STEP-04-PARENT-AUTHORIZATION-IDENTITY.json"
  $sessionStatePath = Join-Path $fixtureDirectory "session-state.json"
} else {
  if (Test-Path -LiteralPath $taskPaths.ActiveSessionPath -PathType Leaf) {
    throw "DENY: an active real STEP 04 session state already exists. Run FINISH or resolve that session before starting another."
  }
  $readinessPath = $taskPaths.ReadinessPath
  $buildIdentityPath = $taskPaths.BuildIdentityPath
  $authorizationPath = $taskPaths.ParentAuthorizationPath
  $sessionStatePath = $taskPaths.ActiveSessionPath

  $scopedStatus = & git -C $repositoryRoot status --porcelain -- `
    "games/hanzi-radical-battle/v2/golden-slice" `
    "apps/hanzi-v2-step03-review" `
    "apps/hanzi-v2-step04-observer" `
    "tools/hanzi-v2-step04" `
    "docs/hanzi-radical-battle-v2/step-04" `
    ".agents/skills/child-first-use-observation" `
    ".agents/skills/SKILL_INDEX.md" `
    "src/main.ts" `
    "package.json" `
    "tests/hanzi-radical-battle-v2-step04-audio.test.ts" `
    "tests/hanzi-radical-battle-v2-step04-freeze.test.ts" `
    "tests/hanzi-radical-battle-v2-step04-observer-schema.test.ts" `
    "tests/hanzi-radical-battle-v2-step04-event-bridge.test.ts" `
    "tests/hanzi-radical-battle-v2-step04-privacy.test.ts" `
    "tests/hanzi-radical-battle-v2-step04-gate.test.ts" `
    "tests/hanzi-radical-battle-v2-step04-copy.test.ts" `
    "tests/e2e/hanzi-radical-battle-v2-step04.spec.ts"
  if ($LASTEXITCODE -ne 0) { throw "Git scoped status check failed." }
  if (@($scopedStatus).Count -gt 0) {
    throw "DENY: STEP 04 runtime/tooling has uncommitted paths, so commitSha cannot identify the exact build. No browser was opened.`n$($scopedStatus -join "`n")"
  }
}

$commitSha = Get-Step04CommitSha -RepositoryRoot $repositoryRoot
& $runtime.NodePath $runtime.TsxCliPath $contractTool readiness `
  --feedback $canonicalFeedback `
  --review-identity $reviewIdentity `
  --output $readinessPath `
  --build-output $buildIdentityPath `
  --authorization-output $authorizationPath `
  --commit $commitSha
if ($LASTEXITCODE -ne 0) {
  $details = if (Test-Path -LiteralPath $readinessPath) { Get-Content -LiteralPath $readinessPath -Raw } else { "(no readiness report)" }
  throw "DENY: canonical authorization, accepted identity, or frozen source validation failed. No browser was opened.`n$details"
}
$readiness = Get-Content -LiteralPath $readinessPath -Raw | ConvertFrom-Json
if (-not $readiness.valid) { throw "DENY: STEP 04 readiness validation is not valid. No browser was opened." }

$package = Get-Content -LiteralPath (Join-Path $repositoryRoot "package.json") -Raw | ConvertFrom-Json
if (-not $package.scripts.'test:hanzi-v2:step04') {
  throw "DENY: package.json does not expose test:hanzi-v2:step04. No browser was opened."
}
Write-Host "Running the scoped STEP 04 audio/gate/freeze/observer checks before launch..."
& $runtime.PnpmPath run test:hanzi-v2:step04
if ($LASTEXITCODE -ne 0) { throw "DENY: STEP 04 targeted tests failed. No browser was opened." }

$buildIdentity = Get-Content -LiteralPath $buildIdentityPath -Raw | ConvertFrom-Json
$parentAuthorization = Get-Content -LiteralPath $authorizationPath -Raw | ConvertFrom-Json
$fixtureQuery = if ($FixtureMode) { "&fixture=1" } else { "" }
$generatedQuery = [System.Uri]::EscapeDataString([string]$buildIdentity.generatedAtUtc)
$checkedQuery = [System.Uri]::EscapeDataString([string]$parentAuthorization.checkedAtUtc)
$startedQuery = [System.Uri]::EscapeDataString($startedAtUtc)
$parentUrl = "http://127.0.0.1:$Port/?observe=hanzi-v2-step04&session=$sessionId&seed=$runSeed&build=$($buildIdentity.buildIdentitySha256)&launch=$launchNonce&commit=$commitSha&generated=$generatedQuery&checked=$checkedQuery&started=$startedQuery$fixtureQuery"
$fixtureChildQuery = if ($FixtureMode) { "&fixture=1" } else { "" }
$childUrl = "http://127.0.0.1:$Port/?play=hanzi-v2-golden-slice&mode=child-first-use&session=$sessionId&seed=$runSeed$fixtureChildQuery"
$sessionState = [ordered]@{
  schemaVersion = 1
  initiativeId = "hanzi-radical-battle-v2"
  step = "04"
  evidenceKind = if ($FixtureMode) { "SYNTHETIC_TOOLING_TEST_ONLY" } else { "REAL_CHILD_OBSERVATION" }
  fixture = [bool]$FixtureMode
  sessionId = $sessionId
  runSeed = $runSeed
  launchNonce = $launchNonce
  sessionMode = if ($FixtureMode) { "LIVE_DASHBOARD" } else { $null }
  startedAtUtc = $startedAtUtc
  port = $Port
  parentUrl = $parentUrl
  childUrl = $childUrl
  buildIdentity = $buildIdentity
  parentAuthorization = $parentAuthorization
}
Write-Utf8NoBom -Path $sessionStatePath -Contents (($sessionState | ConvertTo-Json -Depth 20) + "`n")

Start-Step04RecordedServer -RepositoryRoot $repositoryRoot -TaskPaths $taskPaths -Runtime $runtime
Wait-Step04Server -Url $parentUrl -TaskPaths $taskPaths

if ($FixtureMode) {
  $fixtureObservation = Join-Path $fixtureDirectory "STEP-04_CHILD_FIRST_USE_OBSERVATION.json"
  & $runtime.NodePath $runtime.TsxCliPath $contractTool fixture-observation --session-state $sessionStatePath --output $fixtureObservation
  if ($LASTEXITCODE -ne 0) { throw "Synthetic fixture generation failed." }
  Write-Host "Fixture kind: SYNTHETIC_TOOLING_TEST_ONLY"
  Write-Host "Fixture observation: $fixtureObservation"
  Write-Host "Fixture session state: $sessionStatePath"
  Write-Host "No browser was opened and no real observation was created."
} elseif (-not $NoBrowser) {
  Start-Process $parentUrl
  Write-Host "Opened only the parent audio/READY preflight. The child route was not opened by START."
} else {
  Write-Host "NoBrowser mode: no page was opened. No READY, child route, or observation was created."
}

Write-Host "STEP 04 parent preflight: $parentUrl"
Write-Host "Build identity: $buildIdentityPath"
Write-Host "Parent authorization identity: $authorizationPath"
Write-Host "Session state: $sessionStatePath"
Write-Host "Server PID record: $($taskPaths.PidPath)"
Write-Host "To stop and package a real export, run FINISH_STEP_04_CHILD_FIRST_USE.cmd."
Write-Host "Do not open the printed child URL manually; parent preflight must authorize it."
