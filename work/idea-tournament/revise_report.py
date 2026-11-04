import pathlib,json
w=pathlib.Path(__file__).parent
e=json.loads((w/'evidence.json').read_text(encoding='utf-8'))
new=[('E29','https://kakaomap.tistory.com/449','카카오맵 공식2026-05-26 만날장소: 지점공유·친구 도착/남은거리·길찾기·그룹종료/24시간 만료. 준비 의사·변경 상호수락은 문서에서 미확인'),('E30','https://kakaomap.tistory.com/457','공식2026-08-27 만날 장소 유지, 메뉴를 더보기로 이동'),('E31','https://support.google.com/maps/answer/15437054?co=GENIE.Platform%3DAndroid&hl=en','목적지·ETA·위치 공유, 도착/내비종료로 공유종료. 국내 도로내비 동일지원은 별도 미확인'),('E32','https://www.apple.com/kr/newsroom/2025/03/apple-brings-additional-find-my-capabilities-to-south-korea/','국내 나의찾기 위치공유와 메시지 안전확인 도착알림, 기기/OS 조건 있음')]
e['sources'] += [dict(id=i,url=u,fact=f) for i,u,f in new if i not in {s['id'] for s in e['sources']}]
(w/'evidence.json').write_text(json.dumps(e,ensure_ascii=False,indent=2),encoding='utf-8')
p=w.parents[1]/'docs/IDEA_TOURNAMENT_2026-11-02.md'
t=p.read_text(encoding='utf-8').replace('출처 28건','출처 32건').replace('공식 자료 확인 28건','공식 자료 확인 32건')
t=t.replace('## 실제 진행과 감사','선정에서 크게 작용한 것은 우위가 이미 입증됐다는 판단이 아니라, 결선 중 앱이 소유할 합의 상태가 분명하고 외부 ETA·주행계 의존 없이 우위 가설을 빨리 반증할 수 있다는 점이다. 변경/준비지연 회차가 드물면 일상 반복 불편 기준을 충족하지 못한다.\n\n## 실제 진행과 감사',1)
t=t.replace('독립 생성 1회, 7개 라운드, 추가 반론 1회로 토너먼트에 9회 호출했다. 각 라운드의 여러 경기는 한 호출 안에서 개별 판단했다.','총 9회 호출(독립 생성 1, 라운드 판정 7, 추가 반론 1)로 토너먼트를 수행했다. 라운드당 단일 호출 일괄 판단으로 경기별 심의 깊이에 한계가 있다. 이후 최종 보고서 검수와 추가 근거 재심은 별도다.\n- 후보 생성은 독립했으나 라운드에서는 Claude에게 Codex의 선택과 이유를 전달했다. 맹검 독립 투표가 아닌 상호 검토이며 앵커링 가능성을 배제하지 않는다.')
t=t.replace('| 같은 가족이 쓰는 카카오톡+지도 공유 |','| Gleo 음성 문자·전화 + 상대의 동일 채널 응답 | 음성으로 준비/장소 질문과 답변 | 음성 왕복보다 나은가? Gleo의 카카오톡 지원은 가정하지 않음 |\n| 카카오맵 친구위치 만날 장소 | 지점공유·도착여부·남은거리·길찾기 | 준비 의사와 변경 상호수락이 더 필요한가? |\n| Apple 나의찾기 / Google Maps 공유 | 위치·도착알림 또는 이동 ETA 공유 | 위치·ETA만으로 충분한 회차는 차별가치 대상에서 제외 |\n| 같은 가족이 쓰는 카카오톡+지도 공유 |',1)
t=t.replace('- 동일 사용자 쌍이 기존 방식과 제안 흐름을 교차 사용한다.','- 먼저 기존 픽업 일지로 지점변경/준비지연 비율과 실제 연락·오대기를 측정한다. 모집 전에 반복성 중단 기준을 고정한다. 예비 기준 제안: 주 3회 이상 픽업하는 쌍에게 2주 동안 해당 불편이 2회 미만이면 주력 사용층으로 보지 않는다. 수요 실측이나 전체 인구 기준이 아니며, 해당 대상층 비중도 보고한다.\n- 동일 사용자 쌍이 기존 방식과 제안 흐름을 교차 사용한다. Gleo 음성 문자/전화와 그 차·폰에서 실제 지원되는 공유 기능을 포함한다.',1)
t=t.replace('기준선이 0인 회차는','음성 메시지 왕복과 통화도 연락으로 센다. 기준선이 0인 회차는',1)
t+='''

## 최종 검수 보완과 추가 경쟁 근거

Claude 최종 검수에서 차내 음성 메시징 기준선 누락을 중요 결함으로 지적했고 Codex가 수용했다. Gleo도 이미 음성 연락 부담을 줄이므로 C02의 우위는 음성 사용 자체가 아니다. 남는 가설은 명시 준비 의사와 미수락/확정 지점 합의를 구별하는 회차 상태다. 짧은 음성 답변으로 충분하다면 우위가 없다.

[카카오맵 2026-05-26 공식 안내](https://kakaomap.tistory.com/449)는 만날 장소·도착 여부·남은거리까지 결합한다. [8월 업데이트](https://kakaomap.tistory.com/457)에서도 기능 유지를 확인했다. [Apple 국내 도입 안내](https://www.apple.com/kr/newsroom/2025/03/apple-brings-additional-find-my-capabilities-to-south-korea/)의 위치공유·안전확인 도착알림과 [Google Maps 공유 안내](https://support.google.com/maps/answer/15437054?co=GENIE.Platform%3DAndroid&hl=en)도 비교했다. Google의 한국 도로 내비 지원을 추정하지 않았고, 네이버·T맵의 동등 기능은 이번 추가 조사에서 확정하지 못했다. 위 자료는 픽업 앱의 위치/도착/만날 지점 자체가 새롭지 않다는 강한 반례다.

상대방 데이터 동의, 최소 보관범위·보존기간, 계정 없는 참여 가능성과 인증, 회차 삭제, 자체 서비스 운영비는 다음 설계에서 확인해야 한다. 무가입이 안전하게 가능하거나 무료 운영이 보장된다고 가정하지 않는다. 이 비용까지 감수할 반복 필요가 없으면 중단한다.
'''
p.write_text(t,encoding='utf-8')
prompt='''최종 기획 재심. 소스수정/도구 없음. 이전 최종 검수7개 지적을 반영했고 중요한 새 반례를 발견했다. 카카오맵 공식2026-05-26 만날장소가 이미 지점·도착·남은거리를 결합,8월 기능유지 확인. Codex는 C02가 위치/도착/지점 자체로 차별하지 못함을 수용한다. 남는 준비의사·변경 상호수락의 반복 빈도가 미확인이다. C02는 여전히 C17(개인 도착완료 학습부담), L33(Driversnote와 차량데이터 미확인)보다 앱 소유 상태의 가설을 직접 반증할 수 있어 상대적 최종선택 유지 의견이지만, 검증 쉬움만으로 사용자 가치가 증명되지는 않는다. 이 새 근거로 선택이 뒤집혀야 하면 반론하라. 무조건 승인 금지. JSON {"selection":"C02/C17/L33 또는 재개필요","verdict":"accept/revise","reason":"...","findings":[]}. 결과물은 조사·선정이며 사용자 실험까지 요구한 턴이 아니다. 새 후보를 만들거나 실측성공을 주장하지 말 것. 다음 수정 보고서 전체와 출처를 검토.\n'''+t+'\n'+json.dumps(e,ensure_ascii=False)
(w/'final-followup-input.txt').write_text(prompt,encoding='utf-8')
print('32 sources, revised report, followup prompt')
