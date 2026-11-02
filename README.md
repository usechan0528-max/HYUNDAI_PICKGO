# 픽업 약속판 · 로컬 MVP

가족·지인의 픽업 준비 상태, 만날 지점의 제안·수락, 수동 도착·탑승·종료를 두 역할로 공유하는 로컬 웹 시연입니다.

## 실행

Node.js 22 이상에서 `node experiments/pickup-board/server.mjs`를 실행하고 http://127.0.0.1:4180 에 접속합니다. 데이터는 서버 메모리에만 저장되며 재시작하면 사라집니다. 장소는 합성 데이터입니다.

시험: `node --test experiments/pickup-board/*.test.mjs`

- [실행·사용 안내](experiments/pickup-board/README.md)
- [수동 도착·탑승 검증](docs/PICKUP_BOARD_STATUS_2026-11-03.md)
- [차량 UI](docs/PICKUP_BOARD_DESIGN_2026-11-02.md) · [에뮬레이터 검토 하네스](docs/PICKUP_BOARD_EMULATOR_DESIGN_2026-11-02.md)
- [Gleo 준비와 차단 조건](docs/PICKUP_GLEO_READINESS_2026-11-03.md): 후보 schema·내부 어댑터 시험 단계이며 실제 Gleo 연결은 미완료입니다.
- [선정 기획](docs/IDEA_TOURNAMENT_2026-11-02.md)

차량 SDK·실차·실제 위치 공유·지도 제공자 연동은 이번 커밋 범위에 포함하지 않습니다. 별도 채팅의 위치·근접 기능은 진행 중입니다. Android 하네스는 웹 UI 검토용이며 제품 앱이나 release APK가 아닙니다. 빌드 도구·SDK·서명키와 새 검토용 APK는 업로드하지 않습니다.

J-01(J1/J-1)은 2026-11-03 사용자 결정으로 잠정 폐기했습니다. 사용자 명시적 재개 전까지 향후 개발에서 고려하지 않습니다. 기존 소스·APK는 과거 이력으로만 상속·보존합니다.
