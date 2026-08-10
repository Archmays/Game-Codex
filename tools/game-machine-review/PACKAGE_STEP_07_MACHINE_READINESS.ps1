[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$packageFileName = "STEP-07_MACHINE_QA_REAL_SECOND_USE_READINESS_RETURN_TO_CHATGPT.zip"
$packageManifestName = "STEP-07_MACHINE_READINESS_PACKAGE_MANIFEST.json"

function Resolve-ContainedPath {
  param(
    [Parameter(Mandatory = $true)][string]$BasePath,
    [Parameter(Mandatory = $true)][string]$CandidatePath,
    [Parameter(Mandatory = $true)][string]$Label,
    [switch]$AllowBase
  )
  $base = [System.IO.Path]::GetFullPath($BasePath).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  $candidate = [System.IO.Path]::GetFullPath($CandidatePath)
  $prefix = $base + [System.IO.Path]::DirectorySeparatorChar
  if (($AllowBase -and $candidate -ceq $base) -or $candidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $candidate
  }
  throw "$Label escapes its owned root: $candidate"
}

function Get-WorkspaceRelativePath {
  param(
    [Parameter(Mandatory = $true)][string]$WorkspaceRoot,
    [Parameter(Mandatory = $true)][string]$FullPath
  )
  $workspace = [System.IO.Path]::GetFullPath($WorkspaceRoot).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  $full = Resolve-ContainedPath -BasePath $workspace -CandidatePath $FullPath -Label "Package source"
  return $full.Substring($workspace.Length + 1).Replace("\", "/")
}

function Get-Sha256 {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
      return [System.BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace("-", "")
    } finally {
      $algorithm.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Assert-RegularFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Required package source is missing: $Path" }
  $item = Get-Item -LiteralPath $Path -Force
  if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or $item.Length -le 0) {
    throw "Package sources must be nonempty regular files: $Path"
  }
}

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Contents
  )
  [System.IO.File]::WriteAllText($Path, $Contents, [System.Text.UTF8Encoding]::new($false))
}

function Assert-PushedCleanCommit {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
  $branch = (& git -C $RepositoryRoot branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -cne "main") { throw "STEP 07 readiness packaging requires branch main." }
  $head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -notmatch "^[a-f0-9]{40}$") { throw "Local HEAD could not be resolved." }
  $originMain = (& git -C $RepositoryRoot rev-parse origin/main).Trim()
  if ($LASTEXITCODE -ne 0 -or $originMain -cne $head) { throw "STEP 07 readiness packaging requires HEAD to equal pushed origin/main." }
  & git -C $RepositoryRoot diff --quiet HEAD --
  if ($LASTEXITCODE -ne 0) { throw "Tracked files differ from the pushed STEP 07 commit." }
  & git -C $RepositoryRoot diff --cached --quiet
  if ($LASTEXITCODE -ne 0) { throw "Staged files differ from the pushed STEP 07 commit." }
  return $head
}

function Invoke-CanonicalReadinessVerification {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$MachineRoot,
    [Parameter(Mandatory = $true)][string]$CommitSha,
    [Parameter(Mandatory = $true)][string]$NodePath,
    [Parameter(Mandatory = $true)][string]$TsxPath
  )
  $identityTool = Join-Path $RepositoryRoot "tools\game-machine-review\evidence-identity.ts"
  Assert-RegularFile -Path $identityTool
  try {
    $lines = @(& $NodePath $TsxPath $identityTool verify-readiness $RepositoryRoot $MachineRoot $CommitSha 2>&1)
    $exitCode = $LASTEXITCODE
  } catch {
    throw "Canonical no-write readiness verification failed: $($_.Exception.Message)"
  }
  if ($exitCode -ne 0) {
    throw "Canonical no-write readiness verification failed: $(($lines | ForEach-Object { [string]$_ }) -join ' ')"
  }
  try {
    $identity = (($lines | ForEach-Object { [string]$_ }) -join "") | ConvertFrom-Json
  } catch {
    throw "Canonical no-write readiness verifier returned invalid JSON."
  }
  if ([string]$identity.status -cne "PASS" -or [int]$identity.entryCount -le 0) {
    throw "Canonical no-write readiness verifier did not confirm a nonempty PASS evidence tree."
  }
  return $identity
}

function Remove-OwnedReadinessPath {
  param(
    [Parameter(Mandatory = $true)][string]$WorkspaceTempRoot,
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][ValidateSet("Directory", "Zip")][string]$Kind
  )
  $owned = Resolve-ContainedPath -BasePath $WorkspaceTempRoot -CandidatePath $Path -Label "Temporary package path"
  $leaf = Split-Path -Leaf $owned
  $validLeaf = if ($Kind -ceq "Directory") { $leaf -match "^package-[a-f0-9]{32}$" } else { $leaf -match "^package-[a-f0-9]{32}\.zip$" }
  if (-not $validLeaf) { throw "Refusing to remove an unowned temporary package path: $owned" }
  if (Test-Path -LiteralPath $owned) { Remove-Item -LiteralPath $owned -Recurse -Force }
}

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
foreach ($requiredRootPath in @(".git", "package.json", "tools\game-machine-review\evidence-identity.ts")) {
  if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot $requiredRootPath))) {
    throw "Game-Codex repository root was not found from $PSScriptRoot."
  }
}

$machineRoot = Resolve-ContainedPath -BasePath $repositoryRoot -CandidatePath (Join-Path $repositoryRoot "artifacts\game-machine-review\step-07") -Label "STEP 07 machine evidence"
if (-not (Test-Path -LiteralPath $machineRoot -PathType Container)) { throw "STEP 07 machine evidence directory is missing." }
$outputZip = Resolve-ContainedPath -BasePath $machineRoot -CandidatePath (Join-Path $machineRoot $packageFileName) -Label "Readiness ZIP"
$shaSidecar = Resolve-ContainedPath -BasePath $machineRoot -CandidatePath ($outputZip + ".sha256") -Label "Readiness SHA-256 sidecar"
$returnInventoryPath = Resolve-ContainedPath -BasePath $machineRoot -CandidatePath (Join-Path $machineRoot "final-closure\RETURN-PACKAGE-INVENTORY.json") -Label "Return-package inventory"
$workspaceTempRoot = Resolve-ContainedPath -BasePath $repositoryRoot -CandidatePath (Join-Path $repositoryRoot "tmp\game-machine-review\step-07-readiness") -Label "Workspace temporary root"
New-Item -ItemType Directory -Path $workspaceTempRoot -Force | Out-Null
$workspaceTempRootItem = Get-Item -LiteralPath $workspaceTempRoot -Force
if (($workspaceTempRootItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Workspace temporary root must not be a reparse point." }

$node = Get-Command node -ErrorAction SilentlyContinue
$tsx = Join-Path $repositoryRoot "node_modules\tsx\dist\cli.mjs"
if (-not $node -or -not (Test-Path -LiteralPath $tsx -PathType Leaf)) {
  throw "Node and the existing local tsx runtime are required. No dependency install was attempted."
}

$head = Assert-PushedCleanCommit -RepositoryRoot $repositoryRoot
$initialIdentity = Invoke-CanonicalReadinessVerification -RepositoryRoot $repositoryRoot -MachineRoot $machineRoot -CommitSha $head -NodePath $node.Source -TsxPath $tsx

$packageId = [Guid]::NewGuid().ToString("N")
$staging = Resolve-ContainedPath -BasePath $workspaceTempRoot -CandidatePath (Join-Path $workspaceTempRoot "package-$packageId") -Label "Readiness staging"
$temporaryZip = Resolve-ContainedPath -BasePath $workspaceTempRoot -CandidatePath (Join-Path $workspaceTempRoot "package-$packageId.zip") -Label "Temporary readiness ZIP"
$archivePaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$manifestEntries = [System.Collections.Generic.List[object]]::new()

function Copy-PackageFile {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$ArchivePath
  )
  Assert-RegularFile -Path $Source
  $canonicalArchivePath = $ArchivePath.Replace("\", "/").TrimStart("/")
  if ([string]::IsNullOrWhiteSpace($canonicalArchivePath) -or $canonicalArchivePath.Contains("..") -or $canonicalArchivePath.Contains([char]0)) {
    throw "Invalid readiness archive path: $ArchivePath"
  }
  if (-not $archivePaths.Add($canonicalArchivePath)) { throw "Duplicate readiness archive path: $canonicalArchivePath" }
  $destination = Resolve-ContainedPath -BasePath $staging -CandidatePath (Join-Path $staging $canonicalArchivePath) -Label "Readiness staging file"
  $destinationParent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
  Copy-Item -LiteralPath $Source -Destination $destination
  $sourceHash = Get-Sha256 -Path $Source
  $destinationHash = Get-Sha256 -Path $destination
  if ($sourceHash -cne $destinationHash) { throw "Readiness copy identity mismatch: $Source" }
  $destinationItem = Get-Item -LiteralPath $destination -Force
  $manifestEntries.Add([ordered]@{
      archivePath = $canonicalArchivePath
      sourcePath = Get-WorkspaceRelativePath -WorkspaceRoot $repositoryRoot -FullPath $Source
      bytes = [long]$destinationItem.Length
      sha256 = $destinationHash
    }) | Out-Null
}

function Copy-PackageTree {
  param(
    [Parameter(Mandatory = $true)][string]$SourceRoot,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$ArchiveRoot,
    [string[]]$ExcludedFullPaths = @()
  )
  $root = Resolve-ContainedPath -BasePath $repositoryRoot -CandidatePath $SourceRoot -Label "Package tree" -AllowBase
  if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw "Required package source directory is missing: $root" }
  $rootItem = Get-Item -LiteralPath $root -Force
  if (($rootItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Package source directory must not be a reparse point: $root" }
  $files = @(Get-ChildItem -LiteralPath $root -Recurse -Force -File | Sort-Object FullName)
  if ($files.Count -eq 0) { throw "Required package source directory is empty: $root" }
  foreach ($file in $files) {
    $full = Resolve-ContainedPath -BasePath $root -CandidatePath $file.FullName -Label "Package tree file"
    $excluded = @($ExcludedFullPaths | ForEach-Object { [System.IO.Path]::GetFullPath($_) })
    if ($excluded -contains $full) { continue }
    if (($file.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Package source must not be a reparse point: $full" }
    $relative = $full.Substring($root.TrimEnd("\", "/").Length + 1)
    $archivePath = if ([string]::IsNullOrWhiteSpace($ArchiveRoot)) { $relative } else { Join-Path $ArchiveRoot $relative }
    Copy-PackageFile -Source $full -ArchivePath $archivePath
  }
}

try {
  New-Item -ItemType Directory -Path $staging | Out-Null

  Assert-RegularFile -Path $returnInventoryPath
  try {
    $returnInventory = Get-Content -Raw -LiteralPath $returnInventoryPath | ConvertFrom-Json
  } catch {
    throw "Return-package inventory is invalid JSON."
  }
  if (
    [int]$returnInventory.schemaVersion -ne 1 -or
    [string]$returnInventory.step -cne "07" -or
    [string]$returnInventory.packageKind -cne "MACHINE_QA_REAL_SECOND_USE_READINESS" -or
    -not $returnInventory.entries -or
    @($returnInventory.entries).Count -eq 0
  ) {
    throw "Return-package inventory identity is invalid."
  }

  $inventoryArchivePaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($entry in @($returnInventory.entries)) {
    $entryKeys = @($entry.PSObject.Properties.Name | Sort-Object)
    if (($entryKeys -join "|") -cne "archivePath|sourcePath") { throw "Return-package entries must contain only sourcePath and archivePath." }
    $sourceRelative = ([string]$entry.sourcePath).Replace("\", "/").TrimStart("/")
    $archiveRelative = ([string]$entry.archivePath).Replace("\", "/").TrimStart("/")
    if (
      [string]::IsNullOrWhiteSpace($sourceRelative) -or
      [string]::IsNullOrWhiteSpace($archiveRelative) -or
      $sourceRelative.Contains("..") -or
      $archiveRelative.Contains("..") -or
      $sourceRelative.Contains([char]0) -or
      $archiveRelative.Contains([char]0)
    ) {
      throw "Return-package inventory contains an unsafe path."
    }
    if (-not $inventoryArchivePaths.Add($archiveRelative)) { throw "Duplicate return-package archive path: $archiveRelative" }
    if ($sourceRelative -match "(?i)(observation-inbox|STEP-0[47]_REAL_SECOND_USE_OBSERVATION|STEP-04_CHILD_FIRST_USE_OBSERVATION|storage[-_ ]?dump|raw-candidates|rejected|traces?/|playwright-report|test-results)") {
      throw "Forbidden raw, private, rejected, or transient source reached the return-package inventory: $sourceRelative"
    }
    $sourceFull = Resolve-ContainedPath -BasePath $repositoryRoot -CandidatePath (Join-Path $repositoryRoot $sourceRelative) -Label "Return-package source"
    Copy-PackageFile -Source $sourceFull -ArchivePath $archiveRelative
  }

  foreach ($requiredArchivePath in @(
      "STEP-07-CLOSEOUT.md",
      "MACHINE-REVIEW-VERDICT.json",
      "MACHINE-REVIEW-REPORT.json",
      "FINAL-SOURCE-FREEZE.json",
      "git/FINAL-COMMIT.json",
      "git/ORIGIN-VERIFICATION.json",
      "lifecycle/STEP07-LIFECYCLE-EVIDENCE.json",
      "accessibility/ACCESSIBILITY-CLOSURE-PROOF.json",
      "semantic/SEMANTIC-ACCEPTANCE.json",
      "baseline/BASELINE-PROMOTION.json",
      "baseline/NO-UPDATE-PROOF.json",
      "static/STATIC-REPORT-PROOF.json",
      "skill/SKILL.md",
      "skill/references/recovery-and-source-freeze.md",
      "skill/references/lifecycle-and-evidence.md",
      "skill/references/retention-and-cleanup.md",
      "skill/SKILL-DISTILLATION-SUMMARY.md",
      "cleanup/CLEANUP-PLAN.json",
      "cleanup/POST-PACKAGE-CLEANUP-CONTRACT.json",
      "history/THREE-REPAIR-LOOPS-FAILED.json",
      "history/CLOSED-RECOVERY-FREEZE.json",
      "history/CLOSED-RECOVERY-STOPPED.json",
      "history/exceptional-repair-index.json",
      "history/deleted-evidence-manifest.json",
      "assets/ASSET-BATCH-MANIFEST.json",
      "assets/MACHINE-ASSET-VERDICT.json",
      "assets/contact-sheet.webp"
    )) {
    if (-not $inventoryArchivePaths.Contains($requiredArchivePath)) {
      throw "Return-package inventory is missing required archive entry: $requiredArchivePath"
    }
  }

  Copy-PackageFile -Source $returnInventoryPath -ArchivePath "RETURN-PACKAGE-INVENTORY.json"

  $forbidden = @($manifestEntries | Where-Object {
      $_.sourcePath -match "(?i)(observation-inbox|STEP-0[47]_REAL_SECOND_USE_OBSERVATION|STEP-04_CHILD_FIRST_USE_OBSERVATION|storage[-_ ]?dump|raw-candidates|rejected|traces?/|playwright-report|test-results)"
    })
  if ($forbidden.Count -gt 0) {
    throw "Real-child, inbox, or storage-dump material reached machine-readiness staging: $($forbidden.sourcePath -join ', ')"
  }
  if ($archivePaths.Contains($packageFileName)) { throw "Readiness ZIP attempted to include itself." }

  $orderedEntries = @($manifestEntries | Sort-Object archivePath)
  $packageManifest = [ordered]@{
    schemaVersion = 1
    step = "07"
    packageKind = "MACHINE_QA_REAL_SECOND_USE_READINESS"
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
    sourceCommit = $head
    sourceIdentity = [ordered]@{
      sourceTreeSha256 = [string]$initialIdentity.sourceTreeSha256
      evidenceTreeSha256 = [string]$initialIdentity.evidenceTreeSha256
      evidenceManifestSha256 = [string]$initialIdentity.evidenceManifestSha256
      evidenceEntryCount = [int]$initialIdentity.entryCount
    }
    outputFileName = $packageFileName
    outputZipIncludedInPayload = $false
    realSecondUsePerformed = "NO"
    manifestCoverage = "Every payload file except this manifest is listed in contents."
    contents = $orderedEntries
  }
  $manifestPath = Resolve-ContainedPath -BasePath $staging -CandidatePath (Join-Path $staging $packageManifestName) -Label "Package manifest"
  Write-Utf8NoBom -Path $manifestPath -Contents (($packageManifest | ConvertTo-Json -Depth 8) + "`r`n")
  $packageManifestSha256 = Get-Sha256 -Path $manifestPath

  # Re-run the canonical no-write gate after staging to close the copy-time race.
  $recheckedHead = Assert-PushedCleanCommit -RepositoryRoot $repositoryRoot
  if ($recheckedHead -cne $head) { throw "HEAD changed while the readiness package was staged." }
  $finalIdentity = Invoke-CanonicalReadinessVerification -RepositoryRoot $repositoryRoot -MachineRoot $machineRoot -CommitSha $head -NodePath $node.Source -TsxPath $tsx
  foreach ($field in @("sourceTreeSha256", "evidenceTreeSha256", "evidenceManifestSha256", "entryCount")) {
    if ([string]$finalIdentity.$field -cne [string]$initialIdentity.$field) { throw "Canonical readiness identity changed during packaging: $field" }
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $staging,
    $temporaryZip,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )
  Assert-RegularFile -Path $temporaryZip
  $zipSha256 = Get-Sha256 -Path $temporaryZip

  New-Item -ItemType Directory -Path (Split-Path -Parent $outputZip) -Force | Out-Null
  if (Test-Path -LiteralPath $outputZip -PathType Leaf) {
    $backup = Resolve-ContainedPath -BasePath $workspaceTempRoot -CandidatePath (Join-Path $workspaceTempRoot "package-$packageId.backup.zip") -Label "Temporary readiness backup"
    try {
      [System.IO.File]::Replace($temporaryZip, $outputZip, $backup, $true)
    } finally {
      if (Test-Path -LiteralPath $backup -PathType Leaf) { Remove-Item -LiteralPath $backup -Force }
    }
  } else {
    Move-Item -LiteralPath $temporaryZip -Destination $outputZip
  }
  if ((Get-Sha256 -Path $outputZip) -cne $zipSha256) { throw "Published readiness ZIP identity differs from the staged ZIP." }
  Write-Utf8NoBom -Path $shaSidecar -Contents "$zipSha256  $packageFileName`r`n"

  $result = [ordered]@{
    status = "PASS"
    step = "07"
    sourceCommit = $head
    readinessZip = $outputZip
    readinessZipSha256 = $zipSha256
    readinessZipSha256Sidecar = $shaSidecar
    packageManifestPathInZip = $packageManifestName
    packageManifestSha256 = $packageManifestSha256
    payloadFileCount = $orderedEntries.Count
    realSecondUsePerformed = "NO"
  }
  Write-Output ($result | ConvertTo-Json -Compress)
} finally {
  if (Test-Path -LiteralPath $staging) { Remove-OwnedReadinessPath -WorkspaceTempRoot $workspaceTempRoot -Path $staging -Kind Directory }
  if (Test-Path -LiteralPath $temporaryZip) { Remove-OwnedReadinessPath -WorkspaceTempRoot $workspaceTempRoot -Path $temporaryZip -Kind Zip }
}
