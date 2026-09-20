"""Build handoff from previously verified dist bytes; no install/build during family use."""
import shutil,json,hashlib,zipfile,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];staging=root/'tmp/tasks/oddity-v020/production-final';staging.mkdir(parents=True,exist_ok=True)
shutil.copytree(root/'dist',staging/'web',dirs_exist_ok=True)
freeze=json.loads(subprocess.check_output(['python',str(root/'tools/oddity-puzzles/source-freeze.py')],cwd=root))
(staging/'web/build-identity.json').write_text(json.dumps({'product':'Game-Codex offline hub','oddityVersion':'0.2.0','sourceTree':freeze['sha256']},indent=2)+'\n',encoding='utf8')
(staging/'runtime').mkdir(exist_ok=True);shutil.copy2(shutil.which('node'),staging/'runtime/node.exe')
shutil.copy2(root/'docs/oddity-puzzles/runtime-node-LICENSE',staging/'runtime/LICENSE')
server=(root/'tools/world-in-a-box/serve.mjs').read_text('utf8').replace('世界盒子：http://127.0.0.1:5175/?play=world-in-a-box','游戏大厅：http://127.0.0.1:5175/')
(staging/'serve.mjs').write_text(server,encoding='utf8');shutil.copy2(root/'tools/oddity-puzzles/start-production.ps1',staging/'start-production.ps1')
cmd='@echo off\r\ncd /d "%~dp0"\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-production.ps1" %*\r\nif errorlevel 1 pause\r\n'
for name in ['启动游戏大厅.cmd','START_GAME_HUB.cmd']:(staging/name).write_bytes(cmd.encode('ascii'))
(staging/'停止游戏大厅.cmd').write_bytes(cmd.replace('%*','-Stop').encode('ascii'))
(staging/'开始阅读.txt').write_text('完整解压到任意本地目录，双击“启动游戏大厅.cmd”。\n固定地址 http://127.0.0.1:5175/，奇物事务所入口 ?play=oddity-puzzles。\n保留同一浏览器和同一地址以继续本机存档。所有游戏资源均在web中，无需安装、构建或联网。\n如5175已运行另一份家庭服务，请沿用其入口，或用原服务自己的停止命令关闭，再启动本包；不要同时运行两份。\n结束时运行“停止游戏大厅.cmd”。此命令只停止本包匹配的进程，不清理浏览器存档。\n不能直接双击web/index.html，不声明file://支持。\n无源blend；制作脚本和blend保留在源码仓库。\n设备模拟和机器验证不代表真实儿童体验或学习效果。\n',encoding='utf8')
shutil.copy2(root/'games/oddity-puzzles/README.md',staging/'奇物事务所-规则与资产.md')
if (root/'docs/oddity-puzzles/v020/report.md').exists():shutil.copy2(root/'docs/oddity-puzzles/v020/report.md',staging/'测试与边界.md')
forbidden=[p for p in staging.rglob('*') if p.suffix=='.blend'];assert not forbidden
dest=root/'handoffs/oddity-puzzles-v0.2.0-offline.zip';dest.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(staging.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(staging))
digest=hashlib.sha256(dest.read_bytes()).hexdigest();dest.with_suffix('.zip.sha256').write_text(digest+'  '+dest.name+'\n',encoding='ascii')
print(json.dumps({'zip':str(dest.relative_to(root)),'sha256':digest,'bytes':dest.stat().st_size,'staging':str(staging.relative_to(root)),'source':freeze['sha256']},indent=2))
