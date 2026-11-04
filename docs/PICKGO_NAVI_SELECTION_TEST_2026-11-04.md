# PICKGO 현대 내비 장소 선택 수신 시험

## 판정

사용자 요청: 현대 내비에서 장소를 선택한 뒤 기존 경로를 임의 변경하지 않고 PICKGO에 좌표를 받을 수 있는지 실제 에뮬레이터 시험.

**이번 공개 SDK 시험에서 수용 조건 미충족.** 다른 장소를 검색·선택해 상세를 열어도 기존 42dot 목적지와 ROUTE_GUIDING은 유지되었으나, 선택 장소 좌표는 수신되지 않았다. 불가능을 모든 버전·비공개 계약으로 일반화하지 않는다. 제품 PICKGO 웹에 실제 좌표 수신 기능이 연결됐다는 뜻도 아니다.

## 환경·범위

- 날짜: 2026-11-04 KST. 에뮬레이터 화면/로그 시각(03~04시)은 게스트 시계이며 사용자 현재 시각과 동일하다고 가정하지 않는다.
- emulator-5556, Android API34, active user10, 내비 ai.umos.maps.android.navigation.app 3.3.2-rc5-hotfix.3.
- NaviHelper3.0.5 / navi-data3.0.4 / navi-aidl3.0.1 실제 AAR, JDK17, Gradle8.9, AGP8.7.3.
- 새 독립 Android 시험 앱 org.example.pickgonaviprobe. 기존 PICKGO 제품/웹 코드는 수정하지 않았다. 원시 fixture 좌표는 로컬 시험 로그에만 기록; 실제 차량·개인 목적지에서 실행 금지.
- NAVI_ROUTE / NAVI_CUSTOM_MAP normal 권한 실제 granted=true 확인. NAVI_ROUTE_SEARCH 및 경로 변경 권한 없음; requestRoute/addWaypoint/cancelRoute 사용 없음.
- Dynamic Proxy가 NaviHelperEventListener 전체 이벤트 메서드를 기록한다. getDestinationInfo/getRouteStateInfo 2초 간격, 최대300회. onActivityResult/onNewIntent/onResume 기록. 내비 화면에서 기다리는 동안 프로세스가 살아 있고 조회 응답을 받는 것을 확인했다.
- 기존 debug 키 재사용. 데이터 초기화·키 생성·권한 수동 변경·외부 발송·push 없음. 기존 다른 작업자의 미커밋 변경 보존.

## 실행 및 관찰

1. SDK 연결 성공. 처음 내비는 not ready였고 목적지 조회 응답이 없었다. 내비 UI를 열자 정상 수신. 초기 목적지 빈 값, SAFE_GUIDING/FREE_DRIVE 확인.
2. 초기 활성 경로가 없어 내비 UI의 기존 시험 POI 42dot에 `목적지로` → `안내 시작`을 눌러 기준 경로 생성. 37.48544722,127.03636666 / 12km / 17분 / ROUTE_GUIDING 확인. 시험 전제 설정이며 선택 결과 획득 우회가 아니다.
3. `SearchPlace("현대자동차")` 요청 후 내비 검색 목록에서 **현대자동차 AVP본부** 선택. 상세에 목적지로/경유지로 버튼이 있지만 누르지 않았다. SDK에는 계속 기존42dot 좌표와 ROUTE_GUIDING 수신. 11-poi-selected부터12-return-to-receiver까지 선택상세·수신앱 복귀 확인. 복귀는 adb로 수동 수행했으며 자동 선택결과 복귀가 아니다. 새 Intent extras=null, 선택결과 ActivityResult 없음.
4. 후속 검색 반복 중 목록이 안 보이고 지도만 남는 현상 관찰. 초기 추정과 달리 앱 전환만 원인으로 확정하지 않는다. 내비를 foreground로 유지하는 DUMP 권한 보호 debug CommandReceiver로도 관찰했고, UI `내 위치로` 복귀 뒤 SearchPlace를 요청하자 목록 정상 표시. 이 반복 진입 문제는 별도 미해결이며 숨기지 않는다.
5. `SearchPlace("하나로마트")` → **하나로마트 성남농협대왕지점** 선택. 22-second-selected(04:00:3x)부터23-second-observed(04:01:1x)까지 상세를 30초 이상 유지. 목적지/경유지 버튼 미사용. 기존42dot 좌표/ROUTE_GUIDING 지속, 새 선택좌표 이벤트 없음. 20-current-location에서 안내 화면 복귀, 21-second-results에서 정상 목록 표시를 확인한 뒤 두 번째 장소를 선택했다. 24-final-return은 파일명과 달리 내비 상세 화면이므로 복귀 증거로 사용하지 않는다. 25-receiver-confirmed에서 수동 복귀 화면·NEW_INTENT extras=null·기존 목적지 조회를 확인했다.

| 수용 조건 | 결과 |
|---|---|
| 실제 SDK 연결 및 조회 | 통과 |
| 내비 검색어 전달·검색 결과·다른 POI 상세 선택 | 2개 장소에서 확인; 반복 진입 UI 문제는 별도 존재 |
| 선택 중 기존 목적지·안내 상태 유지 | 관찰 범위에서 통과 |
| 목적지/경유지로 확정 전 상세 선택좌표 수신 | 수용 조건 미충족: 이 단계에서 두 장소 모두 선택좌표 미수신 |
| 목적지/경유지로 확정한 뒤 좌표 수신 | 미시험. 기존 경로 변경 금지의 대안으로 취급하지 않음 |
| 선택 결과로 PICKGO 자동 복귀 | 미관찰; 수동 복귀만 수행 |
| 전체 경로 polyline/routeId 완전 동일 | 미검증. 목적지·안내 상태와 변경 이벤트 관찰을 전체 경로 동일성으로 확대하지 않음 |
| 실제 PICKGO 제품 연결·실차 | 미실행 |

`isRouting=false`는 활성 안내 중에도 관찰됨. 안내 활성 여부는 ROUTE_GUIDING 및 내비 화면으로 판정했다. 수신 콜백이 계속 정상 도착했기 때문에 앱 미연결/리스너 전면 실패와 선택결과 부재를 구분할 수 있다. 다른 미공개 Intent·별도 승인 API까지 부재로 증명한 시험은 아니다.

## 명령·증거

소스: `experiments/pickgo-navi-selection/`. 실제 빌드:

```powershell
$env:JAVA_HOME=(Resolve-Path work/pleos-environment/jdk/jdk-17.0.20.1+1).Path
$env:ANDROID_HOME=(Resolve-Path work/pleos-environment/android-sdk).Path
& ./work/pleos-environment/gradle/gradle-8.9/bin/gradle.bat -p experiments/pickgo-navi-selection --offline --no-daemon assembleDebug
& ./work/pleos-environment/gradle/gradle-8.9/bin/gradle.bat -p experiments/pickgo-navi-selection --offline --no-daemon lintDebug
& ./work/pleos-environment/android-sdk/platform-tools/adb.exe -s emulator-5556 install -r experiments/pickgo-navi-selection/app/build/outputs/apk/debug/app-debug.apk
& ./work/pleos-environment/android-sdk/platform-tools/adb.exe -s emulator-5556 shell am start --user 10 -n org.example.pickgonaviprobe/.ProbeActivity
& ./work/pleos-environment/android-sdk/platform-tools/adb.exe -s emulator-5556 shell am broadcast --user 10 -n org.example.pickgonaviprobe/.CommandReceiver --es command search --es keyword 하나로마트
python experiments/pickgo-navi-selection/capture.py 24-final-return
```

전체 증거는 `docs/evidence/pickgo-navi-selection-2026-11-04/`의 번호별 PNG/XML/log. 주요 증거: 08 기준안내, 10 검색목록, 11 첫선택, 12 첫복귀, 21 두번째목록, 22·23 두번째선택/관찰, 25 최종복귀. UI 캡처와 SDK 수신을 별도 증거로 보존. 캡처 도구의 adb uiautomator는 시험 관찰용이며 제품의 좌표 추출 수단이 아니다.

## 협업·남은 범위

별도 공개자료 조사 채팅01a1a664-ba47-77e2-a367-63602cefaa07과 범위 분리 통보: 이 채팅만 시험 앱/에뮬레이터 담당, 상대는 공개 계약 조사만 담당. Dot 새 외부 조사는 이 실행 시험에서 중복 하달하지 않았다. 사용자 신규 승인 없이 다른 지도 공급자로 전환하지 않는다.

공개 지원 계약이 추가로 확보되면 그 계약으로 별도 시험한다. 현재 PICKGO 설계에서 `현대 내비 검색 선택→좌표 수신`을 구현 가능으로 확정하지 않는다.


## 최종 검수·정리

- assembleDebug 종료0, lintDebug 종료0/0오류4경고: 캐시 의존성 버전, backup 설정, static Activity 참조, 앱 아이콘. 에뮬레이터 전용 시험 도구의 잔여 경고로 남기며 제출 앱에 재사용하지 않는다. Static 참조는 onDestroy에서 해제하고 이번 시험 후 probe를 force-stop했다.
- 실제 Claude Haiku5.5 읽기 검수: session 0a26b86e-685c-416e-a02e-49c2e2e18027, exit0/is_error=false. review.json/input.txt 보존. 소스 수정 권한 없음.
- 지적1(결론 과잉): 수용표를 목적지/경유지 확정 전 상세 선택 2건으로 한정. 확정 뒤 경로는 미시험으로 명시. 모든 API에서 불가능을 증명한 결과가 아님.
- 지적2(수신기 정상성): 폴링 응답과 unsolicited push를 분리. summary.json의 첫 구간 destination16/routeState15 및 roadSpeed31, 두번째 destination71/routeState72 및 roadSpeed145. 선택 관련 push는 관찰되지 않았다. 조회 응답이 있다는 이유만으로 모든 콜백이 검증된 것은 아니다. 확보한 실제 SDK를 javap로 재대조한 listener-declarations.txt의 이벤트 메서드는 모두 void; proxy가 원시 반환값에 null을 반환한다는 우려는 해당하지 않는다. Object hashCode/equals는 별도 처리한다. 저장된 AndroidRuntime:E 로그에 probe 치명 예외 없음. 메서드별 실행 가능성 전부 검증은 미실행.
- 지적3(상태 혼입): 20 안내 복귀 → 21 정상 검색 목록 → 22 상세 선택 → 23 30초 이상 관찰 → 25 수신앱 복귀 순서로 증거를 한정. 24의 파일명/실제 화면 불일치는 본문에서 명시적으로 정정했다.
- 시험 종료 후 내비 UI의 안내 종료로 초기의 무경로 상태 복구. 27-cleanup-end: 빈 목적지, SAFE_GUIDING 확인. probe force-stop 후 기존 PICKGO PreviewActivity 표시. 앱 데이터/내비 기록 삭제 없이 시험 APK는 설치 상태로 보존.
- 본 시험은 PICKGO용 독립 수신 앱 수준이며 제품 웹 세션에 좌표를 전달한 시험이 아니다. 다음 구현 가능성 판단에는 공식 선택 결과 반환 계약 또는 별도 검색 공급자 검증이 필요하다.
