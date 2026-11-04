# PICKGO 공동작업자 환경 설치

Windows 10/11 + Node.js 22 이상(npm 포함)에서 저장소 루트의 명령 하나로 실행합니다. npm 레지스트리에 공개하는 패키지가 아니라 이 비공개 저장소에 포함된 npm 도구입니다. 외부 npm 의존성과 자동 postinstall은 없습니다.

```powershell
npm run setup
```

기본 `full`은 Git, GitHub CLI, Claude Code, Chrome, VS Code, ripgrep, Python 3.12, JDK 17, Android Studio를 WinGet으로 설치하고, Codex CLI가 없으면 npm으로 0.166.0을 설치합니다. 기존 프로그램은 보존하며 자동 업그레이드하지 않습니다. 따라서 모든 바이너리의 정확한 버전까지 동일해지는 이미지 복제는 아닙니다. WinGet 패키지는 실행 시 제공 버전이며 Codex 데스크톱 번들의 alpha CLI와 npm 배포 stable CLI도 다를 수 있습니다.

설치 실행은 나열된 프로그램의 패키지/소스 약관 동의 옵션을 포함합니다. 먼저 계획을 보려면 `npm run setup:plan`을 사용하세요. 일부 프로그램은 Windows 관리자 권한/UAC가 필요합니다. 거부되면 실패로 기록하며 권한 상승이나 재부팅을 자동 수행하지 않습니다.

## 처음 받은 PC

Node/npm과 Git이 없다면 PowerShell에서 아래 두 프로그램을 먼저 설치하고 **새 터미널**을 엽니다. npm은 자신의 실행에 필요한 Node를 먼저 설치할 수 없습니다.

```powershell
winget install --id OpenJS.NodeJS.LTS --exact --source winget --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
winget install --id Git.Git --exact --source winget --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
```

WinGet이 없으면 Microsoft App Installer를 설치하거나 [Node 공식 다운로드](https://nodejs.org/en/download)와 [Git for Windows](https://gitforwindows.org/)를 사용합니다. Node 22 이상인지 `node --version`으로 확인합니다.

저장소 읽기 권한이 있는 본인 GitHub 계정으로 복제합니다.

```powershell
git clone https://github.com/usechan0528-max/HYUNDAI_AI.git
cd HYUNDAI_AI
npm run setup
```

`npm install`은 필요 없습니다. PowerShell에서 npm.ps1 실행 정책 오류가 나면 정책을 완화하지 말고 `npm.cmd run setup`을 사용하세요. 설치 뒤 새 터미널에서 `npm run doctor`를 실행합니다.

## 선택 명령

| 명령 | 동작 |
|---|---|
| `npm run setup:plan` | 쓰기/설치 없이 계획과 수동 체크리스트 출력 |
| `npm run setup -- --dry-run` | 위와 같음 |
| `npm run setup -- --profile web` | Git 확인/설치 + 프로젝트 스킬 배치 |
| `npm run setup -- --profile agents` | web + 협업 CLI/브라우저/에디터 |
| `npm run setup` | agents + Python/JDK/Android Studio |
| `npm run doctor -- --profile web` | 웹 환경과 스킬 상태 확인 |
| `npm run doctor` | 전체 프로그램/스킬 진단; 로그인/SDK 실행 검증은 별도 |
| `npm run test:setup` | 설치 도구 시험 (실제 프로그램 설치 없음) |
| `npm test` / `npm start` | 현재 픽업 웹 시험 / localhost:4180 실행 |

자동 프로그램 설치는 Windows 전용입니다. macOS/Linux에서는 plan으로 목록을 확인해 각 공식 설치 경로를 사용합니다. doctor의 GUI 프로그램 검출은 Windows WinGet에 한정됩니다.

## 스킬·플러그인·설정 범위

- `.agents/skills/design-taste-frontend`와 `security-audit`, 현재 `.claude/skills` 사본도 이미 Git에 포함되어 있습니다. 설치 도구는 Codex 원본과 Claude 사본을 대조하고 누락 파일만 복구합니다. 전역 홈 디렉터리를 수정하지 않습니다.
- 같은 파일은 유지하고, 다른 내용이 있으면 해당 스킬 전체를 건너뛰며 `conflict`와 종료 코드 1을 반환합니다. 사용자가 차이를 검토한 뒤 수동 병합해야 합니다. 링크/junction을 통한 외부 쓰기는 거부합니다.
- GitHub, computer-use, Google Drive, Notion 등 플러그인 목록은 `manifest.json`과 생성 체크리스트에 있습니다. 현재 사용자에게 보이는 스킬 패키지 명칭도 포함하므로 협업자 계정의 상품명/제공 여부는 다를 수 있습니다. 설치 도구가 타인의 계정에 플러그인을 설치하거나 OAuth 연결을 대신하지 않습니다. 본인 Codex의 플러그인 디렉터리에서 설치·연결 후 새 채팅에서 확인합니다.
- imagegen/openai-docs/skill-creator/skill-installer 같은 기본 스킬은 Codex 배포판 제공 여부를 확인합니다. 현재 사용자의 플러그인 캐시·라이선스 리소스를 통째로 재배포하지 않습니다.
- ai-memory 서버/라우팅 스킬은 현재 승인된 배포 주소가 저장소에 없습니다. 담당자로부터 연결 정보를 받은 뒤 공식 routing install을 사용합니다. 대상은 `default/hyundai_ai`; 기존 개인 DB/토큰/사용자 홈 설정을 복제하지 않습니다.
- AGENTS.md/CLAUDE.md/DEVELOPMENT_GUIDE.md는 저장소 원본을 사용합니다. 개인 Git 신원, 모델 기본값, 승인 정책, sandbox, OAuth, 자동화, 키를 변경하지 않습니다. Claude 검수 Haiku 5.5 / 기획 Opus 5.5 가용성은 각 계정에서 확인합니다.

## Android와 Pleos의 남은 설정

Android Studio 설치와 Android 빌드 가능 상태는 다릅니다. SDK Manager에서 API 34와 필요한 build tools/platform tools/emulator를 설치하고 라이선스를 직접 확인합니다. 프로젝트 기준 JDK 17, Gradle 8.9, AGP 8.7.3입니다. Gradle은 [공식 배포](https://gradle.org/releases/)에서 checksum을 확인해 확보합니다.

Pleos SDK/에뮬레이터 접근, NaviHelper 3.0.5·navi-data 3.0.4·navi-aidl 3.0.1, debug 서명 설정은 별도입니다. 현 Android 실험은 `.gradle` 캐시 AAR과 `work/pleos-environment` 로컬 경로를 참조합니다. 이 도구로 해당 비공개 자산이 생기거나 Android 빌드가 즉시 가능해지지 않습니다. [내비 실험 README](../../experiments/pickgo-navigation/README.md)와 build.gradle을 대조해 본인 경로를 준비해야 합니다. 개인 서명키는 공유하지 않습니다.

## 결과와 실패 처리

`work/team-setup/report-*.json`은 항목별 결과, `checklist-*.md`는 수동 설정 목록입니다. 재실행 시 새 보고서를 만들고 예전 보고서를 보존합니다. 보고서는 Git에서 제외됩니다. `ready`는 명령/스킬 확인, `installed`는 WinGet 등록 또는 설치 명령 성공으로 PATH와 실제 실행까지 보장하지 않습니다. `failed`/`missing`/`conflict`가 하나라도 있으면 종료 코드 1입니다. 종료 코드 0도 플러그인/인증/실차/SDK 검증 완료는 아닙니다.

doctor는 CLI 실행이 실패하면 패키지 등록만으로 통과시키지 않습니다. 기존 Codex 명령이 발견되지만 실행되지 않으면 재설치하지 않고 실패를 보고합니다. GUI 프로그램의 휴대용/수동 설치본은 WinGet에서 발견되지 않을 수 있습니다. 스킬 경로에 junction/symlink가 있으면 의도된 링크도 거부합니다. 디스크 오류 등으로 복사가 중단되면 생성된 일부 파일은 남을 수 있으며 같은 명령으로 누락 파일을 복구할 수 있습니다.

인터넷/WinGet/관리자 권한 문제를 해결하고 같은 명령을 다시 실행할 수 있습니다. 설치 완료 프로그램은 유지됩니다. 설치 명령은 항목당 최대 20분, 조회는 60초로 제한합니다. 설치 관리자의 자식 프로세스가 남았다면 종료를 확인한 후 재실행하세요. doctor는 파일을 쓰지 않지만 WinGet 조회 자체는 시스템 캐시/소스에 접근할 수 있습니다.

## 근거 (2026-11-04 확인)

- [Codex 스킬](https://developers.openai.com/codex/skills): 프로젝트 스킬 위치.
- [OpenAI Developers 플러그인 설치](https://developers.openai.com/learn/developers-codex-plugin): 디렉터리 설치, 계정 연결, 새 채팅.
- [Claude Code 설치](https://code.claude.com/docs/en/setup): WinGet `Anthropic.ClaudeCode`.
- [WinGet install](https://learn.microsoft.com/en-us/windows/package-manager/winget/install): exact/silent/no-upgrade/noninteractive 옵션.
- [Pleos 환경](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator): SDK/에뮬레이터는 승인된 공식 경로로 확보.
