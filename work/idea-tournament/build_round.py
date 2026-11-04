import pathlib,json,csv,sys
w=pathlib.Path(__file__).parent
def read_tsv(name): return list(csv.DictReader((w/name).open(encoding='utf-8'),delimiter='\t'))
codex=read_tsv('codex50.tsv'); claude=json.loads((w/'claude50.json').read_text(encoding='utf-8'))['ideas']
allideas={x['id']:x for x in codex+claude}
(w/'all100.json').write_text(json.dumps(allideas,ensure_ascii=False,indent=2),encoding='utf-8')
round_name=sys.argv[1]
votes=read_tsv(round_name+'-codex.tsv')
if round_name=='r1': pairs=[{'match':f'R1-{i:02d}','a':f'C{i:02d}','b':f'L{i:02d}'} for i in range(1,51)]
else: pairs=json.loads((w/(round_name+'-pairs.json')).read_text(encoding='utf-8'))
payload=[]
for p,v in zip(pairs,votes):
 assert p['match']==v['match'] and v['winner'] in [p['a'],p['b']]
 payload.append({'match':p['match'],'a':allideas[p['a']],'b':allideas[p['b']],'codex':v})
prompt='''실제 Claude Opus5.5와 Codex의 사용자 요청 토너먼트. 도구/파일수정 없음. 아래 각 1:1 대결에서 Codex 선호에 동의하거나 반론하라. 기계적으로 동의/반대하지 말 것. 기준: 한국 일반 차주의 일상 반복 불편, 기존 도구조합 대비 구체적 우위, Gleo 공존(앱 소유 상태/처리), 유기적 기능 결합, 실현가능성과 입력 부담. 이전 J1/80점 보호 없음. 모든 기능/수요는 제안이며 경쟁 부재/실측효과로 보지 말 것. Gleo를 임의 데이터 버스로 간주 금지: 앱의 Gleo action은 등록/승인 필요, 문자/ETA/운행 이벤트 자동전달은 미확인, 외부 폰앱은 비용으로 반영. 더 나쁜 두 안도 상대적으로 하나를 고르되 검증됐다고 하지 마라. 서로 비슷한 안은 어떤 상태/흐름 차이가 선택을 가르는지 설명.
JSON만: {"matches":[{"match":"...","winner":"Cxx 또는 Lxx","stance":"agree 또는 challenge","reason":"상대보다 낫다는 구체 이유/반론 1~2문장","condition":"우위 성립의 가장 큰 미확인 또는 반례"},...]}. 모든 경기 정확히 포함. Codex와 의견 다르면 challenge로 표시. 새 후보/합체를 승자로 추가 금지.
'''+json.dumps(payload,ensure_ascii=False)
if round_name!='r1':
 prompt+='\nCodex가 추가 확인한 공식 경쟁 근거(실행 검증 아님):\n'+(w/'evidence.json').read_text(encoding='utf-8')
 prompt+='\n이전 라운드의 승복을 서로 전달한다. Codex는 R1 06/19/21/49에서 Claude 선택을 수용했다. 다만 한국 사용자 빈도/보편성/반품 비율/자동할인 추세 등 원출처 없는 서술은 판단 근거로 확정하지 않는다. Samsung 승하차 리마인더가 있으므로 다음 시동 경계의 독점성을 주장하지 말 것. 데이터와 외부앱 참여 부담을 공정히 비교하라.'
(w/(round_name+'-input.txt')).write_text(prompt,encoding='utf-8')
refine=w/'refinements.json'
if refine.exists():
 prompt+='\n합의된 후보 구체화(동일 핵심, 새 합체 후보 아님):\n'+refine.read_text(encoding='utf-8')
 (w/(round_name+'-input.txt')).write_text(prompt,encoding='utf-8')
print(round_name,len(payload))
