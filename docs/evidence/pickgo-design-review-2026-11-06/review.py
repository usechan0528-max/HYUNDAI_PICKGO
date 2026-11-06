from pathlib import Path
import subprocess,json,hashlib,difflib
out=Path('docs/evidence/pickgo-design-review-2026-11-06');root=Path('experiments/pickup-board')
report=Path('docs/PICKGO_DESIGN_REVIEW_2026-11-06.md');diff=''
for p in sorted((out/'before-fix').rglob('*.mjs')):
 rel=p.relative_to(out/'before-fix');diff+=''.join(difflib.unified_diff(p.read_text(encoding='utf-8').splitlines(True),(root/rel).read_text(encoding='utf-8').splitlines(True),fromfile='before/'+str(rel),tofile='after/'+str(rel)))
diff+='\nNEW place-label.mjs\n'+(root/'place-label.mjs').read_text(encoding='utf-8');(out/'fix.diff').write_text(diff,encoding='utf-8')
prompt='''읽기 전용 독립 검수. 파일 수정/도구 호출 금지. 지정 Haiku5.5. 사용자 승인: 원본22스크린샷/126초영상에서 디자인 보고서 작성, 후속 좌표 노출 표시만 수정. 원본은 보존. 아래 고정 보고서와 이번 diff만 검토. Codex는 실제 이미지23개와 영상35프레임 직접 시각검토. 당신에게는 이미지 자체를 전달하지 않았으므로 시각검수 완료 주장 금지. 실제 Chrome 운전자/탑승자/변경제안/수락/위치 화면 검증 PASS, canonical place/mapPoint 보존. 웹259시험 최종PASS, 초기40실패는VM import harness 보완후해소. 주요질문: 1) 표시 수정이 좌표/권한/상태규칙 훼손 또는 노출 누락? 2) 보고서 관찰/추론/촬영효과 구분 및 심각도 과장? 3) 수용조건 누락? 2000자이내 근거/최소수정/불확실성. 광범위재구현 불필요.\n'''+report.read_text(encoding='utf-8')+'\nFIXED DIFF\n'+diff
(out/'review-input.txt').write_text(prompt,encoding='utf-8');(out/'review-manifest.json').write_text(json.dumps({'input_sha256':hashlib.sha256(prompt.encode()).hexdigest(),'report_sha256':hashlib.sha256(report.read_bytes()).hexdigest()},indent=2),encoding='utf-8')
exe=r'C:\Users\dldyd\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\claude-code\2.1.317\a33aa5518497\claude.exe'
r=subprocess.run([exe,'--safe-mode','--print','--tools','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--permission-mode','plan','--output-format','json','--model','claude-haiku-5-5'],input=prompt,text=True,encoding='utf-8',capture_output=True,timeout=240)
(out/'review.json').write_text(r.stdout,encoding='utf-8');(out/'review-stderr.txt').write_text(r.stderr,encoding='utf-8');print('exit',r.returncode)
if r.stdout:
 d=json.loads(r.stdout);print(json.dumps({k:d.get(k) for k in ['session_id','is_error','modelUsage','result']},ensure_ascii=True))
