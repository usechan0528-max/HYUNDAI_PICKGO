# SDK 응답 대기 중 합성 운행 검증

## 범위와 승인

2026-11-02 사용자가 SDK 답변을 기다리지 않고 Android 통합과 모의 운행 검증을 진행하도록 승인했다. Android 듣기는 별도 활성 채팅 `J1 Android 듣기 기능 구현`의 `experiments/j1-listening/` 담당 범위다. 이 채팅은 해당 파일·에뮬레이터를 변경하지 않고 기존 CoordinateStream, 좌표 추정기, 추천기, QueuePolicy를 조합하는 오프라인 재현 도구를 추가했다. main의 기존 미커밋 변경은 보존했다.

## 실행

프로젝트 루트에서:

```text
node experiments/journey-context/run-simulation.mjs
node --test experiments/journey-context/simulation-replay.test.mjs
node --test experiments/journey-context/*.test.mjs
```

`simulation-replay.mjs`는 시나리오의 한 점씩 입력, 명시적 도착·경로 변경·권한/동의 철회·단절, 재시작, 다음 항목 선택을 기존 정책에 연결한다. `run-simulation.mjs`는 공통 구간→분기→이탈→단절→재시작→다른 분기→명시 도착의 16개 이벤트 결과를 JSON으로 출력한다. 출력에는 좌표가 없다.

합성 입력에서만 동작하는 개발 검증 도구이며 웹 화면·Android 앱의 실제 입력 경로에 연결하지 않았다. `consume`은 미디어 플레이어 이벤트의 모형이고 소리 재생 증거가 아니다. 도착은 테스트가 명시한 사건이며 좌표 정지나 시간 0에서 도착을 추론하지 않는다. SDK 제공자의 응답이나 관측시각 보증을 대체하지 않는다.

## 수용 결과

- 공통 구간은 복수 후보를 유지하고 목적지를 확정하지 않는다.
- 분기 시 운행별 선호가 추천 후보에 반영된다. 교체 제한 시간 안에는 기존 다음 항목을 유지한다.
- 경로 이탈·관측 만료·연결 단절·동의/권한 철회·명시 도착은 운행 맥락을 제거한다. 현재 선택된 재생 항목은 유지한다.
- 운행 맥락에 의존한 다음 항목은 무효화한다. 취향만으로 선정한 다음 항목은 위치 없이도 소비할 수 있다.
- 다음 항목 선택 직전에도 신선도를 재검사한다. 최초 추가 경계 시험에서 만료된 추천을 먼저 소비하는 실패 1건을 재현하고 수정했다. 실패 로그: `work/j1-simulation/stale-consume-before.txt`.
- 재연결·경로 변경은 입력 세대를 분리하며 이전 세션 콜백을 거부한다. 입력 재시작으로 듣기 세션의 추천 교체 예산을 초기화하지 않는다.
- 실제 SDK source 및 동의/권한 없는 시작은 경로 추정을 열지 않는다. `UNVERIFIED_CLOCK` 경계와 기존 상태 bridge는 변경하지 않았다.
- 최종 새 시험 20개 통과. 전체 Node 시험 109/109 통과, 종료 0. 근거: `evidence/j1-simulation-tests-2026-11-02.txt`, `evidence/j1-simulation-replay-2026-11-02.json`.

## 한계와 다음 연결 조건

기존 좌표 추정기의 중간 경로 시작·우회 후 복귀·실측 정확도·운영 임계값은 미해결이다. 다음 항목 무효화 시 교체 예산이 소진되면 취향 후보를 계산하더라도 해당 듣기 세션에서 대기열을 자동으로 채우지 못한다. 재연결이나 대기로 회복되지 않는 현상을 시험으로 확인했다. 재현 도구의 명시적 `reset-listening` 이벤트만 새 듣기 세션으로 예산·현재 항목·최근 목록을 초기화하며, 자동 재생이나 입력 재연결에서 호출하지 않는다. 실제 제품에서의 복구 UX는 별도 통합이 필요하다. 교체 예산은 아직 듣지 않은 다음 항목의 교체에 적용되며 자연 소비 후 새 항목 채우기는 세지 않는다.

실제 좌표 추천, 내비 이동/남은 시간 갱신, Android와 이 재현 도구의 연결, 실제 음성 인식, 실차 검증은 완료하지 않았다. 외부 공개·push·계정·권한 변경은 이번 작업에서 하지 않았다. 앞선 사용자 승인으로 게시한 내비 문의는 https://github.com/Pleos-Playground/pleos-playground-api/discussions/29#discussioncomment-19349545 이다.

## 독립 검수

Claude Haiku 5.5 첫 검수 종료 0, is_error=false, 실제 modelUsage 및 session `76f69010-f0d6-4b3b-b8ba-9ba7a619b14a` 확인. 원문 `evidence/j1-simulation-review-2026-11-02.json`. Claude는 실행하지 않고 고정 입력을 읽었으며 실행 증거는 Codex가 확보했다. Dot의 기존 R004 시각 계약 미확인 결론을 유지하며 같은 조사를 중복 하달하지 않았다.

- P1 교체 예산 소진 후 무한 대기: 재현 시험과 명시적 새 듣기 세션 복구를 추가. 제품 QueuePolicy의 자동 복구 정책은 바꾸지 않았고 한계로 남긴다.
- P2 자연 소비 뒤 채우기는 교체 예산에 안 들어감: 의도된 정책이며 정확한 60000ms 경계 및 소비 후 횟수 불변 시험 추가.
- P2 게스트가 권한 거부처럼 테스트됨: 게스트는 시작 가능한 별도 프로필이며 차주 이력을 빌리지 못한다는 시험으로 분리. 동의/권한/source는 시작 거부와 정확한 reason을 검증.
- P2 fixture 가변성: 기존 실제 추천 모듈과의 통합 검증이 목적이므로 demo fixture를 복제하지 않는다. 후보 ID·purpose를 검증하고 실제 fixture 포함 고정 해시를 `work/j1-simulation/final-manifest.json`에 남겼다.
- P2 관측 지연/잘못된 입력 등의 누락: 기존 coordinate-stream 시험에 있는 경계는 전체 회귀로 실행. 이번 연결부에는 이탈 후 복귀 실패, 만료 후 소비 금지, 위치 없이 취향 소비 가능, 교체 한도·시간 경계를 추가.
- P2 consent 상수를 저장해 context로 전달 제안: 시작 때 검증된 값의 복사로 런타임 철회를 감지할 수 없다. 현재 호출자의 revoke 계약을 유지하며 실제 사건별 revoke/늦은 콜백 시험으로 검증. 플랫폼 자동 권한 감시 구현이라고 주장하지 않는다.
- 기존 모듈 무변경: core/coordinates의 git diff 없음. coordinate-stream은 다른 작업의 untracked 파일이므로 git diff만으로 증명하지 않고 검수 시작 스냅샷과 해시를 대조한다.

후속 Haiku5.5 검수: session `4aa44792-61c9-4075-962c-997553662c4f`, 종료0/is_error=false, 새 P1 없음. `evidence/j1-simulation-followup-2026-11-02.json`. 후속 입력에는 core/stream 원문이 없다는 검수자의 한계도 보존했다. queuedMode 문자열 의존 지적은 실제 contextual mode/queuedMode=journey assertion으로 보강했다. 기존 stale-consume 시험도 이 연결이 깨지면 실패한다. replacements는 운행 맥락뿐 아니라 취향 다음 항목의 교체도 세는 기존 queue.changes 값이며, 문구를 contextual 전용 횟수로 해석하지 않는다. 실행 스크립트 검증 누락은 실제 명령을 별도 프로세스로 실행하여 16개 이벤트·도착 뒤 취향 대안·늦은 콜백 거부·합성 표시를 검사하는 시험으로 보완했다. 마지막 변경은 assertion 및 실행시험 추가이며 Codex가 최종109개 회귀를 재실행했다.
