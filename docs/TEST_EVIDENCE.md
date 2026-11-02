# 검증 증거

## 2026-11-02 · 조사 단계

| 항목 | 명령·방법 | 결과 | 한계 |
|---|---|---|---|
| 저장소 | `git status --short --branch`, `rg --files --hidden ...` | main, 기존 사용자 변경 존재, 시작 시 앱/README/docs 없음 | 기존 변경을 보존 |
| 로컬 환경 | Python `shutil.which` 및 통상 설치 경로 확인 | node/python/npm 있음. adb/gradle PATH 없음. 통상 Android Studio·SDK 경로 없음 | 다른 위치에 설치되어 있지 않다는 뜻은 아님 |
| Node | `node --version` | v25.9.0, 종료 0 | 앱 개발 언어를 결정한 것 아님 |
| Claude CLI | `~/.local/bin/claude --help` | 실행 성공, 종료 0. print/tools/no-session-persistence 옵션 확인 | 인증·모델 호출 성공과 별개 |
| API 조사 | 공식 Pleos/AOSP 웹 문서 | API_EVIDENCE.md에 문서 확인/미확인 구분 | SDK 선언·컴파일·실행 증거 없음 |
| SDK·앱·실차 | 미실행 | 미실행 | APK/동작 인증 없음 |
| Gleo·사용자 비교 | 미실행 | 미실행 | 실제 성능·리텐션 결과 없음 |

## 문서 검증

Python 일회성 검사로 실제 평가 표의 4개 점수를 파싱했다. 평균 65.0, 70 이하 항목 3개, 상대 문서 링크 존재, 검수 대상 두 파일 SHA256 일치를 확인했다. 종료 0. 이는 문서 산술·구조 검사이며 제품 성능 시험이 아니다.

[검사 결과 JSON](evidence/evaluation-check-2026-11-02.json)

## Claude 독립 검수 시도

실행 명령(프로젝트 루트, 쉘에서 실행 파일 경로는 실제 절대경로로 사용):

```sh
~/.local/bin/claude --print --tools '' --strict-mcp-config --mcp-config '{"mcpServers":{}}' --disable-slash-commands --no-session-persistence --permission-mode plan --permission-prompts none --output-format json < docs/reviews/coordination-review-input-2026-11-02.txt > /private/tmp/hyundai-coordination-review-output.json
```

결과: 종료 코드 1. 응답 `is_error: true`, `Not logged in · Please run /login`。응답의 subtype은 success였으나 오류 플래그와 실제 결과를 기준으로 실패로 처리했다. 검수 의견은 생성되지 않았다. CLI 도움말 성공과 모델 검수 성공을 구분했다.

[고정 입력](reviews/coordination-review-input-2026-11-02.txt) · [해시](reviews/coordination-review-manifest-2026-11-02.json) · [검수 상태](reviews/REVIEW_STATUS.md)

로그인·계정 변경은 하지 않았다. 자동 승인 심사에 의한 거부가 아니라 CLI 인증 부재다.

## Claude 동일 세션 반복 호출 시험 · 2026-11-02

사용자 요청으로 CLI 2.1.316에 짧은 기억 시험 요청 후 반환된 세션 ID로 후속 질문을 보냈다. `--safe-mode --print --tools '' --strict-mcp-config --mcp-config '{"mcpServers":{}}' --disable-slash-commands --permission-mode plan --permission-prompts none --output-format json`을 사용했다. 두 번째 호출에는 `--resume 4ae4267d-1d2e-4f14-9151-b3372a6f3bdc`를 추가했다. 세션 저장을 막는 `--no-session-persistence`는 사용하지 않았다.

- 첫 호출: 종료 1, `is_error: true`, `Not logged in · Please run /login`. 모델 답변 없음.
- 후속 호출: 종료 1, `No conversation found with session ID`. 같은 세션의 문맥 유지 확인 불가.
- 판정: 인증 부재로 차단. 실제 반복 대화 성공은 미검증. 계정·권한 설정 변경 없음.

[명령 인수·요청 요약·결과](evidence/claude-loop-test-2026-11-02.json)

### 로그인 후 재시험 · 성공

사용자의 로그인 완료 안내 후 재실행했다. 샌드박스 안에서는 다시 `Not logged in`이 나왔으나 `require_escalated`로 같은 CLI를 실행한 두 요청은 각각 종료 0, `is_error: false`였다. 인증 정보 접근 차이의 정확한 원인은 미확인이다. 기존 시험과 동일한 도구 차단 옵션을 사용했고 로그인·권한 설정은 변경하지 않았다.

- 첫 요청: 표식 `HYUNDAI-LOOP-8426`, 숫자 `23`을 기억하도록 전달. 응답 `1차 수신 완료`.
- 후속 요청: `--resume cf1ce185-a39a-44a1-8cfb-72d510cb9b56` 사용. 값을 다시 전달하지 않고 표식과 이전 숫자+5를 질문. 응답 `HYUNDAI-LOOP-8426, 28`.
- 두 응답의 세션 ID 일치, 예상 응답과 산술 결과 일치를 Python으로 확인했다. 판정: 실제 두 차례 왕복 및 동일 세션 문맥 유지 통과. 코드 검수·파일 수정 능력은 이 시험 범위 밖이다.

[성공 응답 및 검증 증거](evidence/claude-loop-authenticated-test-2026-11-02.json)

## 아이디어 회의 실행 · 2026-11-02

승인된 회의 입력과 Codex 수정안을 동일 세션으로 호출했다. `claude --safe-mode --print --tools '' --strict-mcp-config --mcp-config '{"mcpServers":{}}' --permission-mode plan --permission-prompts none --output-format json` 사용, 후속 호출에 `--resume 23ab568a-f804-4584-bea0-81215b341792` 추가. 두 호출 모두 require_escalated 실행에서 종료 0. Python으로 오류 false와 세션 일치를 확인하고 입력 SHA256 및 응답 원문을 저장했다.

[회의 증거](evidence/idea-meeting-2026-11-02.json). 검증 범위는 대화 실행과 산출물 기록이며 앱·SDK·시장 수요 테스트가 아니다.

## Opus 5.5 명시 호출 · 2026-11-02

기존 회의 CLI 옵션에 `--model claude-opus-5-5`를 추가하고 후속은 `--resume e8d65fde-2714-4717-a83c-0a1e7384009e`를 사용했다. 두 호출 require_escalated, 종료 0. Python으로 오류 false, 같은 세션, modelUsage의 지정 모델 일치를 확인했다. [입력 해시·응답·모델 사용](evidence/fresh-ideas-opus-2026-11-02.json). Haiku 호출 및 제품 검증은 미실행.

## MVP 구현·공동 평가 · 2026-11-02

- Node v25.9.0. `node --test` (mvp 디렉터리): 최종 13 통과/0 실패/종료0. 도메인 11, HTTP 및 실제 경로 기동 2.
- 최초 샌드박스 시험은 loopback EPERM으로 서버 시험 실패. require_escalated에서 12개 통과. Haiku 지적 후 경로 회귀 시험에서 심볼릭 링크 불일치 실패를 재현하고 realpath 수정 후 13개 통과.
- `node mvp/server.mjs`: 127.0.0.1:4173 로컬 실행. 외부 공개 아님.
- IAB 브라우저: 초기 잠금·정차·민영 상세·표본 부족·공식0·만료·단절·복구 후 만료·주행 잠금·피드백 초기화 확인. 최종 error 로그 조회 0건.
- Haiku 5.5 검수 2회, Opus 5.5 제품 평가 2회 모두 종료0. 정확한 modelUsage와 각 후속 세션 일치 확인.
- [최종 소스 해시와 검증 기록](evidence/mvp-validation-2026-11-02.json), [공동 평가 원문](evidence/mvp-collaboration-2026-11-02.json), [평가·미실행·남은 문제](MVP_EVALUATION_2026-11-02.md).
- 합성 자료 시험이며 실제 SDK·주차 API·사용자·예측 정확도 검증은 하지 않았다.

## 실제 공공 데이터 연결 검증 — 2026-11-02
명령 `node --test mvp/*.test.js`: 최종 18/18 통과. 최초 sandbox에서는 loopback EPERM으로 3건 실패. 허용 환경 재실행에서 기존 CSP 기대값과 복사 테스트의 신규 모듈 누락 2건 실패, 테스트를 실제 의존성/동일출처 CSP로 갱신 후 통과. 실제 연결은 별도 curl과 브라우저로 확인; 단위 테스트는 기록된 공급자 응답 fixture 및 주입된 fake fetch 사용.
경계: 5분 만료, 미래/잘못된 달력 날짜, 음수/문자열/총면초과/연계없음, 대상 없음, 공급자오류, oversized/malformed, singleflight/cache, 실패시 이전값 폐기. HTTP API503/HEAD405/live200 및 기존 13개 회귀 포함. timeout 실제 네트워크 지연 강제 시험은 미실행.
브라우저: 초기 미확인 잠금, 정차 시연→실제 확인 버튼→1260면/110대/차이1150 및 공급자/수신시각 표시, 주행 제한→상세 제거/버튼 비활성 확인. 스크린샷 시각 확인 완료. SDK/에뮬레이터/실차/사용자 이해도/모바일 viewport 검증 미실행.
로그 evidence/live-tests-2026-11-02.txt, 실제 응답/스크린샷은 API_EVIDENCE 참조.

최종 추가: Haiku 캐시경계·클라이언트 시계 지적 수정, API200/헤더 시험 및 잠자기/벽시계역행/visibility 회귀 추가로22/22 통과. live.test.js는 VM fake DOM 시험으로 실제OS잠자기 재현이 아니다. 최종 브라우저 actual 표시 재확인, evidence/live-parking-final-2026-11-02.jpg. 최종 판정/검수 처리 LIVE_PARKING_REEVALUATION_2026-11-02.md 참조.

## J1 주력 보완 설계 — 2026-11-02
문서/설계 작업만 수행. Claude Opus5.5 두 호출 종료코드0 및 is_error=false, 실제 modelUsage 확인. JSON 파싱 확인. 앱 소스 수정/빌드/단위테스트/SDK·에뮬레이터·실차 실행은 미실행이며 기존 주차22개 통과를 J1 근거로 재사용하지 않음. 합성 수용 사례는 계획으로만 기록.

## J1 합성 로직 실험 — 2026-11-02
Node v25.9.0, `node --test experiments/journey-context/core.test.mjs`, 종료0, 최종14/14통과. 합성 구역 prefix 후보, 미래/다른프로필 이력 배제, 입력거부/오래됨/이탈 fallback, 취향+운행별선호, 현재재생 보존, 큐 흔들림 제한, 이력삭제/동의철회/프로필전환/오래됨의 파생추천 무효화, 무효화 후 갱신상한 유지 검증. 실제 미디어/SDK/위치수집/영구삭제/정확도/사용자수고 검증 아님. 증거 j1-core-tests/j1-core-manifest/j1-core-review-2026-11-02 파일.
Haiku5.5 두 번 정적 검수, 실제 실행은 Codex. 첫 P1 목적지 노출 표현에는 내부가설 자체가 위반은 아니라 반론하되 필드제거로 최소화. 삭제후큐잔존은 Session 도입으로 수정. 후속 P1없음; P2 stale큐·무효화후상한초기화·호출계약은 Codex 수정/14개회귀통과. 마지막 P2 수정분의 Claude 3차검수는 미실행. WeakSet 제안은 오래된context 승인 문제를 해결하지 않아 미채택, Haiku수용. 외부입력 전면스키마검증과 출처문자열 신뢰는 내부 fixture 계약의 한계로 명시.

## J1 A/B/C 기능 비교 — 2026-11-02
`node --test experiments/journey-context/*.test.mjs` 최종18/18 통과, 종료0. `node experiments/journey-context/compare.mjs` 종료0, 여섯 합성 사례 JSON 생성. 같은 가상 카탈로그에서 A취향/B시간슬롯/C경로prefix 입력전략 차이를 검사. 미래·다른프로필·출발시각 동시종료 이력 차단 및 잘못된 시계 대안 추가. 실제 사용자 정답/승률/정확도 없음. 결과 evidence/j1-comparison-2026-11-02.json, 시험/해시/검수 동명기록.
Haiku5.5 실제 호출 is_error=false, 정적 검수. B시계조건 수정, 테스트명 축소, 경계회귀 추가. current 주입은 재생기 계약이고 미구현 명시; 프로필 변경후예산유지는 같은운행세션 정책으로 유지. min민감도는 미실행 한계. 마지막 변경의 Claude 재검수 미실행, Codex18개회귀통과.

## 2026-11-02 · 실제 SDK 경계 확인
J1 SDK 경계: 공식 FusedLocation1.1.3 POM/AAR 실제 수신, javap 공개선언 출력보존. 실제 classes.jar로 LocationSnapshotMapper를 javac --release17 컴파일 종료0. Haiku5.5 정적 검수 후 NO_LOCATION/INVALID_COORDINATES 구분 Result 도입, 재컴파일0. SDK초기화/콜백/실행/전체앱빌드 미실행. 마지막 수정의 재검수 미실행. 문서/아티팩트선언/단일컴파일을 구분. evidence/j1-sdk-boundary* 참조.

## 2026-11-02 · 내비 입력 계약 확인
공식 NaviHelper3.0.5와 POM의 navi-data3.0.4 AAR/source.jar 확보, DrivingState 공개선언·소스단위 확인. NavigationSnapshotMapper javac --release17 종료0, Kotlin annotation classpath누락 경고2. 실제SDK초기화/콜백/Android전체빌드/권한/실차 미실행. 의미가불명확한 remainDistance/TripInfo.eta 미사용, 위치timestamp/confidence의 소스상 설명부재 확인. evidence/j1-navigation-boundary-2026-11-02.json 및 public-signatures 참조.

내비 Haiku 후속: 실제 공개선언/컴파일증거 전달 후 타입 위험 판정 조율. 실제 회신은 evidence/j1-navigation-review-2026-11-02.json. Codex 실행과 검수자 독립 재실행을 구분한다.
Haiku의 “AAR/source.jar 대조 증거 없음”은 검수 입력에서 원문 전체를 재확인하지 못한 범위로 한정한다. Codex는 실제 아카이브의 해당 파일을 읽었고 공개선언 출력·각파일 SHA256를 보존했다. Kotlin 경고는 javac가 annotation 클래스 부재를 직접 명시했으며 원인불명 metadata 손상으로 확대하지 않는다.

## 2026-11-02 · J1 로컬 듣기 시연
Node core/compare19/19통과, app.mjs syntax통과. HTTP / /app.mjs /audio/story.wav200, 비허용파일404, POST405 확인. WAV4개17~21초확인. IAB 실제story.wav재생time5.30→12.79증가,work변경후같은src/pausedfalse/다음reflection확인. 동의철회/게스트/지연fallback,명시목적지gate,A/B문구수정,리셋관찰. 초기listen sandbox EPERM 후허용loopback실행. Haiku2차P1해결,후속pause경합은phase가드수정·브라우저회귀; refill무료슬롯은실제교체없는최초채움이므로미반영(의도기록). 마지막수정Haiku3차미실행. Range/Safari/mobile/오디오포커스/SDK미검증. 증거 j1-demo-tests/http-audio/review/manifest/screen 참조.

## 2026-11-02 · D-015 자동 이어듣기
좌표합성7개추가총26/26통과. 자동이어듣기app.mjs node --check통과. IAB사용자최초click후story→story2 자연종료자동전환src/pausedfalse확인. 종료버튼후pausedtrue/time5.473039 고정재확인. Haiku로딩중중복클릭/이전play이벤트표시지적수정. 26개node시험은오디오DOM자동시험이아니며자동재생증거는별도브라우저관찰. 전체4곡소진/브라우저거절·네트워크실패강제재현은미시험. 실제시동자동시작/SDK미연동.

최종수정브라우저회귀: 추가클릭없이세번째pause.wav 8.30717초 pausedfalse확인,종료/리셋확인. Haiku후속원문 j1-autoplay-review,최종해시 manifest에보존.

## 2026-11-02 · 합성 좌표 시연 연결
node --test experiments/journey-context/*.test.mjs 32/32,종료0. 고정잡음20반복·반경겹침복수후보·공백/입력/계산상한포함. 기존core/compare/queue회귀포함. IAB새탭5에서jitter→reflection/재생중shop→story다음추천과현재pause.wav pausedfalse확인. 최종변경후jitter·stale·reset재확인. 실제GPS/온라인누적/SDK는미검증. evidence/j1-coordinate-integration-tests와screen 참조.

좌표Haiku두호출정상,차단수준문제없음회신. 첫관측지연미검사/이력상한운영미정/단일시드비대표성은한계로반영했다. 검수자미재실행과Codex실행결과를구분; 원문j1-coordinate-review,최종해시manifest보존.

## 2026-11-02 · 작업 스냅샷 커밋 전 재검증
- `node --test experiments/journey-context/*.test.mjs`: 38/38 통과, 종료 0.
- `mvp/`에서 `node --test`: sandbox에서는 loopback listen EPERM으로 18통과/4실패. 권한 승인 후 같은 명령 재실행 22/22 통과, 종료 0.
- `git diff --cached --check`: 기존 검수 원문 mvp-haiku-input 및 mvp-haiku-followup의 EOF 빈 줄 2건 경고(종료 2). 원문 보존을 위해 수정하지 않음.
- 일반적인 private-key/GitHub-token/OpenAI-project-key/AWS-access-key 패턴 검사에서 일치 없음. 포괄적인 비밀값 부재 인증은 아님.
- 이번은 기존 작업 저장이며 코드 수정/새 Claude 검수/SDK·브라우저 재검증은 수행하지 않음.
