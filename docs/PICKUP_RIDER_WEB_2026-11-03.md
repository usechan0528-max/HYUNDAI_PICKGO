# 설치·가입 없는 탑승자 웹

## 범위와 승인

사용자의 “이 방향으로 개발 진행해줘”, “권장 방식으로 개발 시작해”에 따라 차량 앱 + 탑승자 웹 방향을 구현한다. 이 변경은 기존 로컬 웹/차량 WebView 검토 하네스의 초대 흐름을 개선한다. 실제 차량 앱 본연동·공개 HTTPS 배포·물리 휴대폰 시험 완료를 뜻하지 않는다. main의 기존 미커밋 변경을 보존한다.

탑승자 흐름: 초대 링크 → 명시 참여 → 준비 알림 → 장소 목록에서 직접 제안/상대 수락 → 선택적 현재 위치 1회 공유 → 수동 탑승 확인. 기존 합성 장소 3개를 사용하며 실제 지도에서 핀을 선택하는 기능은 아니다. 별도 추천 담당의 recommendation/**와 추천 링크는 보존한다. 연속 위치 추천 동의는 해당 별도 기능이며 이 일회 공유 동의를 확장하지 않는다.

## 구현

- app.mjs/index.html: 링크 복사와 직접 복사 대안, 설치/가입 불필요 안내, 참여 전 새로고침 복원, 기존 탑승자 원래 링크 재열기, 운전자 자기 초대 참여 차단. 다른 회차 참여 시 기존 탭 접근 정보 손실을 명시한다.
- 초대는 URL fragment로 받고 브라우저 세션에 보존한 뒤 주소에서 제거한다. 링크 열기만으로 참여하거나 위치 권한을 요청하지 않는다. 참여 버튼은 저장 가능한 재시도 UUID를 확인한 뒤 전송한다.
- domain.mjs/server.mjs: 초대를 소비한 동일 invite+joinId 요청은 5분 내 같은 탑승자 권한으로 재시도할 수 있다. 다른 nonce/초대, 만료·종료는 거부한다. receipt는 공개 조회/이력에 노출하지 않으며 5분 또는 종료 때 제거한다. 기존 join(id,invite)도 지원한다.
- notice는 폴링 오류 영역과 분리해 저장 제한 안내가 사라지지 않는다. 참여 후 탭을 닫으면 세션 복구를 보장하지 않는다. 다른 브라우저로 역할이 자동 이전되지 않는다.
- phone.html: 메신저 내장 브라우저에서 기능이 지원되지 않을 때 기본 브라우저 사용 안내. 이미 참여한 경우 현재 탭 유지 및 이전 불가를 알린다. 위치 수집/철회/30초 만료 계약은 기존 구현 그대로다.
- web-origin.mjs: HTTPS origin만 명시적으로 허용, Host/Origin 정확 비교, X-Forwarded-* 무시. 옵션 미지정은 기존 loopback 전용이며 앱 프로세스는 계속 127.0.0.1에 바인딩한다.

## 로컬 실행과 배포 준비

`node experiments/pickup-board/server.mjs` → http://127.0.0.1:4180 . 이 링크는 다른 휴대폰에서 접속할 수 없다. 이번 검증 서버는 별도 4188을 사용했다.

승인된 HTTPS 프록시가 있을 때만 환경변수 `PICKUP_PUBLIC_ORIGIN=https://승인된호스트`를 설정한다. 이 변수만으로 TLS, DNS, 인증서나 외부 접속이 생기지 않는다. 프록시가 요청 Host를 그대로 전달해야 한다. `deployment/nginx.conf.example`는 검토용 예시이며 설치·실행·인증서 생성하지 않았다. HTTPS 인증서, HSTS, 요청 크기 제한, 생성/참여 IP별 속도 제한을 준비해야 한다. 단일 클라이언트가 메모리 회차100개 상한을 채우는 운영 위험이 있어 **이 예시만으로 공개 서비스 준비 완료로 취급하지 않는다**. 지속 저장·분산 부하·운영 남용 대응은 별도 검증 대상이다.

공개 배포는 DEVELOPMENT_GUIDE.md 11절에 따라 대상/내용 별도 승인이 필요하다. 현재 외부 서버/도메인/계정/키를 만들거나 네트워크 권한을 바꾸지 않았다.

## 근거

2026-11-03 KST 직접 원문 확인: [W3C Geolocation CRD 2026-10-30](https://www.w3.org/TR/2026/CRD-geolocation-20261030/), [MDN Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), [sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage), [Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText). HTTPS/권한/문서 가시성 및 세션 저장·클립보드 조건을 확인했다. 각 OS·메신저의 실제 지원을 보장하는 자료가 아니다.

Dot 조율 WEB-R001: DOTS 담당이 기존 보고에 해당 자료 없음을 회신했고 기존 Codex W3C 근거를 재사용했다. Dot 탭 점유로 신규 Dot 전달은 하지 않았으며 보고 대기로 등록하지 않았다. Codex가 직접 원문 대조 후 같은 실행에서 종료·대기 전달했다.

## 검증 및 검수

실행: `node --test experiments/pickup-board/*.test.mjs` 종료0, 165/165 통과. 동시 추천 담당의 시험도 포함한 해당 시점 전체 결과이며 추천 기능의 완료 판정은 해당 담당의 별도 보고를 따른다. 이번 기능의 고정 시험 `node --test experiments/pickup-board/web-invite.test.mjs experiments/pickup-board/web-http.test.mjs experiments/pickup-board/web-origin.test.mjs`는 16/16, 종료0. app/server/domain `node --check` 종료0. 초기 fake sessionStorage가 모든 키에 같은 값을 반환하던 시험9개 실패는 키별 저장소 mock으로 교정했으며 실제 초대 복원 시험을 추가했다.

실제 HTTP: 설정된 HTTPS Host/Origin을 loopback에서 주입해 독립 역할 참여·장소수락·준비·도착·탑승·종료 및 외부 Origin/위조 forwarded Host 거부. 실제 TLS 연결 시험은 아니다. 기본 RecommendationBoard→PhoneBoard 상속과 /phone grant/publish/read/revoke 정상 계약은 합성 좌표로 실제 HTTP 검증했다. 재참여 nonce는 같은 값5분/다른 값/이미 소비/종료/TTL 경계를 검사했다. 위치 거부·만료·철회 관련 기존 시험도 통과했다.

실제 Chrome 4188: 초대 전 새로고침→명시참여→위치 동의 거부→준비 동기화→직접 장소제안/운전자수락→도착/탑승, 서버 단절 잠금·재시작 소실회차 안내 확인. 보완 후 재시작한 서버에서 운전자 자기 초대 차단/닫기 후 운전자 역할 복원, 초대 전 새로고침/탑승자 참여/원래 링크 다시 열기/준비/도착/탑승/완료를 재확인했다. 브라우저 위치 권한은 허용하지 않고 실제 위치는 수집하지 않았다. clipboard 자동 복사 성공은 확정하지 않았으며 대기·거부에서도 수동 주소 복사 대안을 노출한다. 좁은 viewport 요청390×844의 실제 DOM 폭은520으로 관측되어 390px 검증으로 보고하지 않는다. 실제 폭520에서 scrollWidth520, 표시 버튼높이76px 확인. 물리 휴대폰/메신저/TLS/차량SDK·실차 미검증.

Claude Haiku5.5 읽기 검수 5e70db74-5072-4c40-9a64-de119bf85824, 재검수 2b9c25c3-eb80-41b4-9668-45e8cf6c177b 모두 종료0/is_error=false/modelUsage 확인. 검수는 tools 비활성 고정 텍스트 입력이며 실제 파일 수정이나 테스트 실행을 위임하지 않았다. 재검수 응답의 Write/ExitPlanMode 표기는 모델 출력 텍스트일 뿐 실행된 도구 호출이 아니다.

지적 처리:
- 저장 가능성 확인 전 초대 소비(P1): nonce 쓰기/읽기 확인 후 POST, 저장 거부 시 요청0으로 수정·시험.
- 폴링이 저장 경고 삭제(P1): 별도 notice로 분리, 폴링 유지 시험.
- PhoneBoard 상속 미확인(P1): 실제 소스 상속 확인 및 기본 서버 HTTP 위치 시험으로 해소.
- 공개 모드 회차100개 남용(P1 운영 게이트): 공개하지 않았고 미해결 운영 배포 차단으로 유지. nginx 속도제한 예시는 준비물이며 운영 보호 검증 완료가 아니다.
- 자기 초대/다른 회차 접근 소실(P2): 자기 초대 차단, 다른 회차 접근 손실 문구 명시.
- 응답 유실(P2): 동일 invite+nonce 5분 재시도, 소비된 링크 다른 nonce 거부.
- 재검수 P2: 최종 저장 실패 후5분 한계 문구·시험, 불명확 참여를 닫을 때 복구 포기 확인 추가·시험.
- stale 초대 숨김(P2 제안)은 기존 최신상태 안전 계약을 유지한다. 이미 복사된 클립보드 값을 지우지 않으므로 앱 전환 자체가 복사 내용을 잃게 하지는 않는다.
- 이후 Codex 한정 수정: fragment-only 재초대 시 reload, Clipboard 응답 대기에도 직접복사 주소 표시 및 늦은 완료 콜백의 소비된 링크 재표시 방지. Node 회귀·브라우저 원래링크 재열기로 확인; 이 작은 후속 수정 자체의 3차 Claude 검수는 하지 않았다.

증거: docs/evidence/pickup-web-{review,followup}-*, pickup-web-tests-{final,focused}.txt, pickup-web-final-manifest.json 및 pickup-web-rider.png. 이번 작업에서는 commit/push, 외부배포, 계정/권한/서명키 변경 및 새로운 APK 빌드를 하지 않았다.

최종 Chrome 양측 픽업 완료 화면 확인 후 viewport override를 해제했고 pickup-web-completed.png에 최종 화면을 보존했다. 4188 로컬 검증 서버는 시연용으로 유지한다. 전체 작업트리 git diff --check는 공통문서/기존 변경에서 trailing whitespace를 보고했으며 통과로 기록하지 않는다. 다른 작업자의 문서를 일괄 정리하지 않았다.
