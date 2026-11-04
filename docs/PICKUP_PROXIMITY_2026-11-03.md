# 픽업 근접 판정 · 2026-11-03

## 범위와 결과

사용자의 기능별 병렬 구현 지시에 따라 차량 좌표 기반 근접 판정 모듈을 전용 worktree에서 구현했다. **완료 범위는 합성 입력 판정과 통합 준비다. 실제 차량 SDK 근접 연동은 미검증·비활성이다.** 총괄 채팅이 명시적 합성 UI 연결·최종 통합 실행을 담당한다. 지도 제공자와 휴대폰 위치 수집은 다른 채팅 소유다.

- 브랜치: codex/pickup-proximity
- worktree: C:/Users/dldyd/.codex/worktrees/pickup-proximity/HYUNDAI_AI
- 기준 HEAD: 70cf2ae0ef5925aede7dfed9869ebca8c57d0206
- 최신 미커밋 소스는 원본에서 필요한 파일만 복사했고 복사 전/후/대상 SHA256이 일치했다. baseline-manifest.json 자체 SHA256: EB714CC4D7FB36F4EB1A19474BFC67B4F07F0B962840EC452FC0EE303B4AAB11.
- 변경: 신규 proximity/detector.mjs, proximity/README.md, proximity.test.mjs, 이 보고서, work/pickup-proximity 증거. 전용 worktree의 FILE_OWNERSHIP.md에만 소유 메모 추가. 공유 checkout·기존 domain/app/server/UI/build/Gleo 미변경.

## 동작과 수용 조건

약속 회차와 확정 목적지 id/revision/latitude/longitude에 결합한 독립 detector다. near/far/unknown, notify를 반환하며 수동 arrive/board를 호출하지 않는다. 목적지 변경은 새 revision, 지연 콜백은 opaque generation으로 분리한다. pending proposal은 확정 목적지를 바꾸지 않는다.

시연 정책: 100m 진입/150m 이탈, accuracy<=30m, 관측·수신 각 5초 미만, 서로 다른 증가 관측 2회. 거리+accuracy가 진입 반경 이내, 거리-accuracy가 이탈 반경 이상일 때 확인한다. 중간 띠는 후보를 초기화하고 신선한 확정 상태를 유지한다. 새 부정확 관측·만료·권한 거부·단절은 unknown. 재전달·역순은 최신 상태와 TTL을 갱신하지 않는다. 숫자·좌표·미래/역행 시계도 검사한다.

알림은 해당 목적지 binding 생애 내 최대 한 번 제안하며 수신/표시 보장은 아니다. 권한 복구·background 복귀로 latch를 지우지 않는다. 프로세스 재시작 후 중복 억제는 미구현이다. 호스트가 대기 알림을 폐기하면 알림이 유실될 수 있으며 자동 재전송하지 않는다. 종료/역할전환 dispose, 매 렌더와 타이머 read, 수동 arrived/boarded에서 unavailable('manual-stage') 호출이 통합 계약이다.

source:'synthetic' 외 입력은 차단한다. 두 시각은 합성 생성기와 판정기가 공유하는 동일 monotonic 도메인이다. Pleos timestampMillis/휴대폰 Date.now를 넣거나 confidence를 accuracyMeters로 이름만 바꿔 연결하면 안 된다. 좌표는 출력·로그·외부 전송에 포함하지 않는다. 임계값/정확도 마진은 운영 안전성이나 실측 정확도 보장이 아니다.

## 실제 API 비교와 증거

확인일 2026-11-03 KST. [공식 FusedLocation 소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/intro)는 v1.1.3, isSupported 및 addProximityAlert/removeProximityAlert를 명시한다. [위치 접근](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/location-data-access)은 last-known이 새 계산 보장이 아니며 null 가능, 리스너 onChanged/onError 및 동일 리스너 해제를 설명한다.

| 경로 | 확인한 계약 | 제한과 판정 |
|---|---|---|
| 차량 좌표 거리 계산 | 실제 FusedLocation1.1.3.jar의 LocationData latitude/longitude/confidence/timestampMillis getter, 위치 리스너 | confidence 단위/신뢰구간, timestamp epoch·관측시점 공식 계약 미확인. 수신시간만으로 대체하지 않음. 합성 입력만 구현 |
| SDK 근접 알림 | addProximityAlert(ProximityAlertRequest,ProximityAlertListener), removeProximityAlert(String); request latitude/longitude/radiusMeters/transitionTypes; listener onRegistered(String), onTransition(ProximityAlertEvent), onError(Exception); ENTER/EXIT | Event 공개 필드는 alertId/transition뿐. 관측 timestamp·accuracy getter 없음. 알림 지연·중복·해제 후 콜백·재연결·초기 내부 진입 의미 미확인. 실제 서비스 호출하지 않음 |
| 권한/지원 | add/remove 모두 실제 jar RequiresPermission("pleos.car.permission.FUSED_LOCATION") annotation. isSupported 확인 요구는 공식 소개 문서 | 특정 기기 capability·권한 현재값은 이번 시험하지 않음. 기존 에뮬레이터 위치 성공이 근접 알림 실행 증거는 아님 |

[addProximityAlert 상세](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/fused-location/ai.pleos.playground.location.fused/fused-location/add-proximity-alert)와 [removeProximityAlert 상세](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/fused-location/ai.pleos.playground.location.fused/fused-location/remove-proximity-alert)를 열었으나 추출 본문에 시그니처/의미 설명이 없었다. 따라서 확보한 공식 SDK 공개선언을 javap로 대조했고, 미확인 계약을 API 부재로 표현하지 않는다.

실제 jar SHA256 97EB72EF042DB9307494879D7B9C186D0FBA1CC7BFB6049FD44EA47BD7571D98. 증거 work/pickup-proximity/sdk-signatures.txt, sdk-annotations.txt, sdk-hash.json. APK 컴파일/SDK 실행 증거가 아닌 아티팩트 검사다. 원래 jar·키·권한은 변경하지 않았다.

## 실행·검수

Windows, Node v24.19.0. `node --test experiments/pickup-board/*.test.mjs` 최초82/82, 검수 수정 후86/86, 최종 수명주기 보강 후88/88 종료0. 기존49(HTTP/도메인/fake DOM/Gleo fake host)+신규39(합성 좌표/시간/세대 경계)이다. `node --check experiments/pickup-board/proximity/detector.mjs` 종료0.

Claude Opus5.5 설계 세션 28b77102-e89b-4d31-8c62-4c74bf054fa3, Haiku5.5 고정 구현 검수 608c45e6-a104-48cd-9eda-85ed13c0faa7. 실제 modelUsage 일치, is_error=false, exit0. safe-mode/tools빈값/strict빈MCP/plan/print/json 고정 입력만 전달했고 소스 수정 권한 없음.

- Opus B1의 wall-clock 사용 제안은 SDK epoch 가정에 기초하므로 미채택. 이번 두 입력 시각은 명시적 합성 monotonic이며 실제 SDK 경로 자체를 차단한다. B2 알림 latch/비동기 세대확인, B3 수동 단계/수명주기, B4 revision 충돌, B5 read 시 TTL, B6 후보 연속성은 반영.
- Haiku M1 오래된 재전달이 fresh near를 강등, M2 같은 revision의 다른 id 허용, L3 부정확 표본이 타임스탬프 소모: 각 재현 시험을 추가해 수정 전 3건 실패 확인, 최소 수정 후 모두 통과. 원문 review-regressions-before.txt.
- L1 최대한번 제안·표시유실 한계를 문서화. L2 확정 ended에서만 end하는 예제로 수정. Board 공존 시험은 UI wiring 검증이 아님을 명시. clock injection 책임과 새로운 부정확 fix의 unknown 전환 명시.
- 최종 한정 재검수 결과는 work/pickup-proximity/followup-response.txt 및 raw JSON에 보존한다.

도구 실패: 최초 managed worktree 쓰기와 git 조회가 sandbox 경계로 거부되어 필요한 작업만 승인 요청 후 진행. 증거 저장 명령 끝에서 아직 생성 전 review-response.txt를 조회해 exit1이 나온 적이 있으나 별도 node --check exit0과 증거 파일 존재를 확인했다. 승인 우회 없음. 검수용 CLI 도구는 정상 종료했다.

## 통합과 남은 범위

통합할 앱 파일은 신규 3개뿐이다. 공통 FILE_OWNERSHIP/README 등 복사본을 공유 checkout에 덮어쓰지 않는다. 신규 보고서·전용 증거와 integration.patch, final-manifest.json을 함께 전달한다. 기존 픽업 파일 불변 검증은 baseline-verification.json을 따른다.

미실행/차단: 실제 SDK 근접 등록/transition/해제, Android 빌드, 에뮬레이터·실차, 실제 permission denial·reconnect, 좌표 원천 시계·정확도 검증, UI 통합 실행. 기기/공유 서버 점유하지 않았다. Dot 기존 탭이 다른 세션 소유여서 과제 전송 전 차단, 우회/중복 채팅 없음. 실제 위치 연동 재개에는 원천 freshness/accuracy와 근접 이벤트 lifecycle 계약 및 기기 시험이 필요하다. 현재 synthetic 시험을 실제 연동 완료로 보고하지 않는다.

최종 재검수: Haiku5.5 bab314e0-72f3-42af-8ebf-d8041db02658, is_error=false/exit0, 기존 수정 회귀 및 P0/P1 없음. P2 종료 후 재bind·다른 회차 경유 revision 우회 제안은 한 detector=한 session, end terminal 가드와 2시험으로 반영, 최종88/88. 이 마지막 소규모 가드는 추가 Claude 재호출 없이 Codex가 검증했다. P2 floating-point 경계 시험 제안은 현 Node 환경의 정확 경계 회귀로 보존하고 94.99/95.01/155.01 인접 시험도 존재함을 확인했다. 운영 판정에 임의 epsilon을 추가하지 않았다. 최종 앱 소스 편집 종료, 총괄 통합 대기.
