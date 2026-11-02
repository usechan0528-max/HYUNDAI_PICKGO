# C02 픽업 약속판 차량 화면 디자인 · 0.2.0

2026-11-02. 사용자 요청: 이전 작업을 참조하여 Claude와 다시 합작하고 차량 앱 규격 및 현대차 앱 톤에 맞춘다. 기존 C02 기능의 UI 수정이며 새 기능 전환이 아니다. main의 기존 변경을 보존했고 commit/push/checkout은 하지 않았다.

## 방향과 근거

이전 [J1 차량 시안](J1_COCKPIT_DESIGN_2026-11-02.md)의 민트 제거, 중립 검정·차콜·회색·흰색, 로컬 Asta Sans를 계승했다. 준비 상태와 확정 승차지점은 왼쪽, 아직 확정되지 않은 상대 제안과 판단 버튼은 오른쪽에 둔다. 세로 창은 준비→확정→제안 순서로 재구성한다. 종료는 하단 왼쪽에 분리하고 별도 확인 화면을 거친다. 작은 native select를 큰 장소 버튼이 있는 별도 화면으로 교체했다. 가짜 Gleo·음성·지도·ETA·차량 시스템 바는 넣지 않았다.

공식 참고(2026-11-02 웹 확인): [Pleos Display Layout](https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/layout)의 가로·세로 앱 창 대응, [Typography](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/typography)의 Asta Sans/약18px 이상 권고, [Colors](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/colors)의 중립 명도 위계. [현대차 Pleos Connect 소개](https://www.hyundai.com/worldwide/en/newsroom/detail/0000001168)의 화면 분할 맥락도 참고했다. [Android Automotive sizing](https://developers.google.com/cars/design/automotive-os/design-system/sizing)의 최소76dp는 참고 규격이며 **이 웹 앱의 76/88 CSS px가 동일한 물리 크기 또는 차량 인증을 충족한다고 주장하지 않는다.**

큰 화면 버튼88 CSS px, 낮은 가로/480 세로창76 CSS px. 차량 검증창480 이상 본문/보조정보18px 이상,390 보조 모바일에서는 일부16px. 실제 차량 density·시야·주행 UX 제한·실차 시인성 시험은 미실행이다. AstaSans.ttf/OFL.txt는 기존 J1 output의 동일 자산을 복사했고 OFL1.1을 보존했다.

## 실제 Claude 협업

- Opus5.5 설계 세션 `c736cbde-85d8-4ecd-bc95-569aaa0f8b67`: 종료/수락 분리, 큰 장소 선택, 현재 장소와 제안의 분리, 세로 수락/유지 버튼, 1920의 오른쪽 고정폭 제안을 반영했다. 새로고침은 연결 실패 때만 노출하자는 선택 제안 대신 시연 중 명시 동기화를 위해 항상 유지했다.
- Haiku5.5 읽기 전용 검수 세션 `869e0fbd-d201-411b-bc98-d630e6deffd4`: 고정 소스·테스트 증거 전달, 도구·소스 편집 권한 없음. 실제 실행은 Codex가 담당했으며 Claude 응답도 정적 추론임을 명시했다.
- P1 초기 네트워크 실패에서 새 회차 버튼으로 세션을 지울 수 있음: 종료가 확인되거나401/403/404일 때만 새 시작을 표시하도록 수정. 초기 실패·종료 회귀 추가.
- P1 작은창 stale 상세문 숨김: 중복 본문은 숨기되 준비 상태/승차지점/제안 각각에 현재 미확인 라벨을 계속 표시하는 방식을 유지. 실제 서버 중단480 화면에서 라벨·변경 잠금을 검증했다.
- P1 레이아웃 초과 추정: 실제8크기 측정으로 정상 상태를 확인했다. 추가 서버 중단시험에서480 오류문과 버튼 겹침을 발견하여 작은창 간격을 줄였다. 최종 오류 화면에서 마지막 제안 버튼bottom535.09, 하단행top547.70, 오류bottom664, footer top672로 분리됨. scrollHeight720.
- P2 live-region 동일문자 반복 쓰기는 값 변경 때만 갱신하도록 수정. 별도 화면의 키보드 포커스 이동/복귀, 비JSON 오류의 지역화,409 순간 연결실패 표시 등은 후속 개선 항목이다. 운전자/탑승자 모두 종료 가능은 기존 회차 설계이며 변경하지 않았다.

## 실제 검증

`node --test experiments/pickup-board/*.test.mjs`: **17/17 통과**, domain/실제HTTP11 + fake DOM/network6. fake DOM은 CSS/브라우저 인증이 아니다. `node --check` app/server 통과. 런타임 외부 패키지 추가 없음. 서버 API/권한 모델은 유지했고 로컬 폰트2파일의 static allowlist만 추가했다.

실제 IAB 두 역할 생성/참여/준비/큰 장소 선택/상대 제안/수락을 확인했고, 확정지점이 정문→동쪽 입구로 변경됨을 확인했다. 종료 확인→취소는 회차를 유지하고 종료 확정은 약속 종료/새 시작으로 전환했다. 실제 서버 중단에서 모든 변경 잠금·과거 라벨·오류 표시를 확인하고 서버 재시작 후404/새 시작 복구를 확인했다. 이전 MVP에서 거절/철회/새로고침을 검증했으며 이번 UI에서는 이 두 동작의 서버 의미는 변경하지 않았다.

| 화면 | 정상 상태 scroll 크기 | 버튼 높이 | 결과 |
|---|---|---|---|
|1280×720|1280×720|88|가로 제안/확정 분리|
|1024×600|1024×600|76|설명문 겹침 수정 후 확인|
|1920×720|1920×720|88|오른쪽520px 고정|
|640×960|640×960|판단88/하단76|긴 세로 여백 조정|
|480×720|480×720|76|분할창·오프라인 재검증|
|390×844|390×844|판단88/하단76|보조 모바일|
|768×900|768×900|판단88/하단76|세로 구성|
|1440×900|1440×900|88|가로 구성|

8크기 정상상태 측정 후 최종 small-height 간격만 축소했고480 실패상태를 다시 실측했다. Asta 로딩은 브라우저 document.fonts.check로 확인. 스크린샷은 evidence/pickup-design-ui-*.png, 수치는 viewports.json. 오류 화면은 offline-480.png/offline-measurement.json. 종료 확인은 end-confirm-480.png.

## 디자인 검토

design-taste-frontend app run: seed1258251903, true-black-flat, palette/type은 기존 브랜드 방향 유지. 사이트형 사진/모션/사이드바는 차량 작업 화면에 불필요하여 적용하지 않음. 제목 위 라벨은 확정/미확정/현재 미확인을 구분하는 기능 정보다. lint 결과0 FAIL/7 WARN(라벨 관련)은 이 이유로 유지한다. inspect.mjs의 별도 CDP 실행은 허용된 cua_repl 브라우저 경로와 충돌하므로 실행하지 않았고, IAB 스크린샷·DOM 좌표로 대체했다. inspector 통과로 보고하지 않는다.

Before: 일반 웹 폼과 민트 버튼, 작은 선택 입력 중심. After: 준비 상태와 확정 지점이 우선 보이고, 제안은 별도 표면·문구로 구분된다. 실제 판단 버튼 대비는 밝은 수락/외곽선 유지이며 종료가 멀리 떨어져 있다. 최초 낮은 가로의 본문 겹침과 긴 세로의 빈공간, 오류시480 겹침을 수정했다. 자가비평은 디자인7.5/사용성7.5/독창성6.5/내용8, 가중7.35: 기능이 명확하나 매우 작은 오류 화면은 여유가 적고 실제 차량의 입력/주행 제한은 검증되지 않았다. 이는 인증 또는 사용자 평가 점수가 아니다.

## 변경 범위와 한계

experiments/pickup-board/index.html,style.css,app.mjs,server.mjs,client.test.mjs,README.md,fonts/* 및 이 보고서/선별 증거/공통 작업 기록. 기존 J1·Android·SDK 소스 보존. 실제 Gleo/차량 SDK/CarUxRestrictions, 음성, 실제 위치/ETA, Android APK, 물리 dp, 실차, 사용자 입력량·효과 검증은 미구현/미실행. 로컬 메모리 회차는 서버 재시작 시 소실된다. 다음 새 기능과 공개·push는 이번 작업에 포함하지 않는다.

## 최종 검수·보완 결과

후속 Haiku 세션57400f5a-f24f-4572-a38c-cbaf0b5f3883은 초기세션보존/짧은stale라벨을 수용했다. 숨긴 본문이 DOM textContent에 포함된 것을 보이는 본문으로 해석한 지적은 computedStyle 직접측정으로 정정했다. 오류상태8크기 확대시험으로390/404 장문에서의 겹침을 추가 발견하여 오류시 중복본문/이벤트를 숨기고,401/403/404에서는 이전제안과종료를 숨겨 새시작/다시확인만 제공하도록 수정했다. 세 종류의 현재미확인라벨은 네트워크실패에서 계속 보인다.

최종 Haiku 세션aebeced2-e9fa-4016-8d45-6f845e00faf7은8크기 viewport=scroll/폰트로딩/잠금/제안영역과하단12px간격/오류8px안쪽여백을 확인했다. 최종 P1 자동조회 복구 후 오류문이 남는 지적은 refresh 성공시 오류를 비우도록 수정하고403→200회귀에 오류빈값/제안복원 assertion을 추가했다. 수정 후17/17재통과. 이 마지막2줄 보완에 대한 추가Claude회차 및 실제브라우저복구 재측정은 미실행이다. IAB 디버거 동기화 timeout으로 최종 새시작화면/viewport reset/탭유지 표시 확인은 차단됐다. 앱 서버는4180에서 재시작했고 이전 정상상태/실패상태 화면증거는 보존했다. 소스변경 완료와 브라우저 마무리 확인 차단을 구분한다.

최종 실패상태8크기 모두 fontLoaded=true, computedStyle proposalTextDisplay=none, 모든변경잠금, scroll=viewport. error box는 하단버튼과 인접하지만 글자 앞8px padding이 있어 hit area와 겹치지 않는다. final-failure-sizes.json이 최종 실패실측이며 이전 offline-measurement는 중간수정 근거다. 최종소스SHA256은 pickup-design-final-manifest.json, Claude 최종검수 당시 해시는 pickup-design-final-review-manifest.json이다. 공통문서 scoped git diff --check 통과(CRLF 경고만), 전체기존파일의 별도문제는 수정하지 않았다.

## 사용자 후속: 각진 디자인 및 실제 에뮬레이터
패널16→0/버튼12→2 CSSpx로 변경, Pleos 실제분할창에서검토용WebView실행·생성·종료확인·취소 및Claude이미지검토를완료했다. [후속 검증](PICKUP_BOARD_EMULATOR_DESIGN_2026-11-02.md). 기존둥근스크린샷은수정전이력이다.
