# Android 모의 운행 추천 연결

## 범위와 구현

사용자의 다음 작업 진행 승인 및 D-017 인계에 따라 기본 Android 듣기에 **명시적 debug 모의 모드**를 추가했다. 실제 SDK 위치·ETA·STT·백그라운드 서비스는 연결하지 않았다. 기존 J1 목표, 76.75 평가 이력과 90점 개선 목표는 변경하지 않았다.

이전 Android 채팅의 `wait_threads` 완료/idle을 확인한 뒤 Activity를 편집했다. 추천 정책 v1 채팅의 `core.mjs`는 읽기만 했고 다른 미커밋 변경을 보존했다. 기기 UI 탐색과 실기기 시험도 별도 채팅과 순차 조율했다.

- `JourneyDemo.java`: 기존 CoordinateStream의 합성 시각·세대·30초 신선도·단조 경로 정렬, 고정 취향 추천과 QueuePolicy의 3회/60초 교체 제한을 Java로 이식했다. 일반 추천 v1 API 전체 이식이 아니라 기존 시연 프로필/4편/2경로에 한정된다.
- `generate-journey-fixture.mjs`: 실제 기존 `observations.mjs`/`content.mjs`에서 Java fixture와 JS 실행 결과 기반 교차검증 assertion을 생성한다. JS를 Android에 import하지 않는다. 사용자 데이터나 측정 좌표는 없다.
- `ListeningActivity`: `FLAG_DEBUGGABLE`과 `synthetic_journey=true`가 모두 있어야 모의 모드가 열린다. 일반 실행은 기존 4편 순차 듣기다. 화면은 모의 운행·실제 SDK 미연결을 항상 표시하며 복잡한 제어는 플랫폼 UX 미확인/제한 상태에서 숨기고 이벤트 처리도 거부한다.
- 공통 구간은 2개 후보를 유지한다. 출근/심부름 분기·이탈·31초 경과·단절·명시 도착·동의/권한 철회·경로 변경을 입력할 수 있다. 시작 항목은 동의/권한을 허용한 **새 합성 입력**을 명시하는 명령이며 실제 권한을 변경하지 않는다. 지연 콜백은 입력 세대 토큰을 유지한다.
- 현재 출력 중인 항목은 바꾸지 않는다. `prepareDemoNext`와 실제 `startReady` 직전에 신선도를 다시 검사한다. 음원 준비·포커스 대기 중 만료되면 이전 추천을 출력하지 않는다. 사용자 시작 의도가 없으면 모의 입력만으로 재생하지 않는다.
- 무효화된 다음 항목을 교체 예산/간격 때문에 채울 수 없으면 이유를 표시하고 정지한다. **새 듣기** 또는 **듣기 종료 후 새 시작**만 듣기 예산을 초기화한다. 입력 재연결은 예산을 초기화하지 않는다. 3회/60초/30초는 기존 실험값이며 운영 검증값이 아니다.
- 위치 동의 철회는 입력·운행 맥락·다음 추천을 지운다. 이미 듣던 일반 음원과 저장 위치는 유지하며 사용자가 명시적으로 이어들을 수 있다. 미디어 사용 동의 철회 구현을 의미하지 않는다.
- 모의 체크포인트는 기본 듣기와 별도 저장소다. 음원 revision/항목/offset/소진/들은 항목 비트마스크/교체 횟수/대기열 예약 여부만 저장한다. 좌표·경로·입력·목적은 저장하지 않는다. 재시작 시 운행 맥락은 없고 자동 출력하지 않는다. 예약된 대기열이 사라졌으면 복원 시 60초 대기를 보수적으로 다시 적용하며 횟수는 유지한다.

## 재현 명령

저장소 루트 PowerShell:

```powershell
. ./experiments/pleos-probe/env.ps1
node experiments/j1-listening/generate-journey-fixture.mjs
javac -d work/j1-android-journey/classes experiments/j1-listening/app/src/main/java/org/example/j1listening/JourneyDemo.java experiments/j1-listening/app/src/main/java/org/example/j1listening/JourneyFixture.java work/j1-android-journey/JourneyParityTest.java experiments/j1-listening/JourneyDemoTest.java
java -cp work/j1-android-journey/classes org.example.j1listening.JourneyParityTest
java -cp work/j1-android-journey/classes org.example.j1listening.JourneyDemoTest
gradle.bat -p experiments/j1-listening --no-daemon assembleDebug assembleDebugAndroidTest lintDebug
adb.exe -s emulator-5556 install -r experiments/j1-listening/app/build/outputs/apk/debug/app-debug.apk
adb.exe -s emulator-5556 install -r experiments/j1-listening/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb.exe -s emulator-5556 shell am instrument --user 10 -w org.example.j1listening.test/android.test.InstrumentationTestRunner
```

현재 시험 AVD의 활성 사용자는 10이다. 다른 환경은 먼저 `am get-current-user`를 확인한다. 모의 실행은 앱을 종료한 뒤 아래처럼 시작한다. 기본 모드는 extra 없이 시작한다. 기존 debug 키만 재사용하며 새 키를 만들지 않는다.

```powershell
adb.exe -s emulator-5556 shell am force-stop --user 10 org.example.j1listening
adb.exe -s emulator-5556 shell am start -W --user 10 -n org.example.j1listening/.ListeningActivity --ez synthetic_journey true
```

공통 구간 입력 후 약 1.1초에 두 표본이 들어온다. 두 경로 후보 표시를 확인하고 분기를 선택한다. 교체 간격 안에는 이미 정한 다음 항목을 유지할 수 있다. 따라서 분기 직후 항상 다음 항목이 바뀐다고 설명하지 않는다. 새 듣기 전에 출근 분기까지 입력하면 reflection 음원을 우선 선택한다. 기본 시연 취향은 story 3/reflection 1, 출근 reflection +4, 심부름 reflection -3이다. 추천 품질·실제 사용자 선호 검증은 아니다.

## 검증 상태

Java/JS 교차 364 assertion, Java 경계 37개 및 Node 전체125개 통과. 최종 Android 기존8+신규6=14개 통과(159.487초). 추가 별도 프로세스 저장1개/복원1개 통과. 초기12개(157.837초) 결과는 이력이며 최종14개와 구분한다.

수용 범위: 합성 입력과 실제 Android MediaPlayer의 연결. 실제 WAV 자연종료와 합성 입력/직접 주입 focus·UX 검사는 구분한다. 실제 스피커 청취·실차·실제 주행 제한 전환·내비 공존·SDK 시각 계약/ETA 갱신 성공의 근거가 아니다. 중간 버전 release Java 컴파일은 실행했으나 최종 release 컴파일/APK 서명·설치·제출 검증은 하지 않았다.

## Claude 검수와 처리

- Opus5.5 `37fe1d0a-722b-4d86-b63e-0ebaca8a36b2`, exit0/is_error=false/modelUsage 확인. 세대·신선도·사용자 의도·복원·debug gate·교체예산 조건 반영. 시간역행을 단순 무시하라는 제안 대신 기존 JS처럼 해당 입력 세션을 폐기한다.
- Haiku 첫 호출은 180초 timeout, 결과 미확보. 입력을 줄인 재시도 Haiku5.5 `b5f0f56f-8a5e-4b16-9869-d2efce85988c`, exit0/is_error=false/modelUsage 확인.
- P1 일시정지 중 교체예산 미저장: `refreshDemo`가 대기열/횟수/예약 상태 변경을 즉시 저장하고 선택 확정도 동기 저장하도록 수정. 전용 Android 회귀 추가.
- P2 철회 뒤 현재 항목 재개: 위치 맥락 철회와 기존 음원 이어듣기는 분리한다는 요구에 따라 유지하고 문서에 명시. 현재 음원을 강제로 바꾸지 않는다.
- P2 차단 복원 시 모두 들음 오표시: 후보가 남아 있으면 변경 제한 안내를 표시하도록 수정.
- 별도 실기기 시험 실패: uiautomator idle 상태를 얻지 못함. 모의 render가 기본 context→모의 context를 매초 교차 설정하는 부분을 제거하고 실제 문자열이 바뀔 때만 TextView를 갱신했다. 재시험 결과는 최종 기록 참조.
- Dot R002/R004 기존 근거 재사용. 새 공식 API 질문이 없어 중복 조사 요청하지 않았다. 실제 좌표 `UNVERIFIED_CLOCK` 경계와 기존 상태 bridge는 수정하지 않았다.

## 후속 검수 판정

- Haiku5.5 후속 `29cfc8bf-26f5-4b21-b9dd-9de8054fe780`: diff만 보고 lastChange 저장을 가정한 P1은 사실과 다름. 저장 필드에 시각이 없고 `reserved=true`일 때 항상 현재 시각으로 보수적 대기를 다시 시작한다. 복원 시각을 디스크에 저장하라는 제안은 이 계약과 달라 미채택. 새로운 Activity 복원에서 횟수3 유지·대기 기준시각 재설정·자동출력 없음·명시 종료 초기화를 실제 시험했다.
- 같은 후속 P2 메시지 우려: 런타임 `demoBlocked`도 이미 동일한 순수 `proposal()` 판정으로 소진/제한을 구분한다. 고정4편 fixture에서 부작용이 없음을 확인. UI reason enum 제거는 개발 내부 문자열을 일반 화면에서 제거한 의도적 개선이다.
- 최종 좁은 Haiku5.5 검수 `8d393601-6b03-46a0-8ec1-fb6b7a715965`, exit0/is_error=false: 유휴 가드와 복원 시계 정책 일관성을 확인. P1로 지적한 exhausted→begin 예산 초기화는 **사용자가 누르는 버튼이 해당 상태에서 ‘새 듣기’로 바뀌는 명시 복구**이며 승인 조건이다. 최종 검수 입력에는 render가 빠져 일반 시작으로 해석했다. production의 begin 호출자는 play 클릭 한 곳뿐이고 onStart/입력/포커스 콜백에서 호출하지 않는다. 자동 초기화가 아니므로 유지한다. 명시 시작 처리의 예산 복구는 `testFreshnessAfterPrepareFocusWait`에서 검증했고, 버튼의 ‘새 듣기’ 표시는 소스에서 확인했다. 입력 재연결은 별도 시험에서 예산3을 유지했다.
- P2 take 내부 refresh 중복: Android 메인스레드에서 동일 selectionTime으로 동기 실행하고 외부 콜백이 끼어들지 않는다. 같은 후보 계산이며 반환 실패 시 정지한다. 변경하지 않았다.
- Claude는 소스 읽기 검수만 했으며 실제 시험은 Codex가 실행했다. timeout1회와 정상 Haiku3회, Opus1회를 구분한다. 최종 시험 성공을 검수자 실행으로 표현하지 않는다.

## 최종 실행 증거와 실패 범위

| 항목 | 실제 결과 | 증거 |
|---|---|---|
| debug 앱/시험 빌드·lint | 종료0, lint 0오류2경고 | work/j1-android-journey/build-final.log |
| Java/JS 교차·경계·기존 순수 상태 | 364/37 assertion 및 기존 상태 통과 | evidence/j1-android-journey-policy-2026-11-02.txt |
| Node 기존 전체 | 125/125, 종료0 | evidence/j1-android-journey-node-2026-11-02.txt |
| 실제 Android 회귀 | 14/14,159.487초 | evidence/j1-android-journey-tests-2026-11-02.txt |
| 프로세스 분리 저장/복원 | 각1/1,1529ms→force-stop→무음복원→명시 재개2882ms→명시종료0 | evidence/j1-android-journey-process-{prepare,restore}-2026-11-02.txt |
| 서명·권한 | 기존 Android Debug 인증서, 요청 권한 없음 | work/j1-android-journey/signature.txt, permissions.txt |
| APK·fixture·소스 해시 | 최종 manifest | evidence/j1-android-journey-manifest-2026-11-02.json |

남은 lint2개는 기존 동기 SharedPreferences commit과 구버전 backup 설정 권고다. API28 기기/백업 실행은 미검증이다.

**실패 및 수정:** 외부 UI dump 최초 idle 실패는 반복 context 쓰기 제거 후 해소됐다. 외부 터치 기반 프로세스 시험은 이후에도 offset0으로 실패했다. 실제 PNG는 Settings/Gleo 화면인데 uiautomator는 아래 J1 노드를 반환하는 시스템 화면 불일치를 확인하여 해당 클릭 시험을 중단했다. 앱 시작 전 큐 예약도 코드상 발견해 유휴 context-only 가드와 회귀를 추가했지만, 외부 터치 실패 전체의 원인이라고 단정하지 않는다. 최종 프로세스 시험은 각기 다른 instrumentation 실행 사이에 실제 `am force-stop`을 넣었으며, 실제 HOME 터치/시스템 전체 창 전환 시연을 대신 인증하지 않는다. 이전 기본 듣기의 HOME 검증은 이전 버전 증거다. 최종 시스템 화면에서 수동 조작 시연·실차 적합성은 미검증이다.

APK: `output/J1_Android_Journey_0.2.0_debug.apk`, 7,895,236 bytes, SHA256 `4411fc89751f37b8834c3b9fa451b392640dfd261e50003c0fc20204d9cddff7`. 이전0.1.0 APK는 보존했다. 최종 앱 소스·debug APK는14개 회귀와 일치하며 후속 변경은 프로세스 시험 클래스/문서뿐이다. 공개·push·외부 제출·계정·권한·서명키 변경 없음.
