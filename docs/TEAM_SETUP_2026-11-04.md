# 공동작업자 npm 환경 설정 도구 · 2026-11-04

사용자 요청: GitHub 공동작업자가 프로그램·스킬·플러그인 기본 환경을 한 번에 설정할 npm 도구. Windows 대상 `npm run setup`, 계획/진단/프로필을 구현했다. main의 기존 다수 미커밋 앱 변경을 보존했으며 앱 소스는 수정하지 않았다. npm 공개 배포·commit·push는 하지 않았다.

변경: 루트 package.json, tools/team-setup/{cli.mjs,manifest.json,setup.test.mjs,README.md}, README의 안내 한 문단, DESKTOP_SETUP 안내, 이 문서와 증거/작업 기록. 기존 .agents/.claude 스킬은 그대로 보존한다. .gitignore 변경은 최종적으로 없다.

수용 범위: WinGet 9종 프로그램 + Codex CLI 조건부 설치, Git에 포함된 스킬 대조/누락 복구, 계정별 설정 체크리스트, 실패 시 종료 코드 1, 개인 파일 보존, 재실행, 쓰기 없는 계획. 정확한 버전/개인 계정/SDK까지 복제하는 OS 이미지가 아니다. desktop/plugin 설치·OAuth·ai-memory 배포 주소·Pleos 자산·Gradle/SDK/서명 경로는 수동 항목으로 명시한다.

## 실행 증거

환경: Windows PowerShell, Node 24.19.0. 현재 셸에는 npm이 없어서 검증용 npm 11.6.2를 공식 레지스트리에서 integrity 확인 후 ignored work/team-setup-test에만 풀어 실행했다. Python 3.10의 tarfile filter 옵션 미지원으로 첫 검증 도구 추출 실패; 파일 종류/대상 경로를 명시 검증한 추출로 재실행 성공했다. 공동작업자는 Node 공식 설치본의 npm을 사용한다.

| 명령/확인 | 결과 |
|---|---|
| `node work/team-setup-test/npm/package/bin/npm-cli.js run test:setup` | 최종 14/14, exit 0 |
| `... run setup:plan` | exit 0; 계획 테스트에서 subprocess/쓰기 없음 확인 |
| `... run setup -- --profile web` | 실제 checkout에서 반복 실행 exit 0; 스킬 동일 파일 보존/보고서 생성 |
| `... run doctor -- --profile web` | exit 0; Node/Git/두 스킬 확인 |
| `... test` | 당시 작업트리 웹 243/243, exit 0. 동시 작업자 코드 포함한 해당 시점 결과 |
| manifest의 9개 ID 및 Node LTS `winget show` | 모두 exit 0; 다운로드/설치 성공을 의미하지 않음 |
| 존재하지 않는 ID `winget list` | exit -1978335212. 미설치를 installed로 오인하지 않는 근거 |
| `node tools/team-setup/cli.mjs doctor` | 일부 프로그램 missing. 현재 휴대용/번들 도구까지 동일 설치로 판정하지 않음 |
| `git diff --check` (본 작업 범위) | 통과 |

최종 설치 도구 시험은 옵션 검증, 무변경 plan, 충돌 시 전체 스킬 보존, 재실행, 소스/대상 junction 거부, 실패 후 후속 처리/보고서, 기존 프로그램 업그레이드 금지, doctor 무쓰기, 비 Windows 설치 거부, 실제 프로세스 실패, 공백 경로 Windows cmd shim의 성공/exit7, 고장 난 Codex 보존, 등록된 CLI 실행 실패, junction 진입점 탐지를 포함한다.

증거: `docs/evidence/team-setup-2026-11-04/tests.txt`, `app-tests.txt`, Claude `review-input.txt`, `snapshot.json`, `review-raw.json`, `review-response.txt`. 로컬 설치 보고서는 `work/team-setup/`에 있으며 Git 제외다.

## Claude 독립 검수와 처리

실제 Claude Code `claude-haiku-5-5`, safe-mode/빈 tools/MCP/plan, 고정 파일 SHA256 입력, exit 0 및 is_error=false. 검수자는 실행을 재현하지 않은 읽기 검수임을 명시했다. 초기 10시험 스냅샷을 검수했고 이후 최종 14시험으로 보완했다.

- P1 진입점 alias 비교: realpath + Windows 대소문자 정규화, junction 시험 통과.
- P1 Windows shim 미시험: 공백 경로 cmd 성공/실패 exit7을 실제 Windows에서 검증.
- P1 winget list 종료 의미 미확인: 미설치 ID 실제 종료 코드 확인으로 해소.
- P2 현재 디렉터리 명령 탐색: PATH의 절대 디렉터리만 탐색, checkout 제외, PowerShell 시스템 절대경로 사용.
- P2 고장 난 Codex 재설치 위험: ENOENT 외 실패 시 자동 설치 금지, 회귀시험 통과.
- P2 CLI 등록만으로 doctor 성공: 실제 실행 실패는 missing, 회귀시험 통과.
- P2 WinGet 실패 코드: 10진/16진 함께 표시, 미확인 코드를 임의 성공 처리하지 않음.
- P2 ignore 미확인: work는 기존 ignore 확인. Claude 스킬은 기존 tracked 자산이므로 삭제/추적해제하지 않고 유지.
- P3 보고서 이름 충돌: UUID 추가. 복사 중 디스크 실패의 비원자성, 링크 경로 거부, GUI 설치 탐지 한계는 문서화. 기존 CLI 버전 보존은 의도된 정책.

Dot은 공모전/SDK 신규 판단을 요구하는 작업이 아니므로 새 조사 과제를 만들지 않았다. 기존 종료/대기 유지. ai-memory 서버 배포/권한은 확인되지 않아 접속을 만들어내거나 개인 설정을 복제하지 않았다.

미실행: 새 Windows PC full 설치, 전체 프로그램 실행/인증, 협업자 플러그인 설치, Android SDK/Gradle/Pleos/서명/에뮬레이터 빌드. 도구 구현과 로컬 시험 완료를 이 항목들의 완료로 확대하지 않는다.
