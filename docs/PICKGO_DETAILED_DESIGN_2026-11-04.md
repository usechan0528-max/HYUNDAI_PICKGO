# PICKGO 세부 설계와 현대 내비·Gleo 구현 가능성

2026-11-04 KST · Codex 총괄 / 실제 Claude Opus 5.5 독립 설계 검토 및 반론 교환.

사용자 승인 범위: 두 진입 흐름의 공동 검토·세부 설계·구현 가능성 확인. 이 문서의 보완 정책은 설계 제안이며 사용자가 새 제품 결정을 승인한 것으로 취급하지 않는다. 앱 본구현·외부 발송·공개·계정/권한 변경은 수행하지 않았다. J-01은 개발 대상에서 제외한다.

## 1. 결론

후속 사용자 결정: 현대 내비가 불가능한 구조일 때 카카오맵을 고려하되 공모전 문제없음 확인 후 채택한다. [조건부 대안 검토](PICKGO_KAKAO_FALLBACK_2026-11-04.md). 현재는 데이터 저장·공유 및 AAOS 적용 조건이 미해소라 전환 보류이며, 현대 내비 우선은 유지한다.

현대 내비 검색 화면에 검색어 전달, 목적지 설정/조회, Gleo의 앱 기능 호출은 공식 연결 지점이 있다. 그러나 현대 내비 검색 결과를 PICKGO로 직접 반환받는 계약, 현대 지도 임베딩·핀 선택 반환, 정차 적합 후보 데이터, 휴대폰-차량 연결·초대 전송·원격 알림을 내비/Gleo가 일괄 제공한다는 근거는 확보하지 못했다.

따라서 사용자 흐름 전체를 확정 지원으로 약속하지 않는다. 차량 검색과 안내는 현대 내비 연동을 우선하고, 후보 평가·장소 합의·초대·위치 공유는 PICKGO가 담당하는 구조로 설계한다. 외부 지도/검색 서비스는 필요할 때 검토할 대안이며 사용자 지정 현대 내비 기반을 임의로 대체하지 않는다.

## 2. 화면과 흐름

### 공통 장소 선택

1. **검색 진입:** 직접 입력·앱 마이크·Gleo가 하나의 검색어 초안으로 모인다. 한국어 검색어를 확인·수정할 수 있게 한다. 검색 세대가 바뀌면 이전 결과를 폐기한다.
2. **검색 기준 장소 선택:** 장소명·주소·좌표·출처를 확보한다. 같은 이름의 지점은 사용자가 구별한다. 이것은 승차 좌표가 아니다. 내비 검색 결과 반환이 확인되기 전에는 이 단계를 실제 연동 완료로 표시하지 않는다.
3. **주변 후보:** 적격 후보 최대 3개. 카드에는 승차 지점 설명, 접근 방향, 보행 부담, 확인 근거·기준 시각을 표시한다. 1~2개면 그대로, 0개면 다른 기준 장소/범위로 재검색한다. 근거 없는 후보로 수를 채우지 않는다.
4. **지도 세부 조정:** 핀 이동 중에는 초안만 바꾸고 놓은 좌표를 재검증한다. 화면용 핀과 차량 도달 지점을 구분한다. 도로 반대편·건물 중앙·진입 불가 위치를 자동으로 확정하지 않는다. 이전 검증 응답은 새 핀에 적용하지 않는다.
5. **확정:** 검증된 지점의 좌표·진입 방향·출처와 revision을 저장한다. 후보 검사 중/차단/미확인은 확정 불가를 기본안으로 한다.

### 운전자 시작

`검색 → 후보 → 조정·검증 → 지점 선택 → 사람 선택 → 초대 발송 → 경로 안내 → 도착·탑승 → 종료`

- 사람 선택은 사전 연결된 PICKGO 사용자 목록을 우선 제안한다. 임의 연락처 초대는 연결할 메시지 시스템의 접근·전송 계약이 확인된 뒤 추가한다.
- 발송 전 대상자와 지점을 확인한다. 링크 생성, 발송 요청 수락, 전달 확인, 링크 참여는 별개다. 공유창을 열었다고 보냈다고 표시하지 않는다. 전달 확인을 제공하지 않는 시스템에서는 `전달 미확인`으로 유지한다.
- 대상자는 설치 없이 링크에 참여할 수 있는 기존 방향을 유지한다. 링크 참여와 위치 동의를 분리한다. 위치 공유를 거절해도 확정 지점·준비·탑승 확인은 사용할 수 있다.
- 초대 발송 후 `안내 시작`을 운전자가 명시적으로 선택하는 안을 권고한다. 대상자 미참여 상태로 출발할 수 있으나 `대상자 미참여·위치 미공유`를 표시한다. 이 정책은 사용자 확인 대상이다.
- 미참여 상태의 차량 도착 감지는 안내 정보이며 탑승 완료가 아니다. 기존 `arrive`의 참여 필수 계약을 조용히 바꾸지 않는다. 끝내 참여하지 않은 회차의 종료는 취소로 남긴다.
- 대상자 제안은 대기 중 제안으로 표시한다. 상대 수락 전에는 합의 지점이나 내비 목적지를 바꾸지 않는다.

### 탑승자 시작

`사전 연결 차량 선택 → 공통 장소 선택 → 요청 확인·전송 → 차량 수락/거절 → 경로 안내 → 도착·탑승 → 종료`

- 요청자는 인증된 탑승자 앱 사용자이며 연결이 유효한 차량만 선택한다. 단순 차량 ID 입력으로 요청할 수 없게 한다.
- 회차 이전 `PickupRequest`를 둔다. 요청 만료·철회·거절을 기록하고 운전자 수락 때 한 번만 회차를 만든다. 탑승자는 그 회차에 참여한 상태가 되지만 위치 공유 동의는 별개다.
- 운전자가 진행 중 픽업을 가진 경우 기존 회차를 자동 교체하지 않는다. 새 요청을 보류/거절하고, 교체를 지원하려면 명시 종료 절차를 거친다.
- 운전자 수락 직전에 연결 권한·만료·좌표 revision·후보 검증 유효성을 다시 확인한다. 수락과 회차 생성은 원자적으로 처리한다.
- 정차 시 상세 요청 카드, 주행 시 플랫폼 허용 범위의 짧은 알림을 기본안으로 한다. 알림의 즉시 수락/거절 버튼 지원이 확인되기 전에는 정차 후 앱에서 수락·거절한다. 전체화면 강제 팝업이나 자동 경로 전환은 사용하지 않는다.
- 모바일에서 차량용 NaviHelper를 직접 쓸 수 있다고 가정하지 않는다. 같은 UX 단계와 후보 정책을 제공하되 모바일 검색·지도 공급 수단은 별도 검증한다.

## 3. 상태와 데이터 계약 — 설계 제안

| 축 | 주요 상태/필드 | 핵심 불변 조건 |
|---|---|---|
| 연결 | pending / active / revoked; driverAccount, riderAccount, vehicleAppBinding | 사전 양측 확인, 해제 즉시 이후 요청·열람 차단. 차량 ID는 인증 아님 |
| 요청 | draft / pending / accepted / declined / withdrawn / expired; requestId, expiresAt, revision | 늦은 알림에서 수락 시 서버 재확인. 중복 수락으로 회차 2개 생성 금지 |
| 검색 기준 | query, anchorId, coordinates, source, searchGeneration | GPS와 최종 승차 좌표와 분리 |
| 후보/검증 | candidateId, coordinate, roadSide/access, ruleset, evidenceAt, validUntil, verdict | rejected/unknown은 적격 후보가 아님. 핀·규칙 변경 시 재검증 |
| 픽업 회차 | driver, rider, joined, progress, outcome, version | 기존 역할·준비·수동 탑승·취소 구분 유지 |
| 장소 합의 | confirmedPoint, placeRevision; pendingProposal(baseRevision, proposer, validation) | 상대 수락 필요, 오래된 제안 거부, GPS로 자동 변경 금지 |
| 내비 | idle / requested / confirmed / failed / unknown; targetRevision, actualDestination | 요청 반환만으로 confirmed 금지. 합의와 실제 목적지 불일치 표시 |
| 초대 | created / sendPending / sent / failed / joined / revoked / expired | sent는 공급자의 수락 근거가 있을 때만. 공유 UI 실행은 sent가 아님 |
| 위치 공유 | off / active / stale / revoked / expired; consentId, sequence, accuracy, observedAt, receivedAt | 동의·회차·시간·순번 검사. 종료/철회 후 더 수집·표시하지 않음 |

새 상태 모델은 현재 고정 문자열 `PLACES` 기반 Board를 그대로 확장할 수 없다. 문자열에 좌표를 끼워 넣는 대신 장소 ID와 좌표 모델로 바꾸고 저장된 회차 호환 또는 명시 초기화 정책을 정해야 한다.

내비 변경은 한 번에 하나만 진행한다. 지점 수락 후 내비가 실패해도 합의 장소를 되돌리지 않는다. `합의 지점 X / 내비 목적지 Y` 또는 조회 실패 시 `내비 목적지 확인 불가`를 표시한다. 최신 요청 세대·목적지 좌표를 대조하기 전 늦은 완료 이벤트를 성공으로 표시하지 않는다. 사용자가 내비에서 직접 목적지를 바꿨을 때도 합의 지점을 덮어쓰지 않고 불일치로 처리한다.

목적지 일치 판정은 좌표 완전일치나 임의 반경 하나로 정하지 않는다. 도로 스냅 가능성을 실제로 확인하고 동일 진입 도로·도로변 방향·POI/좌표 의미를 함께 검증한다. 반대편 차로를 허용오차로 합치지 않는다. 공급자 계약과 실기기 시험 전에는 일치 확인불가로 유지한다.

## 4. 후보 선정과 위치 공유

후보 필터는 일반 승용차의 짧은 승하차 기준이다. 공식 지정 구역만 요구하지 않되 대중교통/택시 전용, 금지·단속, 폐쇄·진입 제한, 보행 접근 불가를 제외한다. 특정 실제 장소가 적격이라는 판정은 이번 조사에 포함하지 않았다.

필수 입력은 도로변 좌표·차량 진입 방향·시간대별 제한 근거·보행 연결·데이터 신선도다. 정차 카메라 이벤트 하나를 모든 단속구역 데이터로 해석하지 않는다. 제한 정보가 없다는 이유로 허용 판정을 만들지 않는다.

적격 집합 안에서 차량 우회 부담, 탑승자 보행 부담, 지점 구별 용이성으로 비교한다. 실제 경로가 없으면 도보시간/우회시간을 만들어 표시하지 않는다. 대상자를 고르기 전에는 검색 기준 장소에서의 접근만 계산하고, 이후 동의된 대상자 위치로 비교값을 갱신할 수 있다. 이 갱신은 확정 지점을 자동 변경하지 않는다. 가중치·탐색 반경은 데이터 확보 후 조정할 설계값이며 효과 실측이 아니다.

연속 위치는 회차별 별도 동의를 받는다. 정확도 원·마지막 갱신 시각과 미공유/오프라인/stale을 구분한다. 브라우저 링크는 배경·화면잠금 시 연속 수집을 보장하지 않는다. 물리폰에서 이를 시험하기 전 `항상 실시간`으로 약속하지 않는다. 업데이트 주기·stale 임계값·요청 및 위치 TTL은 실기기 시험으로 정하며 아직 제품 확정값이 없다.

## 5. 기능별 구현 가능성

| 사용자 요구 | 확인한 공식 연결점 | 이번 판정 | 남은 확인 |
|---|---|---|---|
| 현대 내비 검색 화면·검색어 전달 | requestNavigationScreen(NavigationScreenRequest.SearchPlace(String)) [S2,S3]; NAVI_CUSTOM_MAP [S4] | 문서 목록 + 실제 SDK 선언 + Java 컴파일 확인 | 실행 화면, 권한, 검색어 전달, 취소·복귀 |
| 검색 결과를 PICKGO가 받아 후보 계산 | 일반 POI 결과 callback/선택 결과 계약을 공개 API에서 찾지 못함 | 미확인 | POI 결과/좌표 반환과 앱 복귀 계약. 검색창 열림과 다름 |
| 경로 시작·변경·목적지 확인 | requestRoute(RouteInfo), getDestinationInfo/onDestinationInfo [S1]; NAVI_ROUTE_SEARCH/NAVI_ROUTE [S4] | 문서·선언·컴파일 확인 | 실제 목적지/탐색 이벤트, 임의 좌표의 POI 필드 계약, 기존 경로 전환 |
| 주변 후보 3곳·금지구역 배제 | 내비/Gleo가 적격 승차 후보를 제공한다는 근거 없음 | PICKGO 데이터·엔진 필요 | 도로·제한·접근·보행 근거와 실지역 검증 |
| 현대 지도 임베딩·핀 조정 | NavigationScreenRequest는 내비 화면 요청. 공개 MapView/핀 결과 반환 미확보 | 미확인 | 공식 지도 구성/선택 반환 계약 또는 별도 지도 승인 |
| 직접 음성 검색 | SpeechToText3.3.1 [S5] | 텍스트 변환 지원 문서 확인; 실행 미실행 | 마이크·한국어 결과·오류/취소. 검색엔진은 별도 |
| Gleo 검색 진입 | schema action→Intent→callback [S6-S9] | 공식 구조 확인, 새 schema·native 구현·승인·실호출 없음 | 인증 대상/실제extras/7초/실행UX/승인 |
| 대상자 선택·초대 전송 | NaviHelper/Gleo의 연락처·메신저 전송 계약 미확보 | 별도 사용자/전송 연동 필요 | 연락처 접근, 공급자, 전송·전달 확인, 실패 재시도 |
| 대상자 실시간 위치 | 내비는 차량 정보이며 대상자 위치 공급자가 아님 | PICKGO HTTPS 동의·중계·표시 필요 | 물리폰 권한/배경/잠금/철회/신선도 |
| 사전 연결 차량에 요청·팝업 | 내비/Gleo가 원격 차량 연결·push를 제공한다는 근거 미확보 | 별도 연결·인증·메시징·차량 알림 경로 필요 | suspend/offline/앱 종료/재로그인, UX 제한 |

`getInternalApi()`나 `isMobileRequest` 같은 SDK 심볼 이름은 공개 POI 검색 또는 모바일 차량 연결 권한의 증거가 아니다. 내부 API를 대안으로 사용하지 않는다.

RouteInfo 공식 Java 예시는 9개 인자이지만 확보된 navi-data3.0.4의 공개 생성자는 11개 인자다. 좌표 순서와 추가 필드는 검증 없이 예시를 복사하지 않는다. 이번 컴파일은 이미 구성된 RouteInfo를 인자로 전달하는 호출 검사이며 임의 좌표 객체 구성·경로 성공 검증이 아니다.

## 6. Gleo 세부안

| action 제안 | 범위 |
|---|---|
| OPEN_PICKUP_SEARCH(query) | 검색 준비 화면 진입·검색어 초안. 후보 확정·초대·안내 시작을 자동 실행하지 않음 |
| GET_PICKUP_STATUS | 기존 회차 상태 조회 |
| REPORT_PICKUP_ARRIVAL | 기존 운전자 명시 도착 |

현재 문서의 최대 3개를 지킨다. 기존 2개 후보에 새 검색 진입을 추가하는 안이다. Claude는 음성 요청 수락과 슬롯이 경쟁한다고 지적했다. 사용자가 Gleo 검색을 명시했으므로 검색을 우선 제안하며 음성 수락은 미지원으로 명시한다. 향후 필요하면 액션 재배치 승인이 필요하고 만능 enum action으로 제한을 우회하지 않는다.

Gleo 응답 제한은 7초다. 검색 결과나 대상자의 수락을 기다리지 않는다. 실제 PICKGO 준비 화면이 표시된 경우 `검색 준비 화면 열림`에 한정해 success, 인자 누락은 asking, 거부/오류는 fail로 응답한다. 단순 API 반환으로 현대 내비 화면 표시/검색 성공을 주장하지 않는다. timeout 이후 작업·이전 세션·중복 Intent·사용자 전환은 취소/세대 검사로 폐기한다. SDK 초기화·UX·호출자 검증 전에는 실행하지 않는다.

Gleo caller/callback 대상의 신뢰 계약과 개별 extras 대 ACTION_PARAM 예시 불일치는 이번에도 미해소다. schema의 packageName은 발신자 인증이 아니다. 기존 fake attest를 실제 인증으로 사용하지 않는다. schema 검토·승인과 앱 설치 스캔은 별개이며 승인 절차를 건너뛰지 않는다.

각 수신 호출은 로컬 terminal guard로 응답을 한 번만 결정한다. 플랫폼과의 종단간 중복 식별 계약은 별도 확인하며 정확히 한 번 전달을 보장한다고 주장하지 않는다. 7초 이후 resume에는 success를 보내지 않으며 자동 재호출하지 않는다. 검색어는 세대 종료 시 폐기하고 로그·영속 저장에 남기지 않는다. 주행 제한으로 진입할 수 없으면 asking/fail로 끝낸다.

## 7. 구현 구조와 검증 순서

차량 Android 앱은 UX 제한·음성·Gleo·NaviHelper·차량 알림을 담당한다. PICKGO 서버는 연결 관계·요청·회차·합의 revision·단기 위치 중계·초대를 담당한다. 초대 링크용 웹과 요청 시작용 탑승자 앱은 같은 서버 계약을 사용하되 배경 위치·알림 능력을 별도로 표시한다. 검색/지도/후보 데이터 공급자는 교체 가능한 경계로 분리한다. Gleo에 초대 capability나 위치 원문을 반환하지 않는다.

| 순서 | 검증 범위 | 통과 조건 |
|---|---|---|
| 1 | 현대 내비 검색 결과 회수 | 검색어→선택→좌표 수신→PICKGO 복귀를 실제 확인. 기존 경로를 몰래 바꾸지 않음 |
| 2 | 좌표 경로 요청 | 고정 시험 좌표의 요청·목적지 조회·탐색 결과·실패·기존 경로 변경을 확인 |
| 3 | 지도·후보 | 핀 이동 재검증, 0/1/2/3 후보, 전용/단속/미확인 제외, stale 응답 차단 |
| 4 | 두 역할 요청·합의 | 수락/철회 경쟁, 만료, 중복전송, 진행중 회차, 장소 수락 후 내비 실패·재시도 |
| 5 | 초대·연속 위치·차량 알림 | 물리폰 HTTPS/권한거부/철회/잠금, 차량 foreground/background/suspend/offline, 연결 해제 |
| 6 | Gleo | 승인된 schema로 자연어→인자→준비화면→callback, 7초 초과·재진입·잘못된 발신자·UX 제한 |

현재 실행 가능한 기능을 더 붙이기 전에 1번이 핵심 선행 조건이다. 내비에서 목적지를 먼저 설정한 뒤 getDestinationInfo로 가져오는 우회는 원래 단계 순서를 바꾸므로 완전한 해결이 아니다. `현재 내비 목적지를 기준 장소로 가져오기`라는 명시적 대안으로만 제안한다. 외부 지도/검색, 휴대폰 공유시트, 차량 전면 폴링도 각 부족한 요구를 명시하는 조건부 대안이다.

## 8. 실제 수행과 한계

- 브랜치 main, 다른 작업자의 기존 미커밋 앱·문서 수정 보존. 이번은 전용 문서·증거·compile-only probe만 생성했다.
- 공식 문서 재열람: 2026-11-04 KST. 일부 세부 API 페이지는 목록과 제목만 추출되어 실제 SDK 선언으로 보완했다.
- `javap -public`로 NaviHelper3.0.5, navi-data3.0.4 공개 선언 확인. `SearchPlace(String)`와 keyword getter, 내비 요청·조회·listener 확인. 일반 POI 검색 결과/핀 반환 계약은 확보하지 못했다.
- `javac --release 17`로 SearchPlace 화면 요청·RouteInfo 전달·목적지 조회·listener 코드 컴파일 종료0. Android34 android.jar, 실제 NaviHelper/navi-data와 Kotlin stdlib 사용. 실행·권한·서비스·검색결과 검증이 아니다.
- `adb devices -l`: 명령 정상, 연결 기기0. ADB 서버는 시작됐으나 앱 설치·내비·Gleo 실행 시험은 미실행이다. 기존 에뮬레이터 성공 기록을 이번 환경의 실행 증거로 전용하지 않았다.
- 제품 코드 변경이 없어 전체 앱 회귀 시험은 이번 턴에 재실행하지 않았다. 직전 176/176 결과는 이전 코드 시점의 기록이다.
- 실제 SDK 런타임/실차, 물리 휴대폰, Gleo 승인/자연어 호출, 메시지 실제 발송은 미실행·미확인이다.

## 9. Claude 검토 처리

후속 환경·UI 검증 수신: 별도 사용자 지정 검증 채팅 `01a1a65a-ed22-78e1-bee4-6e69e28ea4ad`이 이후 emulator-5556을 부팅하고 기존 WebView 검토 앱에서 첫 화면→하나로마트 양재점 픽업 생성→도착 전/참여 대기를 확인했다. 당시 Node183/183 통과·종료0 로그를 Codex가 읽었다. [검증 보고](../work/pickgo-validation-2026-11-04/report.md) 및 [시험 로그](../work/pickgo-validation-2026-11-04/node-tests.txt). 이는 앞선 조사 시점의 adb 기기0과 시간상 구분되며 내비/Gleo 런타임 성공을 뜻하지 않는다. 첫 화면 실제 장소명에 합성 표시가 없는 기존 이슈를 실제 UI에서 재확인했다. 표시 위치는 후속 UI 조정 항목으로 남기며 이번에 사용자 문구를 수정하지 않았다. 에뮬레이터 재검증 담당은 해당 채팅이며 신규 과제를 중복 하달하지 않았다.

모델 claude-opus-5-5, 세션 83664888-c27c-488e-a312-f6278fe67169, 최초 호출 종료0/is_error=false. 입력은 사용자 흐름·기존 Gleo README·도메인 상태 일부와 Codex의 확인 사실에 한정했다. Claude는 공식 출처를 직접 검증한 것이 아니라 설계 반론을 맡았다.

- 회차 밖 요청 상태 필요: 채택. 기존 driver-only create에 무단 rider 권한 추가하지 않음.
- 미참여 출발과 arrive 참여 필수 충돌: 명시 출발 제안/도착표시 제한·취소 결과로 처리.
- 제안 revision·검증 근거 누락: 채택, 서버의 기존 version 검사도 함께 유지.
- Gleo 슬롯 경쟁: 인정. 명시 요구인 검색을 우선 제안, 음성 수락은 새 요구로 분리.
- 목적지 먼저 설정하는 대안: 조건부만 채택, 사용자 경로 변경 부작용 때문에 기본안에서 제외.
- 화면 열기에는 취소가 필요 없다는 제안: 미채택. 늦은 화면 전환과 session 변경을 폐기해야 함.
- 내비 실패 시 이전 목적지를 단정하는 문구: 실제 조회 결과 또는 확인불가로 보완.

후속 호출도 같은 Opus5.5 세션, 종료0/is_error=false. Claude는 위 반론 1~5에 동의하고 Gleo 검색 슬롯 반론, 목적지 선설정 대안의 무조건 적용, 화면 진입 취소 불필요 주장을 철회했다. 남은 보완인 좌표 스냅/허용오차, 검색 선택 후 경로 변경 부작용, callback 중복·늦은 resume, 차량 알림 버튼 미확인, 미참여 종료 취소를 이 문서에 반영했다. 따라서 공동 설계 검토는 완료했으며 실제 연동 검증은 완료가 아니다. Dot에 신규 조사나 외부 문의는 하달하지 않았고 이번 공식 원문 대조는 Codex가 수행했다.

증거: `docs/evidence/pickgo-design-2026-11-04-*`의 input/response/raw, sdk-declarations, compile, sdk-hashes. Probe: `work/pickgo-design/ApiCompileProbe.java`. 사용자 원래 요구: [사용 흐름](PICKGO_USER_FLOW_2026-11-04.md).

## 10. 공식 출처

- [S1 목적지 설정·확인·취소](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/destinations)
- [S2 NaviHelper 공개 API 목록](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.helper/navi-helper/entry)
- [S3 NavigationScreenRequest 및 SearchPlace](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.data/navigation-screen-request/entry)
- [S4 NaviHelper 권한](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/declaring-permissions)
- [S5 SpeechToText](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/intro)
- [S6 Gleo App Schema](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/app-capability)
- [S7 Gleo Callback](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/action_callback)
- [S8 Gleo 예제·Intent](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/examples)
- [S9 Gleo schema 전달·승인](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/deliver-schema)
- [S10 Maps/Navigation 정책](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/navigation-app-development-guide)
- [S11 주행 규제](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide)
- [S12 차량별 호환성](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/api-compatibility-availability)
- [S13 플랫폼 FAQ·내비 탑재 확인 비공개](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/vehicle-app-faq)

NaviHelper 호환성은 내비 탑재 Pleos 차량 조건이다. 모든 현대 차량·휴대폰에서 지원한다는 결론으로 확대하지 않는다. 플랫폼 FAQ상 내비 탑재 확인 방법 자체는 공개되지 않았으므로 지원 확인 계약도 검증 과제다.
