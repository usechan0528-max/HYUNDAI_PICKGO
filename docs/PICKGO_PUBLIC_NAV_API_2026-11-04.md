# PICKGO 현대차·Pleos 공개 내비 API 조사

확인일: 2026-11-04 KST. 담당: Codex 채팅 01a1a664-ba47-77e2-a367-63602cefaa07. 사용자 승인: “현대차, pleos 공개 api 중에 이용할 수 있는 것으로 최대한 찾아보고 안되면 일단 시연 목적으로 가자”.

## 결론과 적용 범위

**현대 계열의 공개 개발 경로는 존재한다.** Pleos NaviHelper는 차량 내 Navigation 앱 연동이고, 현대오토에버 routo는 별도 지도·장소검색·경로 데이터 플랫폼이다. Hyundai Developers와 Pleos Fleet/Vehicle Data API는 차량 데이터 서비스다. 서로 대신하는 동일 API로 취급하지 않는다.

우선순위는 NaviHelper의 실제 지원 범위를 활용하고, 검색·핀 선택처럼 계약/실행이 확보되지 않은 부분은 시연으로 진행하는 것이다. routo는 현대 계열 검색·지도 공급자 후보로 보존한다. 공개 문서가 있다는 이유로 무료·무가입·무계약 사용 또는 Pleos 탑재/공모전 배포가 허용됐다고 판단하지 않는다.

같은 저장소의 병행 작업과 범위를 조율했다. 현대 내비 실행은 `01a1a661-3768-7262-a2cf-8166459e9de4`의 `experiments/pickgo-navi-selection/**`에서 수행 중이다. 지도 시연은 `01a1a630-1c0f-7b82-b2e9-a44f00c016f8`의 별도 사용자 승인된 양재 OSM `/map` 작업이다. 이 조사 채팅은 두 구현 소스·기기를 수정하지 않는다. 병행 보고를 실행 성공으로 자동 채택하지 않고 증거를 대조한다.

## 1. Pleos Connect NaviHelper

공식 [소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/intro), [SDK 가져오기](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/importing-sdk), [권한](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/declaring-permissions)을 직접 확인했다.

- 공개 Maven: `https://nexus-playground.pleos.ai/repository/maven-releases/`, 의존성 `ai.pleos.playground:NaviHelper:3.0.5`.
- [SDK 사용 신청 안내](https://document.pleos.ai/docs/pleos-only/create-my-project)는 Vehicle State와 NaviHelper가 신청 없이 사용 가능한 SDK라고 명시한다. 페이지의 회원가입·프로젝트 생성 안내와 배포 심사는 별개이며, 런타임 지원·권한 부여 성공을 뜻하지 않는다.
- [전용 에뮬레이터](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator): 2.1.0, API34 이미지, Windows/Linux용 공식 SDK update site 제공. 순정 프로그램을 추출하는 방식이 아니라 공식 테스트 환경이다. 일반 AAOS 이미지와 구분한다.
- [릴리즈 노트](https://document.pleos.ai/en/docs/pleos-only/release-note/sdk-release-note): 3.0.5에서 좌표 생성자 순서가 위도·경도로 변경됐고 목적지 잔여거리/시간 필드도 변경됐다. 이전 예제를 그대로 혼용하지 않는다.

| 필요한 기능 | 정확한 공개 연결점 | 권한/판정 |
|---|---|---|
| 내비 검색 화면에 검색어 전달 | `requestNavigationScreen(NavigationScreenRequest.SearchPlace(keyword))` | `NAVI_CUSTOM_MAP`; 화면 요청 계약. 선택 좌표 반환 계약 아님 |
| 내비 화면 표시 | `NavigationScreenRequest.Foreground`, `MoveToCurrentLocationOnMap`, `OverviewRoute` 등 | 화면 전환. PICKGO 내부에 MapView를 삽입하는 API로 해석 금지 |
| 특정 POI 상세 표시 | `NavigationScreenRequest.POIDetailPopup(poiId, poiProvider)` | 이미 알고 있는 POI를 표시하는 요청; 검색 결과 API 아님 |
| 목적지·경유지 설정/경로 변경 | `requestRoute`, `requestRouteWithWaypoints`, `addWaypoint`, `removeWaypoint`, `cancelRoute`, `requestReRoute` | `NAVI_ROUTE_SEARCH`; 실제 경로를 바꿀 수 있어 장소 선택 과정에 몰래 호출하지 않음 |
| 현재 위치·목적지·안내 상태 | `getCurrentLocationInfo`, `getDestinationInfo`, `getRouteStateInfo`, `getTBTInfo`와 리스너 | `NAVI_ROUTE`; 기존 목적지 정보와 검색 중 선택한 POI를 구분 |
| 즐겨찾기·최근 목적지 | `getBookmarkInfo`, `getRecentDestinationInfo` | 일반 장소검색 대체 아님. 별도 사용자 선택 흐름 후보이며 이번 실행 미검증 |
| Trip 정보 | `requestTrip(TripRequest)` → `onTripInfo` | `NAVI_ROUTE`; 좌표/POI 입력이 선행됨. 키워드 검색 API 아님. 경로 무변경·예상시간 품질·호출 상한은 추가 검증 필요 |
| 검색 선택 좌표만 반환/지도 임베딩/자유핀 반환 | 조사한 공개 선언·리스너·화면 타입에서 공식 계약 미확보 | 부재 확정이 아닌 범위 내 미확인. 시연 대체 대상으로 분리 |

[NaviHelper 메서드 목록](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.helper/navi-helper/entry), [화면 타입](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.data/navigation-screen-request/entry), [requestTrip](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.helper/navi-helper/request-trip), [TripRequest](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.data/trip-request/entry).

일반 웹 추출 도구는 일부 API 페이지의 제목/메뉴만 반환했다. 이를 문서 부재로 처리하지 않고 Chrome 렌더링 본문에서 `requestNavigationScreen`, `NavigationScreenRequest`, `requestTrip`, `TripRequest`를 확인했다. 전자는 `NAVI_CUSTOM_MAP`, Trip은 `NAVI_ROUTE`의 Normal protection을 명시한다. 이벤트 발생은 실제 Navigation 앱 구현에 따라 달라진다고 안내한다. 공개 Java 선언은 기존 `docs/evidence/pickgo-design-2026-11-04-sdk-declarations.txt` 및 해시 기록과 대조했다. `getInternalApi()`를 공개 제품 계약 대체로 사용하지 않는다.

## 2. 현대오토에버 routo — 별도 검색·지도 후보 발견

현대오토에버 [공식 소개](https://www.hyundai-autoever.com/kor/business-area/core-technology/bigdata/contents.do?cntnSeq=361), 현대차그룹 [2026-05-29 기사](https://www.hyundaimotorgroup.com/ko/story/hyundai-autoever-routo-b2b-mobility-data-platform), [개발 안내](https://www.routo.com/developers/general/routo_api.html), [서비스](https://www.routo.com/service/service.html), [REST 규격 1.4.2.RELEASE](https://api.routo.com/docs/index.html)를 직접 확인했다. `developers.routo.com`은 개발 안내로 리디렉션됨을 확인했다.

| 용도 | 공개 endpoint 또는 제공 형태 | PICKGO에서의 의미 |
|---|---|---|
| 키워드·주소·POI 검색 | `GET /v1/places/findplacefromtext` | 명칭/주소/POI ID 및 중심·안내·도보 안내 좌표 반환. 검색 기준 장소 확보 후보 |
| 차량 경로 비교 | `POST /v1/directions/basic` | 실제 도로 기준 거리·시간 비교 후보 |
| 보행 접근 | `GET /v1/directions/pedestrian` | 탑승자 접근 경로 후보. 지역별 지원 확인 필요 |
| 여러 후보 비교 | `POST /v1/directions/destinations`, `/origins` | 각각 최대25 목적지/출발지의 요약 경로. 실제 계정 허용/요금 미확인 |
| 지도 표시 | WEB JS, Android SDK, iOS SDK 안내 | 순정 내비 화면과 별개인 지도 플랫폼. WEB JS 지도·마커·좌표 이벤트 문서 확보, AAOS 실행 미검증 |

REST 호출에는 API key가 필수다. 검색은 `center`, 선택적 `guide`, 선택적 `walkingGuide`가 구분돼 있어 건물 중심과 승차·진입점을 섞지 않는 데 유용하다. 다만 어느 좌표도 정차 허용의 증거는 아니다. endpoint별 좌표 순서도 다르므로 공통 배열을 그대로 전달하면 안 된다. 검색 `location`은 위도·경도, 차량 경로 예시는 x=경도/y=위도다.

**현재 채택 게이트:** 공식 개발 안내는 `routo@hyundai-autoever.com`으로 사용 신청·기술 문의하도록 한다. 이 프로젝트에 승인된 사용키·계약은 확인하지 않았으며 키 발급/추출/호출은 수행하지 않았다. 공개 데모의 키를 재사용하지 않는다. AAOS 차량 화면, 공모전 APK/영상/전시, 결과 임시 저장·양측 공유, NaviHelper로 좌표 전달, 요금/쿼터/표시 조건을 확인해야 정식 연결할 수 있다. 같은 현대 계열이라는 이유로 POI ID나 제공자 문자열의 호환을 가정하지 않는다.

추가로 [WEB JS 시작하기](https://www.routo.com/developers/web_js/start.html)와 [전체 API 문서](https://www.routo.com/developers/web_js/document.html)를 직접 열람했다. 발급 키로 지도 스크립트를 로드하며 Map/Marker, addListener, getPosition, setDraggable, EventResponse.latLng가 문서화돼 있다. 따라서 별도 지도에서 지점 선택을 구현할 후보 근거는 있다. 실제 키 호출·PICKGO 연결 성공은 아니다. LatLng 예제는 lat=37.534539/lng=126.909747인데 속성 설명에는 위도·경도가 반대로 적혀 있어 문서 내부 불일치가 있다. 연결 시 알려진 기준 지점의 필드 순서와 왕복 좌표·실제 표시 위치를 검증해야 한다.

## 3. 나머지 현대차·Pleos API 범위

| 서비스 | 확인된 범위 | 현재 목적에 대한 판정 |
|---|---|---|
| Hyundai Developers | [데이터 API](https://developers.hyundai.com/web/v1/hyundai/data_api), [FAQ](https://developers.hyundai.com/web/v1/hyundai/faqs): 블루링크 연동 차량 데이터, 개발 프로젝트/인증, 테스트 차량·샘플 안내 | 내비 화면/POI 선택 SDK의 대체 경로는 미확보. FAQ는 검색 추출문 확보, 직접 open은 timeout/502로 원문 재열람 제한 |
| Pleos Fleet API | [Getting started](https://document.pleos.ai/api-reference/fleet-api/getting-started): 계약 후 endpoint 제공, Client ID/Secret/Project ID와 사용승인 | 차량·운전자·관제용. 무가입 에뮬레이터 내비 대안 아님 |
| Pleos Vehicle Data API | [Overview](https://document.pleos.ai/api-reference/vehicle-data-api/intro): 위치·차량 상태 조회, 동의/토큰, 문서상 2026-08 기준 유럽만 제공 | 국내 PICKGO 내비·지도 공급자로 즉시 채택 불가. 한국 실차 지원을 추정하지 않음 |
| Gleo/STT/TTS/Vehicle/FusedLocation | Pleos 공개 SDK 목록 및 기존 API_EVIDENCE | 음성/차량맥락 보조 기능. 검색/지도/초대·원격연결을 자동 해결하지 않음. 이번 신규 실행 범위 아님 |

## 4. 진행 방식과 수용 조건

1. 내비 실행 시험에서 공개 SDK 연결, 목적지/상태 조회, 검색 화면 전달, POI 선택 전후 목적지/경로 상태를 각각 기록한다. 화면 표시를 결과 반환 성공으로 표시하지 않는다.
2. 선택 결과 반환이 확보되지 않으면 검색·자유핀은 기존 승인된 로컬 지도 시연으로 진행한다. 현재 OSM 시연 담당과 조율 완료. 실제 지도 데이터/합성 움직임/미확인 정차근거를 각각 표시한다.
3. 내비 경로 요청은 사용자가 합의 지점을 확정하고 안내 시작을 선택한 뒤 별도 단계로 검증한다. 요청 반환만으로 안내 성공이라 쓰지 않는다. 실제 목적지와 콜백을 확인한다.
4. routo 조건이 해결되면 검색·경로 공급자를 교체할 수 있으나 현재는 후보로만 유지한다. 시연 폴백은 영구적 기술 불가능 판정이 아니다.

이 조사는 API 활용 가능성과 차단을 구분하는 기능 단위다. 다른 채팅이 진행 중인 지도 구현을 중복 생성하지 않는다. 제품의 실제 NaviHelper 브리지·지도 SDK 통합·실차·휴대폰 HTTPS·공모전 제출 완료로 보고하지 않는다.

## 5. 협업 및 실행 증거 상태

- Dot R010: 기존 자료 먼저 재사용, POI 선택 반환과 별도 지도 SDK 두 질문만 전달/보고 회수/검증범위 및 종료 즉시 회신/종료 답변 확인. routo 서비스 존재는 원문 대조로 채택. Dot의 Pleos 본문 미확보는 도구 관찰이며 API 부재 근거로 쓰지 않음. 신규 예약·외부 문의 없음.
- Codex: `git status --short --branch`, README·공통 지침·소유/결정/API/시험 기록 확인. main의 다수 기존 미커밋 변경 보존. 이 채팅의 제품 코드 변경 없음으로 전체 앱 회귀시험 재실행하지 않음.
- 실제 SDK 실행: [실행 보고](PICKGO_NAVI_SELECTION_TEST_2026-11-04.md) 및 `evidence/pickgo-navi-selection-2026-11-04/summary.json`, 선택/복귀 로그를 대조했다. NaviHelper3.0.5, Android API34, 내비3.3.2-rc5-hotfix.3의 독립 probe에서 연결·목적지/상태 수신·SearchPlace와 두 POI 상세 선택이 확인됐다. 기존42dot 목적지 및 ROUTE_GUIDING 유지, 상세 선택좌표는 두 관찰 구간(약30초/145초)에서 미수신. 목적지 확정 뒤 결과·전체 경로 동일성·PICKGO 제품 연결은 미시험. 검색 반복 진입 시 목록 미표시 문제도 관찰돼 모든 화면전환이 안정적이라고 보고하지 않는다. 실행 담당이 초기 무경로 상태 복구/probe 종료를 완료했다.
- Claude: 실제 claude-haiku-5-5 고정문서 독립 검토 완료, exit0/is_error=false, session `510d6032-e4fc-46c3-9520-1842297fcedb`. 입력/응답/메타는 `evidence/pickgo-public-nav-2026-11-04/`. 검토 시점에는 런타임 보고·추가 WEB JS 발견을 전달하지 않았으며 외부 링크 재검증도 맡기지 않았다. 아래에 중요 지적의 처리 근거를 남긴다.

### 검수 지적 처리와 검증 경계

- 출처 상태: NaviHelper 소개/가져오기/권한/SDK신청/에뮬레이터/릴리즈, routo 소개/개발안내/서비스/REST/WEB JS, Fleet/Vehicle Data는 Codex 원문 열람. NaviHelper 상세 타입은 Chrome 렌더링 본문 열람. Hyundai Developers 검색 자료는 검색 추출이며 FAQ 원문 재열람 실패. 검수자의 미열람을 작성자의 미열람으로 바꾸지는 않는다. routo 리디렉션 외에 실제 REST·JS 본문도 확인했다.
- SDK 신청과 이용조건: 2026-11-04 열람한 공식 신청 안내의 NaviHelper 신청 불필요는 SDK 접근 절차에 한정한다. 공모전 배포·양산 탑재 허가를 의미하지 않는다. 공개 Maven 주소 자체도 이용허가 근거로 삼지 않는다.
- 버전: 에뮬레이터2.1.0과 SDK3.0.5는 서로 다른 제품의 버전이므로 숫자가 다르다는 이유만으로 불일치를 확정하지 않는다. 실제 실행 조합은 위 보고로 한정하고 모든 이미지/SDK 조합 호환을 주장하지 않는다.
- 좌표 순서: 이번에는 공급자 변환 코드를 만들지 않아 형식뿐인 단위시험을 추가하지 않았다. 추후 연결의 수용 조건은 기준 좌표의 SDK 필드/REST x,y 변환·반환값·지도 위치 검증이다. WEB JS 문서의 반대 표기도 함께 남겼다.
- 대안: 사용자가 의도적으로 설정한 현재 내비 목적지를 PICKGO 기준 장소로 가져오는 흐름은 후보다. 기존 경로를 바꾸지 않는 검색 선택과 다른 기능이며, 임시 목적지 설정/취소로 우회하지 않는다. 새 목적지 확정 후 제품 수신은 별도 시험이 필요하다.
- 폴백: 기존 `PICKGO_KAKAO_FALLBACK_2026-11-04.md`는 별도 후보 기록이다. 이번 요청은 현대차/Pleos 우선 조사이며 Kakao/Tmap 신규 채택이나 키 사용을 승인한 것으로 확대하지 않는다. 현재 시연은 별도 승인된 OSM 작업과 조율했다.
- 기준 상태/Trip: 실행 시험은 기존42dot 안내를 기준으로 다른 두 장소를 비교했다. requestTrip 경로 무변경은 미검증 상태를 유지한다. 외부 문의 초안도 미발송이다.

## 6. routo 확인 문의 초안 — 미발송

PICKGO는 Pleos Connect 차량 앱과 탑승자 웹에서 픽업 지점을 합의하는 공모전 프로토타입입니다. routo POI 검색·지도 핀 선택·차량/보행 경로를 사용하고 확정한 지점을 한 회차 동안 보관·양측에 공유하며 NaviHelper 목적지로 전달하려 합니다. 개인 개발자의 테스트 키 신청 가능 여부, AAOS/에뮬레이터 지원, 검색결과·직접 선택 좌표의 저장/공유·타 내비 전달 조건, 공모전 APK/영상/전시 및 향후 배포 이용 조건, 요금·쿼터·지도 고지 요건과 현재 SDK 문서를 알려주시기 바랍니다.

사용자는 우선 가능한 공개 경로 확인과 시연 진행을 지시했다. 외부 연락은 DEVELOPMENT_GUIDE.md 11절의 별도 승인 대상이므로 이 초안은 발송하지 않는다. 현재 시연 진행은 문의 답변을 기다리는 조건으로 막지 않는다.
