# Gleo 연동 준비 · 실행 경로 비활성

현재 결과는 **실제 Board와 연결해 시험한 Node 내부 어댑터**입니다. Gleo 자연어 호출, Android Intent 수신·응답, 호출자 인증, 차량 UX SDK 연결은 구현되지 않았습니다. 기존 HTTP 서버·웹 UI·WebView에 이 모듈을 연결하지 않았습니다. 기본 인스턴스는 모든 명령을 거부합니다.

## 사용과 재현

저장소 루트에서 `node --test experiments/pickup-board/*.test.mjs`를 실행합니다. `gleo.test.mjs`의 가짜 host attest만 시험용으로 사용합니다. 이 fixture를 실제 인증이나 정차 판정으로 복사하지 마세요.

`PickupVoiceReadiness(board, { attest, now })`가 동기 `Board`를 감쌉니다. `bind({ id, token })`은 신뢰할 호스트의 현재 운전자 세션 공급 지점입니다. Intent/음성 인자에서 세션이나 권한을 받으면 안 됩니다. 준비 단계에는 영속 세션 공급자가 없으며 자동 복원을 하지 않습니다.

1. 신뢰할 호스트가 검증한 세션으로 `bind`합니다. role 문자열은 신뢰하지 않고 실제 Board capability로 검증합니다.
2. `prepare({ action, extras })`는 `{ ticket }` 또는 `{ response }`를 반환합니다. ticket은 빈 객체의 동일성으로 식별하며 직렬화·복원할 수 없습니다. 거부·형식 오류를 포함한 새 명령은 이전 준비 요청을 폐기합니다.
3. `dispatch(ticket)`은 Callback 형태 객체를 반환합니다. 5초 이내 한 번만 사용하며 잘못된 ticket도 현재 대기 요청을 폐기합니다. 재시도는 사용자 새 요청으로만 시작합니다.
4. 배경 전환/세션 상실/사용자 전환에는 `clear()`, 수명주기 종료에는 `dispose()`를 호출해야 합니다. 다시 생성한 인스턴스는 바인딩·ticket이 없습니다. 이 lifecycle은 Node 시험이며 실제 Android 콜백 시험이 아닙니다.

`attest(invocation, phase)`는 prepare/dispatch 각각에 새 일회성 객체를 공급해야 합니다: `{ invocation, phase, checkedAt, caller: 'verified', ux: 'allowed', online: true }`. `checkedAt`은 `now`와 같은 단조 시계이며 1초 미만만 허용합니다. 기본 issuer는 null을 반환합니다. 해당 인터페이스는 **인증 구현이 아닌 신뢰할 host 경계**입니다. 객체를 생성할 수 있다는 사실이 Gleo 발신자 검증을 의미하지 않습니다. 실제 공급자를 연결하기 전에 출처·권한·플랫폼 UX를 검증해야 합니다.

## 두 명령의 경계

| 이름 | 의미 | 인자 |
|---|---|---|
| GET_PICKUP_STATUS | 현재 유효 회차의 진행·준비 상태 조회 | 없음 |
| REPORT_PICKUP_ARRIVAL | 운전자의 명시적인 수동 도착 알림 | 없음 |

action은 대소문자·공백까지 정확히 일치해야 합니다. extras 생략, 빈 객체, 또는 `ACTION_PARAM` 단일 문자열의 빈 JSON 객체만 허용합니다. JSON 공백(space/tab/CR/LF)은 허용하고 BOM·중첩 인용·다른 타입·추가 key·1024바이트 초과는 거부합니다. 필수 인자가 없으므로 누락 질문은 발생하지 않습니다. 개별 extra 전달도 두 명령에서는 빈 extras일 때만 허용됩니다. 이는 문서 불일치 하의 로컬 후보 계약이지 Gleo 실제 전송형식 인증이 아닙니다.

도착은 prepare에서 확보한 version/view로만 수행합니다. 그사이 변경되면 asking 응답 후 새 요청을 요구합니다. 조회는 dispatch 시점의 최신 값을 읽습니다. 도착의 자체 view와 조회 view를 공유하지 않습니다. 탑승자 대행, 장소 변경/수락, 종료는 제공하지 않습니다. 기존 joined/waiting/no-proposal/역할/회차/버전/8초 서버 lease 검증을 그대로 적용합니다. 어댑터의 단조 5초 만료가 서버 Date.now 기반 lease보다 추가로 제한하며 기존 Board 시계 정책을 변경하지 않습니다.

응답은 success/asking/fail, 영어 message, mode=voice를 사용합니다. data는 객체 배열의 JSON 문자열이며 progress/riderReady/riderJoined/locationChangePending만 포함합니다. 위치·세션·초대·view·요청ID·사건 원문은 반환하거나 로그하지 않습니다. 위치를 자동 판정하거나 상대 탑승을 대신 확인하지 않습니다. 알 수 없는 action은 로컬 오류의 `UNKNOWN_ACTION`으로 표시하며 Android로 방송하는 경로는 없습니다.

## 실제 연결 전에 필요한 것

- 제품 Android 패키지·버전을 확정하고 안전한 native 운전자 세션 공급자를 마련합니다. `org.example.pickupboard`/`0.0.0`은 미등록 후보 값입니다. WebView sessionStorage를 JavaScript bridge로 꺼내는 방식은 구현하지 않았습니다.
- 공식 Gleo 호출자 및 callback 수신 대상의 package/signature/permission 계약을 확보합니다. action·packageName extra·schema 등록 자체는 인증 증거로 사용하지 않습니다.
- 실제 수신 Intent에서 인자 형식을 검증하고 후보 parser 허용 규칙과 대조합니다. 문서의 개별 putExtra와 ACTION_PARAM 설명 불일치는 미해소입니다.
- 검증된 Android 수명주기/UX/온라인 상태를 host 포트에 연결합니다. default deny를 true 상수로 교체하지 않습니다. 비동기·HTTP Board로 교체하면 현재 동기 원자성 증거가 무효이며 취소·timeout·중복 실행을 다시 설계/검증해야 합니다.
- `contract/schema.candidate.json`을 검토 후 제품의 `assets/schema.json`으로 배치하고 action filter를 연결합니다. 현재 APK에는 후보 파일이 들어가지 않습니다. 외부 제출·권한 변경은 별도 사용자 승인 대상입니다.
- 공식 callback action `ai.pleos.playground.intent.action.APP_ACTION_RESPONSE`, extras `packageName`과 `response` JSON 문자열 계약에 맞춰 **확인된 수신 대상**으로 송신하는 transport를 구현합니다. 지금은 callback 객체 생성만 검증했습니다. 7초 플랫폼 timeout은 side effect rollback 보장이 아닙니다.
- 스키마 검토·승인 후 실제 Gleo 자연어→새 Intent/재진입→앱 상태 변화→실제 callback 수신까지 시험합니다. Android 빌드만으로 이 게이트를 통과하지 않습니다.

## 공식 근거 · 확인 2026-11-03 KST

[App Schema](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/app-capability): 최대 3개 action, activity/startActivity 및 service/sendBroadcast, 영어 설명. 후보는 두 개만 사용하며 예시 필드 invokeWord는 정의 불일치로 제외했습니다.

[Callback](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/action_callback): 세 상태, data 문자열, 영어 메시지와 7초 timeout.

[Examples](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/examples): 요청 인자 설명 불일치와 callback envelope를 대조했습니다. 인증 계약은 이번 범위에서 확보하지 못했습니다.

[Delivering schema](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/deliver-schema): assets/schema.json·필터·검토/승인 절차. 자동 스캔 설명을 승인 우회 방법으로 취급하지 않습니다.
