[CmdletBinding()]
param([switch]$NoBrowser, [switch]$Stop)
$ErrorActionPreference = 'Stop'
$bundle = [IO.Path]::GetFullPath($PSScriptRoot)
$node = Join-Path $bundle 'runtime\node.exe'
$server = Join-Path $bundle 'serve.mjs'
$web = Join-Path $bundle 'web'
$origin = 'http://127.0.0.1:5175'
$listener = Get-NetTCPConnection -State Listen -LocalPort 5175 -ErrorAction SilentlyContinue | Select-Object -First 1
$owned = $null
if ($listener) {
  $details = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
  if ($details.CommandLine -and $details.CommandLine.Contains($server) -and $details.CommandLine.Contains($web) -and $details.ExecutablePath -eq $node) { $owned = $details }
  else { throw 'Port 5175 is in use by another family server. Continue using its existing launcher, or stop that server with its own stop command before starting this package. No process was stopped.' }
}
if ($Stop) {
  if ($owned) { Stop-Process -Id $owned.ProcessId; Write-Host 'Stopped this exact offline package server. Browser saves were not changed.' }
  return
}
if (-not $owned) {
  if (-not (Test-Path -LiteralPath $node -PathType Leaf)) { throw 'The bundled runtime/node.exe is missing. Extract the complete ZIP first.' }
  $process = Start-Process -FilePath $node -ArgumentList @(('"'+$server+'"'),('"'+$web+'"')) -WorkingDirectory $bundle -WindowStyle Hidden -PassThru
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  do {
    try { $response = Invoke-WebRequest "$origin/build-identity.json" -UseBasicParsing; if ($response.StatusCode -eq 200) { break } } catch { Start-Sleep -Milliseconds 150 }
    if ($process.HasExited) { throw 'The local server exited before it became ready.' }
  } while ([DateTime]::UtcNow -lt $deadline)
}
$expected = Get-Content -LiteralPath (Join-Path $web 'build-identity.json') -Raw
$actual = (Invoke-WebRequest "$origin/build-identity.json" -UseBasicParsing).Content
if ($expected.Trim() -ne $actual.Trim()) { throw 'The listening server does not contain this package build. No browser was opened.' }
Write-Host "Game hub: $origin/"
Write-Host 'All resources are local. No installation, build or external service is required.'
if (-not $NoBrowser) { Start-Process "$origin/" }
