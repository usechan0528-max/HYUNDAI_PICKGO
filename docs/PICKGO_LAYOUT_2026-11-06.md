# PICKGO 보고서 개선 및 화면 비율 검증 · 2026-11-06

## 범위와 결과
사용자 승인: 디자인 검토 보고서에 따른 수정, 실제 앱 비율의 잘림/스크롤 개선, 탑승자 UI를 휴대폰 디스플레이에 맞춤. main의 기존 미커밋을 보존했고 이번 작업 전 사본은 `evidence/pickgo-layout-2026-11-06/before/`에 있다.

- 탑승자 단일·다인·초대·위치 공유: 최대 520px 한 열, 320px부터 반응형. 세로 높이를 고정 비율로 강제하지 않고 실제 viewport에 맞춤. 준비 선택 2열, 탑승/취소 분리, 긴 내용은 스크롤.
- 차량용 약속판·다인: 헤더/본문 스크롤/푸터 분리. 내부 패널 높이 축소와 중첩 스크롤 제거. 짧은 가로창에서도 조작에 접근 가능.
- 지도: 모바일 지도 높이 제한과 세로 흐름, 낮은 가로창은 지도와 별도 스크롤 가능한 선택 패널. 홈에서 선택한 후보를 지도에서 바로 확인 가능.

| 보고서 항목 | 반영 |
|---|---|
| DR-01 좌표 노출 | 앞선 place-label 수정 유지. 실제 좌표/API 값은 보존 |
| DR-02 좁은 탑승자 버튼 | 준비 2열, 탑승 전체 폭, 취소 별도 영역 |
| DR-03 같은 지점의 남은 사람 | 현재 지점 탑승 인원과 확인 대기 이름 표시 |
| DR-04 추가 폼 우선 노출 | 진행 현황 아래 접기 영역. 빈 회차만 기본 열림 |
| DR-05 완료 동작 숨김 | 탑승 후 주 행동에 픽업 완료. 기존 확인/상태검사 재사용 |
| DR-06 초대 맥락 | 참여 전 장소 preview; 초대 화면의 다인 진입 숨김 |
| DR-07 후보 구분 | 순번·검색 장소 기준 직선거리 명시, 선택 후보 지도 연결 |
| DR-08 긴 동의 안내 | 필수 목적/범위 요약과 선택 버튼, 상세 보관 안내 펼치기 |
| MD-01 영상 비율 | 앱 레이아웃 반영. 기존 원본 영상은 편집하지 않았으며 영상 재촬영은 이번 결과에 포함하지 않음 |

## 검증
- `node --test experiments/pickup-board/*.test.mjs experiments/pickup-board/map/*.test.mjs experiments/pickup-board/multi/*.test.mjs experiments/pickup-board/recommendation/*.test.mjs`: **261/261**, exit 0. `tests-final.log`.
- `node work/pickgo-layout/verify.mjs`: **89개 화면/상태 검사 통과**, exit 0. 1224×760,1280×720,1024×600,390×844,320×568,844×390,640×380. 각 화면/펼친 도구/변경/취소 대화상자에서 가로 넘침과 스크롤 접근 검사. 단일 완료 실제 상태 전환 확인. `browser-final.log`, `layout-metrics.json`.
- `node work/pickgo-layout/extra.mjs`: 최신 4199 서버의 참여 전 장소, 초대 미소모, 초대 3개 크기, 운전자 위치 중지 버튼 숨김, formatter 200 확인. `extra.log`.
- 실제 emulator-5556 WebView: 기존 /multi 세션 새로고침만 수행. **1224×760, DPR1.375**, main clientHeight664/scrollHeight774, 마지막 나가기 버튼까지 스크롤 접근 true, 가로 넘침 false. 확인 후 스크롤 최상단 복원. `native-viewport.json`, `native-scroll.json`, `native-multi.png`, `native-bottom.png`.
- taste `lint --app`: 0 FAIL/8 WARN. `inspect --app --allow font-not-dealt`: 0 FAIL/2 WARN. 홈의 의도된 중앙 검색/여백 경고 유지. 화면 4개 contact sheet와 주요 모바일/실앱 원본을 눈으로 확인. `git diff --check` exit0, 기존 파일 줄바꿈 경고만 존재.
- 초기 회귀 3개 실패는 preview 요청 추가로 기존 네트워크 요청수 assertion을 갱신해 해결. 초기 브라우저 검사 실패는 닫힌 details의 비표시 자식, top-layer dialog에 조상 clip을 적용하던 검사 코드 오류를 수정한 뒤 전체 재검사. 실패 로그 보존.
- **미실행**: 물리 휴대폰/Safari, 실차, release APK/공개 HTTPS. Chrome CSS viewport 결과를 물리폰 실행으로 표시하지 않는다.

## 독립 검수와 처리
실제 Claude CLI `claude-haiku-5-5`, 세션 cd15caf0-11e9-4a27-99e9-907219461c9d, 고정 diff/필수 소스 읽기 전용, exit0. `review-input.txt`, `review-manifest.json`, `review.json`. P0/P1 없음은 제한된 소스 검수 결과다.

- P2-1 preview 요청 제한: 공개 운영 검토 항목으로 유지. 현재 loopback 시연이며 기존 join에도 rate limit 없음. 이번 UI 수정에서 운영 정책을 새로 도입하지 않음.
- P2-2 이미 사용/만료 초대 안내: 403 안내를 구분하되 자격 저장 실패의 참여 재시도를 막지 않음.
- P2-3 stop 표시: phone-page 소스 확인 후 운전자/미참여에는 숨김. 탑승자는 재진입 후 기존 공유 삭제도 가능하도록 유지. 전체 회귀 및 실제 Chrome 운전자 숨김 확인.
- P2-4 완료 중복: 접힌 관리의 기존 종료와 주 행동의 완료는 동일 확인 흐름. 주 행동 발견성 요구를 충족하고 기존 관리 경로를 보존. 라벨을 '완료 기록'으로 바꾸면 실제 동작과 달라지므로 미반영.
- P2-5 열 높이 차이: 내용 없는 패널을 억지로 늘리지 않는 선택. 동일 그리드 정렬 유지, screenshot 확인.
- P2-6 짧은 가로 지도: 844×390 실제 Chrome에서 접힘/펼침 모두 접근 검사 통과.
- P2-7 추가 패널: polling마다 사용자의 펼침 선택을 덮지 않는 의도. 회차 활성/빈 목록 전환 때 기본값 갱신.

## 앱 화면 자체 검토
1. 첫 정보는 픽업 상태/현재 지점이며 탑승자 화면은 내 픽업과 탑승 행동이 중심이다.
2. 공통 좌우 여백 유지, 폰은 한 열. 운전자 열의 자연스러운 높이를 유지한다.
3. Asta·검정/차콜 유지. 장소 확정에만 녹색 상태 표시, 주요 행동은 밝은 대비.
4. 6명 중 1명 탑승 + B~F 대기 5명 일치. 직선거리의 기준 장소 명시.
5. 남은 지점 0과 탑승 완료, 미확인 상태 구분. 임의 수치 대체 없음.
6. 차트 없음. 라벨 충돌 없이 긴 장소/이름은 줄바꿈.
7. 폰의 관리/상세 정보는 접고 주요 행동은 일반 흐름에 배치. 작아지는 화면에서는 후속 내용 일부가 보여 스크롤 연속성을 유지한다.

## 실행 상태와 한계
최신 전체 구현 로컬 확인: **http://127.0.0.1:4199**. Node 서버를 실행해 두었고 이 서버에서 formatter 200 및 신규 preview를 검증했다. 재실행: PowerShell `$env:PICKUP_PORT='4199'; node experiments/pickup-board/server.mjs`.

기존 4194 서버는 이전 라우팅을 유지(`/place-label.mjs` 404)한다. 메모리 세션 보호를 위해 종료하지 않았고 adb reverse `tcp:4194 → tcp:4194`도 변경하지 않았다. 기존 앱의 다인 정적 UI에는 새 화면이 반영되었으나, 전체 최신 단일/초대 흐름을 기존 앱 서버에서도 쓰려면 서버 전환 또는 재시작이 필요하다. 이를 전체 앱 최신 연동 완료로 표시하지 않는다. 기존 영상과 Android/SDK는 불변. 공개/push 없음.

## 변경 파일
`experiments/pickup-board/`: index.html, app.mjs, style.css, domain.mjs, server.mjs, web-invite.test.mjs, 신규 invite-preview.test.mjs, multi/page.html·mjs·css, phone.html·css, phone-page.mjs, map/page.mjs·css. 재현 스크립트와 이번 diff/해시는 전용 evidence에 보존. 기존 place-label 및 다른 작업자의 미커밋 유지.
