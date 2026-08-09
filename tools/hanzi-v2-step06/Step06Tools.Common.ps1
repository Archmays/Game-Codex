$ErrorActionPreference = "Stop"

$script:Step06FeedbackSha256 = "AF3878C88F68344E2EF649774FCE24C46D2312824D91AD274628B85C8A6E0800"
$script:Step06CandidateCommit = "c46e660396257767692e94d61263b4662a11ccfb"
$script:Step06EvidenceSha256 = "EC04FECD4B04F294E7ED62139EBEE386F6B27B3FBC198EBCF3F6CD98341A86D8"
$script:Step06CandidateRevision = "fnv1a:c9271099"
$script:Step06TechnicalState = "DEFAULT_WORLD_ENTRY_PROMOTED_SECOND_USE_READY"
$script:Step06CanonicalOrigin = "http://127.0.0.1:5175"

function Get-Step06RepositoryRoot {
  param([Parameter(Mandatory = $true)][string]$ScriptDirectory)
  $root = [System.IO.Path]::GetFullPath((Join-Path $ScriptDirectory "..\.."))
  foreach ($path in @("package.json", ".git", "apps\hanzi-v2-step06-observer\index.ts", "tools\my-game-world\START_MY_GAME_WORLD.ps1")) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $path))) { throw "Game-Codex STEP 06 root was not found from $ScriptDirectory." }
  }
  return $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
}

function Get-Step06Paths {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
  $artifactRoot = Join-Path $RepositoryRoot "artifacts\hanzi-radical-battle-v2\step-06"
  return [ordered]@{
    ArtifactRoot = $artifactRoot
    Inbox = Join-Path $artifactRoot "observation-inbox"
    Observation = Join-Path $artifactRoot "STEP-06_SECOND_USE_OBSERVATION.json"
    Summary = Join-Path $artifactRoot "STEP-06-SECOND-USE-SUMMARY.md"
    ReturnZip = Join-Path $artifactRoot "STEP-06_SECOND_USE_RETURN_TO_CHATGPT.zip"
    DefaultIdentity = Join-Path $artifactRoot "STEP-06-DEFAULT-WORLD-IDENTITY.json"
    ParentIdentity = Join-Path $artifactRoot "STEP-06-PARENT-AUTHORIZATION-IDENTITY.json"
    TempRoot = Join-Path $RepositoryRoot "tmp\hanzi-v2-step06"
    Contract = Join-Path $RepositoryRoot "tools\hanzi-v2-step06\step06-contract.ts"
    LocalFeedback = Join-Path $RepositoryRoot "artifacts\hanzi-radical-battle-v2\step-05\review\STEP-05_PARENT_REVIEW_FEEDBACK.json"
    DownloadFeedback = Join-Path $env:USERPROFILE "Downloads\STEP-05_PARENT_REVIEW_FEEDBACK.json"
    DownloadObservation = Join-Path $env:USERPROFILE "Downloads\STEP-06_SECOND_USE_OBSERVATION.json"
  }
}

function Write-Step06Utf8NoBom {
  param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Contents)
  $full = [System.IO.Path]::GetFullPath($Path)
  $parent = Split-Path -Parent $full
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  [System.IO.File]::WriteAllText($full, $Contents, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-Step06Sha256 {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = [System.IO.File]::OpenRead([System.IO.Path]::GetFullPath($Path))
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return [System.BitConverter]::ToString($sha256.ComputeHash($stream)).Replace("-", "")
  } finally {
    $sha256.Dispose()
    $stream.Dispose()
  }
}

function Get-Step06ParentAuthorization {
  param([Parameter(Mandatory = $true)][System.Collections.IDictionary]$Paths)
  $source = if (Test-Path -LiteralPath $Paths.LocalFeedback -PathType Leaf) { $Paths.LocalFeedback } elseif (Test-Path -LiteralPath $Paths.DownloadFeedback -PathType Leaf) { $Paths.DownloadFeedback } else { throw "BLOCK_STEP06_PARENT_AUTHORIZATION: STEP 05 feedback was not found." }
  $hash = Get-Step06Sha256 -Path $source
  if ($hash -cne $script:Step06FeedbackSha256) { throw "BLOCK_STEP06_PARENT_AUTHORIZATION: feedback SHA mismatch ($hash)." }
  try { $feedback = Get-Content -LiteralPath $source -Raw | ConvertFrom-Json } catch { throw "BLOCK_STEP06_PARENT_AUTHORIZATION: feedback JSON is invalid." }
  $ids = @($feedback.decisions | ForEach-Object { [string]$_.itemId })
  $expectedIds = @("real-first-use-evidence", "audio-context-regression", "private-world-shell", "world-navigation")
  $exact =
    [int]$feedback.schemaVersion -eq 1 -and
    [string]$feedback.reviewContractVersion -ceq "hanzi-v2-step05-parent-review-v1" -and
    [string]$feedback.initiativeId -ceq "hanzi-radical-battle-v2" -and
    [string]$feedback.step -ceq "05" -and
    [string]$feedback.identity.candidateCommit -ceq $script:Step06CandidateCommit -and
    [string]$feedback.identity.evidenceSha256 -ceq $script:Step06EvidenceSha256 -and
    [string]$feedback.identity.candidateRevision -ceq $script:Step06CandidateRevision -and
    @($feedback.decisions).Count -eq 4 -and
    @($feedback.decisions | Where-Object { [string]$_.decision -cne "ACCEPT" }).Count -eq 0 -and
    @($expectedIds | Where-Object { $ids -notcontains $_ }).Count -eq 0 -and
    [string]$feedback.authorizeDefaultWorldEntry -ceq "YES" -and
    [string]$feedback.authorizeSecondUseCheck -ceq "YES" -and
    [bool]$feedback.reviewMeta.completed -eq $true -and
    @($feedback.reviewMeta.missingRequiredFieldIds).Count -eq 0
  if (-not $exact) { throw "BLOCK_STEP06_PARENT_AUTHORIZATION: identity, decisions, completion, or YES authorization mismatch." }
  if ([System.IO.Path]::GetFullPath($source) -ceq [System.IO.Path]::GetFullPath($Paths.DownloadFeedback) -and -not (Test-Path -LiteralPath $Paths.LocalFeedback -PathType Leaf)) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $Paths.LocalFeedback) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $Paths.LocalFeedback
    if ((Get-Step06Sha256 -Path $Paths.LocalFeedback) -cne $script:Step06FeedbackSha256) { throw "BLOCK_STEP06_PARENT_AUTHORIZATION: copied local feedback hash mismatch." }
  }
  return [ordered]@{ SourcePath = [System.IO.Path]::GetFullPath($source); Sha256 = $hash; Feedback = $feedback }
}

function Get-Step06FinalCommit {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot, [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Paths)
  $head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -notmatch "^[a-f0-9]{40}$") { throw "Final STEP 06 Git commit cannot be resolved." }
  $branch = (& git -C $RepositoryRoot branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -cne "main") { throw "STEP 06 official tooling requires the final main branch." }
  $originMain = (& git -C $RepositoryRoot rev-parse origin/main).Trim()
  if ($LASTEXITCODE -ne 0 -or $originMain -cne $head) { throw "STEP 06 official tooling requires HEAD to equal pushed origin/main." }
  & git -C $RepositoryRoot diff --quiet HEAD --
  if ($LASTEXITCODE -ne 0) { throw "Tracked files differ from the final STEP 06 commit. Official tooling failed closed." }
  & git -C $RepositoryRoot diff --cached --quiet
  if ($LASTEXITCODE -ne 0) { throw "Staged files differ from the final STEP 06 commit. Official tooling failed closed." }
  if (-not (Test-Path -LiteralPath $Paths.DefaultIdentity -PathType Leaf)) { throw "Final STEP 06 identity is missing: $($Paths.DefaultIdentity)" }
  try { $identity = Get-Content -LiteralPath $Paths.DefaultIdentity -Raw | ConvertFrom-Json } catch { throw "Final STEP 06 identity JSON is invalid." }
  $valid = [int]$identity.schemaVersion -eq 1 -and [string]$identity.initiativeId -ceq "hanzi-radical-battle-v2" -and [string]$identity.step -ceq "06" -and [string]$identity.technicalState -ceq $script:Step06TechnicalState -and [string]$identity.commitSha -ceq $head -and [string]$identity.canonicalOrigin -ceq $script:Step06CanonicalOrigin -and [string]$identity.defaultRoute -ceq "/" -and [string]$identity.classicHubRoute -ceq "?hub=classic"
  if (-not $valid) { throw "Final STEP 06 identity does not match HEAD, state, routes, or canonical origin." }
  return $head
}

function Assert-Step06ParentIdentity {
  param([Parameter(Mandatory = $true)][System.Collections.IDictionary]$Paths)
  if (-not (Test-Path -LiteralPath $Paths.ParentIdentity -PathType Leaf)) { throw "STEP 06 parent authorization identity artifact is missing." }
  try { $identity = Get-Content -LiteralPath $Paths.ParentIdentity -Raw | ConvertFrom-Json } catch { throw "STEP 06 parent authorization identity is invalid JSON." }
  if ([string]$identity.feedbackSha256 -cne $script:Step06FeedbackSha256 -or [string]$identity.authorizeDefaultWorldEntry -cne "YES" -or [string]$identity.authorizeSecondUseCheck -cne "YES" -or [int]$identity.acceptDecisionCount -ne 4) { throw "BLOCK_STEP06_PARENT_AUTHORIZATION: projected identity mismatch." }
}

function Get-Step06Runtime {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
  $node = Get-Command node -ErrorAction SilentlyContinue
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  $tsx = Join-Path $RepositoryRoot "node_modules\tsx\dist\cli.mjs"
  if (-not $node -or -not $pnpm -or -not (Test-Path -LiteralPath $tsx -PathType Leaf)) { throw "Node, pnpm, or the existing local tsx runtime is unavailable. No install was attempted." }
  return [ordered]@{ Node = $node.Source; Pnpm = $pnpm.Source; Tsx = $tsx }
}

function Resolve-Step06ObservationInput {
  param([Parameter(Mandatory = $true)][System.Collections.IDictionary]$Paths, [switch]$FixtureMode)
  $inboxPath = Join-Path $Paths.Inbox "STEP-06_SECOND_USE_OBSERVATION.json"
  $candidates = @()
  if (Test-Path -LiteralPath $inboxPath -PathType Leaf) { $candidates += [System.IO.Path]::GetFullPath($inboxPath) }
  if (-not $FixtureMode -and (Test-Path -LiteralPath $Paths.DownloadObservation -PathType Leaf)) { $candidates += [System.IO.Path]::GetFullPath($Paths.DownloadObservation) }
  if ($candidates.Count -eq 0) { throw "STEP-06_SECOND_USE_OBSERVATION.json was not found in Downloads or the observation inbox." }
  if ($candidates.Count -gt 1) {
    $hashes = @($candidates | ForEach-Object { Get-Step06Sha256 -Path $_ } | Select-Object -Unique)
    if ($hashes.Count -ne 1) { throw "Ambiguous STEP 06 observations with different hashes were found. Nothing was packaged." }
  }
  return $candidates[0]
}

function Remove-Step06OwnedStaging {
  param([Parameter(Mandatory = $true)][string]$TempRoot, [Parameter(Mandatory = $true)][string]$Staging)
  $temp = [System.IO.Path]::GetFullPath($TempRoot)
  $stage = [System.IO.Path]::GetFullPath($Staging)
  if (-not $stage.StartsWith($temp + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $stage) -notmatch '^package-[a-f0-9]{32}$') { throw "Refusing to remove non-owned STEP 06 staging: $stage" }
  if (Test-Path -LiteralPath $stage -PathType Container) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
