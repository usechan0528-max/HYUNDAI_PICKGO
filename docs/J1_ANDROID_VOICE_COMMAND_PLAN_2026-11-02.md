# J1 Android 최소 음성 명령 연결 준비

상태: 조사·연결 설계 초안 완료, 앱 구현·STT 실인식 미실행. 확인일 2026-11-02 KST. 사용자 병렬 작업 승인에 따른 한정 준비이며 Android 듣기 앱 통합은 별도 담당 채팅에서 진행한다.

## 범위와 현재 경계

- 담당 파일은 이 문서 하나. main의 다른 미커밋 파일, experiments/j1-listening, 웹 cockpit, 음원, SDK probe 및 공통 기록을 수정하지 않았다.
- 최소 사용자 흐름: 사용자가 음성 버튼을 눌러 한 번 인식 → ‘멈춰/계속/다음’ 중 하나의 최종 결과만 처리 → 마이크 종료. 상시 청취·호출어·Gleo 통합·서버 인식·자유 대화는 제외한다.
- 현재 한국어 WAV 생성/재생은 TTS 결과이며 STT 동작 증거가 아니다. 기존 시안은 음성 입력 중 일시정지, 취소 후 명시 재개를 가정한다(J1_COCKPIT_DESIGN_2026-11-02.md). 이 경계를 이어받는다.
- SDK 위치 시계/내비 ETA 차단은 이 기능과 별개이며 우회하지 않는다. 음성 제어도 기존 플랫폼 UX 제한을 통과해야 한다.

## 공식 자료와 실제 배포물 확인

확인일은 모두 2026-11-02. 아래는 문서/배포물 확인이지 서비스 실행 성공이 아니다.

| 항목 | 확인 결과 | 근거 |
|---|---|---|
| SDK | ai.pleos.playground:SpeechToText:3.3.1 | [의존성 안내](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/importing-sdk) |
| 모드 | Mode.ON_DEVICE 명시 선택. 생략 기본값 HYBRID는 이 범위에 부적절. ON_DEVICE만 사용하면 앱 등록 불필요라는 문서 설명 | [소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/intro) |
| 한국어 | setLocale(Locale.KOREA), ko-KR 지원 목록 확인. ON_DEVICE별 언어 모델/현재 AVD 탑재를 보장하는 별도 표는 확보하지 못함 | [언어 설정](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/set-locale) |
| 권한 | pleos.car.permission.STT_SERVICE 선언 필요. 권한 보호등급/현재 활성 사용자 허용은 미확인 | [권한](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/declaring-permissions) |
| 수명주기 | initialize 성공 후 사용, 동일 ResultListener 등록/제거, release 후 새 객체 필요 | [초기화·해제](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/initialization-and-release) |
| 입력 | request가 차량 마이크 사용 시작, stop으로 종료. 직접 AudioRecord/sendAudio 경로는 이번 제외 | [시작·중지](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/start-and-stop) |
| 결과 | onUpdated(String, boolean)의 completed=true만 최종 명령 후보. partial은 실행 금지 | [리스너](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/result-listeners) |
| 에뮬레이터 | Extended Controls > Microphone 입력 설정 절차 존재. 이번에는 설정/권한을 변경하지 않음 | [에뮬레이터 설정](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/configure-pleos-connect-emulator) |

배포 URL: https://nexus-playground.pleos.ai/repository/maven-releases/ai/pleos/playground/SpeechToText/3.3.1/SpeechToText-3.3.1.aar

Python urllib로 HTTP 200, 188560 bytes를 메모리로 읽고 ZIP/Java class descriptor를 검사했다. 디스크에 SDK나 코드를 추가하지 않았다. SHA256: `35109ad13400a7fa103cca9fabbf9b785e63a6a98b17a0698a1aef51458d37bf`. 동일 경로의 `SpeechToText-3.3.1-sources.jar`는 HTTP 404였다. 기존 work/experiments 및 사용자 Gradle 캐시 파일명 조회에서는 STT 배포물을 찾지 못했다. 이 검색 결과는 PC 전체 부재를 의미하지 않는다.

AAR manifest: minSdkVersion=23, SDK 버전=3.3.1, CAAS 최소 버전 metadata=4.1.29/code4001029. 앱 minSdk를 23으로 변경하라는 뜻이 아니다. CAAS 실제 설치 버전과 호환성은 다음 실행 게이트다. AAR에 android.permission.INTERNET이 포함되어 있어 ON_DEVICE 선택을 근거로 최종 APK가 인터넷 권한이 없다고 표현하면 안 된다. merged manifest와 실제 통신은 별도 점검한다. STT_SERVICE와 별도로 RECORD_AUDIO가 필요한지는 서비스 직접 마이크 경로의 실제 요구를 확인하며 임의로 권한을 추가하지 않는다.

classes.jar에서 public 선언 교차 확인:

- SpeechToText(Context, Mode)
- initialize(), initialize(OnInitializeListener), release()
- addListener(ResultListener), removeListener(ResultListener)
- setLocale(java.util.Locale), request(), stop()
- ResultListener: onReady(), onStartedRecognition(), onUpdated(String, boolean), onUpdatedEpdData(long,long), onUpdatedRms(double), onEndedRecognition(), onError(ErrorType)
- Mode: HYBRID, SERVER, ON_DEVICE

클래스 선언 확인은 compile/서비스 연결 검증을 대신하지 않는다. 공식 API-reference entry 본문은 상세 계약이 없고 메뉴 심볼만 보여 프로그래밍 가이드와 AAR를 함께 대조했다.

## 앱 연결 계약 제안

SDK 객체는 Android 어댑터가 소유하고, 재생기에는 SDK 객체/인식 원문을 전달하지 않는다. 사용자 의도 명령 PAUSE/RESUME/NEXT와 인식 세대·플레이어 세션 토큰만 전달한다. 모든 이벤트를 한 직렬 실행 경로에서 처리한다. 아래 명칭은 앱 내부 모델 제안이며 SDK 심볼이 아니다.

1. **진입:** 현재 화면/사용자/UX 제한·서비스 준비를 확인한다. 재생 중이면 콘텐츠 ID/position 및 playback session을 유지한 채 일시정지한다. 음성 진입에 의한 정지는 명시적 종료와 구별한다. 버튼 연타는 활성 인식 세션 하나로 제한한다.
2. **시작:** 새 recognition generation을 발급하고 콜백에 그 세대를 캡처한다. ON_DEVICE 객체 initialize 성공 → 리스너 등록 → Locale.KOREA 설정 → request. 준비 실패 시 녹음을 시작하지 않으며 터치 제어를 유지한다.
3. **최종 결과:** completed=true, 현재 세대 일치, 화면/소유자 유효, 종료 안 됨, 이번 세대에서 아직 명령을 소비하지 않은 경우만 파싱한다. 중간 결과·종료/취소 이후 결과는 버린다. 첫 최종 결과 후 해당 세대를 terminal 처리해 중복 NEXT를 막는다.
4. **마이크와 명령 순서:** 최종 명령을 pending으로 저장하고 stop을 요청한다. onEndedRecognition 또는 검증된 자원 해제 이후에만 RESUME/NEXT의 재생을 허용한다. stop 완료/콜백 계약은 실제 시험으로 확인하고 종료 timeout에서는 재생하지 않는다. onEndedRecognition과 final 콜백의 순서를 추정하지 말고, final 없이 끝난 세션은 명령 없이 종료한다.
5. **취소·오류:** 콘텐츠 ID/position/큐를 바꾸지 않고 인식만 종료한다. 재생 중 들어왔더라도 일시정지 상태를 유지하고 명시적 ‘계속’ 또는 터치 재개를 기다린다. 이는 실패 전 자동 재생상태 복원이 아닌, 기존 시안의 ‘취소 후 명시 재개’ 정책이다. 임의 서버 모드 fallback/자동 무한 재시도 금지.
6. **종료·이탈:** 사용자 종료 또는 화면 소유권 상실 시 인식 세대와 pending 명령을 먼저 무효화하고 stop → 동일 리스너 제거 → release를 시도한다. 예외가 있어도 오래된 결과를 재생기로 보내지 않는다. 재생기의 명시종료 토큰은 모든 음성/포커스 콜백보다 우선한다.
7. **오디오 협업:** 인식 진입과 내비/통화 손실을 별도 원인으로 관리한다. 인식 종료만으로 다른 손실 원인을 지우거나 오디오 포커스를 무시하지 않는다. RESUME/NEXT는 현재 플레이어의 공통 재생 허용 게이트를 통과해야 한다. 구체 포커스 정책은 병렬 오디오 문서와 통합 담당이 조율한다.

명령은 정규화한 전체 문장 exact allowlist만 허용한다. 최소안은 NFC 정규화·앞뒤 공백 제거 뒤 ‘멈춰’, ‘계속’, ‘다음’ 세 개이며 문장 부호/동의어 추가는 실제 엔진 출력 시험 후 결정한다. 부분 문자열 일치나 LLM 추론은 사용하지 않는다. ‘계속하지 마’, ‘다음 말고’, 복합 명령·빈 결과는 거부한다. 허용 문구를 화면에 짧게 보여준다.

| 명령 | 동작 |
|---|---|
| 멈춰 | PAUSE. 콘텐츠/position 보존, 반복은 무효과 |
| 계속 | 현재 유효 듣기 세션의 일시정지만 재개. 명시종료·소진·오류·차단 상태에서는 새 세션 시작 금지 |
| 다음 | 유효 세션에서 1회만 다음 항목으로 이동. 음성 진입 전 playing이면 마이크 종료+포커스 허용 후 재생; 사용자 pause 상태에서 진입했으면 다음 항목 준비 후 pause 유지. 다음 항목 없음은 소진, 자동 처음으로 순환 금지 |

다음 항목으로 이동하면서 저장 위치를 갱신하는 책임은 기존 플레이어 하나에 둔다. STT에서 별도 저장소를 만들지 않는다. 로그는 세대/명령 enum/오류 분류/시간만 허용하고 발화 원문·오디오·개인정보를 저장하지 않는다.

## 오류와 실행 게이트

[공식 오류 목록](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/error-code)의 PERMISSION_DENIED, NOT_SUPPORTED_API, UNAVAILABLE_LANGUAGE, ON_DEVICE_ENGINE_ERROR, MIC_ERROR는 명령 미실행·마이크 정리·터치 대안으로 처리한다. TIMEOUT/UNKNOWN/새 enum도 기본 분기에서 terminal 처리한다. INVALID_REQUEST_ERROR는 중복/순서 버그 점검 대상이다. ON_DEVICE에서 NETWORK_ERROR/UNAUTHENTICATED가 발생해도 인증을 만들거나 SERVER로 바꾸지 않고 실제 모드·서비스 환경을 확인한다.

다음 통합 전 확인: (1) 앱 의존성 해석/Java 또는 Kotlin 전체 컴파일 (2) merged manifest와 활성 사용자 STT 권한 (3) CAAS 실제 버전 및 초기화 (4) ON_DEVICE+ko-KR 실제 최종 결과 (5) stop/최종/ended 순서와 지연 콜백 (6) 네트워크 없는 동일 시험 (7) 마이크·오디오 포커스 충돌. 권한 변경은 사용자 별도 승인 경계다. 지원 불가 시 음성 버튼은 설명과 함께 비활성, 터치 듣기는 유지한다.

## 수용 시험 계약 — 전부 아직 미실행

| 구분 | 입력/상황 | 기대 결과 |
|---|---|---|
| 순수 파싱 | 세 명령/빈 문자열/부정문/복합문 | 세 exact 명령만 enum, 나머지 무명령 |
| 이벤트 | partial ‘다음’ 후 final ‘다음’ 두 번 | NEXT 최대 1회, partial 실행 0회 |
| 세대 | 취소 후 늦은 final, 새 인식 중 이전 결과 | 실행 0회, 새 세션 오염 없음 |
| 명시종료 | pending RESUME/NEXT 뒤 터치 종료 | 후속 final/ended/focus gain에도 재생 0회 |
| 실패 | 무음/언어미지원/마이크/권한/엔진 오류 | 콘텐츠·큐·위치 보존, 일시정지 유지, 재시도 자동 반복 없음 |
| 오디오 | 인식 중 내비/통화 포커스 손실 | 인식 종료만으로 재생 재개하지 않음 |
| NEXT | paused/playing/큐 마지막 각각 | 위 명령표 정책, 중복 건너뛰기·순환 없음 |
| 수명주기 | 반복 진입/배경 전환/프로세스 종료 | 마이크 정리, 이탈 후 명령 없음, 재시작 자동청취 없음 |
| 실제 STT | 승인된 마이크로 세 문구 각 3회 | 최종 결과→명령→관찰 상태 기록, 성공/전체 및 실패 원인 별도 보고 |
| 오프라인 | ON_DEVICE, 네트워크 단절 | 실제 인식 여부 측정; 실패를 offline 지원 성공으로 표시 금지 |
| 개인정보 | 로그/저장소/merged manifest 검사 | 원문·오디오 저장 없음, 권한·네트워크 주장과 실제 일치 |

모의 콜백 시험과 실제 STT 시험 결과는 분리한다. 3회 시험은 기능 확인용이며 한국어 정확도나 차량 소음 내성의 통계적 인증이 아니다. 실차·주간 소음·음성 자연스러움·Gleo 호출은 미검증이다.

## 작업 증거와 검수

- git status --short --branch: main, 기존 다수 미커밋 확인. 기존 파일 변경 없음.
- rg 파일/문서 조회: 기존 STT 구현 근거 없음, 한국어 TTS/음성 시안 기록과 구별.
- urllib/zipfile 메모리 조회: AAR HTTP200 및 공개 클래스 descriptor 확인, source artifact HTTP404. SDK 설치·Gradle 변경·기기 제어 없음.
- 이번 범위 빌드/단위/STT 실행/마이크·권한 변경: 미실행. 앱 동작 검증 실패로 기록하는 것이 아니라 준비 범위의 미실행이다.
- Claude 설계 검토: 아래 후속 기록 참조. Dot 기존 보고 대장 확인, 이번 STT 조사와 동일한 활성 과제 없음. 새 Dot 대화 하달은 하지 않았다.

### Opus 설계 검토 결과와 반영

고정 문서 SHA256 `c27aec6874cd4a5a6febc5b738eef3d8ea992fe38461b86cf8be14ef6c864c66`을 stdin으로 전달, 도구 없음·plan·safe-mode·strict empty MCP로 읽기 검토했다. CLI 종료 0, is_error=false, 실제 modelUsage=claude-opus-5-5, session `6b78fc69-0318-465b-8ff4-25663acaa4eb`, duration 12512ms. 결과의 한글 콘솔 표시는 일부 인코딩 손상이 있어 원문 그대로의 인용으로 삼지 않는다. 확인 가능한 기술 지적을 아래 계약으로 보완했고 재검수는 하지 않았다. 앱 구현 독립 검수/실행 검증을 대체하지 않는다.

1. **초기화와 이탈 경합(높음): 반영.** initialize 성공/실패 콜백도 recognition generation, SDK 객체 identity, 소유자 생존·종료 토큰을 공통 직렬 실행 경로 안에서 검사한다. 오래된 onSuccess는 addListener/request를 실행하지 않는다. 정리는 콜백이 캡처한 옛 SDK 객체만 대상으로 하며 새 세션 객체를 release하지 않는다.
2. **종료 완료 전 재진입(높음): 반영.** STOPPING/RELEASING도 활성 인식으로 취급해 음성 버튼 재진입을 막는다. stop timeout이면 pending 명령을 취소하고 기존 객체를 폐기 대상으로 전환한다. 종료/해제가 확인되지 않은 상태에서는 새 request를 시작하지 않고 터치 대안을 유지한다. 새 SDK 객체 생성만으로 마이크 정리가 완료됐다고 판단하지 않는다.
3. **콜백 직렬화와 final 뒤 오류(중간): 반영.** SDK 콜백 스레드를 추정하지 않는다. 모든 initialize/result/error/ended 콜백은 공통 Looper에 post한 뒤 세대/상태를 재검사한다. pending 상태에서 error가 오면 명령을 취소한다. 이미 재생 명령을 전달한 뒤 늦은 오류가 도착하면 같은 세션 재생을 정지시키고 오류를 표시하되 이전 NEXT를 중복 재실행/되돌림하지 않는다. 이벤트 도착 순서를 제어한 모의 시험에 final→error→ended, cancel→initSuccess, stop→새 시작 요청을 추가한다.

이 문서는 연결 설계이며 위 시험들은 미실행이다. 구현 담당은 SDK의 실제 순서/해제 동작을 검증한 뒤 통합 판정해야 한다.
