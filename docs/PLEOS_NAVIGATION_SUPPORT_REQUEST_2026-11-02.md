# Pleos 내비 모의주행 문의 초안

상태: 공개 게시 미실행. 게시 후보: https://github.com/Pleos-Playground/pleos-playground-api/discussions/29 의 후속 댓글. 아래 본문만 게시 대상으로 하며 로컬 로그·경로·파일은 첨부하지 않는다.

## 게시할 본문

동일한 모의주행 방법이 필요하여 재현 결과와 함께 문의드립니다. Pleos 에뮬레이터에서 내비의 현재 위치, 남은 거리, 남은 시간을 연속 갱신하는 공식 절차를 확인하고 싶습니다.

- Windows / Pleos Connect Emulator 2.1.0, Android API 34 / Android Emulator 37.2.13
- FusedLocation SDK 1.1.3, 서비스 1.0.0
- NaviHelper SDK 3.0.5, 서비스 3.0.4
- 내비 앱 3.3.2-rc5-hotfix.3

2026년 11월 2일 수행한 시험의 재현 과정(이 문의 작성 중 새로 실행한 결과는 아닙니다):
1. 에뮬레이터 내비 UI에서 목적지를 선택해 실제 경로 안내를 시작했습니다.
2. 내비 화면을 전면에 유지하고 별도 foreground 진단 서비스에서 NaviHelper의 getCurrentLocationInfo, getDestinationInfo, getRouteStateInfo 및 DrivingInfo 콜백을 관찰했습니다.
3. adb emu geo fix로 합성 좌표를 이동시키면 FusedLocation에는 이동이 반영됩니다. 하지만 내비 위치와 남은 시간은 변하지 않았습니다.
4. 내비 GpsLocationSource의 NMEA checksum mismatch 로그가 있어 올바른 XOR 체크섬의 GGA/RMC도 입력했습니다. Android NMEA 리스너의 수신은 확인했지만 내비 갱신은 확인하지 못했습니다. 이 체크섬 문제가 유일한 원인이라는 뜻은 아닙니다.

최종 활성 안내 시험은 ROUTE_GUIDING, 내비 위치 조회 34회 중 변화 0회, remainTime 1080초 / remainDistance 12000m로 고정되었습니다. isRouting은 활성 안내 중에도 false였으므로 이 값만으로 비활성이라고 판정하지 않았습니다. 재부팅 직후 SAFE_GUIDING 시험은 활성 경로 결과에서 제외했습니다. 콘솔의 OK 응답은 내비의 입력 수용을 입증하지 않습니다.

확인 부탁드리는 사항:
1. SIMULATION_GUIDING으로 진입하거나 출발부터 도착까지 경로를 재생할 수 있는 공식 UI/API/샘플이 있나요?
2. 내비가 사용하는 위치 공급원과 지원되는 모의 위치 입력 방식은 무엇인가요? geo fix/geo nmea가 지원 대상인가요?
3. 위 버전 조합에서 가능한지, 별도 호환 이미지나 설정이 필요한지 확인 부탁드립니다.

실차가 아닌 에뮬레이터에서 합성 입력으로 시험했습니다. 모의주행이 지원되지 않는 경우 지원 범위도 알려주시면 감사하겠습니다.

## 내부 검증과 재개 조건 — 게시 본문에서 제외

- 근거: evidence/pleos-navi-drive-result-2026-11-02.json 및 final-runtime, 입력 json. 새 실행 결과가 아닌 이전 실행의 재현 보고.
- 보완 근거: evidence/pleos-movement-result-2026-11-02.json의 Fused 합성 입력 매칭, evidence/pleos-probe-result-2026-11-02.json의 환경 버전, final-runtime의 DRIVING/ROUTE 응답. 환경 설명은 experiments/pleos-probe/README.md도 대조한다.
- J1 실제 SDK bridge는 여섯 상태 필드만 허용하며 ETA 필드를 거부한다. 현재 ETA 추천 연동은 없다. 새로운 ETA gate를 연결했다고 표현하지 않는다.
- 같은 ETA 값이 반복되는 것과 오래된 관측은 별개다. 수신 시각만으로 관측 신선도를 보증하지 않는다.
- 공식 절차 확보 뒤: 활성 안내 확인 → 합성 이동 → 내비 좌표/거리/남은 시간의 시계열 대조 → 종료/경로 변경/단절 검증. 도착예정 시각은 이동 중 일정할 수도 있으므로 무조건 감소를 성공 조건으로 삼지 않는다.
- 실차·ETA 정확도·모의주행 성공은 미검증 상태 유지.
