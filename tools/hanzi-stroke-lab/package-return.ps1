[CmdletBinding()]
param([string]$TaskId = 'HANZI-STROKE-LAB')
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$stage = Join-Path $repo "tmp/tasks/$TaskId/offline-stage"
$evidence = Join-Path $repo "tmp/tasks/$TaskId"
if (-not (Test-Path -LiteralPath (Join-Path $stage 'node_modules/vite/bin/vite.js'))) { throw 'Prepare the offline hoisted dependencies in this task stage first; see module SOURCES/README.' }
# Reuse the repository's source/Vite family launcher and ZIP + SHA-256 handoff convention.
# Never delete another task or an existing archive. Task staging remains for manual cleanup.
foreach ($directory in @('apps','games','packages','src','public')) {
  & robocopy (Join-Path $repo $directory) (Join-Path $stage $directory) /E /MT:8 /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Failed to stage $directory" }
}
New-Item -ItemType Directory -Force -Path (Join-Path $stage 'tools'),(Join-Path $stage 'docs') | Out-Null
foreach ($directory in @('my-game-world','hanzi-stroke-lab')) {
  Copy-Item -LiteralPath (Join-Path $repo "tools/$directory") -Destination (Join-Path $stage 'tools') -Recurse -Force
}
foreach ($file in @('index.html','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','vite.config.ts','tsconfig.json','README.md')) {
  Copy-Item -LiteralPath (Join-Path $repo $file) -Destination $stage -Force
}
Copy-Item -LiteralPath (Join-Path $repo 'docs/hanzi-stroke-lab-report.md') -Destination (Join-Path $stage 'docs') -Force
@'
汉字书房 · Game-Codex 本地离线包（Windows x64）

解压后运行 tools\my-game-world\START_MY_GAME_WORLD.cmd。
保持 http://127.0.0.1:5175/，汉字书房入口 ?play=hanzi-stroke-lab。
沿用本机已安装的 Node.js / pnpm；随包包含 Vite、Phaser 和依赖，不需联网安装。
先结束同端口的另一份项目服务，再启动解压的这一份；启动器会拒绝错误目录的服务。
继续使用原浏览器 profile 和固定 origin 即可保留旧游戏进度。
不支持双击 index.html。无 Service Worker；GitHub Pages 首次访问需联网。

字库、识别及许可都在 public/hanzi-stroke-lab。
对应识别源码归档和可替换 JS/WASM 随包保留。
开发重新构建数据需要按 SOURCES.md 取得上游；正常使用不需要外网。
本包包含当前游戏运行源码及资源，不含任何家庭浏览器存档或书写轨迹。
'@ | Set-Content -Encoding utf8 (Join-Path $stage '离线使用说明.txt')
$handoffs=Join-Path $repo 'handoffs'
New-Item -ItemType Directory -Force -Path $handoffs | Out-Null
$zip=Join-Path $handoffs 'HANZI_STROKE_LAB_OFFLINE.zip'
if (Test-Path -LiteralPath $zip) { throw "Archive already exists: $zip" }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage,$zip,[System.IO.Compression.CompressionLevel]::Optimal,$false)
$hash=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  HANZI_STROKE_LAB_OFFLINE.zip" | Set-Content -Encoding ascii "$zip.sha256"
$archive=[System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  $names=@($archive.Entries | ForEach-Object { $_.FullName.Replace('\','/') })
  foreach ($required in @('tools/my-game-world/START_MY_GAME_WORLD.cmd','node_modules/vite/bin/vite.js','public/hanzi-stroke-lab/index.json','public/hanzi-stroke-lab/recognizer/hanzi_lookup_bg.wasm','games/hanzi-stroke-lab/workbench.ts')) {
    if ($names -notcontains $required) { throw "Missing offline entry: $required" }
  }
} finally {$archive.Dispose()}
@{zip=$zip;sha256=$hash;bytes=(Get-Item -LiteralPath $zip).Length;entries=$names.Count} | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $evidence 'offline-package.json')
Write-Output "Created $zip ($hash)"
