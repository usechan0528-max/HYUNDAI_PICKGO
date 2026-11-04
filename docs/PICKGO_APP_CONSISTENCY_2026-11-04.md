# PICKGO 앱 화면 일관성 · 2026-11-04

사용자 요청: 앱 디자인 스킬로 전체 일관성 개선. main의 기존 미커밋 변경 보존. design-taste-frontend의 app-screen 절차 적용.

## 범위와 디자인
- 지도 담당 채팅 01a1a688의 완료·소유 반환 확인. 메인/지도는 그 작업의 결과를 유지하며 이 채팅은 보조 화면 6파일만 수정.
- phone.html/css, proximity-page.html/css, recommendation/page.html/css. style.css를 공유하고 phone.css에 보조 화면 공통 셸 배치. 서버/API/도메인/클라이언트 JS 변경 없음.
- True-black flat, seed 1921626902, redraw 없음. 기존 브랜드를 보존하여 Asta, #121212 바탕, #202020 패널, #363636 컨트롤, 2px 모서리를 적용. 차량 시연의 큰 터치 영역을 유지하므로 스킬의 36px pill 대신 64px 보조 컨트롤과 52px 복귀 링크 사용.
- 각 화면의 질문: 위치 공유는 무엇에 동의하고 현재 공유 중인가? 근접 확인은 실제/합성 중 어떤 근거이고 현재 상태는 무엇인가? 추천은 어떤 후보를 상대에게 제안할 것인가?
- PICKGO 이름과 복귀 링크를 상단에 통일. 제목 데스크톱30/모바일24px, 본문18/보조16px, 동일 간격·포커스·비활성 표시.
- 픽업 고유 요소는 회차·확정 장소·공유/근접 상태와 상대 합의 후보. 사진/새 차트/가짜 수치 추가 없음. 기존 합성 좌표·경로·후보 근거는 실데이터로 교체하기 전까지 시연 표시 유지.
- 메인/지도 별도 결과는 PICKGO_MAP_DESIGN_2026-11-04.md 참조. 두 작업의 파일 소유 충돌 없음.

## 검증
- node --test "experiments/pickup-board/*.test.mjs": 최종226/226 통과, 종료0. 기존 다른 담당 작업도 포함한 현 작업트리 회귀 집합.
- 디자인 lint 6파일: 0 FAIL / 0 WARN.
- inspect.mjs --app: 실제 서버 원본 HTML/CSS를 Chrome 1440/768/390px에서 검증. 빌드 단계 없음. 모든 화면 0 FAIL. proximity/recommendation 0 WARN, phone 1 WARN.
- phone 경고는 회차 미참여 상태의 데스크톱 하단 여백(hero-void). 참여 전 동의 폼을 표시하지 않는 실제 빈 상태로 유지. 폼을 늘리거나 허위 정보로 여백을 채우지 않음.
- font-not-dealt 허용: 기존 브랜드 Asta 유지, 해당 폰트 실제 로드 확인. 다른 검사 숨김 없음.
- 전후: phone 제목32→30/24px 및 밝은바탕→공통 어두운바탕; proximity 32→30/24px 및 공통 헤더; recommendation 48→30/24px, 자간 큰 영문 레이블 제거, 낮은 불투명도 disabled→불투명 가독성 유지.
- work/pickgo-consistency/verify.mjs: 별도 loopback 합성 추천 서버 + 실제 Chrome. 각1440×900/768×1024/390×844에서 참여 후 위치 동의 거절·공유 중지·근처/먼곳/권한거부 시연·추천3후보·제안/철회·메인복귀·가로넘침없음 확인. 최종primary 포커스색과 빈 live region display 유지 assertion 통과. 실제 위치 수집 요청은 하지 않음.
- 초기 근처 시연 캡처가 두 번째 관측 전 상태를 읽었으므로 관측 완료 대기를 추가하고 재검증. 최종 browser.json은 근처 판정 확인 결과.
- 최종 inspect의 모든 fold/page 스크린샷을 접촉 시트로 열어 확인. 참여 동의와 후보가 있는 긴 화면도 별도 캡처 확인.

## 시각 검수
1. 화면의 질문: 위치 상태·회차·합성 여부가 제목 아래에 드러남. 추천 후보는 동의 설명 이후에 위치하며 긴 개인정보 고지를 보존함.
2. 정렬: 동일 양옆 여백, 같은 패널 패딩. 근접 카드 높이 불일치를 하나의 회차 패널 안에 차량 출처 행으로 통합하여 해결.
3. 색상: 중립 바탕과 단계별 패널, 흰 주 버튼. 의미 있는 오류에만 기존 amber 유지. 브랜드 이름 세 화면 모두 노출.
4. 숫자: 새 숫자 없음. 후보 시간/거리/만료값은 기존 JS 단일 데이터로 렌더링, 상태 수치는 tabular 적용.
5. 빈 상태: 회차/현재 위치 미확인 고지 유지. 부풀린 수치/임의 성공 상태 없음.
6. 범례: 새 차트/범례 없음. 실제 SDK 미연결과 합성 시연을 텍스트로 구분.
7. 모바일: 동일 헤더와 24px 제목, 후보1099px 이하 단일열, 줄바꿈·스크롤 가능. 기존 장문 동의가 길어지는 한계는 남음.
최종 판정: 화면 간 시각 일관성 개선. 실제 차량 UX 인증 또는 접근성 완전 준수 인증 아님.

## Claude 독립 검수와 처리
실제 claude-haiku-5-5, session 1af58bdb-5200-4f89-8f72-19d531d8a121, exit0/is_error=false. 고정 스냅샷+해당 diff+CSS/JS 주변 코드 전달, 도구/파일 변경 금지. raw는 여러 JSON 레코드로 반환되어 최초 단일JSON 파싱 실패, 줄단위 result를 추출하여 실제 응답 확인.
- P1 빈 live region display:none: 두 규칙 제거, 접근성 트리에 유지. computed display 재검증. 실제 NVDA/VoiceOver 발화는 미실행.
- P1 밝은 primary 안쪽 흰 포커스: scoped dark outline 추가. 실제 Chrome focus-visible computed color #161616 확인.
- P2 기존 동의-컨트롤 연결: consentTitle/consentPurpose와 aria-labelledby/aria-describedby 추가, context로 비활성 사유 연결.
- P2 미사용 support-grid와 오래된 산식: 제거/현재1100px 단일 본문 산식으로 정정.
- P2 후보 pressed 보조문구 대비: active 상태 본문색으로 교체.
- P2 secondary 경계 대비: #767676으로 보강.
- P2 900~1000px 후보3열 밀도: 1099px 이하1열로 전환.
- 복귀 문구 변경은 요청된 앱 일관성의 의도적 변경. 실제 링크 목적지는 / 그대로 유지.
Claude 최초 요약은 P2 4개라고 적었으나 본문은 5개였으며 본문 전부 처리. 후속 수정은 Codex 재검증이며 Claude 재검수로 주장하지 않음.

## 남은 범위와 증거
실기기/실차/실제 차량 SDK/화면낭독기 발화 미실행. 공개·push 없음. Dot 새 조사 과제 없음: 공식API·심사 기준 변경 없는 시각 수정이며 DOT-R010 종료 유지.
증거: docs/evidence/pickgo-consistency-2026-11-04/. 실행 스크립트는 work/pickgo-consistency에서 실행(증거 사본의 상대 import 경로는 실행용 아님). 스타일 방향 sheet와 기존 미커밋 기준 스냅샷은 work/pickgo-consistency/에 보존.
