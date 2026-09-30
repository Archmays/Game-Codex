$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Node.js is required. On the project computer use tools\my-game-world\START_MY_GAME_WORLD.cmd.' }
$packageDirectory = $PSScriptRoot
$origin = 'http://127.0.0.1:5175/'
try {
 $existing = Invoke-WebRequest $origin -UseBasicParsing -TimeoutSec 2
 if ($existing.Headers['X-Game-Codex-Package'] -ne 'short-missions') { throw 'Port 5175 is occupied. Use the existing Game-Codex launcher and the three challenge links in README.md.' }
} catch {
 if ($_.Exception.Message -like 'Port 5175*') { throw }
 $serverProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList @('local-package-server.cjs') -WorkingDirectory $packageDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $packageDirectory 'server-output.log') -RedirectStandardError (Join-Path $packageDirectory 'server-error.log') -PassThru
 $ready = $false
 for ($attempt=0; $attempt -lt 40; $attempt++) {
  if ($serverProcess.HasExited) { throw 'The local server stopped. Read server-error.log.' }
  try { $response = Invoke-WebRequest $origin -UseBasicParsing -TimeoutSec 1; if ($response.Headers['X-Game-Codex-Package'] -eq 'short-missions') { $ready=$true;break } } catch {}
  Start-Sleep -Milliseconds 200
 }
 if (-not $ready) { throw 'The local server did not become ready.' }
}
Start-Process ($origin + '?play=hanzi-tower-defense&scenario=qinglan-elite')
