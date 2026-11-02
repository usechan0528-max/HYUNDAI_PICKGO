# API 근거 — 공동 이용 조율 검토

확인일: 2026-11-02 KST. 아래는 문서 조사이며 SDK 확보·컴파일·에뮬레이터·실차 검증은 하지 않았다. ‘공개 자료에서 확인 못함’은 ‘영구 미지원’과 다르다.

| 기능 | SDK·버전 | 확인한 심볼·계약 | capability·권한·환경 | 오류·대안 | 검증 상태·근거 |
|---|---|---|---|---|---|
| 경유 요청 연결 | NaviHelper 문서 v3.0.5 | `addWaypoint`, `removeWaypoint`, `getWaypointInfo`, `RequestWaypointInfo`, `WaypointIndex.FIRST/SECOND` | 가이드상 최대 2개 경유지. 쓰기 `pleos.car.permission.NAVI_ROUTE_SEARCH`, 조회는 API별 `@RequiresPermission` 대조 필요. 내비 서비스·권한 실제 가용성 미확인 | 현재 경유지·사용자 변경을 확인하지 않고 덮어쓰면 안 됨. 실패를 성공으로 표시하지 않음 | 문서 확인. [경유지 가이드](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/waypoint-settings), [권한](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/declaring-permissions) |
| 경유지를 포함한 경로 요청 | NaviHelper 문서 v3.0.5 | `requestRouteWithWaypoints` 이름 확인 | `NAVI_ROUTE_SEARCH`; 정확한 overload·매개변수·어노테이션은 확보 SDK와 대조 전 | 전체 경로 변경 부작용·최대 경유 수·콜백 순서 확인 필요 | 문서 확인(이름·권한 수준). [레퍼런스](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.helper/navi-helper/request-route-with-waypoints) 본문은 웹 추출에서 시그니처를 확인하지 못함 |
| 내비 결과 확인 | NaviHelper 문서 v3.0.5 | `NaviHelperEventListener`, `getWaypointInfo`; 가이드에 `onWayPointInfo`와 Kotlin 예제의 `onWaypointInfo` 표기가 혼재 | Navigation 앱 구현·현재 상태에 따라 이벤트 차이. 실제 SDK 선언으로 정확한 철자 확정 필요 | 요청 수락과 상태 반영 분리. timeout·재조회·수동 변경 처리 설계 필요 | 문서 확인. [소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/intro), 경유지 가이드. 컴파일 미실행 |
| 주행 UX 제한 | AAOS/Pleos; 실제 플랫폼 버전 미확정 | `CarUxRestrictionsManager.registerListener`, `onUxRestrictionsChanged`, `CarUxRestrictions.getActiveRestrictions` | 플랫폼 규제 값에 따라 UI 제한. 앱 카테고리와 DO 적용도 확인해야 함 | 미확인·단절 시 보수적으로 제한. 사용자 버튼/속도 0으로 주차를 확정하지 않음 | 문서 확인. [주행 규제](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide) |
| 차량 데이터 | Vehicle SDK 문서 v2.3.2 / Service v2.3.21 | 도메인별 capability/get/set/callback 구조. 개별 신호 심볼은 아직 선정 안 함 | 조회 `CAR_*`, 제어 `CONTROL_CAR_*`; 각 함수 권한과 승인 범위 확인 필요 | capability 실패·권한 거부·미지원·오래된 값을 구분 | 구조 문서 확인. [소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/intro), [권한](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle-permission) |
| 후석 취침·음향 구역 제어 | Pleos 앱용 계약 미확인 | 확인한 Vehicle 도메인 표에 별도 오디오 도메인이 보이지 않음. 이를 전체 SDK 부재의 증거로 확대하지 않음 | capability/권한/지원차종 모두 미확인 | 개념 모형만 가능하다고 표시. 다른 앱의 권한을 우회하지 않음 | 미확인. Vehicle 소개와 오디오 가이드 검토 범위 |
| AAOS 앞뒤 음향 균형 | AOSP의 시스템 API, Pleos 허용 계약 아님 | `CarAudioManager.setFadeTowardFront(float)`에 `@SystemApi`, `Car.PERMISSION_CAR_CONTROL_AUDIO_VOLUME` | 시스템 앱용 설명. 공모전 앱이 해당 권한을 받을 수 있는지는 별도 확인 | API 존재만으로 일반 앱에서 사용할 수 있다고 결론 내리지 않음 | 문서 확인(플랫폼 기능). [Audio control HAL](https://source.android.com/docs/automotive/audio/audio-control-hal) |
| 음악·안내·통화 공존 | AAOS + Pleos 오디오 포커스 정책 | `AudioAttributes`, `AudioFocusRequest`, `AUDIOFOCUS_LOSS_TRANSIENT`, duck 등 | 앱이 플랫폼 포커스 정책을 따름. 후석별 믹서 제어 또는 임의 타사 앱 제어의 근거가 아님 | Gleo/통화/긴급 안내 때 요구 동작 준수. 포커스 선점으로 기능 구현을 가장하지 않음 | 문서 확인. [오디오 가이드](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/audio-focus-development-guide/audio-focus-development) |
| Gleo가 우리 앱 호출 | Gleo Interface, 문서 버전 미표기 | `assets/schema.json`, App Schema, Gleo Action, Callback, action filter | 스키마 검토·승인 후 통합. 공모전 적용 절차 미확인 | 직접 앱 실행이 대안. 역방향 범용 Gleo 호출·대화 전체 조회로 해석하지 않음 | 문서 확인. [구조](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/core-concepts), [승인](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/deliver-schema) |
| 탑승자별 역할·신원 | 미선정 | 해당 앱이 쓸 수 있는 식별/인증 심볼 미확인 | 좌석 감지와 사람 신원·동의·보호자 권한은 별개 | 명시적 역할 입력 시 입력 부담도 평가. 시연 역할 버튼은 실제 인증이 아님 | 미확인 |
| 지속 상태·백그라운드 | 앱 자체 설계 + Pleos 정책 | 수명주기·복원·작업 중단/재개 설계 | 무제한 상주를 보장하지 않음 | 오래된 요청 자동 재실행 금지. 요청 만료와 실제 설정 복원은 다른 기능 | 문서 확인. [동작 모델](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/app-structure-screen-model) |

의존성 판단: 현 평가 작업에는 추가 오픈소스·AI API·유료 키가 필요하지 않다. 제품 개발 시 SDK와 해당 권한을 먼저 확인하며, LLM은 요구 파싱 후보일 뿐 신원·동의·실행 권한·성공 판정의 근거가 될 수 없다. 외부 AI 공급자와 데이터 전송은 미결정이다.

## 서울시 실제 연결 — 2026-11-02
- 공식 출처: https://data.seoul.go.kr/dataList/OA-21709/A/1/datasetView.do (서울특별시, 공공누리 제1유형). 실제 현황과 5분 이상 차이 가능.
- 서비스 GetParkingInfo, 공개 sample 요청 http://openapi.seoul.go.kr:8088/sample/json/GetParkingInfo/1/5/ . 문서상 개발 sample은 첫 5건 제한. 운영 키 발급 없음.
- 정확한 필드: PKLT_CD=171721, TPKCT 총면수, NOW_PRK_VHCL_CNT 현재 주차 차량수, NOW_PRK_VHCL_UPDT_TM 관측시각, PRK_STTS_YN=1 연계 존재. 공급자의 20분 연계표시와 앱의 5분 만료정책을 구분.
- 직접 HTTP 호출 INFO-000 확인, 로컬 /api/parking 및 실제 브라우저 표시 확인. 공급자 수치의 현장 정확도 검증은 미실행.
- 증거: evidence/seoul-parking-first-response-2026-11-02.json, seoul-parking-local-api-2026-11-02.json, live-parking-screen-2026-11-02.jpg.
- HTTP 개발 경로, HTTPS 운영 연결/서비스 키/범위확대/사설 데이터/차량 SDK는 미검증.

## 운행 맥락 추천 J1 검토 · 2026-11-02
- FusedLocation v1.1.3: `getLastKnownLocation()`, `registerFusedLocationCallback()`, `unregisterFusedLocationCallback()`, `isSupported()`를 [소개 문서](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/intro)에서 확인. 마지막 위치는 신규 관측 보장이 아니며 null 가능. 콜백·권한·주기·정밀도는 실제 SDK/환경 검증 전.
- NaviHelper v3.0.5: [소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/intro)에서 목적지 확인·경로/주행 상태 이벤트 기능 확인. 실제 이벤트는 내비 구현·상태에 따라 달라짐. ETA/남은 거리의 정확한 심볼·권한·현재 서비스 동작은 미확인. 경로 예측 API가 존재한다고 해석하지 않음. 패턴 추정은 별도 앱 기능 가설.
- 둘 모두 문서 확인만. 실제 위치수집/기록학습/SDK실행/콘텐츠 추천 성능 미실행. 기존 API 증거 상태를 일괄 승격하지 않음.

## J1 FusedLocation 실제 아티팩트 대조 · 2026-11-02
공식 [Maven 설정](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/project-setup)의 `ai.pleos.playground:FusedLocation:1.1.3` POM/AAR을 인증정보 없이 실제 다운로드했다. `/private/tmp`에만 저장, 저장소에 SDK 바이너리 미추가. SHA256/URL은 evidence/j1-sdk-boundary-2026-11-02.json.

`javap` 공개선언에서 LocationData의 getLatitude/getLongitude/getAltitude/getHeading/getConfidence/getTimestampMillis와 위치 리스너 메서드를 확인했다. 출력은 evidence/j1-fused-location-public-signatures-2026-11-02.txt. LocationSnapshotMapper.java를 실제 classes.jar에 대해 javac --release17로 컴파일하여 종료0. **이 매퍼의 타입·getter 참조만 컴파일 확인**이며 Android 앱 전체/SDK 초기화/콜백/서비스/권한/실차 검증은 미실행이다.

타임스탬프 millis라는 이름만으로 epoch 또는 monotonic 기준을 단정하지 않는다. confidence를 확률이나 위치오차 미터로 해석하지 않는다. 둘은 raw 보존, 수신 monotonic 시각과 분리하며 현재 합성 추정기로 연결하지 않는다. null/잘못된 위경도는 관측없음으로 매핑한다. Android SDK·에뮬레이터 표준경로와 PATH 도구 미발견, 맞춤 설치경로까지 부재라 단정하지 않음.

[NaviHelper 권한 문서](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/declaring-permissions)의 정보조회 권한은 NAVI_ROUTE이며 API별 정확한 annotation 확인이 추가로 필요하다. [이벤트 문서](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/event-listeners)는 목적지 변경/취소/정보 콜백을 설명한다. 정확한 목적지 데이터 타입·ETA 계약·실제 이벤트 수신은 여전히 미확인. 읽기전용 추천 앱에 route search/control 권한을 관성적으로 추가하지 않는다.

## J1 내비 데이터 타입·단위 대조 · 2026-11-02
공식 [SDK 가져오기](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/importing-sdk) 좌표로 NaviHelper3.0.5 AAR/POM 수신. POM이 명시한 navi-data3.0.4 AAR/POM과 sources.jar도 수신했다. SDK 바이너리·소스는 임시경로에만 저장, 해시와 명령은 evidence/j1-navigation-boundary-2026-11-02.json. 공개 getter는 j1-navigation-public-signatures-2026-11-02.txt.

|입력|실제 공개 선언·주석에서 확인|선택과 한계|
|---|---|---|
|DrivingInfo.getDestination()|DrivingState 반환|현재 내비 목적지 상태 대상, 실제 콜백 수신 미검증|
|DrivingState.getDuration()|int; 현재 위치→목표 지점 예상 초|estimatedRemainingSeconds로 매핑; 0으로 도착 확정 안함|
|DrivingState.getDistance()|int; 출발점 기준 미터라는 소스 주석|distanceFromStartMetersRaw 유지, 남은 거리로 쓰지 않음|
|DestinationInfo.getRemainTime()/getRemainDistance()|초/미터; 설명의 목적지·경유지·출발점 표현 혼재|수치 이름만으로 계약 확정하지 않고 초기 매퍼 미사용|
|TripInfo.getEta()|초라는 설명|epoch시각/기간 의미 불명확, 초기 미사용|
|FusedLocation LocationData|공개 sources.jar에도 timestampMillis/confidence 의미 설명 없음|시계 기준/오차/확률 해석 보류|

NavigationSnapshotMapper를 실제 navi-data classes.jar로 컴파일 exit0. Kotlin DeprecationLevel.HIDDEN annotation 클래스 부재 경고2건 발생. 독립 classpath 실험이며 전체 의존성 해결/Android 컴파일 완료 아님. 실행·권한·이벤트 주기·현재 경로와 응답 연관·원천 데이터 신선도는 미검증이다. getter·단위 확인만으로 최신 경로 추정 입력에 바로 연결하지 않는다.
