[CmdletBinding()]
param(
  [string]$FeedbackPath,
  [string]$OutputRoot,
  [switch]$KeepServer,
  [switch]$NoStopServer
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Contents
  )

  $encoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
  [System.IO.File]::WriteAllText($Path, $Contents, $encoding)
}

function Get-Sha256 {
  param([Parameter(Mandatory = $true)][string]$Path)

  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
      return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace("-", "")
    } finally {
      $algorithm.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Get-ObjectValue {
  param(
    [object]$Object,
    [Parameter(Mandatory = $true)][string]$PropertyName
  )

  if ($null -eq $Object) {
    return $null
  }

  $property = $Object.PSObject.Properties[$PropertyName]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Get-NestedValue {
  param(
    [object]$Object,
    [Parameter(Mandatory = $true)][string[]]$Path
  )

  $current = $Object
  foreach ($segment in $Path) {
    $current = Get-ObjectValue -Object $current -PropertyName $segment
    if ($null -eq $current) {
      return $null
    }
  }

  return $current
}

function Test-RequiredText {
  param([object]$Value)

  return $null -ne $Value -and -not [string]::IsNullOrWhiteSpace([string]$Value)
}

function Get-ProcessCommandLine {
  param([Parameter(Mandatory = $true)][int]$ProcessId)

  try {
    return (Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop).CommandLine
  } catch {
    return ""
  }
}

function Stop-RecordedReviewServer {
  param(
    [Parameter(Mandatory = $true)][string]$PidPath,
    [Parameter(Mandatory = $true)][string]$RepositoryRoot
  )

  if (-not (Test-Path -LiteralPath $PidPath -PathType Leaf)) {
    Write-Host "No START_STEP_02_REVIEW server record was found."
    return
  }

  try {
    $record = Get-Content -LiteralPath $PidPath -Raw | ConvertFrom-Json
    $processId = [int]$record.pid
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($null -eq $process) {
      Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue
      Write-Host "The recorded STEP 02 review server is no longer running."
      return
    }
    $commandLine = Get-ProcessCommandLine -ProcessId $process.Id
    $sameRoot = [string]$record.repositoryRoot -eq $RepositoryRoot
    $samePort = [int]$record.port -eq 5173
    $isVite = $commandLine -match "(?i)vite(?:\.js)?"
    $hasHost = $commandLine -match "(?i)--host(?:\s+|=)127\.0\.0\.1"
    $hasPort = $commandLine -match "(?i)--port(?:\s+|=)5173"
    $hasStrictPort = $commandLine -match "(?i)--strictPort"

    if (-not ($sameRoot -and $samePort -and $isVite -and $hasHost -and $hasPort -and $hasStrictPort)) {
      Write-Warning "The recorded PID $processId is not the matching STEP 02 Vite process. It was not stopped."
      return
    }

    Stop-Process -Id $process.Id -Force
    Remove-Item -LiteralPath $PidPath -Force
    Write-Host "Stopped recorded STEP 02 review server PID $processId."
  } catch {
    Write-Warning "Could not stop the recorded review server: $($_.Exception.Message)"
  }
}

$scriptDirectory = Split-Path -Parent $PSCommandPath
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDirectory "..\..")).Path
$defaultOutputRoot = Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-02"
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = $defaultOutputRoot
}
$OutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)

$fileName = "STEP-02_PARENT_REVIEW_FEEDBACK.json"
$downloadFeedback = Join-Path $env:USERPROFILE "Downloads\$fileName"
$inboxFeedback = Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-02\review\inbox\$fileName"

if (-not [string]::IsNullOrWhiteSpace($FeedbackPath)) {
  $FeedbackPath = [System.IO.Path]::GetFullPath($FeedbackPath)
  if (-not (Test-Path -LiteralPath $FeedbackPath -PathType Leaf)) {
    throw "FeedbackPath was not found: $FeedbackPath"
  }
} else {
  $FeedbackPath = @($downloadFeedback, $inboxFeedback) |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Select-Object -First 1
  if (-not $FeedbackPath) {
    throw "Feedback JSON was not found. Checked: $downloadFeedback and $inboxFeedback"
  }
}

$reviewDirectory = Join-Path $OutputRoot "review"
New-Item -ItemType Directory -Path $reviewDirectory -Force | Out-Null
$fixedFeedbackPath = Join-Path $reviewDirectory $fileName
Copy-Item -LiteralPath $FeedbackPath -Destination $fixedFeedbackPath -Force

$validationErrors = New-Object System.Collections.Generic.List[string]
$feedback = $null
$expectedIdentity = $null
try {
  $feedback = Get-Content -LiteralPath $fixedFeedbackPath -Raw | ConvertFrom-Json
} catch {
  $validationErrors.Add("Feedback JSON could not be parsed: $($_.Exception.Message)")
}
try {
  $expectedIdentityPath = Join-Path $repositoryRoot "apps\hanzi-v2-step02-review\review-identity.json"
  $expectedIdentity = Get-Content -LiteralPath $expectedIdentityPath -Raw | ConvertFrom-Json
} catch {
  $validationErrors.Add("Current review identity could not be loaded: $($_.Exception.Message)")
}

if ($null -ne $feedback) {
  $schemaVersion = Get-NestedValue -Object $feedback -Path @("schemaVersion")
  if ([string]$schemaVersion -ne "1") {
    $validationErrors.Add("schemaVersion must equal 1.")
  }

  $initiativeId = Get-NestedValue -Object $feedback -Path @("initiativeId")
  if ([string]$initiativeId -ne "hanzi-radical-battle-v2") {
    $validationErrors.Add("initiativeId must equal hanzi-radical-battle-v2.")
  }

  $round = Get-NestedValue -Object $feedback -Path @("round")
  $roundNumber = 0
  if (-not [int]::TryParse([string]$round, [ref]$roundNumber) -or $roundNumber -lt 1) {
    $validationErrors.Add("round must be an integer greater than or equal to 1.")
  }

  $pilotIdentity = Get-NestedValue -Object $feedback -Path @("pilotIdentity")
  foreach ($field in @("anchorCharacterId", "scenarioId", "candidateManifestVersion", "selectedTheme")) {
    if (-not (Test-RequiredText (Get-ObjectValue -Object $pilotIdentity -PropertyName $field))) {
      $validationErrors.Add("pilotIdentity.$field is required.")
    }
  }
  if ($null -ne $expectedIdentity) {
    foreach ($field in @("anchorCharacterId", "scenarioId", "candidateManifestVersion")) {
      $actualValue = [string](Get-ObjectValue -Object $pilotIdentity -PropertyName $field)
      $expectedValue = [string](Get-ObjectValue -Object $expectedIdentity -PropertyName $field)
      if ($actualValue -cne $expectedValue) {
        $validationErrors.Add("pilotIdentity.$field must match current identity '$expectedValue'.")
      }
    }
  }

  $corePilotDecision = Get-NestedValue -Object $feedback -Path @("decisions", "corePilot", "decision")
  if ([string]$corePilotDecision -notin @("ACCEPT", "REVISE", "REJECT")) {
    $validationErrors.Add("decisions.corePilot.decision must be ACCEPT, REVISE, or REJECT.")
  }

  $visualSelection = Get-NestedValue -Object $feedback -Path @("decisions", "visualDirection", "selection")
  if ([string]$visualSelection -notin @("A", "B", "C", "MIX", "REDO")) {
    $validationErrors.Add("decisions.visualDirection.selection must be A, B, C, MIX, or REDO.")
  }
  $identityTheme = [string](Get-ObjectValue -Object $pilotIdentity -PropertyName "selectedTheme")
  if ($null -ne $expectedIdentity -and $identityTheme -notin @($expectedIdentity.allowedThemeSelections)) {
    $validationErrors.Add("pilotIdentity.selectedTheme must be one of the current allowed review selections.")
  }
  if ($identityTheme -cne [string]$visualSelection) {
    $validationErrors.Add("pilotIdentity.selectedTheme must equal decisions.visualDirection.selection.")
  }

  $characters = @(Get-NestedValue -Object $feedback -Path @("decisions", "characters"))
  if ($characters.Count -ne 15) {
    $validationErrors.Add("decisions.characters must contain exactly 15 decisions.")
  }
  for ($index = 0; $index -lt $characters.Count; $index += 1) {
    $character = $characters[$index]
    foreach ($field in @("itemId", "revisionHash")) {
      if (-not (Test-RequiredText (Get-ObjectValue -Object $character -PropertyName $field))) {
        $validationErrors.Add("decisions.characters[$index].$field is required.")
      }
    }
    $decision = Get-ObjectValue -Object $character -PropertyName "decision"
    if ([string]$decision -notin @("ACCEPT", "ACCEPT_WITH_EDIT", "REJECT")) {
      $validationErrors.Add("decisions.characters[$index].decision must be ACCEPT, ACCEPT_WITH_EDIT, or REJECT.")
    }
  }
  if ($null -ne $expectedIdentity) {
    $expectedCharacterIds = @($expectedIdentity.characters | ForEach-Object { [string]$_.itemId } | Sort-Object)
    $actualCharacterIds = @($characters | ForEach-Object { [string](Get-ObjectValue -Object $_ -PropertyName "itemId") } | Sort-Object)
    if (@($actualCharacterIds | Select-Object -Unique).Count -ne $actualCharacterIds.Count) {
      $validationErrors.Add("decisions.characters itemId values must be unique.")
    }
    if (@(Compare-Object -ReferenceObject $expectedCharacterIds -DifferenceObject $actualCharacterIds -CaseSensitive).Count -gt 0) {
      $validationErrors.Add("decisions.characters itemId set must exactly match the current 15-character identity.")
    }
    foreach ($expectedCharacter in @($expectedIdentity.characters)) {
      $matches = @($characters | Where-Object { [string](Get-ObjectValue -Object $_ -PropertyName "itemId") -ceq [string]$expectedCharacter.itemId })
      if ($matches.Count -eq 1 -and [string](Get-ObjectValue -Object $matches[0] -PropertyName "revisionHash") -cne [string]$expectedCharacter.revisionHash) {
        $validationErrors.Add("Character '$($expectedCharacter.itemId)' revisionHash must match current identity '$($expectedCharacter.revisionHash)'.")
      }
    }
  }

  $storyboard = @(Get-NestedValue -Object $feedback -Path @("decisions", "storyboard"))
  if ($storyboard.Count -ne 7) {
    $validationErrors.Add("decisions.storyboard must contain exactly 7 decisions.")
  }
  for ($index = 0; $index -lt $storyboard.Count; $index += 1) {
    $storyboardItem = $storyboard[$index]
    foreach ($field in @("itemId", "revisionHash")) {
      if (-not (Test-RequiredText (Get-ObjectValue -Object $storyboardItem -PropertyName $field))) {
        $validationErrors.Add("decisions.storyboard[$index].$field is required.")
      }
    }
    $decision = Get-ObjectValue -Object $storyboardItem -PropertyName "decision"
    if ([string]$decision -notin @("ACCEPT", "REVISE", "REJECT")) {
      $validationErrors.Add("decisions.storyboard[$index].decision must be ACCEPT, REVISE, or REJECT.")
    }
  }
  if ($null -ne $expectedIdentity) {
    $expectedStoryboardIds = @($expectedIdentity.storyboard | ForEach-Object { [string]$_.itemId } | Sort-Object)
    $actualStoryboardIds = @($storyboard | ForEach-Object { [string](Get-ObjectValue -Object $_ -PropertyName "itemId") } | Sort-Object)
    if (@($actualStoryboardIds | Select-Object -Unique).Count -ne $actualStoryboardIds.Count) {
      $validationErrors.Add("decisions.storyboard itemId values must be unique.")
    }
    if (@(Compare-Object -ReferenceObject $expectedStoryboardIds -DifferenceObject $actualStoryboardIds -CaseSensitive).Count -gt 0) {
      $validationErrors.Add("decisions.storyboard itemId set must exactly match the current seven-beat identity.")
    }
    foreach ($expectedBeat in @($expectedIdentity.storyboard)) {
      $matches = @($storyboard | Where-Object { [string](Get-ObjectValue -Object $_ -PropertyName "itemId") -ceq [string]$expectedBeat.itemId })
      if ($matches.Count -eq 1 -and [string](Get-ObjectValue -Object $matches[0] -PropertyName "revisionHash") -cne [string]$expectedBeat.revisionHash) {
        $validationErrors.Add("Storyboard '$($expectedBeat.itemId)' revisionHash must match current identity '$($expectedBeat.revisionHash)'.")
      }
    }
  }

  $authorizeStep03 = Get-NestedValue -Object $feedback -Path @("decisions", "authorizeStep03")
  if ([string]$authorizeStep03 -notin @("YES", "NO", "NOT_YET")) {
    $validationErrors.Add("decisions.authorizeStep03 must be YES, NO, or NOT_YET.")
  }

  $technicalState = Get-NestedValue -Object $feedback -Path @("reviewMeta", "technicalState")
  if ([string]$technicalState -ne "CORE_SPELL_PILOT_READY_FOR_PARENT_REVIEW") {
    $validationErrors.Add("reviewMeta.technicalState must equal CORE_SPELL_PILOT_READY_FOR_PARENT_REVIEW.")
  }
}

$pilotIdentity = Get-NestedValue -Object $feedback -Path @("pilotIdentity")
$identityArtifact = [ordered]@{
  schemaVersion = Get-NestedValue -Object $feedback -Path @("schemaVersion")
  initiativeId = Get-NestedValue -Object $feedback -Path @("initiativeId")
  round = Get-NestedValue -Object $feedback -Path @("round")
  anchorCharacterId = Get-ObjectValue -Object $pilotIdentity -PropertyName "anchorCharacterId"
  scenarioId = Get-ObjectValue -Object $pilotIdentity -PropertyName "scenarioId"
  candidateManifestVersion = Get-ObjectValue -Object $pilotIdentity -PropertyName "candidateManifestVersion"
  selectedTheme = Get-ObjectValue -Object $pilotIdentity -PropertyName "selectedTheme"
}
Write-Utf8NoBom -Path (Join-Path $OutputRoot "pilot-identity.json") -Contents ($identityArtifact | ConvertTo-Json -Depth 4)

$visualSelection = Get-NestedValue -Object $feedback -Path @("decisions", "visualDirection", "selection")
$selectedTheme = Get-ObjectValue -Object $pilotIdentity -PropertyName "selectedTheme"
Write-Utf8NoBom -Path (Join-Path $OutputRoot "selected-theme.txt") -Contents @"
Review selection: $visualSelection
Pilot identity selectedTheme: $selectedTheme
"@

$candidateSource = Join-Path $repositoryRoot "games\hanzi-radical-battle\v2\content\candidate-characters.ts"
$candidateOutput = Join-Path $OutputRoot "candidate-manifest.ts"
if (Test-Path -LiteralPath $candidateSource -PathType Leaf) {
  Copy-Item -LiteralPath $candidateSource -Destination $candidateOutput -Force
} else {
  Write-Utf8NoBom -Path $candidateOutput -Contents "// Candidate manifest source was not present when this review package was created.`n"
}

$currentIdentityOutput = Join-Path $OutputRoot "current-review-identity.json"
if (Test-Path -LiteralPath $expectedIdentityPath -PathType Leaf) {
  Copy-Item -LiteralPath $expectedIdentityPath -Destination $currentIdentityOutput -Force
} else {
  Write-Utf8NoBom -Path $currentIdentityOutput -Contents "{}"
}

$screenshotIndexOutput = Join-Path $OutputRoot "screenshot-index.md"
$screenshotCandidates = @(
  (Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-02\STEP-02-SCREENSHOT-INDEX.md"),
  (Join-Path $repositoryRoot "docs\hanzi-radical-battle-v2\step-02\STEP-02-SCREENSHOT-INDEX.md"),
  (Join-Path $repositoryRoot "artifacts\hanzi-radical-battle-v2\step-02\screenshots\SCREENSHOT-INDEX.md")
)
$screenshotSource = $screenshotCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if ($screenshotSource) {
  Copy-Item -LiteralPath $screenshotSource -Destination $screenshotIndexOutput -Force
} else {
  Write-Utf8NoBom -Path $screenshotIndexOutput -Contents "# Screenshot index`n`nNo screenshot index was present when this review package was created.`n"
}

$commitSha = "UNKNOWN"
$gitCommand = Get-Command git -ErrorAction SilentlyContinue
if ($gitCommand) {
  try {
    $commitSha = (& $gitCommand.Source -C $repositoryRoot rev-parse HEAD 2>$null | Select-Object -First 1).Trim()
  } catch {
    $commitSha = "UNKNOWN"
  }
}
Write-Utf8NoBom -Path (Join-Path $OutputRoot "commit-sha.txt") -Contents "$commitSha`n"

$summaryLines = @(
  "# STEP 02 parent review summary",
  "",
  "- Feedback source: $FeedbackPath",
  "- Fixed feedback copy: $fixedFeedbackPath",
  "- Validation result: $(if ($validationErrors.Count -eq 0) { "VALID" } else { "INVALID_OR_INCOMPLETE" })",
  "- Commit SHA: $commitSha",
  ""
)
if ($validationErrors.Count -eq 0) {
  $summaryLines += "All required review decisions were present and valid."
} else {
  $summaryLines += "## Missing or invalid required decisions"
  $summaryLines += ""
  foreach ($validationError in $validationErrors) {
    $summaryLines += "- $validationError"
  }
}
Write-Utf8NoBom -Path (Join-Path $OutputRoot "review-summary.md") -Contents (($summaryLines -join "`n") + "`n")

$zipPath = Join-Path $OutputRoot "STEP-02_PARENT_REVIEW_RETURN_TO_CHATGPT.zip"
$archiveInputs = @(
  $fixedFeedbackPath,
  (Join-Path $OutputRoot "review-summary.md"),
  (Join-Path $OutputRoot "pilot-identity.json"),
  (Join-Path $OutputRoot "selected-theme.txt"),
  $candidateOutput,
  $currentIdentityOutput,
  $screenshotIndexOutput,
  (Join-Path $OutputRoot "commit-sha.txt")
)
Compress-Archive -Path $archiveInputs -DestinationPath $zipPath -Force
$zipHash = Get-Sha256 -Path $zipPath

if ($validationErrors.Count -eq 0) {
  Write-Host "All required decisions are valid."
} else {
  Write-Warning "The feedback was copied and packaged, but required decisions are missing or invalid:"
  foreach ($validationError in $validationErrors) {
    Write-Warning "- $validationError"
  }
}

if ($KeepServer -or $NoStopServer) {
  Write-Host "Keeping the recorded STEP 02 review server running."
} else {
  Stop-RecordedReviewServer -PidPath (Join-Path $repositoryRoot "tmp\hanzi-v2-step02\review-server.json") -RepositoryRoot $repositoryRoot
}

Write-Host "Review package: $zipPath"
Write-Host "SHA-256: $zipHash"
