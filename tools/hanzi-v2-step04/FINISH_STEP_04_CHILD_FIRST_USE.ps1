[CmdletBinding()]
param(
  [string]$ObservationPath,
  [string]$SessionStatePath,
  [string]$OutputRoot,
  [switch]$FixtureMode,
  [switch]$KeepServer,
  [switch]$NoStopServer,
  [ValidateRange(1024, 65535)][int]$Port = 5175
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Step04Tools.Common.ps1")

$repositoryRoot = Get-Step04RepositoryRoot -ScriptDirectory $PSScriptRoot
$taskPaths = Get-Step04TaskPaths -RepositoryRoot $repositoryRoot -Port $Port
$runtime = Get-Step04Runtime -RepositoryRoot $repositoryRoot
$contractTool = Join-Path $PSScriptRoot "step04-contract.ts"
$schemaPath = Join-Path $repositoryRoot "docs\hanzi-radical-battle-v2\step-04\04-FIRST-USE-OBSERVATION-SCHEMA.json"
$canonicalOutputRoot = Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-04"

if (-not (Test-Path -LiteralPath $schemaPath -PathType Leaf)) { throw "Observation schema is missing: $schemaPath" }
if (-not (Test-Path -LiteralPath $contractTool -PathType Leaf)) { throw "STEP 04 contract tool is missing: $contractTool" }

if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = $canonicalOutputRoot }
$OutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
if ($FixtureMode) {
  Assert-Step04NonCanonicalFixtureRoot -RepositoryRoot $repositoryRoot -OutputRoot $OutputRoot
  if ([string]::IsNullOrWhiteSpace($ObservationPath) -or [string]::IsNullOrWhiteSpace($SessionStatePath)) {
    throw "FixtureMode requires explicit -ObservationPath and -SessionStatePath from the fixture START output."
  }
} elseif ([System.IO.Path]::GetFullPath($OutputRoot) -cne [System.IO.Path]::GetFullPath($canonicalOutputRoot)) {
  throw "A real observation must use the canonical STEP 04 output root. Use FixtureMode for a non-canonical test root."
}

if ([string]::IsNullOrWhiteSpace($SessionStatePath)) { $SessionStatePath = $taskPaths.ActiveSessionPath }
$SessionStatePath = [System.IO.Path]::GetFullPath($SessionStatePath)
if (-not (Test-Path -LiteralPath $SessionStatePath -PathType Leaf)) { throw "Session state was not found: $SessionStatePath" }
$sessionState = Get-Content -LiteralPath $SessionStatePath -Raw | ConvertFrom-Json
if ([bool]$sessionState.fixture -ne [bool]$FixtureMode) { throw "FixtureMode does not match the START session state." }

$fixedName = "STEP-04_CHILD_FIRST_USE_OBSERVATION.json"
if ([string]::IsNullOrWhiteSpace($ObservationPath)) {
  $downloadCandidate = Join-Path $env:USERPROFILE "Downloads\$fixedName"
  $inboxCandidate = Join-Path $canonicalOutputRoot "observation-inbox\$fixedName"
  $ObservationPath = @($downloadCandidate, $inboxCandidate) |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Select-Object -First 1
  if (-not $ObservationPath) { throw "Observation export was not found. Checked Downloads first, then $inboxCandidate" }
}
$ObservationPath = [System.IO.Path]::GetFullPath($ObservationPath)
if (-not (Test-Path -LiteralPath $ObservationPath -PathType Leaf)) { throw "Observation export was not found: $ObservationPath" }
if ((Split-Path -Leaf $ObservationPath) -cne $fixedName) { throw "Observation export must keep the fixed filename $fixedName" }

New-Item -ItemType Directory -Path $taskPaths.TempDirectory -Force | Out-Null
$validationPath = Join-Path $taskPaths.TempDirectory "validation-$($sessionState.sessionId).json"
$summaryTempPath = Join-Path $taskPaths.TempDirectory "summary-$($sessionState.sessionId).md"
& $runtime.NodePath $runtime.TsxCliPath $contractTool validate-observation `
  --observation $ObservationPath `
  --session-state $SessionStatePath `
  --output $validationPath `
  --summary-output $summaryTempPath
if ($LASTEXITCODE -ne 0) {
  $details = if (Test-Path -LiteralPath $validationPath) { Get-Content -LiteralPath $validationPath -Raw } else { "(no validation report)" }
  throw "Observation was rejected before copy/package. No canonical observation artifact was written.`n$details"
}
$validation = Get-Content -LiteralPath $validationPath -Raw | ConvertFrom-Json
if (-not $validation.valid) { throw "Observation validation did not return valid=true." }
$expectedKind = if ($FixtureMode) { "SYNTHETIC_TOOLING_TEST_ONLY" } else { "REAL_CHILD_OBSERVATION" }
if ([string]$validation.evidenceKind -cne $expectedKind) { throw "Observation evidenceKind does not match $expectedKind." }

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$observationDirectory = Join-Path $OutputRoot "observation"
New-Item -ItemType Directory -Path $observationDirectory -Force | Out-Null
$fixedObservationPath = Join-Path $observationDirectory $fixedName
$summaryPath = Join-Path $observationDirectory "STEP-04-CHILD-FIRST-USE-SUMMARY.md"
$privacyPath = Join-Path $observationDirectory "STEP-04-PRIVACY-VALIDATION.json"
$zipName = if ($FixtureMode) { "STEP-04_SYNTHETIC_TOOLING_TEST_ONLY_RETURN_TO_CHATGPT.zip" } else { "STEP-04_CHILD_FIRST_USE_RETURN_TO_CHATGPT.zip" }
$zipPath = Join-Path $OutputRoot $zipName
foreach ($destination in @($fixedObservationPath, $summaryPath, $privacyPath)) {
  if (Test-Path -LiteralPath $destination) { throw "Refusing to overwrite an existing observation artifact: $destination" }
}
if (Test-Path -LiteralPath $zipPath) { throw "Refusing to overwrite an existing return package: $zipPath" }

Copy-Item -LiteralPath $ObservationPath -Destination $fixedObservationPath
Copy-Item -LiteralPath $summaryTempPath -Destination $summaryPath
Copy-Item -LiteralPath $validationPath -Destination $privacyPath

$stagingDirectory = Join-Path $taskPaths.TempDirectory "package-$(New-Step04Hex -ByteCount 16)"
New-Item -ItemType Directory -Path $stagingDirectory | Out-Null
try {
  $stageObservation = Join-Path $stagingDirectory $fixedName
  $stageSummary = Join-Path $stagingDirectory "STEP-04-CHILD-FIRST-USE-SUMMARY.md"
  $stageBuild = Join-Path $stagingDirectory "STEP-04-FIRST-USE-BUILD-IDENTITY.json"
  $stageAuthorization = Join-Path $stagingDirectory "STEP-04-PARENT-AUTHORIZATION-IDENTITY.json"
  $stageSchema = Join-Path $stagingDirectory "04-FIRST-USE-OBSERVATION-SCHEMA.json"
  $stagePrivacy = Join-Path $stagingDirectory "STEP-04-PRIVACY-VALIDATION.json"
  $stageCommit = Join-Path $stagingDirectory "commit-sha.txt"
  $stageManifest = Join-Path $stagingDirectory "return-package-manifest.json"

  Copy-Item -LiteralPath $fixedObservationPath -Destination $stageObservation
  Copy-Item -LiteralPath $summaryPath -Destination $stageSummary
  Copy-Item -LiteralPath $schemaPath -Destination $stageSchema
  Copy-Item -LiteralPath $privacyPath -Destination $stagePrivacy
  Write-Utf8NoBom -Path $stageBuild -Contents (($sessionState.buildIdentity | ConvertTo-Json -Depth 20) + "`n")
  Write-Utf8NoBom -Path $stageAuthorization -Contents (($sessionState.parentAuthorization | ConvertTo-Json -Depth 20) + "`n")
  Write-Utf8NoBom -Path $stageCommit -Contents "$($sessionState.buildIdentity.commitSha)`n"

  $manifestFiles = @(
    $stageObservation, $stageSummary, $stageBuild, $stageAuthorization, $stageSchema, $stagePrivacy, $stageCommit
  ) | ForEach-Object {
    [ordered]@{ name = Split-Path -Leaf $_; sha256 = Get-Sha256 -Path $_ }
  }
  $manifest = [ordered]@{
    schemaVersion = 1
    initiativeId = "hanzi-radical-battle-v2"
    step = "04"
    evidenceKind = $expectedKind
    sessionId = $sessionState.sessionId
    buildIdentitySha256 = $sessionState.buildIdentity.buildIdentitySha256
    parentFeedbackSha256 = $sessionState.parentAuthorization.parentFeedbackSha256
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
    files = $manifestFiles
    automaticDecision = $null
    explicitlyNotConcluded = @("learning effectiveness", "generalized usability", "child acceptance", "promotion", "comparative preference", "long-term retention")
  }
  Write-Utf8NoBom -Path $stageManifest -Contents (($manifest | ConvertTo-Json -Depth 20) + "`n")

  Compress-Archive -Path (Join-Path $stagingDirectory "*") -DestinationPath $zipPath
} finally {
  Remove-Step04OwnedStagingDirectory -TaskTempDirectory $taskPaths.TempDirectory -StagingDirectory $stagingDirectory
}

$zipHash = Get-Sha256 -Path $zipPath
if ($KeepServer -or $NoStopServer) {
  Write-Host "Keeping the recorded STEP 04 server running by request."
} else {
  Stop-Step04RecordedServer -RepositoryRoot $repositoryRoot -TaskPaths $taskPaths
}
if (-not $FixtureMode -and [System.IO.Path]::GetFullPath($SessionStatePath) -ceq [System.IO.Path]::GetFullPath($taskPaths.ActiveSessionPath)) {
  Remove-Item -LiteralPath $taskPaths.ActiveSessionPath -Force
}

Write-Host "Evidence kind: $expectedKind"
Write-Host "Validated observation copy: $fixedObservationPath"
Write-Host "Summary: $summaryPath"
Write-Host "Privacy validation: $privacyPath"
Write-Host "Return package: $zipPath"
Write-Host "SHA-256: $zipHash"
Write-Host "No Git staging, commit, upload, child acceptance, learning conclusion, or promotion was performed."
