import pathlib,json,hashlib
w=pathlib.Path(__file__).parent
report=w.parents[1]/'docs/IDEA_TOURNAMENT_2026-11-02.md'
body=report.read_text(encoding='utf-8')
prompt='''너는 실제 토너먼트 회의 상대 Claude Opus5.5다. 도구/소스수정 없이 최종 기획 결과의 독립 검수. 사용자 지시: 각각50개 독립 생성→양측 납득 토너먼트→최종1개, 기존아이디어 허용하되 명확한 우위 목표·일상반복불편·Gleo공존. 선택 완료와 실측우위 입증을 구분. 아래 고정 보고서/감사/증거로 과장·모순·숨은 가정·부당한 최종선택이 있는지 검토. 중요한 결함을 억지로 승인하지 말고 실제 문제만 제시. 앱 개발 검수가 아닌 기획 최종 심사다. JSON만 {"selection":"C02 또는 변경 필요","verdict":"accept 또는 revise","findings":[{"severity":"high/medium/low","issue":"...","fix":"..."}],"reason":"..."}.'''+'\nREPORT SHA256 '+hashlib.sha256(report.read_bytes()).hexdigest()+'\n'+body
for name in ['audit.json','evidence.json','r7-settled.json']:
 prompt+='\n'+name+'\n'+(w/name).read_text(encoding='utf-8')
(w/'final-review-input.txt').write_text(prompt,encoding='utf-8')
print('fixed report',hashlib.sha256(report.read_bytes()).hexdigest())
