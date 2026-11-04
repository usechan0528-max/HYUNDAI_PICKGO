# C02 수동 도착·탑승 상태 · 2026-11-03

사용자 “일단 도착 탑승 상태 먼저 구현해보자” 승인과 D-017 기능 인계에 따른 로컬 웹 구현. Codex가 소스/검증/통합을 담당하고 실제 Claude Opus5.5 설계 및 Haiku5.5 독립 검수·재검수를 수행했다. Dot R007은 완료 자료를 재사용했으며 신규 조사 질문이 없어 중복 하달하지 않았다.

## 상태 계약

기존 active/ended와 별도로 stage waiting/arrived/boarded, outcome null/completed/cancelled를 둔다. 조회 응답은 두 역할에 동일한 stage/outcome을 제공한다. 준비 true/false와 위치는 단계의 자동 전이 근거가 아니다.

| 요청 | 역할과 시작 조건 | 결과 |
|---|---|---|
| arrive | 운전자, 상대 참여, waiting, 제안 없음 | arrived, 확정 지점에 대한 직접 도착 알림 |
| board | 탑승자, arrived, 제안 없음 | boarded, 직접 탑승 확인; 아직 active |
| undoArrival | 운전자, arrived | waiting; 탑승 확인 후에는 불가 |
| undoBoarding | 탑승자, boarded | arrived; 운전자 도착 유지 |
| propose | 두 역할, 상대 참여, boarded 아님 | 현재 장소 유지, 상대 응답 대기 |
| accept | 제안 상대, 올바른 proposalId | 장소 변경과 waiting 초기화를 원자적으로 적용 |
| reject / withdraw | 각각 제안 상대 / 제안자 | 기존 장소·도착 유지 |
| end | 두 역할, active | boarded면 completed, 그 외 cancelled; 제안/초대 제거, 이후 변경 금지 |

모든 요청은 기존 capability, active, version, 서버 조회 lease8초, 중복 requestId 방어를 통과해야 한다. 요청 실패는 자동 재전송하지 않는다. 종료 확인창은 연 시점의 version에 묶이고 다른 변경 수신 시 닫힌다. 서버도 같은 version을 검사하므로 확인창의 완료 의미가 바뀐 상태에서 종료할 수 없다. 같은 장소 제안은 기존 고정 장소 식별 문자열 비교로 금지된다. 나가기/unjoin 및 영구 감사 이력은 추가하지 않았다.

## 변경 파일

experiments/pickup-board/domain.mjs, app.mjs, index.html, style.css, board.test.mjs, client.test.mjs, README.md. server.mjs는 기존 라우팅으로 새 액션을 처리하며 수정하지 않았다. 기존 Asta/중립톤/패널0px/버튼2px를 보존했다. 기존 emulator-preview 소스·키·권한, J1/SDK/다른 작업은 수정하지 않았다. main의 다수 기존 미커밋/미추적 파일을 보존했고 commit/push하지 않았다.

## 실행 결과

- 기준 Node17시험 통과 후 구현. 최종 `node --test experiments/pickup-board/*.test.mjs`: 종료0, 27/27(도메인·실제HTTP18, fake DOM/network9). `node --check` app/domain/server 각각 종료0. Node24.19.0, Windows.
- 실제 HTTP 추가 시험: 도착 역할403, 두 역할 stage 공유, 탑승 확인 후 undo, 이전 완료 view의 end409, 재조회 후 cancelled, 종료 후 board409. 합성 장소·실제 loopback HTTP이며 SDK 시험이 아니다.
- 실제 Chrome 두 탭: 생성/참여→운전자 도착→탑승자 장소제안→운전자 수락/양쪽 도착초기화→다시 도착→탑승자 탑승→운전자 완료 확인창 중 탑승취소→확인창 폐기→재탑승→명시 완료→양쪽 픽업 완료 확인.
- 최종 클라이언트 소스로 실제 서버 프로세스 중단: 현재 미확인, 이전 지점 표시, 도착/탑승/준비/장소/종료 잠금, lastEvent display:block 확인. 복구 시 서버 재시작으로 회차 소실은 설계상 한계다. 새 서버를 4180에 다시 실행했다. 재시작 후 UI복구는 Windows잠금으로 이번 최종 확인 미실행.
- 반응형 실제 CSS뷰포트391×844,480×800,1280×720: 가로 넘침 없음, 버튼 최소76px, boardBottom<footerTop. 내용이 많으면 board 내부 스크롤을 사용한다. 브라우저 확대 비율 때문에 요청한 크기와 실제 CSS크기가 달라 실제 측정값을 기록했다. 640×1067도 별도 관찰했으나 JSON3크기만 최종 증거로 저장했다. 실차 dp 인증 아님.
- Pleos emulator-5556 adb 연결과 reverse4180 확인. 최종 앱 UI 확인 시 Windows잠금 화면을 받아 즉시 입력 중단하고 잠금 해제 요청. 최종 상태 기능의 에뮬레이터 시각 검증은 차단/미실행. 기존 하네스 빌드결과를 새 기능 실행 증거로 재사용하지 않는다.
- 중간 실패: fake DOM hidden에 null/숫자를 할당해 2시험 실패→명시 boolean 변환 후 통과. 추가 HTTP시험 작성 중 async 기본 인자 await 문법오류→함수 본문으로 이동 후27통과. 최초 IAB unavailable→Chrome으로 전환. viewport 소수 인자 거부→정수 요청/실제 CSS크기 측정.

## Claude 검수와 처리

모든 호출 --safe-mode/--tools 빈값/strict 빈MCP/plan/print/json으로 고정 텍스트만 전달했다. 소스 수정이나 도구 실행 권한을 부여하지 않았다. 실제 결과 exit0/is_error=false 및 modelUsage에서 지정 모델 확인.

- Opus5.5 c05e9232-c254-444e-b7f6-4bc22e00ab19: 핵심 전이 수용. 제안 종료 원자정리·준비값 보존 채택. expectedOutcome 추가는 version이 전체 상태를 고정하고 UI도 재확인을 강제하므로 미채택; Haiku 동의. unjoin API 없음, 같은 장소 제안 금지, 중복 요청409/명시 재조회 유지. 영구/append-only 기록은 승인 범위에 추가하지 않고 lastEvent로 현재 사건을 설명한다.
- Haiku5.5 bd7df644-00fa-43e2-8030-b912587bde07: P0/P1 없음. P2 오류가 refresh로 즉시 지워짐→actionError를 자동poll에도 보존, 사용자 다시확인/새행동 때 해제. P2 실패 시 과거 설명 숨김→stale CSS override와 내부 스크롤, 실제 offline display:block 검증. P2 종료 행위자 미표시→운전자/탑승자 명시. 기존 장소 제안 사건에 전체 감사기록을 추가하는 것은 범위 밖으로 유지. 두 역할 종료는 승인된 기존 정책.
- P3 준비true 유지 시험 추가, 잘못된 정규식 제거, rider의 잘못된 ready형식400, 화면읽기 headline을 stage와 일치, 탑승 후 ‘아직 준비 중’ 대신 종료대기 설명. 준비값 자체는 보존. 제안 중 undoArrival은 UI에서 숨기고 제안 처리 후 가능; 서버 허용은 위해 없음.
- Haiku5.5 1422b113-81af-4b99-9e41-6d60da4a93cc: 수정diff 재검수, 차단 회귀 없음. CSS ancestor는 index.html의 cockpit 하위 connection과 실제 offline 표시로 확인. 구형 Firefox는 이번 시험 범위 밖. 마지막 추가 HTTP 시험1개는 재검수 후 추가되었고 production 소스는 재검수 이후 변경하지 않았다.

## 증거와 한계

[evidence/pickup-status-tests.txt](evidence/pickup-status-tests.txt), [최종해시](evidence/pickup-status-final-manifest.json), [뷰포트](evidence/pickup-status-viewports.json), [실제 offline 화면](evidence/pickup-status-offline.png). plan/review/followup의 input/response/meta/raw JSON과 review-manifest는 같은 evidence/pickup-status-* 접두사로 저장했다. 검수입력에는 불필요한 자격증명/전체 이력을 전달하지 않았다.

완료 범위: 수동 상태 구현·Node/HTTP/fake회귀·Chrome 두역할 핵심흐름·독립검수/지적처리. 후속 잠금 해제 후 Pleos에서 소실 회차 안내→새 약속 복구→도착 알림 전→탑승 전 취소 확인→약속 취소·탑승 미완료 표시를 확인했다. 도착·탑승 두역할 전체 흐름의 실제 UI 증거는 Chrome이며, 에뮬레이터에서 두역할 전체 흐름을 재실행한 것은 아니다. 실제 SDK·Gleo·위치판정·ETA·영속저장·실차·주행규제·release 제출은 미실행/범위 밖. 다음 새 기능은 시작하지 않는다. 같은 기능의 잠금 해제 후 UI 확인은 이 채팅에서 이어간다.

## 잠금 해제 후 후속 검증

사용자의 잠금 해제 통보 후 동일 채팅에서 재개. 최초 캡처가 다른 전면 창을 반환해 창을 재식별하고 명시 Raise 후 Pleos 화면임을 확인했다. 이후 모든 입력은 cua_repl의 관찰된 화면 좌표로 수행했다.

- 서버 재시작으로 사라진 회차의 오류·새 약속 시작 버튼 확인, 버튼으로 최신 페이지 복구.
- 실제 Pleos WebView에서 새 회차 생성, ‘픽업 진행 · 직접 확인 / 도착 알림 전 / 참여 대기’ 표시.
- ‘약속 취소’ 확인창에 ‘탑승 없이 약속을 취소할까요? / 탑승 완료로 기록하지 않습니다’ 표시.
- 명시 취소 확정 후 ‘약속 취소 · 탑승 미완료’, 운전자 취소 사건, 새 약속 시작 표시. 종료 변경 버튼 없음.
- 최종 화면의 패널/버튼/문구가 분할 앱 영역에 표시됨. 신규 APK 빌드/SDK/실차 시험은 하지 않았다. 앱 소스 변경 없이 기존 검토 하네스가 현재 서버 파일을 로드했다.

증거: [대기](evidence/pickup-status-emulator-waiting.png), [취소 확인](evidence/pickup-status-emulator-confirm.png), [취소 결과](evidence/pickup-status-emulator-cancelled.png). 잠금에 의한 위 미실행 기록은 당시 이력이며 이 후속 검증 범위에서 해소됐다. Chrome의 동일 기존 탭 복구를 별도로 재실행하지는 않았다. 도착·탑승 핵심 두역할 흐름은 앞선 Chrome 검증으로 한정한다. production app/domain 해시는 최종 manifest와 일치, 소스 수정 없음으로 Node/Claude를 반복 실행하지 않았다.
