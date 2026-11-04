# 픽업 지점 추천 개발 시연

실제 서비스 연결 전 준비 구현입니다. 기본 서버는 추천용 위치 수집·추천을 거부합니다.

```powershell
node experiments/pickup-board/recommendation/demo-server.mjs
```

http://127.0.0.1:4187 에서 회차를 만들고 탑승자로 참여한 뒤, 양쪽의 ‘동선 기반 지점 추천’ 화면에서 각각 합성 위치 공유에 동의합니다. ‘현재 위치로 다시 추천’→후보 선택→상대 추천 화면에서 근거 확인 후 수락합니다. 재계산은 확정 장소를 바꾸지 않습니다. 원래 약속판의 수동 장소 합의도 계속 지원합니다. 추천 제안은 일반 수락 버튼으로 검증을 우회하지 못합니다.

각 역할의 서쪽/동쪽 합성 위치를 바꾸려면 공유 중지 후 새 동의를 선택합니다. 새로고침·숨김·오프라인 후 자동으로 공유를 재개하지 않습니다. 실제 GPS·지도·정차구역 데이터가 아니며 실제 위치 권한을 요청하지 않습니다. 주행 중 사용하지 않는 로컬 검증 화면입니다.

```powershell
python work/pickup-recommendation/verify.py
python work/pickup-recommendation/verify.py --all
```

첫 명령은 고정 기존 회귀+추천 시험, 두 번째는 병행 작업의 최종 시험까지 포함합니다. fake DOM/합성 graph와 실제 loopback HTTP를 구분합니다. 실제 SDK/휴대폰/차량 실행을 뜻하지 않습니다.

실제 첫 지역은 사용자 지정 강남역입니다. 정차 허용 구역·진입/보행 입구·실제 경로 공급자·native 차량 위치가 검증되기 전에는 live를 켜지 않습니다. 세부 근거, 공급자 비용/제약, 검수 처리와 남은 항목은 `docs/PICKUP_RECOMMENDATION_2026-11-03.md`, `docs/PICKUP_GANGNAM_DATA_2026-11-03.md`에 있습니다.
