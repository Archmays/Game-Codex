[CmdletBinding()]
param(
  [string]$FeedbackPath,
  [string]$OutputRoot,
  [switch]$KeepServer,
  [switch]$NoStopServer,
  [switch]$FixtureMode
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Step03Tools.Common.ps1")

function Copy-ArtifactOrWriteUnavailable {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][string[]]$Candidates
  )

  $source = $Candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  if ($source) {
    if ([System.IO.Path]::GetFullPath($source) -cne [System.IO.Path]::GetFullPath($Destination)) {
      Copy-Item -LiteralPath $source -Destination $Destination -Force
    }
    return [ordered]@{ name = $Label; status = "copied"; source = $source; path = $Destination; sha256 = Get-Sha256 -Path $Destination }
  }

  Write-Utf8NoBom -Path $Destination -Contents "# $Label`n`nUnavailable when this STEP 03 review return package was created.`n"
  return [ordered]@{ name = $Label; status = "unavailable"; source = $null; path = $Destination; sha256 = Get-Sha256 -Path $Destination }
}

$repositoryRoot = Get-Step03RepositoryRoot -ScriptDirectory $PSScriptRoot
$taskPaths = Get-Step03TaskPaths -RepositoryRoot $repositoryRoot
$runtime = Get-Step03Runtime -RepositoryRoot $repositoryRoot
$defaultOutputRoot = Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-03"
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = $defaultOutputRoot
}
$OutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
if ($FixtureMode -and $OutputRoot -ceq [System.IO.Path]::GetFullPath($defaultOutputRoot)) {
  throw "FixtureMode requires an explicit non-canonical OutputRoot."
}

$fileName = "STEP-03_PARENT_REVIEW_FEEDBACK.json"
$downloadFeedback = Join-Path $env:USERPROFILE "Downloads\$fileName"
$canonicalFeedback = Join-Path $defaultOutputRoot "review\$fileName"
if (-not [string]::IsNullOrWhiteSpace($FeedbackPath)) {
  $FeedbackPath = [System.IO.Path]::GetFullPath($FeedbackPath)
  if (-not (Test-Path -LiteralPath $FeedbackPath -PathType Leaf)) {
    throw "FeedbackPath was not found: $FeedbackPath"
  }
} else {
  $FeedbackPath = @($downloadFeedback, $canonicalFeedback) |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Select-Object -First 1
  if (-not $FeedbackPath) {
    throw "Feedback JSON was not found. Checked: $downloadFeedback and $canonicalFeedback"
  }
}
if ($FixtureMode -and [string]::IsNullOrWhiteSpace($FeedbackPath)) {
  throw "FixtureMode requires an explicit FeedbackPath."
}

$reviewDirectory = Join-Path $OutputRoot "review"
New-Item -ItemType Directory -Path $reviewDirectory -Force | Out-Null
$fixedFeedbackPath = Join-Path $reviewDirectory $fileName
if ([System.IO.Path]::GetFullPath($FeedbackPath) -cne [System.IO.Path]::GetFullPath($fixedFeedbackPath)) {
  Copy-Item -LiteralPath $FeedbackPath -Destination $fixedFeedbackPath -Force
}

$validationPath = Join-Path $OutputRoot "review-validation.json"
$contractTool = Join-Path $PSScriptRoot "step03-review-contract.ts"
& $runtime.NodePath $runtime.TsxCliPath $contractTool validate --feedback $fixedFeedbackPath --output $validationPath
if ($LASTEXITCODE -ne 0) {
  throw "STEP 03 feedback validator failed with exit code $LASTEXITCODE."
}
$identityOutput = Join-Path $OutputRoot "current-review-identity.json"
& $runtime.NodePath $runtime.TsxCliPath $contractTool identity --output $identityOutput
if ($LASTEXITCODE -ne 0) {
  throw "STEP 03 identity export failed with exit code $LASTEXITCODE."
}
$validation = Get-Content -LiteralPath $validationPath -Raw | ConvertFrom-Json
$identity = Get-Content -LiteralPath $identityOutput -Raw | ConvertFrom-Json

$goldenIdentityOutput = Join-Path $OutputRoot "golden-slice-identity.json"
$goldenIdentity = [ordered]@{
  schemaVersion = $identity.schemaVersion
  identitySha256 = $identity.identitySha256
  goldenSliceIdentity = $identity.goldenSliceIdentity
}
Write-Utf8NoBom -Path $goldenIdentityOutput -Contents (($goldenIdentity | ConvertTo-Json -Depth 10) + "`n")

$artifacts = New-Object System.Collections.Generic.List[object]
$artifacts.Add((Copy-ArtifactOrWriteUnavailable -Label "final-golden-manifest" -Destination (Join-Path $OutputRoot "final-golden-manifest.ts") -Candidates @(
  (Join-Path $repositoryRoot "games\hanzi-radical-battle\v2\golden-slice\content\manifest.ts")
)))
$artifacts.Add((Copy-ArtifactOrWriteUnavailable -Label "theme-c-asset-manifest" -Destination (Join-Path $OutputRoot "asset-manifest.ts") -Candidates @(
  (Join-Path $repositoryRoot "games\hanzi-radical-battle\v2\golden-slice\content\asset-manifest.ts")
)))
$artifacts.Add((Copy-ArtifactOrWriteUnavailable -Label "audio-and-voice-audit" -Destination (Join-Path $OutputRoot "audio-and-voice-audit.md") -Candidates @(
  (Join-Path $repositoryRoot "docs\hanzi-radical-battle-v2\step-03\07-AUDIO-AND-VOICE-AUDIT.md")
)))
$artifacts.Add((Copy-ArtifactOrWriteUnavailable -Label "screenshot-index" -Destination (Join-Path $OutputRoot "screenshot-index.md") -Candidates @(
  (Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-03\STEP-03-SCREENSHOT-INDEX.md"),
  (Join-Path $repositoryRoot "docs\hanzi-radical-battle-v2\step-03\STEP-03-SCREENSHOT-INDEX.md"),
  (Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-03\screenshots\SCREENSHOT-INDEX.md")
)))

$childGateSummaryPath = Join-Path $OutputRoot "child-first-use-gate-summary.md"
$authorization = [string]$validation.authorizeChildFirstUse
$childGateLines = @(
  "# STEP 03 child first-use gate summary",
  "",
  "- Feedback validation: $(if ($validation.valid) { "VALID" } else { "INVALID_OR_INCOMPLETE" })",
  "- Parent authorization value: $(if ($authorization) { $authorization } else { "MISSING" })",
  "- Gate status: $(if ($validation.valid -and $authorization -eq "YES") { "AUTHORIZED_FOR_LOCAL_OBSERVATION_ONLY" } else { "DENY" })",
  "- Child route: $($identity.goldenSliceIdentity.previewRoute)",
  "- Observation is local-only: no upload, recording, or child profile is created by this tool.",
  "- This is not child acceptance or promotion evidence."
)
Write-Utf8NoBom -Path $childGateSummaryPath -Contents (($childGateLines -join "`n") + "`n")
$artifacts.Add([ordered]@{ name = "child-first-use-gate-summary"; status = "generated"; source = $null; path = $childGateSummaryPath; sha256 = Get-Sha256 -Path $childGateSummaryPath })

$commitSha = "UNKNOWN"
$gitCommand = Get-Command git -ErrorAction SilentlyContinue
if ($gitCommand) {
  try {
    $commitSha = (& $gitCommand.Source -C $repositoryRoot rev-parse HEAD 2>$null | Select-Object -First 1).Trim()
  } catch {
    $commitSha = "UNKNOWN"
  }
}
$commitShaPath = Join-Path $OutputRoot "commit-sha.txt"
Write-Utf8NoBom -Path $commitShaPath -Contents "$commitSha`n"

$summaryPath = Join-Path $OutputRoot "review-summary.md"
$summaryLines = @(
  "# STEP 03 parent review summary",
  "",
  "- Feedback source: $FeedbackPath",
  "- Canonical feedback copy: $fixedFeedbackPath",
  "- Validation result: $(if ($validation.valid) { "VALID" } else { "INVALID_OR_INCOMPLETE" })",
  "- Commit SHA: $commitSha",
  ""
)
if ($validation.valid) {
  $summaryLines += "All required parent-review fields and current revision identities are valid."
} else {
  $summaryLines += "## Missing or invalid required feedback"
  $summaryLines += ""
  foreach ($validationError in @($validation.errors)) {
    $summaryLines += "- $validationError"
  }
}
$unavailable = @($artifacts | Where-Object { $_.status -eq "unavailable" })
if ($unavailable.Count -gt 0) {
  $summaryLines += ""
  $summaryLines += "## Unavailable supporting artifacts"
  $summaryLines += ""
  foreach ($artifact in $unavailable) {
    $summaryLines += "- $($artifact.name)"
  }
}
Write-Utf8NoBom -Path $summaryPath -Contents (($summaryLines -join "`n") + "`n")

$packageManifestPath = Join-Path $OutputRoot "return-package-manifest.json"
$packageFiles = @(
  [ordered]@{ name = "feedback"; path = $fixedFeedbackPath; sha256 = Get-Sha256 -Path $fixedFeedbackPath },
  [ordered]@{ name = "review-summary"; path = $summaryPath; sha256 = Get-Sha256 -Path $summaryPath },
  [ordered]@{ name = "review-validation"; path = $validationPath; sha256 = Get-Sha256 -Path $validationPath },
  [ordered]@{ name = "review-identity"; path = $identityOutput; sha256 = Get-Sha256 -Path $identityOutput },
  [ordered]@{ name = "golden-slice-identity"; path = $goldenIdentityOutput; sha256 = Get-Sha256 -Path $goldenIdentityOutput }
) + $artifacts.ToArray() + @(
  [ordered]@{ name = "commit-sha"; path = $commitShaPath; sha256 = Get-Sha256 -Path $commitShaPath }
)
$packageManifest = [ordered]@{
  schemaVersion = 1
  feedbackFileName = $fileName
  feedbackValidation = [ordered]@{ valid = [bool]$validation.valid; errorCount = @($validation.errors).Count }
  commitSha = $commitSha
  files = $packageFiles
}
Write-Utf8NoBom -Path $packageManifestPath -Contents (($packageManifest | ConvertTo-Json -Depth 10) + "`n")

$zipPath = Join-Path $OutputRoot "STEP-03_PARENT_REVIEW_RETURN_TO_CHATGPT.zip"
$archiveInputs = @(
  $fixedFeedbackPath,
  $summaryPath,
  $validationPath,
  $identityOutput,
  $goldenIdentityOutput,
  (Join-Path $OutputRoot "final-golden-manifest.ts"),
  (Join-Path $OutputRoot "asset-manifest.ts"),
  (Join-Path $OutputRoot "audio-and-voice-audit.md"),
  $childGateSummaryPath,
  (Join-Path $OutputRoot "screenshot-index.md"),
  $commitShaPath,
  $packageManifestPath
)
Compress-Archive -Path $archiveInputs -DestinationPath $zipPath -Force
$zipHash = Get-Sha256 -Path $zipPath

if ($validation.valid) {
  Write-Host "All required STEP 03 parent-review fields and revision identities are valid."
} else {
  Write-Warning "The feedback was copied and packaged, but required fields are missing or invalid:"
  foreach ($validationError in @($validation.errors)) {
    Write-Warning "- $validationError"
  }
}

if ($KeepServer -or $NoStopServer) {
  Write-Host "Keeping the recorded STEP 03 Vite server running."
} else {
  Stop-Step03RecordedServer -RepositoryRoot $repositoryRoot -TaskPaths $taskPaths
}

Write-Host "Review package: $zipPath"
Write-Host "SHA-256: $zipHash"
