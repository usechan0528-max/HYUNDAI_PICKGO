# PICKGO 최신 통합본 에뮬레이터 검증

2026-11-06 KST. 승인: “2번 마무리 하고 통합본 검증 시작하자”. main / `25a30be009e906c5c3e0bb80c55f2c5ed2e74cd4` 위 기존 다인 미커밋 변경을 보존했다. 이 작업에서 앱 소스 변경은 없다. 별도 아이폰 Safari 검증은 원 채팅 담당이며 본 결과에 포함하지 않는다.

## 환경과 실행

- 기존 실행 채팅 종료·기기 작업 부재 및 파일 소유 반환을 확인했다. 처음 전면 앱은 현대 내비였고 PICKGO를 정상 foreground로 복귀했다. 강제 종료·데이터 초기화 없음.
- 기존 4194 서버 PID47132는 최종 다인 소스 변경 전 프로세스였다. 최신 소스를 반영하기 위해 해당 프로세스만 종료하고 PID56964로 재시작했다. 메모리 회차는 소실되며 이후 새 시험 회차를 사용했다. 다른 서버는 조작하지 않았다.
- emulator-5556 / Android user10 / NaviHelper3.0.5 / debug `0.1-local-demo`(versionCode1). 기존 설치 SHA256 `434a9fb0efb3aa57b91103706fe6e4f2246cce32eea641dcc0989c1c3b356d84` 확인 후 현재 소스·기존 debug 키로 재빌드/설치했다.
- 새 빌드와 기기에서 pull한 설치 APK SHA256 모두 `17835102f6cf7b564482d1aefd43a71ca8b8938b5385b7325903349cb8e75b4b`. 기존 키를 사용했으며 키 생성·변경 없음. 재빌드 파일 해시가 이전 파일과 달라 새 해시로 기록한다.
- `adb shell date`는 11-05 PST(UTC-8), 보고는 11-06 KST(UTC+9)로 17시간 차이다. 서버 시작 KST00:34:14, APK 생성 UTC15:35:24, 내비 캡처 UTC15:39:01로 재시작·빌드 이후 실행임을 확인했다. 기기 날짜를 수정하지 않았다.

## 판정과 증거

증거: `docs/evidence/pickgo-integration-2026-11-06/`. 실행 스크립트 원본은 `work/pickgo-integration/verify.mjs`; 증거 폴더 사본은 상대 import 경로 때문에 원위치에서 실행하는 용도가 아니다.

| 명령/시험 | 결과 |
|---|---|
| `node --test "experiments/pickup-board/*.test.mjs"` | 258/258, exit0 |
| README 환경 설정 후 Gradle `--offline --no-daemon assembleDebug lintDebug` | exit0, lint 0 errors / 3 warnings |
| README의 javac/java RouteGateTest, 출력 경로 `work/pickgo-integration/test-classes` | 43 assertions, exit0 |
| `node work/pickgo-integration/verify.mjs` | 최종 exit0, 실제 에뮬레이터+별도 headless Chrome |
| `git diff --check` | exit0, 기존 LF/CRLF 안내 |

다인: 메인 링크→`/multi`→수동 회차→1명 초대→독립 Chrome 참여·준비→에뮬레이터 다음 지점·도착→탑승자 탑승→전체 완료. 다인 화면 native 안내 버튼 비활성 확인. 3인/2지점·공동탑승·취소·오프라인 상세 회귀는 앞선 `PICKGO_MULTI_CLOSURE_2026-11-06.md` 증거이며 이번 에뮬레이터 1인 기본 동작과 구분한다.

단일: 메인에서 하나로마트 검색→검색 결과·주변 후보 선택→회차 생성→별도 Chrome의 초대 참여·준비. 서버 상태 joined=true / proposal=false / active, 확정 좌표 `[127.0351004,37.463915]`. 초기 지점 참여 동의이며 별도 장소 변경 제안/수락 실기까지 시험한 것은 아니다.

실제 UI XML에서 활성화된 native 안내 버튼의 현재 bounds를 읽어 1회 입력했다. 이후 현대 내비에는 입력하지 않았다. 로그 `REQUEST_ROUTE_SENT` 1회, `DESTINATION_MATCH=true`, `MODE=ROUTE_GUIDING`, `OBSERVATION_FINISHED` 확인. 목적지 일치는 RouteGate 허용오차(각 0.00002도) 기준이며 좌표 완전 동일성으로 확대하지 않는다. 50초 대기 후 복귀 및 반복 런처에서 “45초 관찰 종료 시점: 현대 내비 목적지 일치·안내 중” 유지, Activity1개 확인. `04-navigation.png`, `05-return-retained.png` 직접 시각 확인.

초기 attempt1~4는 실패 증거로 보존했다. 시험 도구가 Chrome 문자열 함수를 호출하지 않은 문제와 페이지 이벤트 등록 전 클릭 문제였다. 함수 호출·이벤트 준비 대기를 고친 최종 실행만 통과로 판정한다. 앱 수정은 없었다. 내비 화면의 도로 경로선·회전 지시·목적지명은 보이지만 배경 지도는 대부분 비어 있었다. 지도 타일 정상 표시나 모든 내비 UX를 검증했다는 뜻은 아니다.

## 미검증과 범위

실차, 차량 UX 제한, 물리폰/HTTPS, 실제 도로시간 추천, 현대 내비 다중경유, 공동 장소 재합의는 미완료 유지. SDK 연결 단절·권한 거부·프로세스 종료 복구·발신 후 회차 변경의 전체 실기 재시험은 이번 범위에서 미실행이며 과거 증거와 혼동하지 않는다. 릴리스 APK·서명/제출 검증이 아니다. lint 경고는 의존성 업데이트 안내, dataExtractionRules 안내, 앱 아이콘 미지정 3개다.

Dot R010 종료 상태를 확인했고 새 공식 API 질문이 없어 추가 조사는 하지 않았다. 공개·push·계정·권한·키 변경 없음. ai-memory 저장 성공을 주장하지 않으며 본 보고와 증거를 작업 기록으로 사용한다.

## 독립 검수

실제 Claude Haiku5.5 session `55c41480-2612-4c99-8db4-a9913c9b235e`, CLI exit0/is_error=false. P1 없음, P2 세 건 처리:

1. proposal 키 누락 차단: 미반영(근거 확인). `domain.mjs` read는 항상 proposal 키를 객체 또는 null로 반환한다. 실제 인증 응답에서도 hasProposal=true/proposal=null 확인(`contract.json`). 불완전 응답을 합의로 해석하지 않고 차단하는 기존 안전 동작을 유지했다.
2. 요청 횟수 범위: 보완. 탭 전 로그를 제외한 차분 외에 PID27004 전체 로그(`runtime-full.log`)에서도 USER_START/REQUEST_ROUTE_SENT 각1회. summary에 전체 집계와 관찰 범위를 추가했다. 버튼 입력 0회 주장은 시험 스크립트가 내비 화면에 입력하지 않았다는 뜻이며 OS 전체 입력 감시가 아니다.
3. 날짜·APK·서버 출처: 보완. PST/KST 대조와 서버/빌드/캡처 시각, 설치/빌드 동일 해시, 서버 소스 SHA256을 `environment.json`에 기록했다.

첫 review.py의 CLI 응답 JSON 저장은 성공했고, 그 뒤 콘솔 출력만 cp949 UnicodeEncodeError로 종료했다. UTF-8 `review.json`을 직접 읽어 위 결과를 확인했으므로 CLI 실패로 혼동하지 않는다.

후속 실제 Haiku5.5 session `3b7ff285-ec2d-4069-9748-1c0b21b1ccc9`, exit0/is_error=false. 세 처분 확인·명확한 수용 차단 없음 회신. 추가 UI/시험 파일 해시 누락 지적은 웹 mjs/html/css 및 Android java의 실행 후 SHA256 목록을 추가해 보완했다. 이는 실행 후 확인 목록이며 HEAD만으로 미커밋 트리나 실행 전 불변 스냅샷을 입증한다고 주장하지 않는다.

후속 답변 중 “hasProposal=true/proposal=null은 불완전 응답” 문장은 잘못된 설명이다. 키가 존재하고 null인 것은 정상적인 제안 없음 응답이며, **키 누락**만 차단한다. Codex가 실제 서버 응답과 Java 식을 대조해 바로잡았다. 시작 전 selected-state.json과 복귀 후 contract.json의 좌표/version3이 일치하고, native readTarget이 인증 응답을 재조회해 RouteGate로 확인한 뒤 요청한다. SDK 로그는 좌표·세션을 출력하지 않으므로 원시 요청 좌표 로그가 있다고 주장하지 않는다.

판정: 명시한 에뮬레이터 수용 실행 통과. 앱 소스 수정 없음, 독립 검수 지적 처리 완료. 에뮬레이터는 PICKGO 결과 화면, 4194 서버는 유지하며 파일·기기 소유를 반환했다. 다음 물리폰 검증은 원 채팅 담당이며 이 작업의 성공으로 대체하지 않는다.
