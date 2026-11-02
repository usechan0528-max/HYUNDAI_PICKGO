# J1 Android 내비 안내·오디오 공존 구현 준비

확인일: 2026-11-02 KST. 상태: 공식 문서 확인 및 연결 설계 제안. 앱 코드 수정·Android 빌드·오디오 실행 시험은 이번 작업에서 미실행. 사용자 병렬 작업 승인에 따른 준비 문서이며 내비 공존 구현 완료 기록이 아니다.

## 범위와 현재 기반

이 작업의 소유 파일은 이 문서 하나다. Android 듣기 담당 채팅 `01a19c09-6708-77c3-8162-bf2b05a3ed36`의 `experiments/j1-listening/` 및 공유 기록은 읽기 전용으로 확인했다. main에 기존 다수 미커밋 변경이 있으며 보존했다. 구현 중인 파일은 이후 바뀔 수 있으므로 통합 전 재대조한다.

읽기 시점의 `app/build.gradle`은 minSdk 28, compile/targetSdk 34다. `ListeningActivity`는 MediaPlayer, MEDIA/SPEECH 속성, AudioFocusRequest, CAN_DUCK 시 0.2 배율, transient 정지, 명시적 종료 후 오래된 콜백 차단을 사용한다. `onStop`은 재생 중단·저장·자원 해제를 수행한다. 따라서 현재 범위는 전면 화면에서의 로컬 듣기이며, 내비 화면을 전면으로 바꾼 채 콘텐츠를 계속 듣는 기능은 아직 별도다. 이 소스 확인은 동작 인증이 아니다.

기존 DOT-R002 조사와 API_EVIDENCE를 재사용하고 아래 공식 원문을 직접 재확인했다. Dot 추가 중복 하달 없음. ai-memory 검색 결과는 이전 개념 검토 맥락이며 현재 구현 증거로 사용하지 않았다. SDK 위치 시계 계약, ETA 갱신, 실제 좌표 추천 차단은 이 기능과 독립적으로 유지한다.

## 공식 근거와 해석 경계

| 근거 | 확인 내용 | 이번 설계에 적용할 경계 |
|---|---|---|
| [Pleos Audio Focus](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/audio-focus-development-guide/audio-focus-development) | 재생 전 속성과 focus 요청, loss/gain 처리, CAN_DUCK 감쇠 및 복원. 동시재생 조건과 정책 존재 | J1을 NAVIGATION으로 위장하지 않는다. 앱이 다른 앱의 포커스 정책을 계산하거나 시스템 믹서를 직접 제어하지 않는다. |
| [Pleos Music/Audio](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/music-audio-app-developement-guide) | 차량 배포 오디오 앱은 MBS와 MediaSession, 백그라운드 재생 및 차량 제어 연결을 요구. appCategory audio, 분류별 탐색 구조 안내 | 현재 전면 시연 APK의 수용과 App Market 배포 적합성을 구별한다. CAN_DUCK를 pause하는 예제와 위 본문의 차이는 공식 우선순위 미확인으로 유지한다. |
| [Pleos Suspend](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/audio-focus-development-guide/suspend-mode-audio-focus) | 진입 시 출력 중단·focus 반납·상태 보관·자원 해제, 복귀 시 재평가. OEM/user 정책 조건 | Activity onStop을 실제 차량 suspend 수신으로 간주하지 않는다. 공식 진입 이벤트·권한 확인 전 suspend 지원 완료라고 하지 않는다. |
| [Android audio focus](https://developer.android.com/media/optimize/audio-focus) | SPEECH는 일반 자동 ducking 조건에서 제외. 재생 직전 GRANTED 확인. ExoPlayer 자동 관리 사용 시 별도 수동 focus 중복 금지 | 시스템 자동 감쇠를 가정하지 않고 이벤트·실제 출력 관찰. target 35 이상으로 올릴 경우 전면 앱/foreground service 요청 제한도 다시 확인한다. |
| [AAOS audio focus](https://source.android.com/docs/automotive/audio/audio-focus) | concurrent에서 기존 보유자 focus가 그대로일 수 있음. duck 이벤트 수신 설정 또는 pause 설정이 concurrent 성립에 영향 | GAIN/LOSS 콜백만으로 내비 안내 시작·끝을 추정하지 않는다. OEM 오디오 경로/볼륨 정책의 실행 결과를 따로 측정한다. |
| [AudioFocusRequest.Builder](https://developer.android.com/reference/android/media/AudioFocusRequest.Builder) | 공개 요청 설정 및 listener API | API 26 이후 공개 API 사용. AOSP 샘플의 비공개·시스템 전용 심볼을 일반 APK에 그대로 옮기지 않는다. |
| [MediaSessionService](https://developer.android.com/media/media3/session/background-playback) | 서비스가 player/session 소유, foreground mediaPlayback 선언 및 관련 권한 | Media3 선택 시 라이브러리 버전·compileSdk 요구를 별도로 검증한다. 현재 API34 프로젝트에 최신 버전을 자동 적용하지 않는다. |
| [MediaLibraryService](https://developer.android.com/media/media3/session/serve-content) | 콘텐츠 트리, MediaLibrarySession, 플랫폼 MediaBrowserService 호환 intent action | MediaSession만으로 MBS 탐색이 구현되지 않는다. Media3 호환 선언만으로 Pleos 차량 미디어 브라우저 수신 성공을 보장하지 않는다. |

J1의 짧은 낭독 콘텐츠는 `USAGE_MEDIA`/`CONTENT_TYPE_SPEECH`가 적절한 후보다. duck 도중 이야기 일부를 놓칠 수 있으나, 이를 피하려고 문서 차이를 무시한 채 무조건 pause 정책으로 바꾸지 않는다. 0.2 배율은 현재 코드의 실험값이며 공식 감쇠값·청취 적합성 기준이 아니다. Pleos 실제 서비스에서 이벤트와 음량을 관찰한 후 기본 정책을 확정한다.

## 연결 설계 제안

첫 통합은 기존 MediaPlayer와 수동 AudioFocusRequest 경로를 유지해 변경 범위를 줄이는 방안이 우선 후보다. 서비스가 재생·체크포인트·포커스를 단독 소유하고 Activity는 명령과 표시를 담당한다. 플랫폼 MediaBrowserService + MediaSession과 Media3 MediaLibraryService 중 선택은 담당 채팅이 의존성·차량 호환 시험을 보고 확정한다. Media3로 옮기면 자동 포커스와 기존 수동 포커스를 동시에 활성화하지 않는다.

백그라운드 재생에는 manifest의 `FOREGROUND_SERVICE`, API34의 `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, service `foregroundServiceType="mediaPlayback"` 및 알림/세션 구현을 검토한다. 선언 변경과 기기 권한 변경을 구별하고 프로젝트의 별도 승인 경계를 따른다. 서비스 공개 인터페이스는 임의 URI/파일 재생을 허용하지 않고, 연결 클라이언트와 허용 명령을 검증한다. 인증·권한 검사 때문에 정상 차량 미디어 컨트롤을 차단하지 않는지도 시험한다.

재생 의도, 포커스, 실제 player 준비 상태, 수명주기/사용자 세대 번호를 분리한다. `GAIN` 자체는 사용자 재생 명령이 아니다. 자동 다음 곡도 같은 재생 의도와 focus 상태 아래 실행한다. 한 항목 완료가 transient 손실과 겹치거나 duck 중 다음 항목이 로드되어도 새 항목을 정상 음량으로 먼저 재생하지 않는다.

| 입력 | 출력·상태 처리 제안 | 복귀 조건 |
|---|---|---|
| 사용자 시작/재개 | 필요한 자원 준비, 동일한 속성으로 focus 요청 | GRANTED이며 현재 사용자 의도/세대/서비스 조건 유효할 때만 출력 |
| focus 요청 실패 | 무음, 로딩 종료, 짧은 재시도 안내 | 명시적 사용자 재시도. 초기에는 delayed gain 비활성 |
| LOSS_TRANSIENT_CAN_DUCK | 수신된 경우 앱 감쇠 상태 적용. 준비 중에도 상태 보존 | 실제 GAIN 수신 시 앱 감쇠 해제. 플랫폼에서 자체 감쇠했다면 중복 적용 여부 확인 |
| LOSS_TRANSIENT | 위치 저장, 재생 일시정지. 자동 재개 의도는 상실 직전의 유효 재생에만 보존 | 같은 요청·세대의 GAIN + 의도 유지 + 서비스 활성 |
| transient 중 사용자 pause/stop | 자동 재개 의도와 대기 요청 취소, stop이면 기존 명시 종료 계약 적용 | 늦은 GAIN으로 재생하지 않음 |
| LOSS | 즉시 출력 중단·focus 반납·자동 재개 의도 해제 | 이후 사용자/검증된 media controller의 새 play 명령으로 재요청 |
| 항목 자연종료 | 다음 항목 준비. 마지막이면 반납/정지 | 의도와 focus 유지 시만 다음 출력; duck 상태 계승 |
| 출력 장치 변경 | 보수적으로 일시정지, 재생 의도 취소 | 새 명시적 재개 |
| UI 화면 이탈/재진입 | 서비스 통합 이후에는 UI 구독만 해제/재연결 | 플레이어 중복 생성·임의 재시작 금지 |
| 서비스 종료·프로세스 재생성 | 위치·음원 revision 저장, 자원 해제; 시작 의도는 저장 복원하지 않음 | 위치 복원과 출력 재개 분리 |
| 실제 suspend | 출력 중단 후 반납, 상태 저장, 자원 해제; 새 요청 금지 | 확인된 정책/명령과 새 focus 획득 필요. 현재 이벤트 연동은 미확인 |

## 구현 담당과 먼저 맞출 사항

1. 전면 듣기 이정표를 먼저 고정한 뒤 서비스 이동을 별도 변경 묶음으로 진행한다. 동일 ListeningActivity 동시 수정 금지.
2. 앱의 명시적 ‘듣기 종료’는 체크포인트 삭제, pause는 저장이라는 현재 계약을 보존한다. 외부 MediaSession STOP의 발생 이유는 별도 확인 전 사용자 삭제 의도로 간주하지 않고 재생만 중단·위치 보존하는 제안이다. 단순 focus LOSS 역시 명시적 종료와 구별한다. 향후 음성 ‘종료’도 사용자가 의도한 명령의 의미를 정한 뒤 연결한다.
3. 서비스/미디어 탐색 구현 방식과 라이브러리 버전을 고정한다. 임시 콘텐츠 분류를 제품 분류 확정으로 표현하지 않는다.
4. 실제 내비 안내음을 낼 수 있는 공식 재현 방법을 확인한다. 현재 내비 모의주행 차단 때문에 안내음 시점 재현이 불가능하면 제어된 다른 앱 focus 경쟁 시험까지만 실행하고 내비 검증은 차단으로 남긴다.

## 수용 시험 계획 — 전부 미실행

시험용 focus 경쟁자는 별도 debug 앱/패키지로 분리하고 합성 음성만 사용한다. 앱 내부에서 콜백을 직접 호출하는 상태 시험과 플랫폼이 실제 전달한 이벤트 시험을 별도로 기록한다. 포커스 경쟁자 실행 시에도 사용자 허용 범위와 기기 설정 경계를 지킨다.

| ID | 재현 입력 | 합격 관찰 |
|---|---|---|
| AF-01 | J1 시작 → 실제 플랫폼 focus 거부 | 출력/재생 시각 증가 없음, 무한 로딩 없음 |
| AF-02 | 재생 중 NAVIGATION 속성 MAY_DUCK 경쟁 요청·반납 | 실제 수신 이벤트, 앱 볼륨 및 audible 출력/복원을 함께 기록. callback 부재를 실패로 단정하지 않음 |
| AF-03 | transient 손실 → 반납 | 위치 유지, 자격 있는 GAIN에서 한 번 재개 |
| AF-04 | transient 도중 사용자 pause 또는 stop → 반납 | 둘 다 자동 출력 없음, pause 위치 보존/stop 삭제 |
| AF-05 | 영구 손실 → 늦은 GAIN | 자동 재생 없음, 새 play만 재요청 |
| AF-06 | prepare/seek 중 손실·stop, 오래된 callback | 출력 없음, 폐기 player 접근/크래시 없음 |
| AF-07 | duck/transient 상태에서 항목 완료 경합 | 정상 음량 짧은 누출·다음 항목 중복·무단 재개 없음 |
| AF-08 | 내비 전면 전환·J1 재진입 | 서비스 재생/정책 유지, UI 복귀가 추가 player를 만들지 않음 |
| AF-09 | 서비스 종료/프로세스 재생성·음원 revision 변경 | 복원 위치 유효성 확인, 자발적 재생 없음 |
| AF-10 | 실제 Pleos 미디어 브라우저·컨트롤 | 탐색/상태/명령 일치. 일반 controller 시험만으로 차량 연동 통과 아님 |
| AF-11 | 실제 suspend 및 복귀 | 출력·focus 정리와 무단 자동재개 없음. 이벤트 접근 불가 시 미실행 |
| AF-12 | 실제 내비 안내 전후 | 안내 식별 가능성·콘텐츠 감쇠/정지·복귀를 청취와 시간표로 확인. 합성 경쟁 앱 시험과 구분 |

로그에는 request/result/change, generation, userIntent, playerState, offset, 앱 gain 값만 포함하고 실제 위치·사용자 발화·토큰은 제외한다. 앱의 setVolume 값은 최종 차량 출력 음량 증거가 아니다. 화면 녹화에 오디오가 없으면 실제 청취 또는 적절한 오디오 측정 증거를 별도로 남긴다. 실제 기기/서비스 버전·오디오 장치·시험 순서·결과를 기록한다.

## 검수와 인계

Claude Opus 5.5 고정 문서 설계 검토: exit 0, is_error=false, 실제 modelUsage `claude-opus-5-5`, session `08f06863-b5bd-42df-a8db-95fbf0fd9dbf`. 도구 없는 읽기 검토이며 현재 소스·실행 결과·공식 페이지 독립 검증은 포함하지 않았다. 다음 지적을 근거 대조 또는 설계 보완했다.

- 현재 target34에도 FGS 백그라운드 시작 제한이 적용된다는 지적: [Android 공식 제한](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)의 target31 이상 규칙을 직접 확인. target35 focus 요청 조건과 별개다. UI에서 시작한 서비스의 유지와 백그라운드에서 새 서비스 시작을 구분하고, 미디어 컨트롤러 명령이라고 자동 예외를 가정하지 않는다. `ForegroundServiceStartNotAllowedException`의 무크래시 처리를 AF-08/10에 추가한다.
- 준비/seek 중 transient의 재개 조건 모호성: 시작 요청이 유효하고 아직 취소되지 않았다면 pending play 의도를 보존한다. 같은 세대 GAIN과 prepare/seek 완료가 모두 있어야 출력한다. AF-06에 두 이벤트 순서와 그 사이 stop을 각각 시험한다.
- 재생 복원 UI가 새 프로세스에서 play를 요청하는 경우: 단순 상태 복원은 무음, 확인된 사용자/컨트롤러 play 요청은 정책·시작 제한·focus를 재평가한다. Media3 선택 시 `onPlaybackResumption` 경로를 AF-09에 포함한다.
- 외부 STOP을 모두 체크포인트 삭제로 매핑하는 위험: 위 통합 계약을 수정했다. 차량에서 실제 STOP이 언제 오는지는 아직 미검증이다.
- duck 후 transient의 복합 상태: AF-07에 연쇄 입력을 추가한다. GAIN 시 해당 focus의 감쇠 상태와 transient 중단을 함께 해소하고, 정상 음량 선행 출력이나 0.2 배율 잔류를 검사한다.
- AAOS duck 콜백은 오지 않을 수 있음: 기존 AF-02의 경계를 유지한다. 일반 Android 자동 ducking 제외를 AAOS HAL 감쇠 부재로 확대하지 않는다. 출력 장치 변경 시 pause는 제품의 보수적 제안이며 Pleos 공식 강제 정책이 아니다.
- 차량 controller 신뢰 경계 미정: 실제 package/signature/연결 정책은 미확인이다. 임의 하드코딩으로 정상 차량 UI를 차단하지 않는다. 탐색 화면의 주행 UX 제한도 별도 확인하며 현재 전면 듣기 UI의 제한 구현을 서비스 연동 적합성으로 확대하지 않는다.

초기 문서 후속 수정은 Codex 자체 대조이며 Claude 재검수는 미실행. 도구 호출은 기존 Claude 바이너리를 도구 비활성/plan 모드로 사용했고 환경 설치·설정 변경은 없었다. 한 차례 문서 패치의 문맥 불일치가 발생했으나 파일 변경 없이 실패했으며 올바른 문맥으로 재적용했다.

이 문서는 코드 통합 또는 실차 적합성 승인이 아니다. 최종 고정 코드·위 시험의 실제 결과·미해결 문서 차이를 묶어 Haiku 5.5 독립 검수 후 통합해야 한다. 파일 소유/공통 API·작업·시험 기록은 메인 통합 담당자가 반영한다.
