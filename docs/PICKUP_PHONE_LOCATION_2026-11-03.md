# 픽업 휴대폰 위치 일회 공유 · 2026-11-03 KST

로컬 서비스 구현과 합성 회귀시험 완료. 실제 휴대폰 HTTPS 연결·권한창·기기 위치 수신은 차단/미검증이며 완료로 표시하지 않는다. J-01 잠정 폐기 최신 지시 적용: 이번 작업은 픽업만 담당하며 J1 재개·변경 없음.

## 소유와 기준
- 작업자 Codex pickup-phone-location, 브랜치 codex/pickup-phone-location.
- 전용 worktree: C:/Users/dldyd/.codex/worktrees/pickup-phone-location/HYUNDAI_AI
- HEAD 기준 70cf2ae, 미커밋 최신 픽업 소스23개 별도 복사/원본-복사 SHA256 대조. baseline-hashes.json SHA256 A58631355A4C2CEB65E50972CD3B5230C9DD9346FAD80A244CF32191A71C9D3B.
- 공유 main 수정/commit/push/stash/reset 없음. 기존 문서 복사본은 작업 기준일 뿐 통째로 통합하지 않는다.
- 허용 파일: experiments/pickup-board의 phone-* 및 phone.html/css, server.mjs 라우팅/정리/UTF8, index.html 같은탭 링크. domain.mjs/app.mjs/style.css/Gleo/Android/차량근접/지도는 미수정.
- 변경9개 정확한 목록/해시는 work/pickup-phone-location/final-manifest.json. 원본 해시 재대조 후 생성한 integration.patch 적용 또는 수동 병합. server/index는 다른 기능 변경과 통합 담당이 병합한다.

## 사용자 흐름과 수용 결과
1. 기존 약속판에서 참여한 동일 탭의 /phone으로 이동. 기존 sessionStorage capability 재사용, 새 인증체계나 native bridge 없음.
2. 목적(만날 때 찾기), 수신자(현재 회차 운전자와 서비스), 필드/보관/삭제/거부 대안을 읽고 버튼을 눌러야 서버 grant 요청. 서버 동의 확인 전 geolocation 호출0.
3. 한 번만 수집. watchPosition을 취소 가능한 일회 수집에 사용하며 첫 fix에서 clearWatch. 다음 공유는 새 동의 필요. 자동 재전송·백그라운드 추적 없음.
4. 거부/철회/offline/hidden/pagehide/권한철회에 로컬 세대 무효화·watch해제. keepalive revoke를 보내지만 네트워크 실패나 페이지 종료시 원격 삭제 도착 보장은 하지 않는다. 실패 안내와30초조회만료를 표시.
5. 서버 board/end 처리에서 위치 즉시 제거. 원격 상태를 폰이 아는 시간은 polling/통신 지연에 의존하며 실시간 즉시 기기중단을 주장하지 않는다.
6. 최신1개만 메모리 보관, 조회30초 만료. 메모리 제거는 다음1초 sweep(이벤트루프 지연 가능). 철회 도착/탑승/종료는 동기 삭제. 원시위치 로그·디스크 저장·이력 없음. JS 메모리 보안 소거 보장은 아님.

## API/좌표 계약 (통합 제안)
- PhoneBoard extends 기존 Board, 별도 locations Map. 일반 room read/version/lastEvent에 위치를 넣지 않음. placeRevision 변경과 독립.
- GET /api/rooms/:id/phone: 같은 회차 driver/rider capability만 조회.
- POST 같은 경로: rider만 grant/publish/revoke. grant는 consentId UUID, consent pickup-location-once-v1, 현재 version/view. revoke는 version/view 없이 멱등; 늦은 grant 방지 tombstone을 회차 수명 동안 유지.100개 한도로 메모리 제한; 이후 grant429. 새 grant는 이전 grant/sample 대체.
- grant20초 단조시각 만료. publish 단1회; fix latitude[-90,90],longitude[-180,180],accuracy(0,100]m,observedAt,ageMs 유한숫자; ageMs[0,15000) 검증. client가 동의 이후 관측과 같은 기기시계 age를 검사. 기기와 서버 epoch 비교하지 않음.
- 응답 source='rider-phone', sample=null 또는 {latitude,longitude,accuracy,observedAt,receivedAt,ageMs,remainingMs,source}. observedAt는 기기보고 메타데이터, receivedAt는 서버 epoch; ageMs는 기기보고 age+서버 단조경과. 물리 위치 진실성/변조방지 attestation이 아니며 차량좌표로 취급 금지.
- 정확도100m/15초/20초/30초는 프로토타입 정책, 공인 요구/최적성 주장 아님. 지도 표시는 다른 담당 범위. 이 UI는 수신·정확도·신선도 상태만 표시.

## 공식 확인
Codex 직접 확인: https://www.w3.org/TR/2026/CRD-geolocation-20261030/ (2026-11-03 KST). 6.3 watchPosition / 6.4 clearWatch, 6.5 secure context·permission·visibility, 7 maximumAge/timeout/highAccuracy, 8 timestamp, 9 accuracy. 브라우저 위치는 호스팅 기기의 관측이며 실제 위치 보장/차량 SDK 대체 아님. 문서 확인과 실제기기 검증을 구분한다. Dot은 기존 탭 타세션 소유로 조사 전달 차단이라고 총괄이 알림; 우회·중복 대화 없음.

## 실제 실행
- Node v24.19.0, node --test experiments/pickup-board/*.test.mjs: 최종68/68 종료0 (기존49 + phone19). tests-final.txt.
- 기존49 기준시험: sandbox47통과/HTTP2 EACCES 실패, 승인된 loopback 실행에서49/49. 새60→63→65→66집합 모두통과.
- 새19는 실제 Board/domain 및 loopback HTTP, 주입한 fake geolocation/DOM/network이다. 실제 휴대폰·브라우저 native 권한 허용·실제좌표 수신 증거가 아니다.
- node --check phone-page.mjs/server.mjs 종료0. 첫 경로지정 실수로 공유main의 없는 phone-page 검사 MODULE_NOT_FOUND, 올바른 worktree에서 재실행 성공.
- 작성 도구 첫 cp949 읽기 오류: 시험파일 작성후 page수정만 실패, UTF8 명시로 수정. 재검수 준비 콘솔 checkmark 출력 cp949 오류:66시험/로그 정상, Claude호출 전 중단; ASCII출력으로 재실행. 실패 은폐 없음.
- 첫 worktree write는 sandbox AccessDenied; 별도 승인후 이 worktree에만 쓰기. 공유 소스는 보존.

## Claude 검수 처리
Opus5.5 설계: plan-raw.json 실제 modelUsage/exit0. 클라이언트 UUID, 회차수명 tombstone, revoke 독립권한/keepalive, 첫fix 해제/15초시간상한, 별도 위치 map, single grant, stale표시 제거 채택.
Haiku5.5 검수: d5a3af2e-d3d1-443e-99c8-fe415ae8ac9e exit0/is_error=false. P0없음. P1 실제폰HTTPS 미도달은 알려진 차단으로 유지(Host검사 완화없음), P1 시계차는 ageMs/단조TTL로 수정. P2 stop후재표시 suppressSample, GET2초제한, Buffer.concat UTF8,4xx오류구분,100회429/문구 반영. 기존 Board wall-clock view는 공통범위라 미반영·총괄 인계; 위치grant는 음수age 거부. 모바일 권한창 hidden 동작은 실기기미검증. 총괄 지적 30초보관문구/종료상태/늦은GET도 반영 및 회귀 추가.
최종 재검수는 followup-raw.json 및 별도 결과 기록을 확인한다. 검수 모델의 미실행시험을 실행증거로 사용하지 않는다.

## 통합 실행 절차와 남은 한계
다른서버 점유없이 통합 checkout에서 PICKUP_PORT=4193 등 빈 loopback 포트로 node experiments/pickup-board/server.mjs 실행. 기존 두역할 회차 참여 후 같은탭 /phone. 동의 없이 수집없음·거부·수동 흐름·종료를 확인. 합성 위치 테스트는 node --test로 분리. 실제 위치 permission을 자동 허용하거나 실제 좌표를 캡처/로그하지 않는다.
실제 폰 접근은 기존127.0.0.1 Host/Origin만 허용하는 서버와 LAN HTTP secure-context 문제로 차단. HTTPS/운영주소/배포는 구현하지 않았고 계정/tunnel/키/권한 변경 없음. Android WebView geolocation/native권한도 미구현. 운영용 기기연결·인증/규정검토는 별도 범위.
이 채팅의 실제 browser UI 실행/시각검사는 미실행이며 총괄이 통합본 실행을 담당. 모든 기능완료/실기기연동완료로 확대하지 않는다.
총괄 상태메시지 추가전송은 자동 승인 정책 approval policy is never로 거절되어 전달완료 처리하지 않았다. 기존 전달분/최종 보고를 통해 인계한다.

## 최종 재검수와 편집 종료
Haiku5.5 재검수 de4343d6-3208-4e13-ae87-99bfcf5bc876 종료0/is_error=false/modelUsage 확인. 수정사항의 합성 범위 동작 인정, 새P0없음. 남은 지적 처리:
- P1 운전자 표시 미확인: 별도 driver앱이 아닌 동일 phone-page.mjs의 role별 UI이며 refresh가 두 역할 모두 GET /phone 조회. 실제 HTTP driver수신 시험 + fakeDOM driver 수신/20m표시 assertion 추가. 실제브라우저/실폰은 여전히 미검증; 총괄 통합 실행 대상.
- P1 ageMs 신뢰: 위치 원본 자체가 참여자 기기 self-report이며 attestation 없음. 실제위치·도착 증명에 쓰지 않는 계약/한계로 유지. 서버 clock 비교로 바꾸면 잘못된 시계차거부가 재발하므로 미반영.
- P2 grant429/409 안내: 명시 한도/새상태 확인 문구와 수집0 회귀 추가.
- P2 unmatched revoke cap: 지적의 unmatched tombstone 제거안은 revoke-before-grant 부활을 허용하므로 미반영. 인증된 rider 자신의 회차 공유를100ID로 소진시킬 수 있으나 다른 회차/driver 권한은 불가; bounded fail-closed 정책 유지. 해당 cap시험 존재.
- P2 413연결: Connection: close 추가.
- 신규동의 후 suppression 해제·자동복구없음 시험 추가. 최종68/68 통과. 마지막 작은 수정은 Codex가 검수 지적에 따라 처리·재검증했으며 세 번째 Claude호출은 하지 않음.
- git diff --check는 sandbox에서 worktree인식 오류로 실패; 소스시험/정적구문 검사와 별도patch검증을 근거로 사용.
최종 통합 대상은9개 소스/시험 파일과 이 보고서, work/pickup-phone-location의 patch/manifest/tests/Claude 증거. 복사된 기존 공통 문서나 다른 실험은 통합대상 아님. 이 담당의 파일 편집 종료. 총괄이 통합·실행 확인을 진행하며 실기기 차단을 완료로 표시하지 않는다.
