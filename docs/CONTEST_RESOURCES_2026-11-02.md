# 공모전 자원 조사 — 2026-11-02 KST

사용자 요청: 공식 공모전 사이트를 둘러보고 프로젝트에 필요한 자원 확보. 현재 J1 운행 맥락 기반 콘텐츠 추천과 자동 이어듣기를 기준으로 우선순위를 정했다. 공식 문서 확인과 파일 확보이며 앱 연동 성공 기록이 아니다.

## 확보한 파일

로컬 경로: `work/contest-resources-2026-11-02/`. 원본 URL·HTTP 상태·바이트·SHA256은 같은 폴더의 `manifest.json`에 있다. 공개 Maven에서 인증정보 없이 6건 모두 HTTP 200으로 다운로드했다. 저장소 공개·push는 하지 않았다.

| 파일 | 용도 |
|---|---|
| FusedLocation-1.1.3.aar / .pom | 차량 위치 입력과 의존성 확인 |
| NaviHelper-3.0.5.aar / .pom | 내비 정보 입력과 의존성 확인 |
| navi-data-3.0.4.aar / .pom | 내비 데이터 타입 확인 |

전체 오프라인 빌드 키트는 아니다. POM에 AndroidX·Kotlin·coroutines 및 별도 AIDL/data 런타임 의존성이 있다. 실제 빌드에서는 공식 Maven 저장소와 Gradle의 의존성 해석을 사용한다. 이전 macOS `/private/tmp` 확보 기록은 현재 Windows 파일 존재 증거가 아니므로 이번에 다시 확보했다.

## 참가·제출 자원

| 자원 | 공식 경로 | 사용할 때 |
|---|---|---|
| 접수양식·개인정보 동의서 DOCX | https://appdevchallenge.auto-hmg.io/downloads/contest-application-consent.docx | 지정 기획서 작성. 링크 확인만 완료; 웹 도구의 DOCX 형식 미지원으로 파일 미확보 |
| 제출 안내 | https://appdevchallenge.auto-hmg.io/guide/submission | 이메일 제목·첨부·수정 제출·README/APK 규칙 |
| FAQ | https://appdevchallenge.auto-hmg.io/faq | 선택 개발 산출물과 PT 전 실제 앱 요건 |
| 공지 목록 | https://appdevchallenge.auto-hmg.io/notice | 일정·심사 계정 등 변경 확인 |
| 설명회 공지 | https://appdevchallenge.auto-hmg.io/notice/c0a1a000-2026-4923-8000-000000000005 | 10월 28일 14시 안내. 확인한 본문에는 다시보기 예정만 있고 실제 영상 링크 없음 |
| 개발 환경 안내 | https://appdevchallenge.auto-hmg.io/guide/development | 공식 개발 문서 연결 |
| 사이트 이용약관 | https://appdevchallenge.auto-hmg.io/terms | 제9조의 자동 접근·수집 금지 확인 후 공모전 사이트 추가 자동 수집 중단 |

1차는 기획서 필수, 시연·소스/APK 등은 선택이다. 소스와 APK는 함께 저장소에 제공하는 안내이며, 2차 PT 전 실제 앱 완성이 필요하다. 접수 종료일은 11월 15일, 1차 결과 11월 23일, PT 12월 3~4일, 최종 선정 12월 18일, 전시·순위 발표는 2027년 2월 안내다. [공식 홈](https://appdevchallenge.auto-hmg.io/), [FAQ](https://appdevchallenge.auto-hmg.io/faq).

현재 제출 페이지에는 이메일 접수 안내와 저장소·APK 경로를 ‘제출 페이지’에 입력하라는 문구가 함께 있다. 경로 전달 방식은 미해결로 유지한다. 이번에 읽은 공지/FAQ에서는 심사용 GitHub 계정의 구체 ID를 확보하지 못했다. 계정이 없다고 단정하지 않는다.

## J1 개발에 바로 필요한 공식 자료

| 우선순위 | 자원 | 프로젝트에서 확인할 것 |
|---|---|---|
| 1 | [FusedLocation 소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/intro) · [Maven 설정](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/project-setup) | v1.1.3, 지원 여부·권한·콜백·해제. 마지막 위치 조회가 새 관측을 보장하지 않음 |
| 1 | [NaviHelper 소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/intro) · [Maven 설정](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/importing-sdk) | v3.0.5. 실제 이벤트는 내비 앱 상태·구현에 의존. 경로 예측을 제공한다는 뜻이 아님 |
| 1 | [Music/Audio 개발 가이드](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/music-audio-app-developement-guide) | 백그라운드 재생·차량 미디어 컨트롤·콘텐츠별 분류와 브라우징. App Market 심사 기준이며 공모전 1차 필수 제출조건과 구별 |
| 1 | [오디오 포커스](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/audio-focus-development-guide/audio-focus-development) | 재생 전 포커스 요청, 상실 시 정지/일시정지/duck, 통화·Gleo·내비와 공존 검증 |
| 1 | [Suspend/Resume](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/audio-focus-development-guide/suspend-mode-audio-focus) | 절전 진입 시 중단·포커스 반납·재생 위치 저장. 복귀 시 재평가·재요청. 자동재생은 OEM/사용자 정책에 따름 |
| 1 | [주행 규제](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide) | 기존 프로젝트 출처. 실제 플랫폼 제한 연동에 필요; 이번 본문 재검증은 미실행 |
| 2 | [TTS 소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/TextToSpeech/intro) | v3.3.1. ON_DEVICE는 서버 등록 불필요라는 문서 설명; 기본 HYBRID 및 SERVER는 등록 필요. 실제 음성·권한·가용성은 별도 검증 |
| 2 | [SDK Overview](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/) | 5종 SDK 구성. Vehicle은 도메인 capability와 승인된 권한 범위 확인 |
| 2 | [Vehicle Sample App 가이드](https://document.pleos.ai/docs/pleos-only/tutorial/vehicle-sdk-sample-app) | 지원 확인→조회→콜백 구독/해제 학습. 초기화 표시만으로 서비스 연결 성공을 판정하지 않음 |
| 2 | [프로젝트 생성·SDK 신청](https://document.pleos.ai/docs/pleos-only/create-my-project) | 계정/프로젝트/권한 신청 절차와 현재 제공 상태 확인 |

공모전 개발 환경 페이지의 이전 Vehicle 튜토리얼 URL(`/tutorial/vehicle-sdk`)은 이번 웹 추출에서 본문이 없었다. SDK Overview가 연결하는 위 Sample App 가이드에서는 실제 본문을 확인했다.

## Windows 개발 환경 자원

- [에뮬레이터 설치 가이드](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator): 문서 기준 Emulator 2.1.0, API 34 이미지, Cold boot, AVD RAM 4 GB. 최소 Android API 28·Gradle 8.0이며 프로젝트 AGP/JDK/targetSdk를 확정한 것은 아니다.
- Windows/Linux SDK Update Site: `https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-sys-img.xml`.
- Maven 저장소: `https://nexus-playground.pleos.ai/repository/maven-releases/`.
- [Virtual Console](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/use-vehicle-emulator): Emulator 2.1.0 이상, `adb forward tcp:8088 tcp:8088` 후 `http://127.0.0.1:8088/`. 차량 상태·이벤트 시나리오를 시험할 도구다. 이번에는 설치/명령 실행하지 않았다.

## 확인해야 할 핵심 차이

SDK 신청 문서는 FusedLocation/TTS/STT/Vehicle Control을 준비 중으로, Vehicle State/NaviHelper를 신청 없이 사용 가능으로 설명한다. 반면 FusedLocation 배포 파일과 사용 문서는 공개되어 있다. 이는 문서 간 제공 상태 차이이며, 다운로드 가능하다는 사실을 실제 사용 승인이나 서비스 가용성으로 해석하지 않는다. 로그인된 프로젝트 상태·주최 측 확인·에뮬레이터 실행으로 구분해야 한다. [신청 안내](https://document.pleos.ai/docs/pleos-only/create-my-project).

콘텐츠 추천용 음악·뉴스·팟캐스트 라이선스, 외부 콘텐츠 공급 계약, 실제 운행 이력 데이터는 이번에 확인한 사이트에서 확보하지 못했다. SDK는 콘텐츠 사용권이나 목적지 없는 경로 예측 알고리즘을 대신 제공하지 않는다. 이는 조사 범위의 한계이지 모든 서비스의 부재 판정이 아니다.

## 실행·검수 범위

- 브랜치 main. 기존 `demo/app.mjs`, `playback.test.mjs`, `work/` 변경 보존. 이번 담당은 이 문서, 자원 폴더 및 작업 기록뿐이다.
- 실행: 공식 페이지별 웹 열람, PowerShell `Invoke-WebRequest` 6건, `Get-FileHash` SHA256 기록. 앱 소스 변경·빌드·에뮬레이터·실차·제출·계정 변경 미실행.
- Claude: 현재 Windows PATH 및 사용자 `.local/bin`, npm 기본 위치에서 CLI를 찾지 못해 이번 자원 조사 독립 검수 미실행. 과거 다른 환경의 Claude 성공 기록을 현재 검수 성공으로 재사용하지 않는다.
- 다음 작업 제안: 실제 Android 환경에서 위치/내비 서비스 지원 여부와 미디어 포커스 흐름을 검증. 새 계정 생성이나 SDK 권한 신청은 별도 사용자 결정 사항이다.
