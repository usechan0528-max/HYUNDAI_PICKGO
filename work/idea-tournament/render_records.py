import pathlib,json
w=pathlib.Path(__file__).parent
ideas=json.loads((w/'all100.json').read_text(encoding='utf-8'))
def cell(x): return str(x).replace('|',' / ').replace('\n',' ')
lines=['# 독립 제출 100개 원본 목록','', 'Codex 50개와 실제 Claude Opus 5.5 50개. 유사 문제/변형이 포함되며 100개 독창적 시장을 뜻하지 않는다. 원본의 SDK/Gleo 접근 가정은 검증된 기능이 아니다. 후속 반론과 범위 수정은 경기 기록·refinements.json이 우선한다.','']
for prefix,label in [('C','Codex'),('L','Claude')]:
 lines+=['## '+label,'','| ID | 이름 | 반복 불편 | 결합 | 앱이 소유할 상태 | Gleo 역할 제안 | 우위 시험 | 위험 |','|---|---|---|---|---|---|---|---|']
 for key,a in ideas.items():
  if key.startswith(prefix): lines.append('| '+' | '.join(cell(a.get(k,'')) for k in ['id','name','problem','combination','app_owns','gleo','edge_test','risk'])+' |')
 lines+=['']
(w/'catalogue.md').write_text('\n'.join(lines),encoding='utf-8')
lines=['# 토너먼트 99경기 전체 논의','', 'Codex 선호를 먼저 고정하고 실제 Claude 응답을 받은 뒤 반론을 해결했다. 아래 모델의 주장에는 검증하지 않은 수요/빈도/보편성 가정이 포함된다. 공식 근거는 evidence.json, 최종 수용 범위와 한계는 통합 보고서가 우선한다. E12는 Glympse이며 카카오톡 출처가 아니다. 앱의 시동종료/ETA/거리 자동 취득은 미확인이다.','']
for n in range(1,8):
 rows=json.loads((w/f'r{n}-settled.json').read_text(encoding='utf-8'))
 lines+=['## 라운드 '+str(n),'']
 for r in rows:
  lines+=['### '+r['match']+' · '+r['a']+' '+ideas[r['a']]['name']+' vs '+r['b']+' '+ideas[r['b']]['name'],'',f"- Codex 첫 선택: {r['codex_initial']}. {r['codex_reason']}",f"- Claude 선택: {r['claude_choice']}. {r['claude_reason']}",f"- 미확인/반례: {r['condition']}",f"- 합의: {r['codex_response']}",f"- 최종: **{r['winner']} {ideas[r['winner']]['name']}** · 승복: {r['concession']}",'']
 bye=w/f'r{n}-bye.json'
 if bye.exists(): lines+=['부전승: '+', '.join(json.loads(bye.read_text(encoding='utf-8'))),'']
(w/'matches.md').write_text('\n'.join(lines),encoding='utf-8')
print('catalogue.md / matches.md generated')
