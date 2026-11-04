# OSM 지도 데이터 검색 연결 · 2026-11-04

사용자 요청: 실제 검색 연동. 추가 확인: routo 키 발급 전이며 현재 사용 중인 지도 기반 사용.

## 구현과 범위
- 기존 OpenStreetMap 양재 데이터 1,327개 지형 중 이름/주소가 있고 범위 안에 있는 항목 검색. 시연 장소 하드코딩 검색을 제거했다. 이름/별칭/주소의 공백·문장부호 정규화, 최대20결과, 근접 동일 이름 중복 억제.
- POST /api/map/search {query} → 실제 source id/name/address/kind/point. GET /api/map?place=sourceId → 해당 장소를 기준으로 최대3개 주변 후보. /map?place=sourceId로 직접 지도 이동.
- 검색 장소 좌표는 지도 대표점이다. 승차 지점이나 출입구 인증이 아니다. 비점 지형의 대표점은 지형 내부/경계 또는 선 위로 보정한다. 사용자가 후보/핀을 명시 선택하고 기존 서버 판정을 거쳐 생성한다.
- 검색 결과와 지도 툴팁은 textContent로 렌더링. 검색어 변경/빠른 결과 선택의 이전 응답 무시. 지도 데이터7일 만료 시 검색503, 후보 없음, 기존 서버지점검사 유지.
- 전국/실시간 외부 검색이 아니다. routo 키, Nominatim 외부 검색 요청, 계정/키/CSP변경 없음. 배경 OSM 타일은 기존 동작 유지.

## 실행 증거
- node --test experiments/pickup-board/*.test.mjs: 246 pass / 0 fail (당시 다른 담당 다인 시험 포함). work/pickgo-osm-search/tests.txt.
- 마지막 시간 고정 시험 보완 후 node --test experiments/pickup-board/map-search.test.mjs experiments/pickup-board/main-selection.test.mjs: 12 pass / 0 fail. final-focused.txt.
- 별도 headless Chrome1440/390: 실제 하나로마트 검색5결과 → 해당 장소 후보 → desktop 실제 room생성 / mobile 해당 장소 지도+타일 표시. 최종 P2보완 후 재실행 통과. browser.txt, search-1440.png/search-390.png/map-390.png.
- 새 localhost4195 서버 PID17452에서 POST 검색 실응답5개 확인(live-4195.json). 최초 PowerShell 검증은 Content-Type charset 부가로 기존 엄격 JSON검사415; 앱과 같은 application/json으로 재검증200.
- 기존4180 서버는 소유 미확인,4194는 사용자확인용 내비회차 유지 요청으로 재시작하지 않았다. 기존 메모리회차 보존. 4194에 신API를 적용하려면 회차 소멸을 고려한 별도 재시작 필요; 담당01a1a664/01a1a679 전달.

## 독립 검수
Claude Haiku5.5 실제2회 읽기검수. b630ee9a-f4fb-4230-945c-f6db9b70ee05 / 5f389208-953f-483f-bf98-a5b0670e9328. 입력/원문/응답 work/pickgo-osm-search/review-* 및 followup-*.
- 1차 P1없음, P2 tooltip HTML/대표점 bbox/검색만료3건 모두 보완 및 회귀.
- 2차 시간의존 시험 지적 수용, test Date.now 고정(운영시간 규칙은 유지).
- 2차 거리단위 지적은 근거상 미반영: geometry.nearest.distance는 도(degree)가 아니라 metre이며 0.01은1cm. inside는 경계0.05m를 true로 명시 처리해 ray casting 경계우연이라는 지적도 해당없음.
- holes: 대표점은 구멍 안일 경우 외곽경계로 이동하여 객체경계에 위치. 가장 가까운 출입구를 약속하지 않으므로 별도 홀경계 최단선택은 이번 범위 미반영.
- 7일 상수는 기존 정책 유지. 서버 mapModel.check의 범위/만료 재검사 기존시험 통과. Leaflet1.9.4 HTMLElement 툴팁은 실제 브라우저 통과.
- 2차 응답 저장 성공 및 is_error=false. 실행 래퍼는 저장 후 콘솔 cp949가 ≈ 문자를 출력하지 못해 exit1; 모델 검수 실패와 구분한다.

## 변경 파일과 협업
app.mjs/index.html/style.css/server.mjs/map/page.mjs/map/page.html/main-selection.test.mjs 및 신규 map/search.mjs/map-search.test.mjs. 이전 다수 미커밋 및 다른 담당 /multi 삽입 보존. 메인 후보 담당01a1a65c와 다인담당01a1a696 소유 반환 확인 후 편집. 기기조작/4194재시작 없음. Dot 공식자료 새과제 없음. commit/push 없음.
