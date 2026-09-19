"""Use the repository's sorted file SHA-256 line algorithm on runtime + QA inputs.
Reports/screenshots are outputs and are excluded, avoiding self-referential hashes.
"""
import hashlib, json, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
paths=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode('utf-8').split('\0')
paths=sorted(set(p for p in paths if p and (p.startswith(('apps/','games/','packages/','src/','public/','tools/','tests/')) or p in ['package.json','pnpm-lock.yaml','vite.config.ts','tsconfig.json','docs/input-contract.md']) and (root/p).is_file()))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
lines=[f'{sha(root/p)}  {p}' for p in paths]
print(json.dumps({'algorithm':'sha256(sorted lines: file_sha256 two-spaces repo-relative-path newline)','scope':'all runtime, authored game sources, QA tools/tests, package/build config, input contract; excludes report/screenshot outputs','fileCount':len(paths),'sha256':hashlib.sha256(('\n'.join(lines)+'\n').encode()).hexdigest(),'glbSha256':sha(root/'public/assets/world-in-a-box/window-breeze.glb')},indent=2))
