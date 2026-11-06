from pathlib import Path
import subprocess,json
root=Path(__file__).resolve().parents[2];out=root/'docs/evidence/pickgo-multi-2026-11-06'
prompt='''Read-only targeted follow-up, no tools/edits, <=500 words Korean. Review only fixes below for new important defects. Prior review session9f63669b-cd1f-403e-b5ae-683ff329f495 found P2s: (1) six-person cap includes cancelled: explicit existing approved policy retained, UI now explains need for new trip at cap, (2) join recovery expired: unrecoverable403/404/409 now clears retry key/disables join/instructs cancel/reinvite, (3) arrived origin updated and planner excludes already travelled origin->active leg, (4) missing/invalid session401/403/404 cleared, setup shown, polling stopped; transient503 preserved. 258 automated tests now pass; real headless Chrome 3riders/2stops/shared boarding, stale cancel, partial/all cancellation, recommendation, reload, offline/reconnect pass. No real route provider/native navigation claim. Check diff for regressions; classify addressed or remaining.\n'''
r=subprocess.run(['git','diff','--','experiments/pickup-board/multi','experiments/pickup-board/multi.test.mjs','experiments/pickup-board/multi-client.test.mjs'],cwd=root,text=True,encoding='utf-8',capture_output=True)
prompt+=r.stdout
(out/'followup-input.txt').write_text(prompt,encoding='utf-8')
exe=sorted(Path('C:/Users/dldyd/AppData/Local/Claude-Data').glob('*/claude-code/*/*/claude.exe'),key=lambda p:p.stat().st_mtime)[-1]
r=subprocess.run([str(exe),'--safe-mode','--print','--tools','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--permission-mode','plan','--output-format','json','--model','claude-haiku-5-5','--effort','low'],input=prompt,text=True,encoding='utf-8',capture_output=True,timeout=180)
(out/'followup.json').write_text(r.stdout,encoding='utf-8');(out/'followup.stderr.txt').write_text(r.stderr,encoding='utf-8');print('exit',r.returncode)
d=json.loads(r.stdout);print(json.dumps({k:d.get(k) for k in ['session_id','is_error','modelUsage','result']},ensure_ascii=False))
