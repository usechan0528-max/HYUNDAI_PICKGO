# PICKGO 확정 픽업 지점 → 현대 내비 안내

2026-11-04 KST. 사용자 승인: “일단 OSM으로 시연 진행하고, 확정한 픽업 지점을 현대 내비 목적지로 넘겨서 안내 시작하는 것까지 연결”. 공개·push·계정·키 변경은 제외했다.

## 최신 재검수·재시연 완료 (같은 날 후속)

사용자의 “검수 마무리하고 … 수정된 버전으로 다시 시연” 승인으로 아래 과거 보류를 재개했다. **최종 APK에서 새 회차의 최초 지도 선택→확정→native 버튼1회→내비 무터치 자동 안내→45초 결과 유지→반복 런처 실행의 회차 유지까지 통과했다.**

- 최종 APK SHA-256: `434a9fb0efb3aa57b91103706fe6e4f2246cce32eea641dcc0989c1c3b356d84`. 기기에 설치된 base.apk를 다시 내려받아 빌드 파일과 일치 확인. 최종 build/lint 종료0, lint0오류3경고 유지.
- `reviewed-demo.mp4`: **94.42초 연속 원본**. 최초 지도 후보 선택 전부터 녹화. 약0~6초 지도 선택/확정, 6~12초 시험용 상대 참여와 native 안내, 약12~20초 내비 경로 카운트다운/자동 안내, 이후 안내 관찰, 약65초 앱 복귀와45초 결과, 반복 런처 실행까지 포함. 상대 참여는 CDP 테스트 fixture로서 물리폰 시연이 아니다. native 버튼 이후 내비 탭0회. 5초간격 표본 프레임에서 초대URL/토큰 노출 미발견; 링크를 펼치지 않음.
- 최종 새 회차에서 선택한 좌표는 `[127.0358465,37.4661039]`. 과거 첫 시험과 같은 후보를 새로 선택했다. 이전 모든 시험과 다른 좌표라고 표현하지 않는다.
- `reviewed-runtime.log`: 요청04:56:25.280, 최초 목적지일치·안내확인04:56:33.032, 관찰종료04:57:11.079(게스트 로그시각). `REQUEST_ROUTE_SENT` 정확히1회.
- `reviewed-04-retained.png/xml`, `reviewed-05-repeat-launch.png/xml`: 45초 관찰 종료 결과 유지, 같은 픽업 좌표, 중복 요청 버튼 차단. `reviewed-activities.txt`에서 NavigationActivity 인스턴스1개.
- 이후 별도 read-only probe로도 정확한 목적지 `latitude=37.4661039, longitude=127.0358465` 및 `ROUTE_GUIDING`을 재확인(`reviewed-independent-destination.log`). 앱 복귀가 현대 내비 안내를 종료하지 않았음을 관찰했다. probe를 force-stop하고 PICKGO 최종 결과 화면으로 복귀(`reviewed-08-final-screen`). 4194 서버와 사용자 확인용 새 회차를 유지한다. 후속 검색 담당의 새 endpoint 활성화는 별도 서버 재시작이 필요해 이번에는 수행하지 않았다.
- 최종 소스에서 기존 native 실기 회귀9항목을 재실행해 모두 통과. `runtime-regression.json`은 이 최종 재실행 결과다. 추가 `reviewed-06-read-failure`, `reviewed-07-session-failure`에서 인증된 read 실패/세션값 소실에도 이전 결과+현재미확인 문구 유지, 안내 버튼 비활성 확인. 이후 원래 세션 복구.
- 기존 보류원인 일부를 실제로 찾았다: standard launchMode 때문에 동일 NavigationActivity4개가쌓이고 WebView별 session이달라졌다. `singleTask`로 수정. 기존 `final-05-result-retained.png`는 수정 전 실패증거이며 통과근거가 아니다. 검색입력 `rjse`의 주체까지 이 원인으로 확정하지 않는다. 관련 UI담당3곳 모두 기기미사용 확인 뒤 이번 최종시험에서 추가경합 없이 수행했다.
- 최종 제한검수 session `3e24f8b2-6546-4480-8deb-c9832f28f5aa`: R1 해결·해당 P1없음. 뒤이어 singleTask/늦은JS콜백가드 검수 session `71f39997-58b4-441f-912a-ccd0a7345e0b`: P0/P1회귀미발견. 둘 다 실제 `claude-haiku-5-5`, exit0/is_error=false. 가드P2도 반영했다. singleTask가 내비를 같은task에서 제거할 가능성은 기기검수 대상이었으며 실제복귀·반복런처·안내조회로 확인한다.
- 최종 정상흐름·복귀·중복·세션/read실패 검증 보류는 해소했다. 실제 서비스강제단절/45초무응답/발신중취소·실차/주행UX/물리폰HTTPS는 이번최종시연에포함하지않았다. 순수 정책43항목과 이전 웹226시험의 범위는 유지하며 다른 채팅의 최신 검색기능 변경을 이번 내비검수로 포함하지 않는다.

이하 본문은 초기 구현·검수·실패 이력을 보존한 것이다. 현재 판정은 이 최신 절과 `reviewed-summary.json`을 우선한다.

## 실제 결과

**OSM에서 확정한 좌표를 실제 NaviHelper로 전달하고 현대 내비 안내 시작을 확인했다.** 호출 반환만으로 성공을 표시하지 않았다.

- 첫 정상 흐름: OSM 후보1을 화면에서 선택 → `이 핀으로 픽업 시작` → 테스트 탑승자 참여 → 차량 native 안내 버튼 → 현대 내비 경로 화면 → 실제 안내.
- 확정 좌표: WGS84 `[127.0358465,37.4661039]`. 기존 독립 read-only probe의 `DestinationInfo(latitude=37.4661039, longitude=127.0358465, name=PICKGO 픽업 지점)` 및 `ROUTE_GUIDING`을 대조했다.
- **초기 설명 정정:** 첫 시험 뒤 “내비 최종 버튼이 필수”라고 설명했으나 영상에 카운트다운이 있었다. 두 번째 시험에서는 PICKGO native 버튼만 1회 누르고 내비 화면을 누르지 않았다. `04:34:35.679 REQUEST_ROUTE_SENT` → `04:34:42.674 MODE=ROUTE_GUIDING` → `04:34:43.714 DESTINATION_MATCH=true/GUIDANCE_CONFIRMED`. 따라서 이 환경은 경로 선택 카운트다운 뒤 자동 안내를 시작한다. 두 번째 좌표는 `[127.0351611,37.4641324]`이며 첫 목적지와 구분된다. 시각은 에뮬레이터 로그 시각으로 KST 현재시각과 동일하다고 가정하지 않는다.
- `isRouting=false`는 안내 중에도 관찰되므로 성공 기준으로 사용하지 않는다.

## 영상·증거

`docs/evidence/pickgo-navigation-2026-11-04/`:

| 파일 | 내용 |
|---|---|
| `05-osm.png`, `06-selected.png` | 실제 OSM 지도와 선택 좌표 |
| `07-confirmed.png`, `selected-state.json` | 확정 좌표·참여 완료·native 안내 버튼 |
| `08-requested.png`, `09-guiding.png/.log` | 내비 경로 화면과 실제 안내·SDK 관측 |
| `independent-destination.log` | 별도 기존 probe의 실제 목적지 좌표·안내 상태 |
| `demo.mp4` | 원본 90초. 선택된 핀 화면부터 확정·안내까지, 뒤에 독립 probe 화면 포함 |
| `demo-40s.mp4` | 원본 앞 40초 연속 발췌. 중간 편집·성공 화면 합성 없음 |
| `auto-start.mp4`, `auto-start.log` | 두 번째 시험. native 버튼 1회 후 내비 무터치 자동 안내 |
| `runtime-regression.json` | 에뮬레이터 native 버튼/외부 이동 회귀 9항목 |
| `policy-tests.txt`, `build-final.txt`, `web-tests.txt` | 최종 정책·빌드/lint·전체 웹 회귀 |
| `review-*`, `followup-*` | 실제 Claude 고정 입력·응답·모델/세션·파일 해시 |

첫 영상의 최초 후보 클릭은 녹화 시작 전이다. 탑승자 참여는 debug WebView의 테스트 participant로 처리했고 물리 휴대폰/사람의 참여를 연출한 증거가 아니다. 화면에 초대URL/토큰을 펼치지 않았다. 첫 영상 5초 간격, 두 번째 영상 3초 간격 프레임을 시각 점검했고 비밀값 노출을 발견하지 못했다. 모든 프레임 OCR 검사를 했다는 의미는 아니다.

## 구현

전용 `experiments/pickgo-navigation/**` Android 앱을 추가했다. 기존 `pickup-board`의 map/domain/server/UI는 읽기만 했고, 해당 담당의 구현·미커밋을 보존했다. 패키지 `org.example.pickgonavigation`, SDK 3.0.5/navi-data3.0.4/navi-aidl3.0.1, AGP8.7.3/Gradle8.9/JDK17. API34/user10/emulator-5556, 내비3.3.2-rc5-hotfix.3에서 실행했다. 기존 debug 키를 재사용했다.

- 고정 loopback origin 4194의 mainframe session만 읽는다. JavaScript 호출 가능 native interface와 Intent 경로명령은 없다. SDK 요청은 native 버튼에서만 시작한다.
- 서버 인증 read로 운전자/active/waiting/참여 완료/제안 없음/실제 mapPoint를 검증한다. synthetic-diagram이나 proposal 좌표는 받지 않는다. native에서 양재 bbox·유한 수치도 확인한다.
- 클릭 때 표시된 회차·version·placeRevision·좌표와 새 서버 응답을 대조한다. 8초 TTL·화면 세대·onPause·중복기록을 확인한 뒤 `RouteInfo(latitude,longitude,…)`를 만든다. 문자열 필드는 SDK의 null불가 계약에 맞춰 빈문자열을 사용한다.
- 명시 안내 시작 전에는 `requestRoute`를 호출하지 않는다. 요청 전에 회차+revision 기록을 디스크에 저장하여 중복·불확실 반환·재시작 시 재전송을 막는다. 같은 revision의 재요청은 막히므로 실제 상태는 현대 내비에서 확인한다.
- SDK 목적지 일치와 최근3초 이내 `ROUTE_GUIDING`을 함께 확인한다. 발신 후45초 관찰하며 웹 회차도 재확인한다. 변경·취소·확인 불가에는 경고하고 이미 전달한 경로를 자동 취소하지 않는다. 관찰 후는 ‘최근 확인’ 또는 시간 초과를 보존한다.
- 외부 페이지 이동·다른 remote 리소스 차단, OSM HTTPS 타일 이미지 경로만 예외. native HTTP는 redirect 금지·크기 제한·연결/읽기/전체 요청 deadline 및 종료 시 disconnect를 적용했다. cleartext는127.0.0.1만 허용한다.

## 검증 판정

| 범위 | 판정 |
|---|---|
| 실제 OSM 확정→requestRoute→목적지 일치/ROUTE_GUIDING | 통과. 첫 지도UI 흐름 + 두 번째 무터치 자동시작 |
| NAVI_ROUTE/NAVI_ROUTE_SEARCH/NAVI_CUSTOM_MAP | 설치 후 dumpsys에서 granted=true 관찰; 수동 권한부여 없음 |
| 최종 assembleDebug / lintDebug | 종료0. lint0오류3경고(고정 캐시 의존성 버전, backup 설정 권고, 아이콘) |
| 최종 순수 Java 정책 | 43 assertions 통과: 역할/회차/좌표/TTL/버전/상태악화/회차확인불가/최종 timeout 구분 |
| 실제 에뮬레이터 실패/활성화 회귀 | 9항목 통과: 미참여 차단, 참여 활성화, 제안 차단, 탑승자 차단, 수락 후 활성화, 취소 차단, 잘못된 토큰 차단, 요청한 revision 차단, 외부origin 이동 차단 |
| 전체 기존 웹 회귀 | 현재 작업트리226/226 통과, 다른 담당의 추가 시험 포함 |
| 실제 서버/SDK 단절·45초미응답·발신뒤취소 | 최종 실기 판정 유보/미실행. 아래 기기 혼입 및 순수 정책 검증과 구분 |
| 최종 순수함수 추출·XML 명시속성 뒤 재설치/재시연 | 미실행. 보완 직전 Android에서 두 번째 정상 안내 확인, 이후 변경은 빌드/정책검증 |
| 실차·주행 UX 제한·물리폰 HTTPS·release | 미실행 |

초기 lint의 `InputStream.readNBytes` API33 요구는 bounded read loop로 수정했다. 후속 network config의 includeSubdomains 누락 lint 오류도 명시false로 수정 후 재통과했다. 초기 javac의 Windows949 인코딩 실패는 `-encoding UTF-8`로 재실행해 통과했다. 실패를 삭제하거나 최초부터 성공한 것으로 기록하지 않았다.

## 독립 검수와 처리

실제 Claude Haiku5.5 최초 검수: session `744bf86d-da45-4968-955c-30c9347d308e`, exit0/is_error=false. 고정 소스와 실제 증거 요약만 전달, 수정 권한 없음.

- P1 관찰 종료 뒤 메시지 덮어쓰기: 회차별 최종 outcome 저장·복원으로 수정.
- P1 발신 후 회차 변경/취소 미감지: 발신 후 인증 재조회·revision/좌표 대조와 확인불가 경고 추가. 임의 cancelRoute는 추가하지 않음.
- P1 성공 표시가 상태 악화 뒤 잔존: 최신 destination/mode/회차 관측으로 매번 재계산. 완료 후는 현재 상태가 아닌 최근 관측임을 표시.
- P2 proposal키 누락, 생성자 예외, HTTP deadline/종료, cleartext 제한, 재연결/재시작 안내 보강. synchronous commit은 SDK 발신 전 중복 방지 저장을 위한 의도적 선택으로 유지.
- P2 최종 내비 버튼 필수에 기초한 문구 제안은 추가 실제 무터치 시험으로 전제가 성립하지 않음을 확인. native ‘안내 시작’은 유지했다.
- 후속 검수 session `5a639f61-8b67-43da-8042-0df468206110`, exit0/is_error=false. 회차변경 감지·성공 래치 수정 확인. 종료 후 room/session 읽기 실패가 이전 outcome을 덮는 R1을 추가 지적했다. 두 실패 경로를 `unavailable()`로 통일해 저장된 결과를 ‘이전 안내 요청 결과’로 보존하고 현재 상태 미확인을 덧붙였다. Codex 소스 대조·최종 build/lint 통과, 이 마지막 수정의 실기/3차 Claude 검수는 미실행이다.
- ‘최근 확인’은 ‘45초 관찰 종료 시점’으로 명시했다. 발신 후 samePlace가 일반 version을 비교하지 않는 이유(준비상태 변경은 장소합의를 바꾸지 않음)를 주석에 남겼다. 발신 전 same()은 version까지 비교한다. 후속 입력에서 빠졌던 Manifest의 networkSecurityConfig 연결은 실제 Manifest와 lint로 확인했다.
- 순수 상태 판정 추출 후43시험에 현재확인→상태악화→대기, 최종timeout/관찰종료시점확인, 회차변경 우선 경고를 추가했다. 초기 실기 실패9항목은 최종 소스의 전 범위 실기 회귀를 대신하지 않는다.

## 남은 범위와 현재 상태

두 번째 정상 요청/안내확인 이후 `15-auto-guiding.png`에는 요청하지 않은 다른 합성 회차의 PICKGO 화면이 나타났다. 파일명과 실제 내용을 구분한다. 해당 PNG를 내비 안내 화면 증거로 쓰지 않는다. 원 채팅도 기기를 조작하지 않았다고 회신했으며 조작 주체는 확인되지 않았다. 요청~자동안내 로그/영상과 이후 화면을 분리하고, 이후 기기 조작을 중단했다. 연결단절 시도 캡처11/12는 상태혼입 가능성이 있어 통과 근거로 쓰지 않는다.

4194 전용 서버는 최신 OSM 보완 반영을 위해 한 번 재시작했고 기존 영상 회차는 소멸했다. 최신 서버는 유지한다. 이후 기기 현상 재현과 단절·시간초과·발신후취소 실기 검증은 기기 단독 사용 확인 후 같은 기능 채팅에서 이어갈 항목이다. 차단을 전체 검증 완료로 표시하지 않는다.

이 시연은 현장 정차 합법성이나 실제차량의 주행 안전을 보장하지 않는다. 이미 운전자 명시로 전달한 경로를 웹 회차 취소가 자동 취소하는 기능은 없다. 서버 검증과 SDK IPC 사이 원자성도 보장하지 않는다. Dot R010 종료 자료 재사용, 새 조사/예약/외부 연락 없음. commit/push/공개/키 변경 없음.

실행 방법: `experiments/pickgo-navigation/README.md`. 공식 계약 근거는 `PICKGO_PUBLIC_NAV_API_2026-11-04.md`와 실제 SDK 선언을 재사용했다. requestRoute/RouteInfo 공식 상세 URL의 이번 웹 텍스트 추출은 제목만 보여 새 계약 증거로 과장하지 않았고 확보 SDK 선언·실제 실행으로 확인했다.
