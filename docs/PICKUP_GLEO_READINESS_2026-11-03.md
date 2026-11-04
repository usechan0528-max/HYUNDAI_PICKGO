# C02 픽업 Gleo 연동 준비 · 2026-11-03 KST

사용자 “연동할 수 있게 해놓자. 하다가 막히면 연동 준비까지만 진행해”, 대상 “현재 주력인 픽업 약속판” 및 D-017 인계에 따른 구현. **준비 경계는 구현·시험했으며 실제 Gleo 연동은 차단 상태다.** J1 오디오 연동이 아니다.

## 결과와 변경 범위

`experiments/pickup-board/gleo/adapter.mjs`, `gleo/contract/schema.candidate.json`, `gleo/README.md`, `gleo.test.mjs`를 추가했다. 현재 회차 조회/운전자 수동 도착의 두 명령만 준비했다. 기존 실제 Board의 역할·참여·장소 합의·version·view lease·중복 요청 검증을 재사용한다. 새 서버 route나 exported Android endpoint는 없다. 웹 화면의 디자인·기능과 검토용 WebView 소스는 변경하지 않았다.

main에 있던 다수 미커밋/미추적 변경을 보존했다. 원래 디자인 채팅의 편집 종료 회신을 확인했다. 기존 수동 상태 최종 manifest에 기록된 domain/server/app/index/style/board.test/client.test 7개 SHA256 모두 일치한다. commit/push/stash/checkout·외부 제출·계정/권한/서명키 변경은 하지 않았다.

## 구현 판단

- 최대3개 공식 한도 안에서 `GET_PICKUP_STATUS`, `REPORT_PICKUP_ARRIVAL` 두 개만 사용한다. 탑승 확인·상대 수락·종료·장소 변경을 운전자 음성으로 대행하지 않는다.
- 신뢰할 host의 현재 운전자 바인딩과 매 단계의 일회성 attest가 없으면 거부한다. 기본 issuer는 없다. 테스트의 fake attest는 인증·CarUxRestrictions 구현 증거가 아니다.
- monotonic 5초 ticket, 단조 시각 역행 거부, prepare/dispatch 재인증, consume-before-call·재진입 차단, clear/rebind/dispose에 따른 폐기. 호출 식별자는 내부에서 한 번 만들며 입력에서 받지 않는다. 실제 Android lifecycle은 아직 없다.
- 도착은 준비 시점 version/view에 결합한다. 중간 변경은 asking, 자동 갱신 후 변경 실행은 금지한다. 조회는 최신 상태를 읽는다. 서버의 기존 Date.now lease는 보존하고 음성 ticket에 추가 단조 만료를 둔다.
- 인자가 없는 명령이다. 빈 extras 또는 단일 ACTION_PARAM 빈 JSON 객체 문자열만 허용하며 타입 변환/이중 디코딩/인자 주입을 거부한다. 이 제한은 로컬 후보 계약이다.
- Callback 객체는 영어 메시지·success/asking/fail·mode voice와 최소 data 문자열을 사용한다. 위치·capability·초대·회차ID·view·requestId·사건 원문을 반환하거나 로그하지 않는다. 아직 Android broadcast를 전송하지 않는다.

## 통과·실패·미실행·차단

| 항목 | 판정과 증거 |
|---|---|
| Node 기존27+새22 | `node --test experiments/pickup-board/*.test.mjs`, 최종49/49, 종료0. 실제 Board/기존 loopback HTTP/fake DOM·fake host를 구분 |
| parser/role/신선도 | 잘못된 action·누락/타입·extra·중첩인용·크기, rider 위반, 미참여·제안중·탑승후·종료·회차소실 거부 통과 |
| 동시·수명주기 경계 | 동일 ticket 한 번, 동시에 예약된 순차 microtask·동기 dispatch 재진입, 새 invocation/clear/rebind/dispose/새 인스턴스 무효화 통과. 병렬 스레드/Android Intent 시험 아님 |
| 오프라인·UX·시계 | fake host offline/restricted/unknown/stale/replayed grant, 4999/5000/6999/7000/8000ms, wall 역행·만료·monotonic 역행 통과 |
| 정적 검사 | `node --check experiments/pickup-board/gleo/adapter.mjs` 종료0 |
| 기존 Android 검토 앱 | Gradle8.9/JDK17 offline `assembleDebug lintDebug` 종료0, 43 tasks 중1 실행42 up-to-date, lint0오류1기존경고. 새 Gleo 코드를 컴파일한 것이 아님 |
| APK 격리 | ZIP 검사로 schema.json 없음. 후보 JSON과 Gleo action이 기존 빌드/manifest에 연결되지 않음을 시험 |
| 에뮬레이터 환경 | `adb devices -l`: emulator-5556 연결, `adb reverse --list`:4180 확인. 앱 설치/자연어/실제Intent·callback 시험 미실행 |
| 실제 연동 | 차단: 등록·승인된 schema 없음, native 현재 운전자 세션 공급자 없음, 검증된 caller/응답 대상 계약 미확보, 플랫폼 UX 공급자 없음 |

실패 시험은 초기45개/최종49개 집합에서 없었다. 초기 검수에서 시험에 없던 빈 ticket 예외를 발견하여 수정·회귀 추가했다. 문서 링크 추가 중 apply_patch의 기존 줄 불일치가 한 번 발생했으며 원본 확인 후 추가 방식으로 반영했다. 실제 환경 미실행 항목을 fake 시험 통과로 대체하지 않는다. 준비 코드와 기존 앱은 연결되지 않았으므로 사용자가 지금 Gleo로 픽업을 조작할 수 있는 상태가 아니다.

## 협업과 근거

Claude Opus5.5 설계 세션 `33b79208-5590-4d6d-ba18-0aef53ca056c`, 종료0/is_error=false/modelUsage 확인. 일회성 grant, 기본 거부/검사 순서, requestId 고정, 단조 시간, 재진입, 후보 schema 이름·위치, 조회와 도착의 version 정책 분리 제안을 채택했다. HTTP 어댑터나 추정 Android 인증은 만들지 않았다. 서버 lease 시계 전체 변경은 기존 도메인 변경을 피하고 추가 단조 ticket으로 제한했다.

Haiku5.5 고정 검수 세션 `ecd29ece-86f3-42c9-b1e4-017eabf9df0a`, 종료0/is_error=false, P0/P1 없음. P2 다섯 항목 모두 반영: (1) 빈 ticket의 try 밖 예외 방어, (2) 거부된 새 invocation도 이전 pending 폐기, (3) accessor 입력 거부/검증 action 고정/arrival 명시 분기, (4) host grant phase 일치 검사, (5) 실제 동기 Board 타입·read/act method 검사. 마지막 두 항목은 보강 권고였지만 함께 적용했다. microtask 시험 이름을 정확히 바꾸고 dispatch 재진입·일반 오류 응답·getter/phase/async Board 거부 시험을 추가했다. 최종49개 통과. 별도 APK ZIP검사로 후보schema 비포함을 확인했다. 기존 Board의 wall clock 문제는 이번 변경 전부터 존재하며 음성 경로에 단조5초 상한을 추가했고 기존HTTP 정책은 변경하지 않았다. 동일 credential의 과도한 조회로 오래된 view가 밀리면 안전하게 거부하며 자동재시도하지 않는다.

Dot R008은 [computer-use 스킬](C:/Users/dldyd/.codex/plugins/cache/openai-bundled/computer-use/26.1027.30824/skills/computer-use/SKILL.md)을 통해 기존 대화에 한정 질문 두 개 전달·완료 보고 회수·같은 실행에서 종료 회신을 완료했다. Codex가 Examples/Callback/Core Concepts 원문을 직접 대조했다. 인증 계약과 직렬화 불일치 모두 이번 범위에서 미확인이며 플랫폼 보안장치 부재로 단정하지 않는다. Dot의 날짜는 후속 회신에서 11-03 KST/11-02 UTC로 정정됐다. 기존 예약을 변경하지 않았다.

공식 URL과 정확한 연결 절차, host 교체 지점은 [연동 README](../experiments/pickup-board/gleo/README.md)에 있다. `assets/schema.json` 검토·승인 필요는 [공식 전달 문서](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/deliver-schema)와 대조했다. 후보 패키지 org.example.pickupboard/version0.0.0은 미등록 값이며 제출하지 않았다.

## 다음 단계

실제 연결은 제품 Android 세션 공급자·플랫폼 UX·Gleo 호출자/응답대상 신뢰 계약 확보부터 이어간다. 후보 schema의 제품 package/version, 실제 Intent 인자 형식, 검토·승인을 확인한 후 transport를 연결하고 7초 내 응답·중복·새 Intent·재시작을 실제 Gleo로 검증해야 한다. 별도 승인 대상인 외부 제출·권한 변경을 자동 실행하지 않는다. 준비 완료와 실연동 차단을 분리하며 새 기능 채팅을 열지 않는다.


## 최종 재검수·증거
Haiku5.5 후속 세션 `98c2bf87-88a8-4820-9cd5-36fe390560d8`, 종료0/is_error=false/modelUsage 확인. 다섯 P2 해결 및 새 P0/P1/P2 없음. P3 세 항목은 현 범위에서 비차단으로 기록: Proxy extras는 실제 JSON 정규화 입력 범위 밖이고 인자를 전파하지 않아 실행 영향 없음; grant999ms 성공 경계 개별시험은 미실행(1000ms 거부는 시험); 시계검사 실패 전 grant 소모 순서 보강은 한 invocation·단일dispatch 구조에 재사용 경로가 없어 유지. 향후 실제 host 포트 연결 시 재검토. 재검수 후 production 소스 변경 없음.

증거: [최종49시험](evidence/pickup-gleo-tests-final.txt), [기존Android빌드](evidence/pickup-gleo-preview-build.txt), [환경·보존검사](evidence/pickup-gleo-environment.json), [최종해시](evidence/pickup-gleo-final-manifest.json). plan/review/followup의 input/response/meta/raw와 review-manifest도 pickup-gleo 접두사로 보존. 실제Gleo 연동·SDK·실차·release는 미완료.
