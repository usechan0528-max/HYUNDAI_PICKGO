# 이번 길 · Android 로컬 듣기

기존 J1 한국어 WAV 4개를 Android MediaPlayer로 재생하는 전면 화면 시연 APK. 기존 웹 및 SDK probe와 별도 패키지 `org.example.j1listening`이며 인터넷·위치·마이크 권한이 없다. 콘텐츠 순서는 기본 고정 순서다. 실제 좌표 기반 추천은 여전히 `UNVERIFIED_CLOCK` 차단이며 이 앱에 연결하지 않았다.

## 실행

프로젝트 루트의 PowerShell에서 기존 설치 도구 환경을 사용한다. Gradle wrapper는 없으며 검증한 로컬 Gradle 8.9/AGP 8.7.3/JDK17/API34 조합이다.

```powershell
. ./experiments/pleos-probe/env.ps1
gradle.bat -p experiments/j1-listening --no-daemon assembleDebug lintDebug
adb.exe -s emulator-5556 install -r experiments/j1-listening/app/build/outputs/apk/debug/app-debug.apk
adb.exe -s emulator-5556 shell am start --user 10 -n org.example.j1listening/.ListeningActivity
```

`10`은 시험 Pleos AVD의 활성 사용자이며 다른 환경에서는 `adb shell am get-current-user`로 확인한다. AVD가 꺼져 있으면 기존 `Pleos_J1_Probe`를 시작한다. 기존 `work/pleos-environment/android-user/debug.keystore`를 재사용하며 키를 생성·교체하지 않는다. 다른 PC는 사용자 승인된 자체 서명 설정이 필요하다.

1. **바로 듣기**를 누르면 시작하고 자연종료 시 다음 항목을 재생한다. 4개 소진 후 정지하며 **다시 듣기**는 첫 항목부터 시작한다.
2. **일시정지**, **이어듣기**로 같은 위치에서 재개한다. 앱을 벗어나면 위치를 저장하고 재생 자원을 해제한다. 돌아오거나 프로세스를 재시작해도 자동 출력하지 않는다.
3. **듣기 종료**는 현재 위치와 순서를 초기화한다. 단순 화면 이탈/포커스 상실과 다르다.
4. 임시 포커스 상실은 대기하고 유효한 재생 의도가 남아 있을 때만 gain에서 재개한다. 영구 상실·출력 장치 변경·사용자 일시정지는 새 시작 동작이 필요하다.

매초 및 전환 시 앱 전용 저장소에 음원 revision/항목/위치를 저장한다. 백업·기기간 전송은 제외한다. 비정상 강제 종료 시 마지막 주기 이후 약 1초의 진행은 손실될 수 있다. 기존 브라우저 체크포인트/취향 저장소는 가져오지 않는다.

## 범위와 제한

Android 네이티브 화면은 기존 차콜·흰색/Asta Sans·큰 고정 버튼을 유지한다. CarUxRestrictions 초기 조회/변경을 구독하며 미확인·제한 상태에서 제목을 숨긴 간단 모드로 전환한다. 복잡한 입력·목록·설정은 없다. DO 인증이나 주행 허용 메타데이터는 선언하지 않아 플랫폼이 주행 시 화면을 막을 수 있다. 실차 적합성·실제 주행 전환 검증 완료가 아니다.

현재는 **Activity 전면 재생**이다. 내비를 전면으로 바꾸면 일시정지한다. MediaBrowserService/MediaSession, 차량 미디어 컨트롤러, 백그라운드 지속재생, 실제 suspend/시동 자동실행, STT는 후속 범위다. 오디오 포커스 기본 처리를 실제 내비 안내·통화의 정교한 공존 검증으로 확대하지 않는다.

한국어 AI 음원은 기존 생성본 그대로이며 `assets/NOTICE.txt` 및 `assets/licenses/`에 출처·권리 안내를 포함한다. Asta Sans 라이선스는 `assets/fonts/`에 동봉한다. 새 AI 호출이나 외부 전송은 없다.

## 0.2.0 모의 운행 연결

APK: `output/J1_Android_Journey_0.2.0_debug.apk`. 일반 실행은 기존 기본 듣기이며 아래 extra를 명시한 **debug 앱만** 합성 운행 제어를 표시한다. [수용 결과·검수·한계](../../docs/J1_ANDROID_JOURNEY_2026-11-02.md).

```powershell
adb.exe -s emulator-5556 shell am force-stop --user 10 org.example.j1listening
adb.exe -s emulator-5556 shell am start -W --user 10 -n org.example.j1listening/.ListeningActivity --ez synthetic_journey true
```

플랫폼 UX가 허용할 때 ‘모의 운행 입력’에서 공통 구간→분기, 이탈·만료·단절·도착·동의/권한 철회를 선택한다. 실제 위치나 권한이 아니라 합성 입력이다. 현재 재생은 유지하고 다음 항목만 갱신한다. 변경 제한으로 대기열을 채우지 못하면 ‘새 듣기’로 명시 복구한다. 모의 체크포인트는 기본 듣기와 분리된다. Java/JS364 교차 assertion,37 경계 검사,Android14회귀 및 별도 프로세스2시험 통과. 실제SDK·실차·백그라운드 재생·추천v1 전체설정 적용은 아니다.

### 기본 상태 시험 명령

```powershell
. ./experiments/pleos-probe/env.ps1
javac -d work/j1-android-listening/classes experiments/j1-listening/app/src/main/java/org/example/j1listening/ListeningState.java experiments/j1-listening/ListeningStateTest.java
java -ea -cp work/j1-android-listening/classes ListeningStateTest
gradle.bat -p experiments/j1-listening --no-daemon assembleDebugAndroidTest
adb.exe -s emulator-5556 install -r experiments/j1-listening/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb.exe -s emulator-5556 shell am instrument --user 10 -w org.example.j1listening.test/android.test.InstrumentationTestRunner
```

시험 APK는 개발용이며 전달할 앱에 포함하지 않는다. 시험은 이 앱의 체크포인트를 초기화하고 4개 WAV를 실제 시간으로 재생한다. 테스트의 duck/transient/noisy/unknown UX 직접 주입과 시스템 focus 경쟁 요청을 구분한다. 실제 스피커 청취·감쇠량 측정·내비 안내·실차 시험은 별도다.
