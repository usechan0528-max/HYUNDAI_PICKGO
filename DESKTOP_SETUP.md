# 다른 컴퓨터에서 이어서 작업하기

저장소: https://github.com/usechan0528-max/HYUNDAI_AI (비공개)

## 처음 가져오기

Git과 Node.js 22 이상을 설치하고, 저장소 소유 GitHub 계정으로 인증한다. GitHub Desktop을 사용하는 경우 이 저장소를 Clone한 뒤 아래 명령은 복제한 폴더에서 실행한다. 비밀번호나 토큰을 저장소 파일에 넣지 않는다.

```sh
git clone https://github.com/usechan0528-max/HYUNDAI_AI.git
cd HYUNDAI_AI
node --version
node experiments/journey-context/demo/server.mjs
```

브라우저에서 http://127.0.0.1:4177 을 연다. 종료는 터미널에서 Ctrl+C. 외부 패키지 설치는 필요 없다. 소스와 WAV 시연 음원이 저장소에 포함되어 있으며 macOS의 음성 생성 도구는 재생에 필요 없다. 다른 OS에서의 실제 실행은 아직 검증하지 않았다.

## 테스트

프로젝트 루트에서 아래 명령을 각각 실행한다. 따옴표는 Node에 glob을 전달하여 셸별 확장 차이를 줄인다.

```sh
node --test "experiments/journey-context/*.test.mjs"
node --test "mvp/*.test.js"
```

이전 주차 시연은 `node mvp/server.mjs` 실행 후 http://127.0.0.1:4173 에서 확인한다. 주력은 J1 운행 맥락 기반 콘텐츠·정보 추천이며, 주차 MVP는 보존 자료다.

## 다음 에이전트에게 전달할 맥락

- `AGENTS.md`, `DEVELOPMENT_GUIDE.md` 전체를 읽고 현재 git 상태부터 확인한다.
- `docs/DECISIONS.md`의 D-014(J1 주력), D-015(조작 없이 바로 듣기)를 유지한다.
- `docs/JOURNEY_CONTEXT_PROPOSAL_2026-11-02.md`, `docs/J1_DELIVERY_GAPS_2026-11-02.md`, `docs/WORK_LOG.md`, `docs/TEST_EVIDENCE.md`, `docs/FILE_OWNERSHIP.md`를 확인한다.
- 합성 위치·이력 추천, 자동 다음 재생, 로컬 취향·이어듣기 저장 실험이 있다. 실제 차량 SDK 서비스 연결, Android 앱/APK, 실차 검증과 사용자 효과 검증은 완료되지 않았다.
- 기준 커밋 `1471d0c`에서 Node 시험 J1 38개/주차 22개 통과. SDK Java 매퍼의 과거 단일 컴파일 증거와 Android 앱 실행을 구분한다.
- 이 문서 작성 중 같은 로컬 폴더에서 이어듣기 소스와 증거 파일이 추가 변경되고 있었다. 이 안내 작성 작업은 해당 변경을 수정하거나 임의 완료 처리하지 않았다. 최신 인계는 GitHub에 실제 푸시된 커밋 기준이다.
- 다음 작업은 최신 이어듣기 수정·검수 증거를 확인하고 새 PC에서 재생/새로고침 후 복구/종료를 검증한 뒤, J1_DELIVERY_GAPS의 미완료 항목을 이어가는 것이다.

새 컴퓨터의 에이전트에 전달할 문장:

> 이 저장소의 AGENTS.md, DEVELOPMENT_GUIDE.md와 DESKTOP_SETUP.md를 읽고 현재 브랜치·미커밋 변경·최신 작업/검증 기록을 확인해. J1을 주력으로 유지하고 자동 이어듣기와 저장 위치 복구의 현재 상태부터 검증한 뒤 남은 작업을 이어가. 합성 시연을 실제 SDK 연동으로 취급하지 마.

## 컴퓨터를 번갈아 사용할 때

작업을 시작할 때 먼저 `git status`로 로컬 변경을 확인한다. 작업 트리가 깨끗할 때 `git pull --ff-only`로 최신 커밋을 받는다. 작업을 마친 컴퓨터에서는 변경 파일을 확인하고 선택적으로 `git add`, `git commit`, `git push`를 수행한다. 동시에 두 컴퓨터에서 같은 파일을 편집하지 않는 것이 좋다. 충돌이나 미커밋 변경이 있으면 강제 reset/push 대신 변경을 보존하고 통합한다.

GitHub에는 커밋하고 푸시한 내용만 전달된다. 실행 중인 서버, 터미널 세션, 브라우저 localStorage의 취향·재생 위치, 앱 로그인, 로컬 SDK 임시 다운로드, 개인 도구 설정은 옮겨지지 않는다.

## ai-memory와 협업 도구

`.ai-memory.toml`은 `workspace="default"`, `project="hyundai_ai"` 범위를 지정한다. 이 파일만으로 메모리 서버·인증·훅이 설치되거나 기존 기록이 복제되지 않는다. 데스크톱에서도 기존과 같은 ai-memory 서버/계정에 연결되어 있는지 별도로 확인해야 한다. 연결이 없더라도 이 안내와 저장소의 docs 기록으로 프로젝트 작업을 이어갈 수 있다.

Claude Code 설치·인증·지정 모델 가용성도 새 컴퓨터에서 확인해야 한다. DEVELOPMENT_GUIDE.md 7절의 기존 협업 기준을 따르며, 사용할 수 없는 검수는 완료라고 표시하지 않는다. 저장소의 taste 스킬은 포함되어 있지만 외부 이미지·폰트나 브라우저 검사 도구의 추가 실행 조건은 별도다.
