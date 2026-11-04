# routo 연결 준비

2026-11-04. 키 수신 전 구현한 **연결 모듈**이다. 실제 routo 요청·SDK 지도 표시 성공이 아니다. 기존 `/map`과 메인 화면은 수정하지 않았다. 지도 담당의 현재 OSM 판정/회차 생성·제안·수락 처리를 대체하지 않는다.

## 구성

- `search-provider.mjs`: 서버 전용 REST 검색, 고정 HTTPS endpoint, 검색어·좌표 검사, 5초 제한, 취소, redirect 거부, 응답 크기 제한, 오류 내용 비노출.
- `contracts.mjs`: 중심/차량안내/보행안내 좌표 분리. 내부는 `{latitude, longitude}`, MapBoard 전달은 `[longitude, latitude]`.
- `map-adapter.mjs`: 브라우저 SDK 로딩/오류/취소, 지도 클릭→핀, 리스너 정리. 클릭 방식이며 drag 이벤트는 미확인이라 사용하지 않는다. SDK Map 전체 destroy 계약은 미확보; dispose 뒤 호스트가 전용 컨테이너를 제거한다.
- `selection-controller.mjs`: 검색 세대 관리, 이전 응답 무시, 검색결과 선택은 화면 이동만, 핀 이동 재검사, 확인 유효시간 최대5초, 취소·해제. 확인된 좌표도 실제 쓰기 전에 서버가 다시 검사해야 한다.
- `connect.mjs`: REST 검색→결과 선택→SDK 지도 클릭→주입된 지점 검사→명시 확인까지 묶은 진입점.
- `server.mjs`: 기존 서버에 삽입 가능한 `createRoutoRoutes`와 별도 loopback 준비 서버. 상태/검색만 제공하며 회차 생성·데이터 영속 저장은 하지 않는다.

## 키 없이 실행

```powershell
node experiments/pickup-board/routo/server.mjs
node --test experiments/pickup-board/routo.test.mjs
```

`http://127.0.0.1:4194/api/routo/status` → `ready:false, reason:KEY_MISSING`.
`POST /api/routo/search`의 JSON은 `{ "query": "검색어", "near": {"latitude":37,"longitude":127} }`. near는 선택 사항. 준비 서버는 로컬 Host/Origin 검사를 적용한다. 연결된 검색어·좌표를 로그에 출력하지 않는다. 공개 서버로 사용하지 않는다.

## 발급 후 설정

서버 프로세스 환경에 `ROUTO_REST_API_KEY`를 주입한다. 저장소/브라우저/채팅에 REST 비밀키를 넣지 않는다. 이용 조건 확인이 끝났을 때만 `ROUTO_USAGE_APPROVED=true`로 실제 요청을 활성화한다. 새 키 발급·계정 변경·실제 호출은 이번 작업에서 수행하지 않았다.

지도는 **브라우저 노출이 허용된 지도용 키**를 `connectRoutoPicker`의 `browserKey`로 별도 주입한다. REST 키를 자동 재사용하거나 클라이언트 config API로 반환하지 않는다. 발급 유형/도메인 제한을 공급자 답변과 맞춘다. 키가 같아도 되는지는 추정하지 않는다.

공식 SDK 로더는 `https://api.routo.com/v2/maps/map?key=...`. 호스트의 CSP에서 이 script origin과 실제 실행 시 확인된 지도 asset origin만 허용해야 한다. 현재 앱 CSP를 임의 확대하지 않았다. 실제 SDK가 사용하는 추가 자원·라이선스 고지와 화면 정상표시는 키 받은 뒤 확인해야 한다.

## 기존 앱 통합 지점

서버: `createRoutoRoutes(createRoutoSearch(...))`를 한 번 생성. 기존 Origin/JSON 검사 뒤 `await dispatch({path, method:req.method, body, signal})` 결과가 undefined가 아니면 reply(200, result). `RoutoError`의 status/code/message만 응답하고 raw 오류/요청 URL은 기록하지 않는다. 준비 서버 코드를 참조. 배포 시 기존 인증·요청량 제어를 적용한다.

브라우저:

```js
const lifetime = new AbortController();
const picker = await connectRoutoPicker({
  elementId: 'routo-map', browserKey: approvedBrowserKey, usageApproved: true,
  center: { latitude: 37.463, longitude: 127.043 },
  signal: lifetime.signal,
  checkPoint: async (point, {signal}) => {
    // 기존 /api/map/check를 호출하되 현재 지역·데이터 유효기간을 확인한다.
    const result = await checkCurrentMapPoint(point, signal);
    return {...result, validForMs: Math.min(5000, result.remainingDataValidityMs)};
  },
  onChange: renderPickerState,
  onMapError: showMapError
});
await picker.search(query);
picker.selectResult(currentResultId); // 지도 중심 이동; 확정 아님
const draft = picker.confirm(); // 사용자의 확인 버튼에서만 호출
// draft = {point:[lon,lat], provenance:{searchProvider:'routo',anchorProviderId,anchorCenter,derivedFromSearch:true,coordinateSource:'user-pin-on-routo-map'}, validation:{confirmedAt,remainingMs,requiresServerRevalidation:true}}
// 이 시점 이후는 호스트가 서버 재검증→생성/제안→상대 수락 흐름을 수행한다.
// pagehide/화면 종료: lifetime.abort(); picker.dispose(); 전용 컨테이너 제거
```

예시의 checkCurrentMapPoint/renderPickerState/showMapError는 **호스트 주입 함수**이며 SDK 심볼이 아니다. 현재 OSM 검사는 양재 범위에 한정된다. routo 검색을 전국에서 할 수 있다고 다른 지역 핀까지 허용하지 않는다. 범위 밖/만료/금지/검사 실패는 confirm 차단을 유지한다.

현재 MapBoard는 좌표를 다시 검사하지만 routo 출처 메타데이터를 저장하는 계약은 아직 없다. 공급자 답변으로 저장·양측 공유 허용이 확인된 뒤 `draft.provenance`를 서버가 검증·보존하도록 통합한다. 기존 생성 API에 임의 필드로 보내고 무시되도록 하지 않는다. 이 준비 모듈은 자동 생성/자동 안내 시작을 하지 않는다.

## 최초 실연동 확인

1. 승인된 키/요금·사용 범위, 브라우저 도메인 제한과 SDK 버전 확인.
2. 알려진 장소를 검색해 이름/주소 및 중심·차량안내·보행안내 좌표 분리 확인.
3. 지도 표시/키 거부/네트워크·CSP 오류, 표시 좌표와 클릭 좌표 왕복 확인. 문서 LatLng 일부 설명의 위경도 표기가 뒤집혀 있어 예제 및 실제 지점 대조 필수.
4. 장소 변경·빠른 재검색·핀 재이동 때 이전 응답이 확정에 쓰이지 않는지 확인.
5. 정차/접근/데이터 유효성 검사를 서버에서 재실행하고 양측 합의 흐름에 연결.
6. 새 API·CSP·키 설정은 해당 환경에서 실행 검증 후에만 완료 표시.

## 근거와 검증 범위

- REST 1.4.2.RELEASE: https://api.routo.com/docs/index.html — `/v1/places/findplacefromtext`, key/input/location/size, status/total/result, center/guide/walkingGuide 확인.
- SDK: https://www.routo.com/developers/web_js/start.html 및 https://www.routo.com/developers/web_js/document.html — Map/LatLng/Marker, click/latLng, setCenter/setPosition/setMap, MapsEventListener.remove 확인.
- 테스트는 합성 응답/주입 fake SDK와 실제 loopback HTTP를 사용한다. 실제 routo 키·네트워크 응답·차량 SDK·브라우저 지도 렌더링 검증은 미실행이다.

검수 보완: 검색 기준 POI ID/중심은 `anchorProviderId/anchorCenter`로만 기록하고 실제 핀과 동일한 POI라고 주장하지 않는다. 확인 결과의 `validation` 시간은 클라이언트 참고용이며 서버 권한·유효성 근거가 아니다. 쓰기 시 서버에서 별도 최신 검사를 수행해야 한다. UI `review`는 타이머/스냅샷에서 자동 만료된다. 렌더 콜백 오류는 내부 선택 상태나 Promise를 깨뜨리지 않는다. 제목/주소는 외부 데이터이므로 호스트는 `textContent`로만 렌더링하고 HTML로 삽입하지 않는다.

SDK 스크립트는 페이지/window당 한 번만 로드한다. 키 변경·로딩 실패 후 재시도는 페이지를 새로 열어 수행한다. 동일 컨테이너에서 Map을 반복 생성하지 않는다. 실제 SDK의 전체 지도 해제 계약을 확보하기 전에는 라우트 전환 시 해당 페이지를 종료한다. 한 검색 응답의 좌표 필드가 손상되면 전체 검색 실패로 처리하는 보수적 정책을 유지한다. (0,0)은 유효한 지구 좌표이므로 공급자가 결측치라고 규정하지 않은 상태에서 임의 차단하지 않는다. 지역 밖 핀의 허용 여부는 별도 checkPoint가 판단한다.
