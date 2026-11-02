# J1 actual location input adapter

기존 J1 웹 디자인을 변경하지 않는 별도 Android 입력 검증 모듈. FusedLocation SDK1.1.3 실제 콜백→PleosLocationInput→LocationInputGate 연결. 실제 위치 원문은 로그·파일·웹서버로 전달하지 않는다. NaviHelper/경로쓰기 권한은 없다.

## 확인 결과와 남은 차단

SDK 시각과 Android 벽시계를 비교한 에뮬레이터 27표본: wall-raw 5~1636ms, raw 비역행. `elapsedRealtime`과는 수치 기준이 다르고 기기 벽시계의 epoch ms와 일치하는 관찰이다. 공식 timestampMillis 문서에 기준 시계/관측 발생 시점/캐시 시각 의미를 확인할 설명이 없으므로 **에뮬레이터 관찰이지 일반 SDK 시계 계약 확정이 아니다**. 호스트 시각을 원천 신선도 판단에 쓰지 않는다.

현재 gate 출력은 UNVERIFIED_CLOCK이다. 실제 콜백을 받는 연결은 구현됐지만 기존 JS CoordinateStream/추천기로 전달하는 연결은 의도적으로 차단한다. 수신 시각을 observedAtMs로 바꾸거나 source를 synthetic으로 위장하지 않는다. SDK 제공자의 시각 계약 또는 검증 가능한 원천 시각 입력이 있어야 이 마지막 연결을 진행할 수 있다. 시각 보정/벽시계 점프/부팅 변경/실차/실측 신선도는 미검증이다.

## 구현 계약

- main thread에서 start/close/revoke. Android SDK 콜백은 시각과 필드를 복사한 뒤 main handler로 넘긴다. onChanged를 동기화해 수신 캡처와 post 순서를 보존한다.
- start는 명시적인 profile/consent와 현재 FUSED_LOCATION 권한이 필요하다. permission은 매 콜백에서 다시 확인한다. 프로필/동의 변경·서비스 종료 시 소유자가 revoke/close해야 한다. 앱의 onStop에서 close한다.
- 시작마다 세대 토큰을 바꿔 늦은 콜백/에러를 무시한다. close는 큐 제거·구독 해제·release를 수행한다. 정리 실패는 상태와 별도 cleanupIssue로 보고한다.
- 30초 무응답은 초기 콜백 timeout. 이후 무응답 신선도는 보증하지 않으며 최신 위치를 출력하는 상태 자체가 없다.
- rawTimestamp는 의미가 미확인이므로 보존·관찰만 한다. 좌표는 유한성/범위 검사 후 버리고 소비자 Sink에는 좌표를 노출하지 않는다.
- debug의 ClockProbeActivity는 ranchu 에뮬레이터에서만 테스트용 프로필/동의를 주입한다. 20초 후 revoke, 25초 후 종료. release 소스에는 진단 Activity가 없다. 배포용 앱이나 사용자 동의 UI가 아니다.

## 재현

프로젝트 루트 PowerShell에서:

```powershell
. ./experiments/pleos-probe/env.ps1
gradle.bat -p experiments/j1-input-adapter --no-daemon assembleDebug lintDebug
adb.exe -s emulator-5556 install -r -g experiments/j1-input-adapter/app/build/outputs/apk/debug/app-debug.apk
adb.exe -s emulator-5556 shell am start -n org.example.j1input/.ClockProbeActivity
adb.exe -s emulator-5556 logcat -d -s J1Input:I '*:S'
javac.exe -d work/j1-input/test-classes experiments/j1-input-adapter/app/src/main/java/org/example/j1input/LocationInputGate.java experiments/j1-input-adapter/tests/LocationInputGateTest.java
java.exe -cp work/j1-input/test-classes org.example.j1input.LocationInputGateTest
```

`-g`는 이 시험 에뮬레이터 앱의 런타임 권한만 허용한다. 제품은 실제 권한/동의 흐름을 구현해야 한다. 기존 로컬 도구 경로를 재사용하며 시스템 PATH 영구 변경은 없다.

공식 참고: [위치 접근](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/location-data-access), [timestampMillis](https://document.pleos.ai/en/api-reference/connect-sdk-pleos/FusedLocation/fused-location/ai.pleos.playground.location.fused.model/location-data/timestamp-millis), [권한](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/FusedLocation/declaring-permissions), [수명주기](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/initialization-and-release). 확인2026-11-02. 영문 소개1.1.2와 한국어1.1.3 버전 표기의 차이도 일반화하지 않는다.

현재 시험 종료 상태: 권한 거부 시험의 user10 권한을 원상복구하는 명령이 자동 승인 정책에 차단되어 거부 상태로 남아 있다. 테스트 APK는 종료됐다. 권한 복구 완료로 가정하면 안 된다.

## 실제 SDK 상태 연결 (2026-11-02 후속)

사용자 승인으로 emulator-5556 / Android user10 / org.example.j1input의 FUSED_LOCATION 권한 복구 및 granted=true 확인. 위의 권한 거부 종료 상태는 이전 시험 이력이다.

실제 SDK→어댑터→debug 상태 발행기→adb reverse→로컬 J1 서버→브라우저 상태 표시/취향 대안까지 연결했다. 시계 계약을 가정하는 emulator epoch 변환은 Opus5.5와 검토 후 채택하지 않았다. CoordinateStream은 여전히 synthetic만 허용하며 실제 좌표 추정은 미완료다.

전달은 source/generation/sequence/state/sampleCount/UNVERIFIED_CLOCK 여섯 필드만. raw 시각·좌표·관측 나이·fresh 표시는 전송하지 않는다. 수신 서버의 단조 시계5초 TTL은 상태 메시지의 최근 수신 여부만 의미한다. 콜백이 조용한 정상 서비스도 최근 상태 갱신 없음으로 표시될 수 있으며 연결 실패/관측 stale로 확정하지 않는다. heartbeat로 마지막 관측을 최신처럼 유지하지 않는다.

명시적 시험 실행:
```powershell
$env:J1_SDK_STATUS='1'
node experiments/journey-context/demo/server.mjs
# 별도 셸에서 기존 env.ps1 적용 후:
adb.exe -s emulator-5556 reverse tcp:4177 tcp:4177
adb.exe -s emulator-5556 shell am start --user 10 -n org.example.j1input/.ClockProbeActivity
```
브라우저 `http://127.0.0.1:4177/?input=sdk`. 기본 `/`는 기존 합성 시연. 실제 모드에서는 합성 경로/전략을 비활성화하고 다음 추천은 취향 대안, 저장된 이어듣기는 유지한다. 상태 조회는 대기열/추천 시계를 변경하지 않는다. debug Activity는60초후 revoke,65초후 종료한다. 종료 후 UI는 최근 상태 갱신 없음으로 바뀐다. `adb reverse --remove tcp:4177`로 이번 전달 경로를 해제할 수 있다.

제한: 동일 PC의 명시적 debug 시험용이며 송신자 인증은 없다. 다른 로컬 프로세스가 상태를 위조할 수 있으므로 운영용/실제 인증 증거로 사용하지 않는다. 네트워크 외부에는 바인딩하지 않으며, JSON/Origin/Host/크기를 검사한다. SDK 상태가 위조돼도 실제 경로·신선도·추천 승격 경로는 없다. generation은 기기 elapsedRealtime이므로 에뮬레이터 재부팅 시 로컬 서버도 재시작해야 한다. 최초 seq0 손실 상태에서 새 세대로 전환할 때도 시험 앱/서버 재시작이 필요할 수 있다. 서버만 재시작한 경우 기존 세대의 후속 sequence를 받을 수 있다. 이 제약을 제품 수명주기 지원으로 포장하지 않는다.
