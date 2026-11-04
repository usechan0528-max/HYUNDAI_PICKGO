from pathlib import Path
import subprocess, json, re, collections, hashlib
root=Path(__file__).resolve().parents[2]
out=root/'docs/evidence/pickgo-navi-selection-2026-11-04'
log=(out/'25-receiver-confirmed.log').read_text(encoding='utf-8')
summary={}
for label,start,end in [('first','03:55:36','03:56:06'),('second','04:00:30','04:02:55')]:
 lines=[s for s in log.splitlines() if len(s)>15 and start<=s[6:14]<=end]
 events=collections.Counter(re.findall(r'EVENT (\w+)', '\n'.join(lines)))
 destinations=sorted(set(re.findall(r'onDestinationInfo \[(.*)\]', '\n'.join(lines))))
 summary[label]={'start_guest_time':start,'end_guest_time':end,'events':dict(events),'destinations':destinations,'selected_place_received':any(('AVP' in s or '하나로마트' in s) and 'EVENT' in s for s in lines)}
(out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
files=[root/'docs/PICKGO_NAVI_SELECTION_TEST_2026-11-04.md',*list((root/'experiments/pickgo-navi-selection/app/src/main').rglob('*.java')),root/'experiments/pickgo-navi-selection/app/src/main/AndroidManifest.xml',out/'summary.json']
prompt='Read-only independent Haiku review. No tools or edits. Emulator public SDK experiment only, not production PICKGO. Evaluate whether conclusion is too strong, callback receiver fails, evidence misinterpreted. Report <=3 important issues. Baseline actual navigation UI starts 42dot, two other POIs selected via official SearchPlace screen, destination/waypoint buttons NOT pressed. Existing destination and ROUTE_GUIDING remain; no selected POI event. No full polyline identity assertion allowed. Build exit0, lint0errors4warnings (dependency,backup,static Activity,icon). Static Activity cleared onDestroy, probe intentionally alive during <=10min capture. Review source and fixed evidence below.\n'
for f in files: prompt+='\nFILE '+str(f.relative_to(root))+'\n'+f.read_text(encoding='utf-8')
for name in ['11-poi-selected.xml','23-second-observed.xml','25-receiver-confirmed.xml']:
 prompt+='\nUI '+name+'\n'+(out/name).read_text(encoding='utf-8')
(out/'review-input.txt').write_text(prompt,encoding='utf-8')
exe=r'C:\Users\dldyd\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\claude-code\2.1.308\c17a819afb40\claude.exe'
r=subprocess.run([exe,'--safe-mode','--print','--tools','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--permission-mode','plan','--output-format','json','--model','claude-haiku-5-5'],input=prompt,text=True,encoding='utf-8',capture_output=True,timeout=180)
(out/'review.json').write_text(r.stdout,encoding='utf-8')
(out/'review.stderr.txt').write_text(r.stderr,encoding='utf-8')
print('review_exit',r.returncode)
try:
 d=json.loads(r.stdout); print(json.dumps({k:d.get(k) for k in ['is_error','session_id','modelUsage','result']},ensure_ascii=False))
except Exception: print('Response is not JSON')
