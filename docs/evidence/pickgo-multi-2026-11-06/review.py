from pathlib import Path
import subprocess, json, hashlib
root=Path(__file__).resolve().parents[2]
out=root/'docs/evidence/pickgo-multi-2026-11-06'
files=['board.mjs','planner.mjs','page.mjs','page.html']
prompt='''Read-only independent review, no tools/edits. Korean, <=5 concrete P1/P2 issues. Scope is completing the existing LOCAL multi-pickup demo, not implementing real navigation. Immutable shared stops (cancel/reinvite to change), max6 total participants, explicit synthetic time opt-in; no car UX/real traffic/native navigation claims. Verify per-person authorization, shared-stop boarding/cancellation, stale queued UI actions, reload and offline recovery. 254 automated tests pass today; final browser rerun pending. Prior review fixed stale click snapshots and join storage recovery. Report reproducible remaining defects, not feature wishes. Fixed source snapshot follows.\n'''
manifest={}
for name in files:
 p=root/'experiments/pickup-board/multi'/name
 manifest[name]=hashlib.sha256(p.read_bytes()).hexdigest()
 prompt+='\nFILE '+name+'\n'+p.read_text(encoding='utf-8')
(out/'review-input.txt').write_text(prompt,encoding='utf-8')
(out/'review-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
exe=sorted(Path('C:/Users/dldyd/AppData/Local/Claude-Data').glob('*/claude-code/*/*/claude.exe'),key=lambda p:p.stat().st_mtime)[-1]
try:
 r=subprocess.run([str(exe),'--safe-mode','--print','--tools','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--permission-mode','plan','--output-format','json','--model','claude-haiku-5-5','--effort','low'],input=prompt,text=True,encoding='utf-8',capture_output=True,timeout=180)
 (out/'review.json').write_text(r.stdout,encoding='utf-8');(out/'review.stderr.txt').write_text(r.stderr,encoding='utf-8')
 print('exit',r.returncode)
 d=json.loads(r.stdout);print(json.dumps({k:d.get(k) for k in ['session_id','is_error','modelUsage','result']},ensure_ascii=False))
except subprocess.TimeoutExpired: print('TIMEOUT: independent review not completed')
