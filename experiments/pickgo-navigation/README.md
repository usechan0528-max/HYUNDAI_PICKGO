# PICKGO · OSM 확정 지점 → 현대 내비 시연

기존 pickup-board 웹을 표시하는 별도 Android 시연 앱입니다. 실제 NaviHelper 3.0.5를 사용합니다. J1 코드는 사용하지 않습니다. 실제 차량용 주행 UX/CarUxRestrictions, 공개 HTTPS, 실차 검증은 포함하지 않습니다.

## 실행

저장소 루트 PowerShell에서 기존 확보 환경과 debug 키를 사용합니다. 새 키를 만들지 않습니다.

```powershell
$env:JAVA_HOME=(Resolve-Path work/pleos-environment/jdk/jdk-17.0.20.1+1).Path
$env:ANDROID_HOME=(Resolve-Path work/pleos-environment/android-sdk).Path
& ./work/pleos-environment/gradle/gradle-8.9/bin/gradle.bat -p experiments/pickgo-navigation --offline --no-daemon assembleDebug lintDebug
$env:PICKUP_PORT='4194'
node experiments/pickup-board/server.mjs
```

별도 터미널:

```powershell
& ./work/pleos-environment/android-sdk/platform-tools/adb.exe -s emulator-5556 reverse tcp:4194 tcp:4194
& ./work/pleos-environment/android-sdk/platform-tools/adb.exe -s emulator-5556 install -r experiments/pickgo-navigation/app/build/outputs/apk/debug/app-debug.apk
& ./work/pleos-environment/android-sdk/platform-tools/adb.exe -s emulator-5556 shell am start --user 10 -n org.example.pickgonavigation/.NavigationActivity
```

1. 차량 앱 상단 `픽업 지도`에서 실제 OSM 핀을 선택하고 `이 핀으로 픽업 시작`을 누릅니다.
2. 초대 링크를 같은 로컬 서버에 연결된 별도 브라우저에서 열어 탑승자가 참여합니다. 이번 영상의 참여는 테스트용 CDP participant이며 물리폰 참여 증거가 아닙니다.
3. 약속판의 native `확정 지점으로 현대 내비 안내 시작`을 누릅니다. 기존 내비 경로가 변경됩니다.
4. 현재 시험 내비에서는 경로 선택 화면의 카운트다운 후 자동으로 안내가 시작됐습니다. 호출 반환을 성공으로 판단하지 않고 실제 목적지와 `ROUTE_GUIDING`을 확인합니다. 버전별 동작을 보장하지 않습니다.

## 연결 계약

- origin은 `http://127.0.0.1:4194`로 고정. 외부 페이지 이동 차단. 원격 리소스는 OSM HTTPS 타일 이미지 경로만 허용. cleartext는 loopback만 허용합니다.
- JavaScript-callable bridge/Intent command가 없습니다. native 버튼만 경로 요청을 실행합니다. mainframe `evaluateJavascript`는 session credential만 읽으며, 좌표/역할은 native가 인증된 서버 응답에서 검증합니다.
- Activity는 `singleTask`로 기존 WebView/회차를 재사용합니다. 내비에서 앱으로 돌아오거나 런처를 반복 실행해도 새 빈 세션을 쌓지 않습니다.
- 확정 `mapPoint=[longitude,latitude]`를 `RouteInfo(latitude,longitude,…)`로 변환합니다. proposal 좌표와 synthetic-diagram 좌표는 전달하지 않습니다. 현재 시연 범위는 양재 bbox입니다.
- 운전자, 참여 완료, active/waiting, 제안 없음, 실수 좌표, 회차/버전/revision, 8초 이내 관측을 확인합니다. 명시 클릭 뒤 서버 최신 상태를 재검증하고 상태가 달라지면 요청하지 않습니다.
- requestRoute 전에 회차+placeRevision 중복 방지 기록을 저장합니다. 불확실한 응답/재시작 뒤 같은 지점을 자동 재전송하지 않습니다. 요청 결과는 현대 내비에서 확인합니다. 재연결은 앱 재실행으로 수행합니다.
- 발신 후 45초간 목적지(좌표 허용 오차 각 0.00002도)와 ROUTE_GUIDING을 확인합니다. 3초 내 새 관측 두 종류가 함께 있어야 현재 안내를 표시합니다. 결과 문구는 보존하되 관찰 종료 후에는 ‘최근 확인’으로 표시합니다.
- 발신 후 웹 회차도 다시 확인합니다. 취소/변경/확인 불가이면 경고하고 이미 전달한 내비 경로를 자동 변경·취소하지 않습니다. 서버 read와 SDK IPC 사이 원자성이나 플랫폼의 최종 동작은 보장하지 않습니다.
- 에뮬레이터 debug 빌드에서만 WebView debugging을 허용합니다. 로그는 credential/초대URL을 기록하지 않습니다. 기존 독립 probe의 공개 시험지점 로그는 별도 검증 증거입니다.

## 검증

```powershell
& ./work/pleos-environment/jdk/jdk-17.0.20.1+1/bin/javac.exe -encoding UTF-8 -d work/pickgo-navigation/test-classes experiments/pickgo-navigation/app/src/main/java/org/example/pickgonavigation/RouteGate.java experiments/pickgo-navigation/RouteGateTest.java
& ./work/pleos-environment/jdk/jdk-17.0.20.1+1/bin/java.exe -cp work/pickgo-navigation/test-classes org.example.pickgonavigation.RouteGateTest
```

실제 결과와 제한은 `docs/PICKGO_NAVIGATION_2026-11-04.md` 및 `docs/evidence/pickgo-navigation-2026-11-04/`를 참조합니다. OSM 선택 가능 표시는 합법 정차 인증이 아닙니다.
