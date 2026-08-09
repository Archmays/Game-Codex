[CmdletBinding()]
param(
    [string]$OutputPath,
    [switch]$Replace
)

$ErrorActionPreference = "Stop"
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$artifactRoot = Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-04"
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $artifactRoot "STEP-04_FIRST_USE_READINESS_RETURN_TO_CHATGPT.zip"
}
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
if (-not $OutputPath.StartsWith(([System.IO.Path]::GetFullPath($artifactRoot) + [System.IO.Path]::DirectorySeparatorChar), [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Readiness ZIP must stay inside the STEP 04 artifact directory."
}
if ((Test-Path -LiteralPath $OutputPath) -and -not $Replace) {
    throw "Readiness ZIP already exists; pass -Replace to replace this exact package."
}

$evidenceFiles = @(
    "STEP-04-CLOSEOUT.md",
    "STEP-04-DIFF-SUMMARY.md",
    "STEP-04-TEST-SUMMARY.md",
    "STEP-04-INDEPENDENT-ACCEPTANCE.md",
    "STEP-04-FIRST-USE-BUILD-IDENTITY.json",
    "STEP-04-AUDIO-REVISION-EVIDENCE.md",
    "STEP-04-OBSERVER-EVIDENCE.md"
)
$screenshotFiles = @(
    "01-parent-audio-preflight.webp",
    "02-pinyin-visible-phrase-spoken.webp",
    "03-observer-ready.webp",
    "04-child-clean-route.webp",
    "05-live-phase-sync.webp",
    "06-stop-control.webp",
    "07-optional-again-again.webp",
    "08-compact-observer.webp",
    "09-completed-observer-summary.webp",
    "10-privacy-validation.webp"
)
$testFiles = @(
    "tests\hanzi-radical-battle-v2-step04-audio.test.ts",
    "tests\hanzi-radical-battle-v2-step04-freeze.test.ts",
    "tests\hanzi-radical-battle-v2-step04-observer-schema.test.ts",
    "tests\hanzi-radical-battle-v2-step04-event-bridge.test.ts",
    "tests\hanzi-radical-battle-v2-step04-privacy.test.ts",
    "tests\hanzi-radical-battle-v2-step04-gate.test.ts",
    "tests\hanzi-radical-battle-v2-step04-copy.test.ts",
    "tests\e2e\hanzi-radical-battle-v2-step04.spec.ts"
)

$required = @()
$required += $evidenceFiles | ForEach-Object { Join-Path $artifactRoot $_ }
$required += $screenshotFiles | ForEach-Object { Join-Path $artifactRoot "screenshots\representative\$_" }
$required += Join-Path $artifactRoot "screenshots\SCREENSHOT-INDEX.md"
$required += $testFiles | ForEach-Object { Join-Path $repositoryRoot $_ }
foreach ($path in $required) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required readiness file is missing: $path" }
}

$tmpRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot "tmp\hanzi-v2-step04"))
New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
$staging = [System.IO.Path]::GetFullPath((Join-Path $tmpRoot ("readiness-package-" + [guid]::NewGuid().ToString("N"))))
if (-not $staging.StartsWith(($tmpRoot + [System.IO.Path]::DirectorySeparatorChar), [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe readiness staging path."
}
New-Item -ItemType Directory -Path $staging | Out-Null

function Copy-ReadinessFile {
    param([Parameter(Mandatory)][string]$Source, [Parameter(Mandatory)][string]$RelativePath)
    $destination = Join-Path $staging $RelativePath
    $parent = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $destination
}

function Copy-ReadinessTree {
    param([Parameter(Mandatory)][string]$SourceRoot, [Parameter(Mandatory)][string]$RelativeRoot)
    Get-ChildItem -LiteralPath $SourceRoot -Recurse -File | ForEach-Object {
        $relative = [System.IO.Path]::GetRelativePath($SourceRoot, $_.FullName)
        Copy-ReadinessFile -Source $_.FullName -RelativePath (Join-Path $RelativeRoot $relative)
    }
}

try {
    foreach ($name in $evidenceFiles) { Copy-ReadinessFile -Source (Join-Path $artifactRoot $name) -RelativePath $name }
    $authorization = Join-Path $artifactRoot "STEP-04-PARENT-AUTHORIZATION-IDENTITY.json"
    if (Test-Path -LiteralPath $authorization -PathType Leaf) {
        Copy-ReadinessFile -Source $authorization -RelativePath "STEP-04-PARENT-AUTHORIZATION-IDENTITY.json"
    }
    Copy-ReadinessTree -SourceRoot (Join-Path $repositoryRoot "docs\hanzi-radical-battle-v2\step-04") -RelativeRoot "docs\hanzi-radical-battle-v2\step-04"
    Copy-ReadinessTree -SourceRoot (Join-Path $repositoryRoot ".agents\skills\child-first-use-observation") -RelativeRoot ".agents\skills\child-first-use-observation"
    Copy-ReadinessTree -SourceRoot (Join-Path $repositoryRoot "apps\hanzi-v2-step04-observer") -RelativeRoot "apps\hanzi-v2-step04-observer"
    Copy-ReadinessTree -SourceRoot (Join-Path $repositoryRoot "games\hanzi-radical-battle\v2\golden-slice\first-use") -RelativeRoot "games\hanzi-radical-battle\v2\golden-slice\first-use"
    Copy-ReadinessTree -SourceRoot (Join-Path $repositoryRoot "tools\hanzi-v2-step04") -RelativeRoot "tools\hanzi-v2-step04"
    foreach ($relative in $testFiles) { Copy-ReadinessFile -Source (Join-Path $repositoryRoot $relative) -RelativePath $relative }
    Copy-ReadinessFile -Source (Join-Path $artifactRoot "screenshots\SCREENSHOT-INDEX.md") -RelativePath "screenshots\SCREENSHOT-INDEX.md"
    foreach ($name in $screenshotFiles) {
        Copy-ReadinessFile -Source (Join-Path $artifactRoot "screenshots\representative\$name") -RelativePath "screenshots\representative\$name"
    }

    $forbidden = Get-ChildItem -LiteralPath $staging -Recurse -File | Where-Object {
        $relative = [System.IO.Path]::GetRelativePath($staging, $_.FullName)
        $relative -match "(?i)(downloads|observation-inbox|STEP-04_CHILD_FIRST_USE_OBSERVATION|storage[-_ ]?dump|playwright-report|trace\.zip)" -or
        $_.Extension -match "(?i)^\.(mp3|wav|m4a|aac|mp4|webm|mov|avi)$"
    }
    if ($forbidden) { throw "Forbidden observation/media material reached readiness staging: $($forbidden.FullName -join ', ')" }

    New-Item -ItemType Directory -Path (Split-Path -Parent $OutputPath) -Force | Out-Null
    if (Test-Path -LiteralPath $OutputPath) { Remove-Item -LiteralPath $OutputPath -Force }
    Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $OutputPath -CompressionLevel Optimal
    $sha = (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash
    [System.IO.File]::WriteAllText("$OutputPath.sha256", "$sha  $([System.IO.Path]::GetFileName($OutputPath))`r`n", [System.Text.UTF8Encoding]::new($false))
    Write-Host "STEP04_READINESS_ZIP=$OutputPath"
    Write-Host "STEP04_READINESS_SHA256=$sha"
}
finally {
    $resolvedStaging = [System.IO.Path]::GetFullPath($staging)
    if ((Test-Path -LiteralPath $resolvedStaging) -and $resolvedStaging.StartsWith(($tmpRoot + [System.IO.Path]::DirectorySeparatorChar), [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
    }
}
