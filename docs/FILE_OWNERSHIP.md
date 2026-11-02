# 파일 담당 범위

| 작업자 | 위치 | 이번 허용 범위 | 제외 | 상태 |
|---|---|---|---|---|
| Codex 메인 | 기존 main 작업 디렉터리 | 이번에 새로 만드는 평가·API·결정·검증·검수 문서 | 기존 미커밋 변경, 지침 원본, 앱 구현, 공개/push | 작성·검증 |
| Claude Code 검수자 | 고정 검수 입력 묶음 | 전달된 자료의 읽기 중심 검수, 파일 수정 없음 | 저장소 수정, 외부 도구/조회, 새 구현 | CLI 로그인 부재로 검수 미실행 |

시작 시 main에 기존 삭제/수정/미추적 파일이 있었다. 이를 복원·삭제·이동하지 않는다. 이번 작업에서는 새 문서만 작성한다.

## 아이디어 회의 담당 · 2026-11-02

- Codex: 추천안·회의 입력·증거 작성, 관련 기록 추가. main의 기존 사용자 변경 보존.
- Claude: 승인된 입력 두 건의 텍스트 검토 완료. 파일 수정·외부 조회 없음.
- 위 표의 인증 부재는 이전 독립 검수 시도 상태다. 이번 회의 성공은 기존 심층 평가 전체 검수 완료를 뜻하지 않는다.

## 주차 MVP · 2026-11-02

| 담당 | 허용 범위 | 제외 |
|---|---|---|
| Codex | `mvp/`, 신규 README, MVP 평가·검증·결정 기록 | 기존 사용자 변경, 외부 공개·위치 수집 |
| Claude Haiku 5.5 | 고정 입력의 소스·시험 증거 읽기 검수 | 모든 파일 수정·명령 실행 |
| Claude Opus 5.5 | 고정 MVP 설명·실행 증거에 대한 제품 평가 | 구현·사용자 실험 성공 추정 |

## 실제 공공 데이터 연결 이정표 (2026-11-02)
Codex: mvp/parking.mjs, live.html, live.js, parking.test.js 및 기존 server/index/README/검증·평가 문서 통합. Claude Haiku: 고정 소스 읽기 전용 검수. Claude Opus: 제한된 실행 증거로 제품 재평가. 병렬 소스 수정 없음.

## 아이디어 반복 탐색
Codex: 평가기준·조사·후보·점수·기록 통합 및 공통지침의 이번 승인 추가. Claude Opus5.5: 고정 입력 텍스트 제안/독립평가/반론. 앱소스 변경없음.

## J1 주력 보완 (D-014)
Codex: 공통 기준·README·J1 설계·결정·작업/검증 기록 통합. Claude Opus5.5: 고정 설계 입력에 대한 읽기 전용 반론과 보완. 앱 소스 병렬 수정 없음.

## J1 합성 로직 실험
Codex: experiments/journey-context/ 신규 실험·테스트·설명 및 증거 문서. Claude Haiku5.5: 고정 코드/테스트 읽기 전용 검수. 기존 mvp/ 수정 없음.

J1 비교 하네스: Codex experiments/journey-context/compare.mjs·compare.test.mjs 및 문서/증거 담당. Haiku 고정 입력 읽기 전용 검수, 소스 수정 없음.

## 2026-11-02 · 실제 SDK 경계 확인
J1 SDK 경계: Codex experiments/journey-context/java/ 및 API/TEST/WORK 증거 통합. Haiku5.5 최소매퍼/공개선언 읽기전용 검수.

## 2026-11-02 · 내비 입력 계약 확인
Codex NavigationSnapshotMapper.java 및 API/TEST/WORK 증거 담당. Haiku5.5 소스·공개선언·한정실행증거 읽기 검수. SDK는 임시경로, 저장소바이너리/기존앱 변경없음.

J1 v2 재평가: Codex 독립사전점수·근거통합·차이문서, Opus5.5 독립평가/반론 텍스트만. 코드동시수정없음.

## 2026-11-02 · J1 로컬 듣기 시연
Codex demo/소스·음원·기존core큐수정/회귀/문서담당. Haiku5.5 고정app/core/server/콘텐츠읽기검수. 기존주차mvp변경없음.

## 2026-11-02 · D-015 자동 이어듣기
Codex coordinates.mjs/test 신규실험 및 demo/app/index 자동이어듣기 변경, Haiku자동재생app/core읽기검수. 좌표모듈은이번Claude검수제외로명시.

## 2026-11-02 · 합성 좌표 시연 연결
Codex coordinates/observations/좌표시험 및core추정함수주입·demo연결, Haiku고정좌표알고리즘/관측fixture읽기검수. 자동이어듣기이벤트로직변경없음.
