$ErrorActionPreference = "Stop"

$script:Step07FeedbackSha256 = "AF3878C88F68344E2EF649774FCE24C46D2312824D91AD274628B85C8A6E0800"
$script:Step07CanonicalOrigin = "http://127.0.0.1:5175"

function Get-Step07RepositoryRoot {
  param([Parameter(Mandatory = $true)][string]$ScriptDirectory)
  $root = [System.IO.Path]::GetFullPath((Join-Path $ScriptDirectory "..\.."))
  foreach ($path in @("package.json", ".git", "apps\hanzi-v2-step07-observer\index.ts", "tools\my-game-world\START_MY_GAME_WORLD.ps1")) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $path))) { throw "Game-Codex STEP 07 root was not found from $ScriptDirectory." }
  }
  return $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
}

function Get-Step07Paths {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
  $artifactRoot = Join-Path $RepositoryRoot "artifacts\hanzi-radical-battle-v2\step-07"
  $machineRoot = Join-Path $RepositoryRoot "artifacts\game-machine-review\step-07"
  return [ordered]@{
    ArtifactRoot = $artifactRoot
    MachineRoot = $machineRoot
    Inbox = Join-Path $artifactRoot "observation-inbox"
    Observation = Join-Path $artifactRoot "STEP-07_REAL_SECOND_USE_OBSERVATION.json"
    Summary = Join-Path $artifactRoot "STEP-07-REAL-SECOND-USE-SUMMARY.md"
    RealReturnZip = Join-Path $artifactRoot "STEP-07_REAL_SECOND_USE_RETURN_TO_CHATGPT.zip"
    FixtureRoot = Join-Path $machineRoot "fixture-dry-run"
    FixtureObservation = Join-Path $machineRoot "fixture-dry-run\STEP-07_SYNTHETIC_TOOLING_TEST_OBSERVATION.json"
    FixtureSummary = Join-Path $machineRoot "fixture-dry-run\STEP-07-SYNTHETIC-TOOLING-SUMMARY.md"
    FixtureZip = Join-Path $machineRoot "fixture-dry-run\STEP-07_SYNTHETIC_TOOLING_TEST_RETURN.zip"
    Verdict = Join-Path $machineRoot "MACHINE-REVIEW-VERDICT.json"
    Report = Join-Path $machineRoot "MACHINE-REVIEW-REPORT.json"
    EvidenceManifest = Join-Path $machineRoot "EVIDENCE-MANIFEST.json"
    RuntimeGrant = Join-Path $RepositoryRoot "public\step07-runtime-grant.json"
    TempRoot = Join-Path $RepositoryRoot "tmp\hanzi-v2-step07"
    Contract = Join-Path $RepositoryRoot "tools\hanzi-v2-step07\step07-contract.ts"
    LocalFeedback = Join-Path $RepositoryRoot "artifacts\hanzi-radical-battle-v2\step-05\review\STEP-05_PARENT_REVIEW_FEEDBACK.json"
    DownloadFeedback = Join-Path $env:USERPROFILE "Downloads\STEP-05_PARENT_REVIEW_FEEDBACK.json"
    DownloadObservation = Join-Path $env:USERPROFILE "Downloads\STEP-07_REAL_SECOND_USE_OBSERVATION.json"
  }
}

function New-Step07RuntimeGrant {
  param(
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Paths,
    [Parameter(Mandatory = $true)][string]$CommitSha
  )
  $now = [DateTime]::UtcNow
  $nonce = [Guid]::NewGuid().ToString("N")
  $grant = [ordered]@{
    schemaVersion = 1
    step = "07"
    verdict = "PASS_MACHINE"
    buildCommit = $CommitSha
    verdictSha256 = Get-Step07Sha256 -Path $Paths.Verdict
    launchNonce = $nonce
    generatedAtUtc = $now.ToString("o")
    expiresAtUtc = $now.AddMinutes(30).ToString("o")
  }
  Write-Step07Utf8NoBom -Path $Paths.RuntimeGrant -Contents (($grant | ConvertTo-Json -Depth 4) + "`n")
  return $nonce
}

function Write-Step07Utf8NoBom {
  param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Contents)
  $full = [System.IO.Path]::GetFullPath($Path)
  $parent = Split-Path -Parent $full
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  [System.IO.File]::WriteAllText($full, $Contents, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-Step07Sha256 {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = [System.IO.File]::OpenRead([System.IO.Path]::GetFullPath($Path))
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try { return [System.BitConverter]::ToString($sha256.ComputeHash($stream)).Replace("-", "") }
  finally { $sha256.Dispose(); $stream.Dispose() }
}

function Assert-Step07ParentAuthorization {
  param([Parameter(Mandatory = $true)][System.Collections.IDictionary]$Paths)
  $source = if (Test-Path -LiteralPath $Paths.LocalFeedback -PathType Leaf) { $Paths.LocalFeedback } elseif (Test-Path -LiteralPath $Paths.DownloadFeedback -PathType Leaf) { $Paths.DownloadFeedback } else { throw "BLOCK_STEP07_PARENT_AUTHORIZATION: STEP 05 feedback was not found." }
  $hash = Get-Step07Sha256 -Path $source
  if ($hash -cne $script:Step07FeedbackSha256) { throw "BLOCK_STEP07_PARENT_AUTHORIZATION: feedback SHA mismatch ($hash)." }
  try { $feedback = Get-Content -LiteralPath $source -Raw | ConvertFrom-Json } catch { throw "BLOCK_STEP07_PARENT_AUTHORIZATION: feedback JSON is invalid." }
  $valid =
    [int]$feedback.schemaVersion -eq 1 -and
    [string]$feedback.step -ceq "05" -and
    @($feedback.decisions).Count -eq 4 -and
    @($feedback.decisions | Where-Object { [string]$_.decision -cne "ACCEPT" }).Count -eq 0 -and
    [string]$feedback.authorizeDefaultWorldEntry -ceq "YES" -and
    [string]$feedback.authorizeSecondUseCheck -ceq "YES" -and
    [bool]$feedback.reviewMeta.completed -eq $true -and
    @($feedback.reviewMeta.missingRequiredFieldIds).Count -eq 0
  if (-not $valid) { throw "BLOCK_STEP07_PARENT_AUTHORIZATION: STEP 05 decisions or authorization mismatch." }
}

function Get-Step07Commit {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot, [switch]$RequireFinal)
  $head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -notmatch "^[a-f0-9]{40}$") { throw "STEP 07 Git commit cannot be resolved." }
  $branch = (& git -C $RepositoryRoot branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -cne "main") { throw "STEP 07 tooling requires branch main." }
  if ($RequireFinal) {
    $originMain = (& git -C $RepositoryRoot rev-parse origin/main).Trim()
    if ($LASTEXITCODE -ne 0 -or $originMain -cne $head) { throw "STEP 07 real-use tooling requires HEAD to equal pushed origin/main." }
    & git -C $RepositoryRoot diff --quiet HEAD --
    if ($LASTEXITCODE -ne 0) { throw "Tracked files differ from the final STEP 07 commit." }
    & git -C $RepositoryRoot diff --cached --quiet
    if ($LASTEXITCODE -ne 0) { throw "Staged files differ from the final STEP 07 commit." }
  }
  return $head
}

function Assert-Step07MachineVerdict {
  param(
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Paths,
    [Parameter(Mandatory = $true)][string]$CommitSha,
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Runtime
  )
  foreach ($requiredEvidence in @($Paths.Verdict, $Paths.Report, $Paths.EvidenceManifest)) {
    if (-not (Test-Path -LiteralPath $requiredEvidence -PathType Leaf)) { throw "BLOCK_STEP07_MACHINE_VERDICT: required final machine evidence is missing: $requiredEvidence" }
  }
  $untrackedSourceFiles = @(
    & git -C $RepositoryRoot ls-files --others --exclude-standard |
      ForEach-Object { $_.Replace("\", "/") } |
      Where-Object {
        $_ -and
        -not $_.StartsWith(".playwright-cli/", [System.StringComparison]::Ordinal) -and
        -not $_.StartsWith("artifacts/", [System.StringComparison]::Ordinal) -and
        -not $_.StartsWith("dist/", [System.StringComparison]::Ordinal) -and
        -not $_.StartsWith("node_modules/", [System.StringComparison]::Ordinal) -and
        -not $_.StartsWith("output/", [System.StringComparison]::Ordinal) -and
        -not $_.StartsWith("playwright-report/", [System.StringComparison]::Ordinal) -and
        -not $_.StartsWith("test-results/", [System.StringComparison]::Ordinal) -and
        -not $_.StartsWith("tmp/", [System.StringComparison]::Ordinal)
      }
  )
  if ($LASTEXITCODE -ne 0) { throw "BLOCK_STEP07_MACHINE_VERDICT: untracked source files could not be checked." }
  if ($untrackedSourceFiles.Count -gt 0) {
    throw "BLOCK_STEP07_MACHINE_VERDICT: non-ignored untracked source files are present: $($untrackedSourceFiles -join ', ')."
  }
  $evidenceIdentityTool = Join-Path $RepositoryRoot "tools\game-machine-review\evidence-identity.ts"
  try {
    $identityOutput = @(& $Runtime.Node $Runtime.Tsx $evidenceIdentityTool verify-readiness $RepositoryRoot $Paths.MachineRoot $CommitSha 2>&1)
    $identityExitCode = $LASTEXITCODE
  } catch {
    throw "BLOCK_STEP07_MACHINE_VERDICT: canonical evidence verification failed: $($_.Exception.Message)"
  }
  if ($identityExitCode -ne 0) {
    throw "BLOCK_STEP07_MACHINE_VERDICT: canonical evidence verification failed: $(($identityOutput | ForEach-Object { [string]$_ }) -join ' ')"
  }
  try { $identity = (($identityOutput | ForEach-Object { [string]$_ }) -join "") | ConvertFrom-Json } catch { throw "BLOCK_STEP07_MACHINE_VERDICT: canonical evidence verifier returned invalid output." }
  if ([string]$identity.status -cne "PASS" -or [int]$identity.entryCount -le 0) {
    throw "BLOCK_STEP07_MACHINE_VERDICT: canonical evidence verifier did not confirm a nonempty evidence tree."
  }
}

function Get-Step07Runtime {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
  $node = Get-Command node -ErrorAction SilentlyContinue
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  $tsx = Join-Path $RepositoryRoot "node_modules\tsx\dist\cli.mjs"
  if (-not $node -or -not $pnpm -or -not (Test-Path -LiteralPath $tsx -PathType Leaf)) { throw "Node, pnpm, or the existing local tsx runtime is unavailable. No install was attempted." }
  return [ordered]@{ Node = $node.Source; Pnpm = $pnpm.Source; Tsx = $tsx }
}

function Resolve-Step07ObservationInput {
  param([Parameter(Mandatory = $true)][System.Collections.IDictionary]$Paths)
  $inboxPath = Join-Path $Paths.Inbox "STEP-07_REAL_SECOND_USE_OBSERVATION.json"
  $candidates = @()
  if (Test-Path -LiteralPath $inboxPath -PathType Leaf) { $candidates += [System.IO.Path]::GetFullPath($inboxPath) }
  if (Test-Path -LiteralPath $Paths.DownloadObservation -PathType Leaf) { $candidates += [System.IO.Path]::GetFullPath($Paths.DownloadObservation) }
  if ($candidates.Count -eq 0) { throw "STEP-07_REAL_SECOND_USE_OBSERVATION.json was not found in Downloads or the observation inbox." }
  if ($candidates.Count -gt 1) {
    $hashes = @($candidates | ForEach-Object { Get-Step07Sha256 -Path $_ } | Select-Object -Unique)
    if ($hashes.Count -ne 1) { throw "Ambiguous STEP 07 observations with different hashes were found. Nothing was packaged." }
  }
  return $candidates[0]
}

function Remove-Step07OwnedStaging {
  param([Parameter(Mandatory = $true)][string]$TempRoot, [Parameter(Mandatory = $true)][string]$Staging)
  $temp = [System.IO.Path]::GetFullPath($TempRoot)
  $stage = [System.IO.Path]::GetFullPath($Staging)
  if (-not $stage.StartsWith($temp + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $stage) -notmatch '^package-[a-f0-9]{32}$') { throw "Refusing to remove non-owned STEP 07 staging: $stage" }
  if (Test-Path -LiteralPath $stage -PathType Container) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
