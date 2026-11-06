from pathlib import Path
import json,hashlib
out=Path('docs/evidence/pickgo-integration-2026-11-06');m=json.loads((out/'environment.json').read_text())
paths=list(Path('experiments/pickup-board').rglob('*.mjs'))+list(Path('experiments/pickup-board').rglob('*.html'))+list(Path('experiments/pickup-board').rglob('*.css'))+list(Path('experiments/pickgo-navigation/app/src').rglob('*.java'))
m['sourceSHA256'].update({p.as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in paths})
m['manifestScope']='Captured after acceptance run; no app source edits in this integration session. HEAD alone does not identify the dirty tree.'
(out/'environment.json').write_text(json.dumps(m,indent=2),encoding='utf-8')
