from pathlib import Path
root=Path('experiments/pickup-board');out=Path('docs/evidence/pickgo-design-review-2026-11-06')
for name in ['client.test.mjs','main-selection.test.mjs','phone-page.test.mjs','proximity-page.test.mjs','recommendation-page.test.mjs','web-invite.test.mjs']:
 p=root/name;s=p.read_text(encoding='utf-8');(out/'before-fix'/name).write_bytes(p.read_bytes())
 lines=s.splitlines();idx=next(i for i,l in enumerate(lines) if l.startswith('const source'))
 lines.insert(idx,"const labelSource = (await readFile(new URL('./place-label.mjs', import.meta.url), 'utf8')).replace('export function', 'function');")
 idx+=1;lines[idx]=lines[idx].replace('const source','const rawSource',1)
 path='../' if name=='recommendation-page.test.mjs' else './'
 lines.insert(idx+1,"const source = rawSource.replace(\"import { placeLabel } from '"+path+"place-label.mjs';\", labelSource);")
 p.write_text('\n'.join(lines)+'\n',encoding='utf-8')
