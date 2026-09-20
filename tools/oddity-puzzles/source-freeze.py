"""Repository canonical sorted file SHA line algorithm, with the requested root launcher."""
import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
paths=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode('utf8').split('\0')
paths=sorted(set(p for p in paths if p and (p.startswith(('apps/','games/','packages/','src/','public/','tools/','tests/')) or p in ['package.json','pnpm-lock.yaml','vite.config.ts','tsconfig.json','docs/input-contract.md','启动游戏大厅.cmd']) and (root/p).is_file()))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
lines=[f'{sha(root/p)}  {p}' for p in paths]
print(json.dumps({'algorithm':'sha256(sorted lines: file_sha256 two-spaces repo-relative-path newline)','scope':'runtime, authored models, QA tools/tests, package/build config, input contract, root hub launcher; excludes evidence outputs','fileCount':len(paths),'sha256':hashlib.sha256(('\n'.join(lines)+'\n').encode()).hexdigest(),'charterSha256':sha(root/'docs/oddity-puzzles/v020/charter.md')},indent=2))
