[CmdletBinding()]
param(
  [string]$FeedbackPath,
  [string]$SessionStatePath,
  [string]$OutputRoot,
  [switch]$FixtureMode,
  [switch]$KeepServer,
  [ValidateRange(1024, 65535)][int]$Port = 5176
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Step05Tools.Common.ps1")

$repositoryRoot = Get-Step05RepositoryRoot -ScriptDirectory $PSScriptRoot
$taskPaths = Get-Step05TaskPaths -RepositoryRoot $repositoryRoot -Port $Port
$runtime = Get-Step05Runtime -RepositoryRoot $repositoryRoot
$contractTool = Join-Path $PSScriptRoot "step05-contract.ts"
$fixedFeedbackName = "STEP-05_PARENT_REVIEW_FEEDBACK.json"

if (-not $PSBoundParameters.ContainsKey("FeedbackPath")) {
  $userProfilePath = [Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)
  if (-not $userProfilePath) { throw "The user profile path could not be resolved for Downloads-first lookup." }
  $FeedbackPath = Join-Path $userProfilePath "Downloads\$fixedFeedbackName"
}
if (-not $PSBoundParameters.ContainsKey("SessionStatePath")) {
  if ($FixtureMode) { throw "FixtureMode requires an explicit -SessionStatePath." }
  $SessionStatePath = $taskPaths.ActiveSessionPath
}

if ((Split-Path -Leaf $FeedbackPath) -cne $fixedFeedbackName) {
  throw "DENY: feedback must use the fixed filename $fixedFeedbackName."
}
if (-not (Test-Path -LiteralPath $FeedbackPath -PathType Leaf)) {
  throw "DENY: STEP 05 parent feedback was not found at $FeedbackPath. Downloads is checked first when -FeedbackPath is omitted."
}
if (-not (Test-Path -LiteralPath $SessionStatePath -PathType Leaf)) {
  throw "DENY: STEP 05 START session state was not found at $SessionStatePath."
}
if (-not (Test-Path -LiteralPath $contractTool -PathType Leaf)) {
  throw "STEP 05 contract tool is missing at $contractTool."
}

$sessionState = Get-Content -LiteralPath $SessionStatePath -Raw | ConvertFrom-Json
if ($sessionState.schemaVersion -ne 1 -or [string]$sessionState.initiativeId -cne "hanzi-radical-battle-v2" -or [string]$sessionState.step -cne "05") {
  throw "DENY: START session state identity is invalid."
}
if ([bool]$sessionState.fixture -ne [bool]$FixtureMode) {
  throw "DENY: -FixtureMode must exactly match the START session fixture marker."
}
if ([int]$sessionState.port -ne $Port) {
  throw "DENY: FINISH -Port $Port does not match START port $($sessionState.port)."
}

$currentCommit = Get-Step05CommitSha -RepositoryRoot $repositoryRoot
if ($currentCommit -cne [string]$sessionState.identity.candidateCommit) {
  throw "DENY: current Git commit differs from the exact START candidate commit. No package was created."
}
if (-not $FixtureMode) {
  $branch = (& git -C $repositoryRoot branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -cne "main") { throw "DENY: real STEP 05 FINISH requires branch main." }
  $scopedStatus = Get-Step05ScopedStatus -RepositoryRoot $repositoryRoot
  if ($scopedStatus.Count -gt 0) {
    throw "DENY: reviewed STEP 05 paths changed after START. No package was created.`n$($scopedStatus -join "`n")"
  }
}

if (-not $PSBoundParameters.ContainsKey("OutputRoot")) {
  if ($FixtureMode) {
    $OutputRoot = Join-Path (Split-Path -Parent ([System.IO.Path]::GetFullPath($SessionStatePath))) "parent-review-return"
  } else {
    $OutputRoot = Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-05"
  }
}
if ($FixtureMode) {
  Assert-Step05FixtureOutputRoot -TaskTempDirectory $taskPaths.TempDirectory -OutputRoot $OutputRoot
} else {
  $expectedOutputRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-05"))
  if ([System.IO.Path]::GetFullPath($OutputRoot) -cne $expectedOutputRoot) {
    throw "DENY: real FINISH output root must be the canonical STEP 05 artifact directory."
  }
}

$parentReviewDirectory = Join-Path $OutputRoot "parent-review"
$zipPath = Join-Path $OutputRoot "STEP-05_PARENT_REVIEW_RETURN_TO_CHATGPT.zip"
$fixedFeedbackPath = Join-Path $parentReviewDirectory $fixedFeedbackName
$validationDestination = Join-Path $parentReviewDirectory "STEP-05-PARENT-REVIEW-FEEDBACK-VALIDATION.json"
$identityDestination = Join-Path $parentReviewDirectory "STEP-05-PARENT-REVIEW-IDENTITY.json"
$summaryDestination = Join-Path $parentReviewDirectory "STEP-05-PARENT-REVIEW-SUMMARY.md"
$manifestDestination = Join-Path $parentReviewDirectory "return-package-manifest.json"

foreach ($destination in @($zipPath, $fixedFeedbackPath, $validationDestination, $identityDestination, $summaryDestination, $manifestDestination)) {
  if (Test-Path -LiteralPath $destination) { throw "Refusing to overwrite an existing STEP 05 parent-review artifact: $destination" }
}

$stagingDirectory = Join-Path $taskPaths.TempDirectory "package-$(New-Step05Hex -ByteCount 16)"
$temporaryZipPath = Join-Path $taskPaths.TempDirectory "STEP-05-PARENT-REVIEW-$(New-Step05Hex -ByteCount 16).zip"
New-Item -ItemType Directory -Path $stagingDirectory | Out-Null
try {
  $stageFeedback = Join-Path $stagingDirectory $fixedFeedbackName
  $stageValidation = Join-Path $stagingDirectory "STEP-05-PARENT-REVIEW-FEEDBACK-VALIDATION.json"
  $stageIdentity = Join-Path $stagingDirectory "STEP-05-PARENT-REVIEW-IDENTITY.json"
  $stageSummary = Join-Path $stagingDirectory "STEP-05-PARENT-REVIEW-SUMMARY.md"
  $stageManifest = Join-Path $stagingDirectory "return-package-manifest.json"

  & $runtime.NodePath $runtime.TsxCliPath $contractTool validate-feedback `
    --feedback $FeedbackPath `
    --session-state $SessionStatePath `
    --output $stageValidation
  if ($LASTEXITCODE -ne 0) {
    $details = if (Test-Path -LiteralPath $stageValidation -PathType Leaf) { Get-Content -LiteralPath $stageValidation -Raw } else { "(no validation report)" }
    throw "DENY: feedback schema, identity, decisions, authorization, or privacy validation failed. No package was created.`n$details"
  }
  $validation = Get-Content -LiteralPath $stageValidation -Raw | ConvertFrom-Json
  if ($validation.valid -ne $true) { throw "DENY: STEP 05 parent review feedback is not valid." }

  Copy-Item -LiteralPath $FeedbackPath -Destination $stageFeedback
  $identityRecord = [ordered]@{
    schemaVersion = 1
    initiativeId = "hanzi-radical-battle-v2"
    step = "05"
    reviewContractVersion = "hanzi-v2-step05-parent-review-v1"
    candidate = $validation.identity
    feedbackSha256 = $validation.feedbackSha256
    evidenceIdentity = $sessionState.evidenceIdentity
    sourceSnapshots = $sessionState.sourceSnapshots
    parentAcceptanceInferred = $false
    automaticPromotionPerformed = $false
  }
  Write-Step05Utf8NoBom -Path $stageIdentity -Contents (($identityRecord | ConvertTo-Json -Depth 20) + "`n")

  $decisionLines = @($validation.decisions | ForEach-Object { "- $($_.itemId): $($_.decision)$(if ($_.carriedForward) { ' (carried forward)' } else { '' })" })
  $summaryLines = @(
    "# STEP 05 Parent Review Return",
    "",
    "- Candidate commit: $($validation.identity.candidateCommit)",
    "- Candidate revision: $($validation.identity.candidateRevision)",
    "- Evidence SHA-256: $($validation.identity.evidenceSha256)",
    "- Feedback SHA-256: $($validation.feedbackSha256)",
    "- authorizeDefaultWorldEntry: $($validation.authorizations.authorizeDefaultWorldEntry)",
    "- authorizeSecondUseCheck: $($validation.authorizations.authorizeSecondUseCheck)",
    "",
    "## Four parent decisions",
    ""
  ) + $decisionLines + @(
    "",
    "## Boundary",
    "",
    "FINISH validated and packaged the parent's explicit fields. It did not infer acceptance, change the default route, authorize a second-use observation, stage Git files, publish, or promote any product state.",
    ""
  )
  Write-Step05Utf8NoBom -Path $stageSummary -Contents ($summaryLines -join "`n")

  $manifestFiles = @($stageFeedback, $stageValidation, $stageIdentity, $stageSummary) | ForEach-Object {
    [ordered]@{ name = Split-Path -Leaf $_; sha256 = Get-Step05Sha256 -Path $_ }
  }
  $manifest = [ordered]@{
    schemaVersion = 1
    initiativeId = "hanzi-radical-battle-v2"
    step = "05"
    packageKind = if ($FixtureMode) { "SYNTHETIC_TOOLING_TEST_ONLY" } else { "PARENT_REVIEW_RETURN" }
    candidate = $validation.identity
    feedbackSha256 = $validation.feedbackSha256
    files = $manifestFiles
    automaticDecision = $null
    parentAcceptanceInferred = $false
    automaticPromotionPerformed = $false
    explicitlyNotConcluded = @(
      "default world promotion",
      "second-use authorization",
      "learning effectiveness",
      "retention",
      "generalized usability",
      "full Ink Forest readiness"
    )
  }
  Write-Step05Utf8NoBom -Path $stageManifest -Contents (($manifest | ConvertTo-Json -Depth 20) + "`n")

  Compress-Archive -Path (Join-Path $stagingDirectory "*") -DestinationPath $temporaryZipPath
  New-Item -ItemType Directory -Path $parentReviewDirectory -Force | Out-Null
  Copy-Item -LiteralPath $stageFeedback -Destination $fixedFeedbackPath
  Copy-Item -LiteralPath $stageValidation -Destination $validationDestination
  Copy-Item -LiteralPath $stageIdentity -Destination $identityDestination
  Copy-Item -LiteralPath $stageSummary -Destination $summaryDestination
  Copy-Item -LiteralPath $stageManifest -Destination $manifestDestination
  Copy-Item -LiteralPath $temporaryZipPath -Destination $zipPath
} finally {
  Remove-Step05OwnedStagingDirectory -TaskTempDirectory $taskPaths.TempDirectory -StagingDirectory $stagingDirectory
  if (Test-Path -LiteralPath $temporaryZipPath -PathType Leaf) { Remove-Item -LiteralPath $temporaryZipPath -Force }
}

$zipHash = Get-Step05Sha256 -Path $zipPath
if ($KeepServer) {
  Write-Host "Keeping the recorded STEP 05 server running by request."
} else {
  Stop-Step05RecordedServer -RepositoryRoot $repositoryRoot -TaskPaths $taskPaths
}
if (-not $FixtureMode -and [System.IO.Path]::GetFullPath($SessionStatePath) -ceq [System.IO.Path]::GetFullPath($taskPaths.ActiveSessionPath)) {
  Remove-Item -LiteralPath $taskPaths.ActiveSessionPath -Force
}

Write-Host "Validated feedback: $fixedFeedbackPath"
Write-Host "Validation: $validationDestination"
Write-Host "Identity: $identityDestination"
Write-Host "Parent review return package: $zipPath"
Write-Host "SHA-256: $zipHash"
Write-Host "No acceptance, default-route promotion, second-use authorization, Git action, upload, or publication was inferred or performed."
