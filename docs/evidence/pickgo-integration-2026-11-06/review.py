from pathlib import Path
import subprocess,json,hashlib
root=Path(__file__).resolve().parents[2]
out=root/'docs/evidence/pickgo-integration-2026-11-06'
prompt='''Read-only independent integration acceptance review. No tools or edits. Korean concise findings. Actual Haiku5.5 required. Scope: current PICKGO local web plus Android WebView/NaviHelper emulator integration. Multi is deliberately NOT connected to navigation. No production/car UX/physical phone claims. No application source changed this session; rebuilt debug APK and restarted 4194 server after detecting it predated latest multi source. Test harness initial failures were non-invoked expression and readiness waits; preserved attempts. Review the fixed harness, actual evidence and native source for unsupported success claims or missed important regression. Report P1/P2 with concrete evidence, distinguish limitations from defects. Do not ask to implement excluded real routing/multi navigation. Acceptance: actual emulator multi basic flow; single OSM search/select, separate headless Chrome rider UI join, explicit native start only once, destination match + ROUTE_GUIDING, retained result after45s / repeated launcher one Activity. 258 web tests pass, RouteGate43 pass, assembleDebug/lintDebug pass (0errors3warnings).\n'''
files=['work/pickgo-integration/verify.mjs','docs/evidence/pickgo-integration-2026-11-06/verify.txt','docs/evidence/pickgo-integration-2026-11-06/summary.json','docs/evidence/pickgo-integration-2026-11-06/runtime.log','experiments/pickgo-navigation/app/src/main/java/org/example/pickgonavigation/NavigationActivity.java','experiments/pickgo-navigation/app/src/main/java/org/example/pickgonavigation/RouteGate.java']
manifest={}
for name in files:
 p=root/name
 if not p.exists():raise RuntimeError('Missing evidence '+name)
 manifest[name]=hashlib.sha256(p.read_bytes()).hexdigest()
 prompt+='\nFILE '+name+'\n'+p.read_text(encoding='utf-8-sig')
(out/'review-input.txt').write_text(prompt,encoding='utf-8')
(out/'review-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
exe=sorted(Path('C:/Users/dldyd/AppData/Local/Claude-Data').glob('*/claude-code/*/*/claude.exe'),key=lambda p:p.stat().st_mtime)[-1]
r=subprocess.run([str(exe),'--safe-mode','--print','--tools','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--permission-mode','plan','--output-format','json','--model','claude-haiku-5-5','--effort','low'],input=prompt,text=True,encoding='utf-8',capture_output=True,timeout=180)
(out/'review.json').write_text(r.stdout,encoding='utf-8');(out/'review.stderr.txt').write_text(r.stderr,encoding='utf-8')
print('exit',r.returncode)
d=json.loads(r.stdout);print(json.dumps({k:d.get(k) for k in ['session_id','is_error','modelUsage','result']},ensure_ascii=False))
