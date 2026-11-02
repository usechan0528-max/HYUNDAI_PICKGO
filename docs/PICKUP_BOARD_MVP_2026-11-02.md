# C02 픽업 약속판 초기 MVP · 2026-11-02 KST

## 승인과 구현 범위

사용자 “이 아이디어로 간다 초기 mvp 개발해”, D-020에 따른 로컬 구현·검증. D-019의 선정과 경쟁 우위 실측은 구분한다. 같은 저장소의 J1/주차/Android/SDK 변경을 보존했다. 현재 기능은 픽업 약속의 두 참여자 상태 공유이며 다른 기능 개발을 시작하지 않았다.

`experiments/pickup-board/` 신규 구현: domain.mjs, server.mjs, index.html, app.mjs, style.css, board.test.mjs, client.test.mjs, README.md. Node 내장 모듈만 사용. Android J1은 오디오 실험이므로 이번 두 사용자 상태 공유에는 재사용하지 않았다. 실제 Gleo/Pleos 연동을 위한 가짜 성공 경로도 없다.

## 수용 결과

| 항목 | 결과와 증거 |
|---|---|
| 생성·참여·준비 공유 | 서로 다른 브라우저 탭의 운전자/탑승자 화면으로 확인 |
| 제안과 확정 분리 | 제안 중 기존 정문 유지, 상대 수락 뒤 동쪽 입구로 변경 |
| 거절·철회 | 기존 승차지점 유지, 새 제안 가능. 철회는 제안자만 가능 |
| 종료 | 화면 내 확인/취소 후 종료, 양쪽 종료 표시와 수정 버튼 제거 |
| 권한·충돌 | 자기 수락/자기 거절, 다른 회차 토큰 조회·쓰기, 다른 참여자의 조회 권한, 중복 요청·오래된 버전·오래된 제안 거부 |
| 오래된 상태 | 서버 프로세스 실제 중단, 지점·제안·이벤트는 마지막 기록, 준비 상태 현재 미확인, 버튼 잠금 |
| 새로고침·재시작 | 같은 탭 역할 복원; 서버 재시작 후 회차 없음 표시, 새 약속으로 복구 |
| 실제 SDK·차량 | 미실행. 브라우저는 주행용 앱이 아니며 주행 중 사용 금지 표시 |

## 실행 증거

- Windows / Node v24.19.0 / 외부 npm 의존성 없음.
- `node --test experiments/pickup-board/board.test.mjs`: 최초 10/10, 검수 보완 뒤 11/11, 종료0. `work/pickup-board/tests.txt`, `tests-final.txt`.
- `node --check experiments/pickup-board/app.mjs`: 종료0.
- 실행: `node experiments/pickup-board/server.mjs`, http://127.0.0.1:4180. loopback만 바인딩. 서버 로그: `work/pickup-board/server-out.txt`, `server-err.txt`.
- 실제 IAB UI: 첫 회차 탑승자 제안→운전자 수락, 탑승자 새로고침 복원; 최종 회차 탑승자 제안→철회, 운전자 제안→탑승자 거절→재제안→수락, 종료 취소→확정→양쪽 종료. 상태는 접근성 트리로 확인했다.
- 화면: `work/pickup-board/accepted-final.png`, `offline.png`, `ended-final.png`. 최초 `accepted.png`는 최종 문구 수정 전 이력이다.
- 최초 native confirm 클릭 후 IAB CDP timeout. 팝업 접근·탭 닫기 API도 timeout. native confirm을 화면 내부 확인 단계로 교체하고 다른 정상 탭에서 최종 종료 흐름 검증. 최종 화면 click의 일시적 locator 실패는 새 AX 확인 후 AX 클릭으로 재현 완료. 이를 앱 상태 전이 실패나 성공으로 대체 기록하지 않는다.

## API 계약 (자체 로컬 API)

| 요청 | 입력과 권한 | 결과 |
|---|---|---|
| POST /api/rooms | place: 합성 목록 중 하나 | 운전자 임시 토큰·일회용 초대·회차 ID |
| POST /api/rooms/:id/join | invite | 탑승자 임시 토큰, 단 한 명 참여 |
| GET /api/rooms/:id | Authorization: Bearer 참여 토큰 | 역할·버전·상태·지점·준비·제안·짧은 조회 권한 |
| POST /api/rooms/:id/actions | 참여 토큰, requestId/version/view/type, 유형별 인자 | 원자적 상태 전이 후 새 스냅샷 |

type은 ready/propose/accept/reject/withdraw/end. 서버 동기 전이로 검사와 갱신 사이 비동기 구간이 없다. 제안 변경은 정확한 proposalId로만 처리한다. Origin/Host 검사·no-store·정적 파일 허용목록·CSP·4KB 본문 한도. 서버 과거 조회 권한은 참여자당 최대10개·8초 범위로 한정한다. 실제 앱 계정/영속저장/운영 보안 인증으로 확대하지 않는다.

## Claude 독립 검수와 처리

실제 CLI `--model claude-haiku-5-5`, 읽기 전용, 도구없음, 고정 소스 및 테스트 결과 전달. 첫 세션 `a8474748-f1cc-4f66-bd8e-8f249fbb067c`, exit0/is_error=false/modelUsage 실제 일치. 입력·해시·원문·메타는 `work/pickup-board/review-*`.

- P1 stale 준비/제안/마지막 이벤트가 현재처럼 보임: 전부 현재 미확인 또는 마지막 기록으로 표시. 실제 서버 중단 UI에서 확인, `offline.png`.
- P2 공유 이벤트의 “상대가” 주체 오류: 주체 중립 문구로 수정, 단위시험과 최종 양쪽 UI 확인.
- P2 제안 철회 없음: 제안자 전용 withdraw 추가, 권한시험과 실제 UI 확인.
- P3 응답 수신 시점 신선도: 요청 시작 시각으로 수정해 응답 지연을 신선도에 포함.
- 기타 초대 전 새로고침·localhost 거부·자원 한도·운영 인증 한계는 README에 명시. 413은 실제 HTTP 시험 통과이며 모든 전송조건을 인증한 것은 아님.
- 후속 검수는 수정된 고정 파일과 11시험·실제 UI 증거 요약을 전달했다. 결과는 아래 최종 상태에 기록한다.

### 최종 상태

두 번째 실제 Haiku5.5 세션 `939f9216-6989-4a3c-8936-6b48f52d9409`, exit0/is_error=false/modelUsage 일치. 읽기 범위에서 P0/P1 없음, 로컬 시연 수용 가능 판정. 후속 P2 `unavailable` 성공 후 초기화 누락은 `adopt`에서 false로 복구하고 fake DOM/network의 403→200 회귀로 확인. P3 오래된 초대 링크 표시는 valid 조건을 추가해 숨김 처리. P3 자원 상한/413 연결재설정 가능성은 시연 한계로 유지한다. 최종 두 줄 보완에 대한 3차 Claude 검수는 수행하지 않았다.

최종 `node --test experiments/pickup-board/*.test.mjs` 종료0: 도메인·실제HTTP11 + fake DOM/network3 = **14/14**. fake DOM은 브라우저 동작 인증이 아니며 실제 IAB 기록을 별도로 유지한다. 최종 증거를 추적 가능한 `docs/evidence/pickup-board-*`로 선별 복사했다. 검수 input/manifest/raw/meta/response 2세트, tests.txt, accepted/offline/ended.png. 원래 work 경로는 .gitignore 대상이며 배포 근거는 docs/evidence를 사용한다.

## 남은 한계

메모리 저장·최대24시간·로컬 단일 서버/단일 컴퓨터 두 탭 시연. 실제 다중 기기, 계정 복구, 영속성, 위치/ETA, Gleo/CarUxRestrictions, 실제 주행·실차, Android APK·release, 경쟁 대비 입력량·수요·효과는 미검증 또는 미구현이다. 보안 핵심 경계 단위시험은 운영 보안 감사를 대신하지 않는다.

Git commit/push/브랜치 통합은 별도 담당 채팅에서 진행. 이 구현 채팅은 Git 상태를 변경하지 않았으며 `codex/pickup-board` 후속 통합을 위한 파일 범위를 전달한다. 공통 문서 추가는 D-020/소유/테스트/API/작업 기록 및 README 안내로 한정한다.

검사 추가: 이번 공통문서 범위 git diff --check 통과(CRLF변환 경고). 저장소 전체 git diff --check는 기존 docs/evidence/dot-coordination-review-input-2026-11-02.txt의 trailing whitespace를 보고했으며 이번범위외라 수정하지 않았다. 최종소스 SHA256은 evidence/pickup-board-final-manifest.json. 최종 app/server node --check 종료0. 종료화면 새로고침 후 새 약속 시작 화면으로 복귀하고 사용자용 탭 유지.

## 후속 차량 화면 디자인
동일 기능 UI 0.2.0에서 Claude Opus 설계·Haiku 검수, Asta/중립톤/큰 버튼/가로세로 대응을 적용했다. 최종17시험 및 실제 화면 근거는 [디자인 검증 보고서](PICKUP_BOARD_DESIGN_2026-11-02.md)를 참조한다. 위14시험은 초기 MVP 기록이다.
