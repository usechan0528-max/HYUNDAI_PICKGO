# Android 기본 듣기 통합 · 2026-11-02

## 범위와 구현

사용자가 추가 작업 1번 Android 앱 듣기 통합을 승인하여 D-017 새 채팅에서 진행했다. Codex 구현·실행·통합, Claude Opus5.5 설계 검토 및 Haiku5.5 고정 코드 검수 2회. main의 기존 미커밋 변경은 보존했으며 `experiments/j1-listening/`를 별도 프로젝트/패키지로 만들었다. 기존 웹·j1-input-adapter·pleos-probe 소스는 수정하지 않았다. 기존 도구 환경과 AVD만 재사용했다.

Java17/Android native views + MediaPlayer를 선택했다. 작은 오프라인 전면 재생에 필요한 상태·자원만 구현하며 새 런타임 의존성은 없다. 기본 한국어 WAV4개, 원본 라이선스 및 Asta Sans를 복사 동봉했다. 기존 차콜/흰색·큰 버튼 구성 유지. 브라우저를 포장한 앱이 아니며 웹 서버 없이 실행한다. 기존 웹 취향/저장위치의 이관 및 추천 알고리즘 통합은 이번 범위가 아니다.

- 시작→비동기 준비→저장 위치 seek 완료→focus가 허용되면 재생.
- 일시정지/화면 이탈/영구 focus 손실/출력 장치 변경은 저장 후 해제. 복귀는 명시적 버튼으로 재개.
- 앱의 **듣기 종료**는 저장 위치·순서 초기화. 자연종료는 동일 focus를 유지하며 다음 항목으로 전환, 4편 소진 시 무음 종료. 다시 듣기는 처음부터.
- MEDIA/SPEECH, transient pause/gain 재개 의도 검사, CAN_DUCK 0.2 배율/복원. 실제 차량 감쇠량 적합성은 미검증.
- player 세대/focus epoch/차량 연결 epoch를 분리해 늦은 콜백을 차단. 준비/seek 10초 상한.
- revision/index/offset/exhausted만 앱 전용 저장. 매초·전환 시 저장, 백업·기기간 전송 제외. 프로세스의 예고 없는 종료에서는 마지막 주기 이후 진행 손실 가능.
- 실제 CarUxRestrictions 조회/리스너, 미확인·제한에서 간단 표시. 모든 상태에 복잡한 목록/입력/설정 없음. 오디오 기본 제어 자체는 차단하지 않으며 플랫폼 화면 차단을 우회할 DO 메타데이터를 넣지 않았다. 주행 적합성 인증이 아니다.

## 실행 명령과 증거

환경: 기존 Gradle8.9/AGP8.7.3/Temurin17, min28/compile·target34, Pleos2.1.0 API34 AVD `Pleos_J1_Probe`, `emulator-5556`, 활성 user10. 기존 debug 키만 재사용. release 서명/키 생성·교체·권한 변경·공개·push 없음.

실행 설명과 명령 전체: [앱 README](../experiments/j1-listening/README.md). 증거 원본은 `work/j1-android-listening/`이다.

| 시험 | 명령/방법 | 관찰 |
|---|---|---|
| 빌드·정적 분석 | `gradle.bat -p experiments/j1-listening --no-daemon assembleDebug assembleDebugAndroidTest lintDebug` | build-final-verified.log; 성공, lint 0오류/4경고 |
| 순수 상태 | `javac` 후 `java -ea ... ListeningStateTest` | unit.log; 복원/잘못된 값/세대/종료/소진 assertion 통과 |
| 실제 Android | `adb shell am instrument --user 10 -w ...` | instrumentation-final.log; 최종8/8통과, 114.766초. 실제 player와 주입 시험 구분은 아래 참조 |
| 실제 화면 이탈·프로세스 재시작 | `python work/j1-android-listening/process-test.py` | HOME 후 2520ms 저장→force-stop/재실행 시 무음·이어듣기→7358ms 재생/중지→명시 종료 후 재실행0ms. process-restart.json |
| 서명·권한 | `apksigner verify --print-certs`, `aapt dump permissions` | 기존 Android Debug 인증서, 요청 권한 없음. signature.txt/permissions.txt |
| APK 구성·해시 | ZIP 저장방식/WAV 원본 SHA256 비교 | final-manifest.json |
| 화면 | ADB PNG 캡처 및 시각 확인 | screen-final.png. 앱 영역과 버튼/AI고지 확인 |

기존 7개 instrumentation 묶음은 두 차례 통과(102.128초/100.846초). 실제 WAV 4편을 seek 가속 없이 자연 재생·완료했고 실제 경쟁 AudioFocusRequest(GAIN)로 영구손실을 관찰했다. duck/transient/noisy/unknown UX는 콜백 주입 시험이며 시스템 내비·통화·실제 출력장치 이벤트 시험으로 표현하지 않는다. 마지막 보완은 준비 도중 transient 후 11초 대기와 유효 gain 재개, idle noisy 무변경 시험을 추가했다. 최종 수치는 final 로그를 기준으로 한다.

실패/진단 이력: 초기 lint의 API33 receiver 상수 경고를 버전 분기로 수정. 최초 프로세스 시험은 run-as 인수 순서 오류, 후속은 외부저장 UI 덤프 경로/콜드스타트 대기 부족으로 실패했다. `run-as package --user 10`, 로컬 임시 덤프, `am start -W`로 수정 후 같은 검증을 통과했다. 앱 데이터 삭제나 권한 우회는 없었다. 시험 중 시스템 서비스 crash 로그가 존재했으나 이를 J1 앱 크래시로 판정하지 않으며 실차 안정성 인증도 하지 않는다.

lint 경고4개: 동기 SharedPreferences commit 1개(종료 경계의 작은 저장), 한국어 상태문자열 조합 2개, API31미만 fullBackupContent 권고1개. API31미만은 allowBackup=false이며 이후는 명시적 추출 제외 규칙을 적용한다. 이번 시연에서 유지하며 다국어·메인스레드 저장 성능·구버전 실제 백업 검증은 별도다.

## Claude 검수와 대응

- Opus5.5 session `745a1dec-bfee-4bca-b89a-2e0e3a9f5511`, exit0/is_error=false/modelUsage 확인. 세대·restore검사·주기저장·noisy·라이선스·시험 경계 반영. 제안 중 회전 후 자동 재생은 화면 복귀 명시 재개 정책과 달라 채택하지 않음.
- Haiku5.5 session `f8c3723f-a429-4dfe-8684-1264ab3fd17d`, exit0/is_error=false. P1 조건부 60초 제한: 실제 WAV가 모두20~23초라 현재 결함 아님, 100초 시험은4편 합계. P1 항목전환 focus 반납: 반납 제거 및 focusEpoch 분리로 수정. P2 오래된 Car 연결·시험 스레드·stale token 분리·중립 문구 반영. debug signing은 AGP debug 기본값 상속, 빌드/설치/서명으로 확인. 실제 transient/duck/거부 시험 누락은 미실행으로 유지.
- Haiku5.5 session `22a77693-c919-41be-9d9b-78af33d0bb46`, exit0/is_error=false. 차단 결함 없음. 콜백 내부 release는 방어적으로 post+동일 player/token 재검사로 보완, idle noisy 무변경 반영. timeout을 focus 대기 중 비활성화하라는 제안은 미채택: 준비는 focus와 독립적으로 끝나며 prepared=true이면 timeout이 동작하지 않는다. 준비 자체가10초 지연될 때만 중단한다. 실제 준비중 transient/11초대기 시험을 추가했다. 후속 답변의 onStop active 순서 설명은 정확하지 않으나 코드에서는 같은 메인스레드 내 pause 후 active=false이며 중간 콜백 실행이 없다.
- 마지막 작은 보완은 Codex 재빌드/시험으로 검증, Haiku3차 호출은 하지 않았다. 검수자가 실행한 시험은 없고, 기록된 실행은 Codex가 수행했다.

## 공식 근거와 한계

[MediaPlayer 상태/자원](https://developer.android.com/media/platform/mediaplayer/state-resources), [MediaPlayer API](https://developer.android.com/reference/android/media/MediaPlayer), [Android audio focus](https://developer.android.com/media/optimize/audio-focus), [CarUxRestrictionsManager](https://developer.android.com/reference/android/car/drivingstate/CarUxRestrictionsManager), [Pleos Audio Focus](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/audio-focus-development-guide/audio-focus-development)를 직접 확인했다. 실제 SDK API34 android.car.jar 선언도 javap로 대조했다. 문서 확인과 실행 증거는 구분한다. DOT-R002 기존 조사와 병렬 [오디오 후속 계획](J1_ANDROID_AUDIO_FOCUS_PLAN_2026-11-02.md)을 참고했으며 중복 하달하지 않았다.

**미실행/차단:** 실차, 실제 주행·주차 변경/차량 서비스 단절, OS suspend, API28 기기, 화면 회전/모든 분할 창, 내비 안내/통화/청취·출력 감쇠량, 실제 focus 거부·transient·duck, MediaBrowserService/MediaSession/차량컨트롤러, STT, release 제출 적합성. 화면 이탈 시 중단하므로 내비 전면 지속재생은 지원하지 않는다. 실제 위치 추천은 공식 clock 계약 미확인으로 계속 차단하며 ETA 갱신 문제와 분리한다.

사용자 후속 시연 방향은 출퇴근·장거리·동승·목적 이동·드라이브 5개다. 현재 APK는 공통 기본 듣기이며 이 5개 시나리오 입력/콘텐츠가 제작·통합되었다고 주장하지 않는다. 다음 기능으로 넘길 범위이며 기본 APK 완료와 분리한다.
