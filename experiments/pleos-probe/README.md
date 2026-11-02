# Pleos SDK emulator probe

## 후속: 활성 경로 ETA 수신 확인 (2026-11-02)

사용자 승인으로 에뮬레이터에 공식 예제의 42dot POI를 설정했다. `test_route=true` Intent extra와 `Build.HARDWARE=ranchu`일 때만 `requestRoute`를 실행한다. 이 후속판에는 NAVI_ROUTE_SEARCH 권한이 추가되어 아래의 초기 읽기 전용 범위보다 넓다. 기존의 기본 실행은 목적지를 변경하지 않는다.

```powershell
. ./experiments/pleos-probe/env.ps1
gradle.bat -p experiments/pleos-probe --no-daemon assembleDebug lintDebug
adb.exe -s emulator-5556 install -r -g experiments/pleos-probe/app/build/outputs/apk/debug/app-debug.apk
adb.exe -s emulator-5556 shell am force-stop org.example.pleosprobe
adb.exe -s emulator-5556 shell am start -n org.example.pleosprobe/.ProbeActivity --ez test_route true
```

실제 수신 순서(단조 시계 ms):

| 수신 시각 | 결과 |
|---|---|
| 804553 | SAFE_GUIDING, routing=false, 목적지 시간 0 |
| 806432 | 공식 42dot POI 경로 요청 |
| 816716 | NavigationStatus.ROUTE_DRIVE |
| 816720 | NaviMode.ROUTE_GUIDING, routing=false |
| 817739 | onDrivingInfo → destination.duration = **60초** |
| 834479 | onDestinationInfo → remainTime = **60** |

실제 내비 화면의 안내 시작 후 **1분·50m** 표시와 일치했다. 화면에서 안내 시작 카운트다운 이후 경로 안내로 전환됐으며 별도 클릭으로 강제하지 않았다. 빌드와 lint 성공(0오류/기존 경고2개). 검증 앱은 종료했고 에뮬레이터의 목적지 안내는 확인용으로 남겼다.

**이전 설명 정정:** `routing=false`만으로 활성 경로가 없다고 판단하면 안 된다. 소스 `RouteStateInfo.isRouting` 주석은 활성 경로 여부라고 설명하지만 이번 이미지에서는 ROUTE_DRIVE/ROUTE_GUIDING 및 실제 안내 화면과 동시에 false였다. 이 문서·실행 불일치를 미해결로 보존한다. 초기 시험의 SAFE_GUIDING 상태 자체는 그대로 유효한 관찰이다.

ETA는 이번에 **목적지까지 예상 소요 시간**을 확인한 것이다. `DrivingState.duration`의 소스 주석은 현재 위치에서 목적지까지의 초로 명시한다. `TripInfo.eta`는 이번에 요청하지 않았고 도착 시각 형식·실제 이동 시 갱신·정확도·실차는 미검증이다. 공식 예제 POI ID로 해석된 목적지이며 좌표/POI ID 일치 검증은 별도다.

공식 목적지 가이드의 Java 예제는 현재 SDK와 위도·경도 순서 및 생성자 인자 수가 다르다. 공개 sources.jar의 latitude→longitude 순서 및 11인자 생성자와 Kotlin 예제를 대조했다. [공식 가이드](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/destinations).

Claude Haiku5.5 고정 코드 읽기 검수 완료. 차단 결함 없음. ETA와 상태 연관 지적은 위 수신 시각과 화면을 대조하여 판정했고, `onRouteStarted`만으로 활성 경로를 판단하라는 제안은 공식 문서상 경로 탐색 시작 콜백이므로 채택하지 않았다. NavigationStatus는 공개 enum 소스로 원문 위치 유출 우려를 반증했다. 재연결·회전 시 요청의 멱등성 및 초기화 중 예외의 자원 정리는 제한된 시험 밖의 개선 항목으로 남긴다. [검수와 처리](../../docs/evidence/pleos-eta-review-2026-11-02.json).

[수신 로그](../../docs/evidence/pleos-eta-runtime-2026-11-02.txt) · [결과와 해시](../../docs/evidence/pleos-eta-result-2026-11-02.json) · [안내 화면](../../docs/evidence/pleos-eta-active-2026-11-02.png)

Windows용 실제 Pleos SDK 읽기 검증 앱. 기존 J1 웹 시연과 분리한다. Java는 이 작은 검증 앱에만 사용하며 본 제품의 언어 결정은 아니다. fake adapter나 하드코딩된 위치 응답은 없다. 에뮬레이터 서비스의 모의 차량 데이터이며 실차 검증은 아니다.

## 실행 환경

프로젝트 루트에서 PowerShell:

```powershell
. ./experiments/pleos-probe/env.ps1
gradle.bat -p experiments/pleos-probe --no-daemon assembleDebug
adb.exe -s emulator-5556 install -r -g experiments/pleos-probe/app/build/outputs/apk/debug/app-debug.apk
adb.exe -s emulator-5556 shell am start -n ai.umos.maps.android.navigation.app/.MainActivity
adb.exe -s emulator-5556 shell am start -n org.example.pleosprobe/.ProbeActivity
adb.exe -s emulator-5556 logcat -s PleosProbe:I '*:S'
```

`-g`는 이 검증용 에뮬레이터의 앱 런타임 권한을 허용한다. 실제 제품에서는 사용자에게 권한을 요청하고 거부를 처리해야 한다. 초기 권한 없는 실행에서는 SecurityException을 관찰했다. 서비스/시스템의 signature 권한을 우회하거나 호스트 위치 권한을 바꾸지 않았다.

AVD가 꺼져 있으면 같은 환경에서 `emulator.exe -avd Pleos_J1_Probe -no-snapshot -port 5556`로 실행한다. 이번 시험은 `-no-window -no-audio`로 백그라운드 실행했다. 로컬 차량 콘솔은 `adb.exe -s emulator-5556 forward tcp:8088 tcp:8088` 후 http://127.0.0.1:8088/ 에서 접근한다.

도구는 `work/pleos-environment/`에 설치했다. 시스템 PATH 영구 변경이나 Android Studio IDE 설치는 하지 않았다. `env.ps1`은 현재 셸에만 적용한다. Gradle 8.9, AGP 8.7.3, Temurin JDK 17.0.20.1, compile/target API 34, min API 28, Emulator 37.2.13, Pleos 이미지 2.1.0, AVD RAM 4096 MB, WHPX를 사용한다. Gradle/AGP/JDK 조합은 [공식 호환표](https://developer.android.com/build/releases/agp-8-7-0-release-notes)에 맞췄다.

의존성은 공식 Maven의 FusedLocation 1.1.3 / NaviHelper 3.0.5 및 전이 의존성이다. 처음 확보한 AAR을 수동으로만 연결하지 않고 POM/Gradle metadata를 통해 런타임 의존성까지 해결했다. SDK 바이너리·도구·AVD·디버그 키는 공개 저장소 배포 대상이 아니다.

## 2026-11-02 결과

- 실제 Android APK 빌드·설치·실행 성공, Android 14/API34 부팅 확인.
- FusedLocation 지원 true. 권한 허용 후 60초 관찰 시 콜백 49회, 좌표 범위/유한성 검사 통과 49회. 1회 조회·재조회와 구독 콜백을 합친 수치이므로 고유 위치 49개나 정확한 1Hz 보장이 아니다.
- NaviHelper 서비스 연결 후 현재 위치·목적지 응답·경로 상태 총 3회 수신. 경로는 `SAFE_GUIDING`, `routing=false`였다. 목적지 응답 객체의 존재가 활성 목적지나 유효 경로를 의미하지 않는다.
- 초기 내비 앱 활성화 전에는 서비스 연결만 있고 응답이 없었다. 내비 앱 실행 이후 응답이 관찰됐다. 이 관찰만으로 모든 콜백에 동일한 선행 조건이 있다고 일반화하지 않는다.
- 실제 설치 서비스: FusedLocation 1.0.0, Navi service 3.0.4, Navigation app 3.3.2-rc5-hotfix.3.
- 좌표·목적지 원문은 로그에 기록하지 않는다. SDK timestamp 의미·신선도·좌표 변화 반영·활성 경로/ETA·실차는 미검증이다.

증거: [실행 로그](../../docs/evidence/pleos-probe-runtime-2026-11-02.txt). 상세 설치/빌드/검수 로그와 화면은 `work/pleos-environment/`에 있다. 에뮬레이터 logcat 벽시각은 호스트 KST와 다르므로 줄 안의 monotonic 수신 시각과 60초 관찰 기준으로 판정했다.

앱은 개발용 로그 화면이며 배포용 주행 UX가 아니다. 시험 당시 P/0 km/h 정차 상태였다. 테스트 범위 밖의 시스템 입력기 크래시 로그가 있었으나 probe 프로세스의 크래시로 보고하지 않는다.

`lintDebug`는 0 errors / 2 warnings로 통과했다. DataExtractionRules와 MissingApplicationIcon 경고는 데이터 저장이 없는 내부 검증 앱의 배포 준비 항목으로 남겼다.

Claude Haiku 5.5 읽기 검수 2회 정상 완료. 최초 지적의 스레드 가시성·유효 위치 집계·내비 상태 로그를 반영했다. 최종 검수는 허위 성공 표현/리스너 수명주기/좌표 로그 문제를 찾지 못했으며, 내비 비-null 별도 집계·반복 조회·예외 클래스 전체 이름을 추가 제안했다. 이번 한정 시험에서는 개별 `present=true` 3개를 근거로 판정하고, 내비 연속 갱신은 미검증으로 남겨 해당 확대는 하지 않았다. [회신과 지적별 처리](../../docs/evidence/pleos-probe-review-2026-11-02.json). 검수자가 실행한 시험은 없으며 런타임 증거는 Codex가 수집했다.

## 수명주기·범위

종료 시 구독 해제와 SDK release를 호출한다. 위치 초기화 후 바로 조회하는 순서는 공식 FusedLocation 생명주기 가이드에 따르며, initialize 반환만으로 연결 성공을 선언하지 않는다. 5/15/30초의 유한한 재조회와 60초 집계를 제공한다. 기본 실행은 내비 경로를 변경하지 않으며 `test_route` 에뮬레이터 시험에서만 경로 설정을 요청한다. 사용자 계정·SDK 권한 신청·외부 공개·실차 연결은 수행하지 않았다.

## 2026-11-02 · 이동 중 갱신 시험

**위치 갱신 통과, 내비 위치·ETA 변화 확인 실패.** 활성 안내가 유지된 동일 AVD에서 합성 좌표 11개를 약 22m 간격, 8초마다 입력하는 시험을 2회 수행했다. 두 번 모두 FusedLocation에서 0~10번 입력 전부 수신했다. 이는 실제 SDK 서비스의 합성 GPS 반영이며 실차 주행이 아니다.

1차 목적지 응답 37회와 2차 24회 모두 `remainTimeRaw=60`, 값 변화 0회였다. 2차에는 내비 좌표도 비교했으며 24회 모두 합성 좌표에 일치하지 않고 기준값 이후 변화가 없었다. 안내 모드는 `ROUTE_GUIDING`이었다. 반복 응답을 ETA 변화로 간주하지 않는다. `DrivingState.duration`의 연속 변화나 ETA 정확도는 이번 시험으로 확인되지 않았다.

```powershell
. ./experiments/pleos-probe/env.ps1
# 활성 안내가 있는 상태에서 시작. 없다면 별도 test_route 시험으로 먼저 설정한다.
adb -s emulator-5556 shell am start -n org.example.pleosprobe/.ProbeActivity --ez test_movement true
python experiments/pleos-probe/move-emulator.py
# PID를 확인해 logcat을 저장한 뒤 analyze-movement.py로 비교한다.
```

`test_movement`는 ranchu AVD에서 최대36회/5초 간격으로 내비를 조회한다. 입력 스크립트도 대상 AVD의 ranchu 여부를 확인한다. 합성 직선 경로는 도로 경로나 내비의 모의 주행과 동일하지 않다. 차량 속도·기어 변경 시험은 수행하지 않았다. 추가 로컬 차량 콘솔 GET 조회는 도구 실행 정책에 차단되어 원인 진단 범위에 포함하지 못했다. 내비가 GPS 입력을 사용하지 않는 이유는 미확인이다.

변경 파일: `ProbeActivity.java`, `move-emulator.py`, `analyze-movement.py`. assembleDebug/lintDebug 통과(0 errors/2 기존 warnings), APK 설치 성공. Claude Haiku5.5 읽기 검수 후 내비 좌표 비교를 보강하고 ETA 시계열은 로그 분석기로 비교했다. 실험 종료 시 probe만 중지했고 AVD와 기존 안내는 유지했다.

[집계 결과](../../docs/evidence/pleos-movement-result-2026-11-02.json) · [2차 원본 로그](../../docs/evidence/pleos-movement-second-runtime-2026-11-02.txt) · [검수 처리](../../docs/evidence/pleos-movement-review-2026-11-02.json)

## 2026-11-02 · 내비 갱신 원인 조사 — 미해결

기본 GPS 입력에서 내비 앱 `GpsLocationSource`가 `NMEA checksum mismatch`로 문장을 거부하는 현상을 확인했다. 공개 AOSP Emulator `android/emu/gps/src/android/gps.cpp`에도 `*47` 고정 체크섬 생성 코드가 있다. 이것은 관찰된 입력 결함의 근거이며 설치 바이너리와 공개 브랜치의 완전한 동일성 또는 유일한 원인 증명은 아니다.

`drive-nmea.py`는 합성 위치를 `geo fix`에 넣고 XOR 체크섬을 계산한 GGA/RMC 문장을 `geo nmea`로 보낸다. 시간은 Goldfish GNSS 형식에 맞춘 HHMMSS 정수다. fractional-time 입력 시도도 있었으나 성공으로 집계하지 않았다. 입력기의 OK는 콘솔 접수만 뜻한다. 자동 생성되는 잘못된 체크섬 문장은 별도로 계속 들어온다.

`MovementProbeService`는 내비 화면을 전면에 둔 채 최대180초 동안 2초마다 실제 NaviHelper를 조회한다. 실제 좌표 대신 변화 여부와 합성 경로 일치 번호를 남기고, Android NMEA 수신 체크섬/UTC를 기록한다. native navigation을 foreground로 전환했을 때 기존 Activity 로그가 중단된 관찰을 계측 서비스로 보완했다. 서비스는 ranchu 전용이며 DUMP 권한을 가진 shell/system만 외부 시작 가능하다. fine-location 권한 검사와 비고정 foreground location/specialUse 수명주기를 갖는다. 제품용 앱 구성은 아니다.

```powershell
. ./experiments/pleos-probe/env.ps1
gradle.bat -p experiments/pleos-probe --no-daemon assembleDebug lintDebug
adb -s emulator-5556 install -r -g experiments/pleos-probe/app/build/outputs/apk/debug/app-debug.apk
# 내비 UI에서 목적지 및 ROUTE_GUIDING을 먼저 확인한다.
adb -s emulator-5556 shell am start-foreground-service -n org.example.pleosprobe/.MovementProbeService
adb -s emulator-5556 logcat -s NaviDriveProbe:I '*:S'
# 다른 셸에서 첫 NAVI_LOCATION/DESTINATION 응답 확인 후 실행
python experiments/pleos-probe/drive-nmea.py --steps 61
adb -s emulator-5556 shell am stopservice -n org.example.pleosprobe/.MovementProbeService
```

기존 최근 목적지를 내비 UI에서 선택하면 약12km/18~20분 경로가 계산된다. 앞선 SDK 예제 요청의50m 경로와 같다고 간주하지 않는다. 정차시험에서89회 내비위치 조회, 올바른 체크섬 NMEA137회 수신에도 위치 변화0회, 남은시간1080초/거리12000m 고정. 마지막 계측에서도34회 위치조회 모두 변화0, 합성경로 불일치, 시간1080초/거리12000m 고정이었다. NMEA valid 개수에는 우연히 체크섬이 일치하는 자동 생성 문장이 포함될 수 있다.

가상 콘솔 D/ACCEL도 시험했지만 내비 갱신 성공을 얻지 못했다. 시험 중 emulator 프로세스가 종료되어 연결이 끊겼으며 원인은 미확인이다. 데이터 삭제 없이 재부팅했고 P/0km/h 및 DDS ONLINE을 확인했다. 재부팅 직후87회 조회는 SAFE_GUIDING/목적지0이므로 활성경로 갱신 증거에서 제외한다. 진단 서비스는 종료했다. 내장 모의주행 SIMULATION_GUIDING 진입은 확인하지 못했다. SDK enum 존재를 실행 지원으로 표현하지 않는다.

Navi42 설치 APK 파일 읽기는 Permission denied여서 중단했으며 권한 상승이나 내비 코드 변경을 하지 않았다. 정상 입력만으로 갱신되지 않는 나머지 원인은 미해결이다. [공식 포럼의 같은 시뮬레이션 문의](https://github.com/Pleos-Playground/pleos-playground-api/discussions/29)는 확인 시점 미답변이었다. 이는 현재 이미지의 미지원 판정은 아니다.

[계측 집계](../../docs/evidence/pleos-navi-drive-result-2026-11-02.json) · [최종 런타임](../../docs/evidence/pleos-navi-drive-final-runtime-2026-11-02.txt) · [Claude 검수와 처리](../../docs/evidence/pleos-navi-drive-review-2026-11-02.json). 최종 런타임은 마지막 명시적 권한검사 추가 직전 APK이며, 권한검사 추가 후 빌드/lint를 별도로 검증했다. 실차·도로 경로 재생·ETA 정확도는 미검증이다.
