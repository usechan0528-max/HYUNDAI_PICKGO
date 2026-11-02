# 에뮬레이터 UI 검토용 실행 앱

기존 웹 MVP를 Pleos의 실제 앱 영역에 띄우는 **debug 시각 검토용 WebView**입니다. 픽업 기능의 Android 이식/SDK 연동/제출용 APK가 아닙니다. 주행 중 사용하지 않습니다. 운행 제한을 우회하는 distractionOptimized 설정이 없습니다.

## 실행

저장소 루트에서 Node 서버를 먼저 실행합니다.

```powershell
node experiments/pickup-board/server.mjs
```

프로젝트에 이미 확보된 JDK/Android SDK/Gradle/기존 debug 키가 있는 환경:

```powershell
$env:JAVA_HOME=(Resolve-Path work/pleos-environment/jdk/jdk-17.0.20.1+1).Path
$env:ANDROID_HOME=(Resolve-Path work/pleos-environment/android-sdk).Path
& ./work/pleos-environment/gradle/gradle-8.9/bin/gradle.bat -p experiments/pickup-board/emulator-preview --offline --no-daemon assembleDebug lintDebug
& ./work/pleos-environment/android-sdk/platform-tools/adb.exe devices -l
& ./work/pleos-environment/android-sdk/platform-tools/adb.exe -s emulator-5556 reverse tcp:4180 tcp:4180
& ./work/pleos-environment/android-sdk/platform-tools/adb.exe -s emulator-5556 install -r experiments/pickup-board/emulator-preview/app/build/outputs/apk/debug/app-debug.apk
```

실제 device ID를 확인하고 맞춥니다. 에뮬레이터 앱 목록의 **픽업 UI 검토**를 누릅니다. 초기 전화 전체창이 앱 위에 남으면 전화 아이콘을 한 번 선택하여 정상 분할창으로 돌리고 픽업 P 아이콘을 선택합니다. 이번 환경에서 이 순서로 정상 표시를 확인했습니다. 계정/연락처 연결은 필요하지 않습니다.

주소는 정확히 http://127.0.0.1:4180/ 입니다. localhost나10.0.2.2로 바꾸지 않습니다. 서버의 Host/Origin 검증은 그대로 유지합니다. INTERNET normal 권한은 loopback 서버 통신에 사용하며 파일·콘텐츠 접근과 외부 origin 요청은 차단합니다. JavaScript bridge가 없습니다. 새 창을 지원하지 않으므로 탑승자 링크는 안내 후 차단하여 운전자 세션을 보존합니다. 두 역할의 완전한 흐름은 PC 브라우저의 두 탭에서 실행합니다.

서버 재시작 시 회차가 사라지고, 검토 앱 프로세스 재시작 시 sessionStorage 복구를 보장하지 않습니다. 독립 실행 배포 앱이 아닙니다. APK는 app/build/outputs/apk/debug/app-debug.apk, 로컬 전달용 복사본은 output/Pickup_UI_Preview_0.1_debug.apk. 기존 키를 재사용하며 키가 없는 환경에서 새 키를 자동 생성하는 절차는 포함하지 않습니다.

## 실제 확인

Pleos API34 emulator-5556, physical2560×1440/density160, 실제 앱 창 bounds[853,90,2535,1300](1682×1210). WebView131.0.6752.0. build/lint 성공, lint0오류1경고(구형Android fullBackupContent명시 권고). 실제 생성→종료확인→취소 유지, 최종빌드 생성과새창링크눌러도운전자화면유지 확인. SDK/CarUxRestrictions/실차/터치거리/가독성 인증은 미실행.
