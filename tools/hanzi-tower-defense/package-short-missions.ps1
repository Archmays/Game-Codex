$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$stage = Join-Path $repositoryRoot 'tmp\tasks\SHORT-MISSIONS\package-stage'
$returnDirectory = Join-Path $repositoryRoot 'handoffs\hanzi-short-missions'
if (Test-Path -LiteralPath $stage) { throw 'Package staging already exists; preserve it until explicit task cleanup.' }
New-Item -ItemType Directory -Path $stage,$returnDirectory -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'dist') -Destination (Join-Path $stage 'runtime') -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'local-package-server.cjs'),(Join-Path $PSScriptRoot 'start-short-missions.ps1') -Destination $stage
$launcher = "@echo off`r`npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File `"%~dp0start-short-missions.ps1`"`r`nif errorlevel 1 pause`r`n"
[IO.File]::WriteAllText((Join-Path $stage 'START_SHORT_MISSIONS.cmd'),$launcher,[Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'docs\hanzi-tower-defense\short-missions-report.md') -Destination (Join-Path $stage 'REPORT.md')
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'games\hanzi-tower-defense\README.md') -Destination (Join-Path $stage 'README.md')
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'tmp\tasks\SHORT-MISSIONS\evidence') -Destination (Join-Path $stage 'evidence') -Recurse
$packageReadme = @'
# 字阵守城 · 三个短局原型

解压后双击 START_SHORT_MISSIONS.cmd。需要已有 Node.js，不需安装依赖，不联网下载。
本包在本机 127.0.0.1:5175 提供静态游戏；沿用相同浏览器与来源可读取已有本地存档。
如果 5175 已运行 Game-Codex，请使用项目原启动器；本包不会抢占端口或修改那个进程。

- 少塔精兵：http://127.0.0.1:5175/?play=hanzi-tower-defense&scenario=qinglan-elite
- 接手残局：http://127.0.0.1:5175/?play=hanzi-tower-defense&scenario=qinglan-repair
- 带着行囊出发：http://127.0.0.1:5175/?play=hanzi-tower-defense&scenario=qinglan-packs

也可点击游戏顶部“战术短局”选择。本包保留现有游戏世界以便返回，其他游戏未改动。
不要双击 runtime/index.html；模块与存档来源需要本地 HTTP。
REPORT.md 记录玩法、策略、检查和边界。evidence 为合成工具证据，不包含真人观察。
'@
[IO.File]::WriteAllText((Join-Path $stage '打开说明.md'),$packageReadme,[Text.UTF8Encoding]::new($false))
$manifest = Get-ChildItem -LiteralPath $stage -File -Recurse | Sort-Object FullName | ForEach-Object { [PSCustomObject]@{path=$_.FullName.Substring($stage.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant();bytes=$_.Length} }
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $stage 'PACKAGE_MANIFEST.json') -Encoding utf8
$zipPath = Join-Path $returnDirectory 'SHORT_MISSIONS_LOCAL.zip'
if (Test-Path -LiteralPath $zipPath) { throw 'Return ZIP already exists; preserve its bytes.' }
Compress-Archive -LiteralPath (Get-ChildItem -LiteralPath $stage).FullName -DestinationPath $zipPath -CompressionLevel Optimal
$hash=(Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText(($zipPath+'.sha256'),($hash+'  SHORT_MISSIONS_LOCAL.zip'),[Text.UTF8Encoding]::new($false))
Write-Output "Package: $zipPath"
Write-Output "SHA256: $hash"
