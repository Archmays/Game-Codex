param([Parameter(Mandatory=$true)][string]$BlenderPath)
$ErrorActionPreference = 'Stop'
$exe = (Resolve-Path -LiteralPath $BlenderPath).Path
foreach ($scene in @('dresden','frozen')) {
    & $exe --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot "build_$scene.py")
    if ($LASTEXITCODE -ne 0) { throw "Blender export failed: $scene" }
}
