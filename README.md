# 픽업 약속판

운전자와 탑승자가 준비 상태·승차 지점·변경 수락·도착·탑승을 한 회차로 관리하는 로컬 웹 시연입니다. 현재 위치·경로 추천은 합성 데이터이며 실제 차량 SDK·Gleo·물리 휴대폰 HTTPS 연동은 미완료입니다.

```sh
node experiments/pickup-board/server.mjs
node --test "experiments/pickup-board/*.test.mjs"
```

http://127.0.0.1:4180 에서 실행합니다. [상세 실행 안내](experiments/pickup-board/README.md).

2026-11-04 J-1 전용 코드·음원·APK·문서·증거는 [별도 비공개 J1_ARCHIVE](https://github.com/usechan0528-max/J1_ARCHIVE)로 이관했습니다. J-1은 잠정 중단 상태입니다. 기존 Git 이력과 혼합 결정 기록은 보존하며, 이관 전 경로는 과거 기록입니다. [분리 기록](docs/PROJECT_SEPARATION_2026-11-04.md).

이전 주차 MVP(mvp/)는 별도 과거 실험이며 현재 주력 개발 대상이 아닙니다.

## 픽업 약속판 · 초기 MVP
[C02 실행 안내](experiments/pickup-board/README.md) · [검수·증거·한계](docs/PICKUP_BOARD_MVP_2026-11-02.md). node experiments/pickup-board/server.mjs 실행 후 http://127.0.0.1:4180 . 운전자·탑승자 두 화면의 준비/장소 제안/상대 수락·거절/철회/종료를 공유합니다. 로컬 웹·합성 장소·메모리 저장이며 실제 Gleo/차량 SDK/Android APK가 아닙니다. 도메인·HTTP11개 및 fake DOM 회귀3개 총14개 통과, 별도 실제 브라우저 검증 완료.

차량 화면 디자인 0.2.0: 이전 Pleos 시안의 Asta·중립톤·큰 터치 버튼을 반영하고 가로/세로8크기를 확인했습니다. 실제 Claude 설계/검수 및17시험 결과: [디자인 보고서](docs/PICKUP_BOARD_DESIGN_2026-11-02.md). 실제 차량 규격 인증이나 SDK 연동 완료를 뜻하지 않습니다.

수동 도착·탑승 0.3.0: 운전자 도착→탑승자 확인→명시 완료, 탑승 전 종료는 취소로 구분합니다. 27시험 및 실제 Chrome 두역할 검증·Claude설계/독립검수 완료. 잠금 해제 후 Pleos에서 새 약속 복구·도착 전 표시·미탑승 취소 결과를 확인했습니다. [상태 기능 보고서](docs/PICKUP_BOARD_STATUS_2026-11-03.md).


Gleo 연동 준비: 현재 약속 조회·수동 도착 두 명령의 내부 어댑터/후보 schema와 경계 시험을 추가했습니다. 실제 Gleo·Android 수신 경로는 비활성이며 승인·호출자 계약·native 세션 연결이 남아 있습니다. [재현/연결 절차](experiments/pickup-board/gleo/README.md) · [준비 결과와 차단](docs/PICKUP_GLEO_READINESS_2026-11-03.md).

픽업 위치 통합 마감(2026-11-03): 합성 차량 근접 시연과 동의 기반 일회 휴대폰 위치 공유 흐름을 연결했습니다. 115개 시험 및 Chrome 두 역할 완료 흐름 통과. 실제차량SDK·물리폰HTTPS·외부지도 본연동은 미완료입니다. [통합 검수·실행·남은 범위](docs/PICKUP_LOCATION_INTEGRATION_2026-11-03.md).



## 탑승자 웹 초대 흐름 · 2026-11-03
설치·가입 없는 링크참여/복사/새로고침복원/참여재시도 및 기존 준비·장소합의·선택적위치·탑승 흐름을 연결했습니다. 로컬구현·검증이며 공개HTTPS/물리휴대폰/실차 연결 완료가 아닙니다. [구현과검증](docs/PICKUP_RIDER_WEB_2026-11-03.md).


## 픽업 지점 추천 준비 · 2026-11-03
명시 합성 위치/경로/정차 근거로 후보 비교→제안→상대 최신근거 수락을 구현했습니다. 실제 첫 검증 지역은 강남역이며 검증된 실제 후보/차량위치/경로 공급자는 미연동입니다. 기본 서버 추천 수집 차단, 합성 실행: `node experiments/pickup-board/recommendation/demo-server.mjs` (4187). 최종 통합176시험 통과. [구현·검수·차단](docs/PICKUP_RECOMMENDATION_2026-11-03.md) · [강남역 데이터 조사](docs/PICKUP_GANGNAM_DATA_2026-11-03.md).
