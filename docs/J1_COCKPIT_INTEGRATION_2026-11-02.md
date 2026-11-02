# J1 차량 화면 통합 및 SDK 시각 조사 · 2026-11-02

## 범위와 결과
사용자는 앱 디자인 채팅의 기존 수정본 반영, Dot 공식 시각 조사, Claude 검수 및 실제 좌표 추천 연결 계속을 요청했다. main의 미커밋 변경을 보존했다. 원본 output/j1-cockpit은 수정하지 않고 demo/cockpit.html/css에 시각 구성을 적용, 실제 재생 제어를 분리 구현했다. 기본 / 및 /?input=sdk가 차량 화면이며 기존 진단/합성 실험은 /lab에 보존한다. 기존 app/index/style/음원은 이번에 변경하지 않았다.

현재 완료: 차량 시안→실제 로컬 AI음원 재생, 터치 일시정지·이어듣기·종료·자동 다음 곡·오류 재시도, SDK 상태 읽기. 실제 STT는 비활성·미연결 표시. 브라우저 소유자의 기존 취향/이어듣기 저장키를 의도적으로 재사용한다. 차량 사용자 식별/동의/권한/운행 제한/오디오 포커스의 Android 제품 통합은 완료 아님. 종료는 체크포인트를 지우고 다음 명시 시작은 새 세션, 화면 이탈은 저장 후 일시정지한다.

## 시각 계약
DOT-R004 완료 보고는 docs/evidence/dot-clock-2026-11-02.md. 공식 timestampMillis의 epoch/monotonic, clock 변경·재부팅, 관측/계산/수신 의미를 확보하지 못했다. Codex도 meta refresh를 따라 실제 공식 문서를 조회하여 제목 뒤 dokka 본문이 비어 있음을 확인했다. 모든 공식 자료에 계약이 없다는 단정은 아니다.
https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/FusedLocation/fused-location/ai.pleos.playground.location.fused.model/location-data/timestamp-millis
https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/location-data-access
수신시각을 관측시각으로 치환하거나 Android/별도REST 계약을 전이하지 않는다. UNVERIFIED_CLOCK 및 실제 좌표 차단 유지. 현 UI는 위치가 아닌 기본/저장취향 추천이다. 다음 필요한 근거는 제공자의 FusedLocation1.1.3 필드 계약 또는 같은 원천에 대응하는 검증된 관측시각 API다. 외부 문의는 보내지 않았다.

## 실행 증거
- node --test experiments/journey-context/*.test.mjs: 종료0,87/87. evidence/j1-cockpit-integration-tests-2026-11-02.txt.
- node --check cockpit.mjs/server.mjs 및 git diff --check: 종료0(CRLF 경고만).
- 실제 IAB: story.wav paused=false/currentTime0.121→17.902; 터치 일시정지 paused=true. reload 후 저장 위치18.023982/22.580045부터 재생. 한 번 시작 후 자연종료 연쇄를 거쳐 최종 pause2.wav19.925283에서 소진·정지 표시 확인. 최종 로드 중 명시 종료도 paused=true/src=null 확인.
- 1280×720,1024×600,1920×720,640×960,480×720의 scrollWidth/Height가 viewport와 일치, 버튼88~96px 높이. work/cockpit-integration/viewport.json 및 PNG. IAB1920 스크린샷은 캡처 영역이 잘렸으므로 전체 시각 검증 주장은 하지 않음; DOM 배치 경계는 확인. 다른4종 시각 확인. 최종 화면 outputs/j1-cockpit-integrated.png.
- 초기 headless check.mjs는 audio.currentTime>0 assertion 실패(0). 숨기지 않으며 해당 전체 스크립트 통과 주장 없음. 이후 실제 IAB에서 미디어 시계 진행·자연종료 확인. 가짜 오디오 테스트와 실제 재생 구분.
- SDK 재수신 재시험: adb reverse --list / am start는 emulator-5556 not found로 실패. adb devices -l에는 기기가 없음. 이전51콜백 증거를 이번 실행으로 재사용하지 않음. Android 소스 변경/빌드 없음, 에뮬레이터 자동 재시작/권한 변경 없음.
- 서버 J1_SDK_STATUS=1, localhost4177, 실행 세션75693. 미연결이면 연결 대기/기본 추천, 실제 시각·좌표신선도 주장 없음.

## Claude 검수
Haiku5.5 읽기 전용 고정 소스 검수: work/cockpit-integration/review.json, 세션9c31e7dd-20fd-4c5a-a8f1-292a1d02be03,exit0,is_error=false,modelUsage 확인. 수정 전 확정P1 없음. ended/pause 순서 방어·static 음성 비활성·2초 저장 제한·확인불가 상태 문구·취소/오류/정리 테스트 반영. 공유저장키는 기존 사용자 이어듣기를 연결하려는 의도; guest write 차단은 기존 lab 테스트에 유지. 미디어오류 체크포인트 폐기는 불확실한 오프셋으로 무음 자동복구하지 않는 정책. 실제 차량WebView·오디오포커스·5초 wait timeout 경계 전체 검증 미실행. Dot 결론 포함 후속 검수 원문 followup.json.

## 남은 상태
실제 좌표 추천은 공식 시계 계약 부족으로 미완료. 디자인 통합과 로컬 재생 검증 완료와 구분한다. 같은 SDK 기능을 미완료로 유지하며 새 기능 채팅으로 넘어가지 않는다. 공개·push·계정·권한변경 없음.

후속 ClaudeHaiku5.5 세션574ac57e-f1e1-44bd-845d-6c6c3b8fd16b exit0/is_error=false, DotR004·최종player 읽기검수. 확정P1없음, 좌표차단 유지 타당. recent 무제한 증가 지적은 catalog4개/current·recent제외/재시작reset으로 최대4개이므로 미반영. 최종 증거 JSON에 두 검수와 소스해시 보관.
