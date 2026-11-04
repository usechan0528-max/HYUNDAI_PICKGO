# 지도·장소 검색·주소 변환 검토

담당 채팅 01a19cfa-9a42-70d3-97f8-43083776d054 최종 보고 수신본. 통합 담당은 Kakao 151176 저장 제한, 149943 타사 API 혼용, Pleos destinations 원문을 직접 대조했다. 공급자 선정·계약·실연동 승인이 아니다.

**지도 검토를 마쳤습니다. 별도 지도 서비스는 필요하지만, 공급자 확정과 본연동은 보류하는 것이 권장안입니다.** 기술 비교·인터페이스 제안·Claude 독립 비평을 총괄 채팅에 전달했습니다. 확인일은 2026년 11월 3일입니다.

| 항목 | Pleos | 카카오 | 네이버 |
|---|---|---|---|
| 지도 표시 | 내비 화면 요청 확인. 앱 내 지도 컴포넌트는 미확인 | 웹·Android·iOS 제공 | 웹·Android·iOS 제공 |
| 장소 검색 | 일반 POI 검색 미확인 | 키워드·카테고리 검색 | 별도 지역 검색 API 필요 |
| 주소↔좌표 | 일반 변환 API 미확인 | 정·역 지오코딩 제공 | 정·역 지오코딩 제공 |
| 차량 적용 | 내장 내비와 연동 | Pleos 호환·탑재 허용 미확인 | Pleos 호환·탑재 허용 미확인 |

Pleos `NaviHelper`는 목적지·경유지·경로 요청을 내장 내비로 전달합니다. `requestRoute()` 호출 성공과 경로 탐색 완료도 구분해야 합니다. 따라서 휴대폰에서 장소를 검색하고 약속 지점을 합의하는 기능까지 Pleos만으로 해결된다고 볼 근거는 확보하지 못했습니다. [Pleos 소개](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/intro), [목적지 계약](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/destinations)

**가장 중요한 제약은 장소 데이터 저장입니다.**

- 카카오 운영자 답변은 사용자가 선택한 검색 결과라도 **응답 주소·좌표의 저장 사용을 불허**합니다. 직접 입력한 명칭·주소와 구별합니다. ID·URL 및 특정 사용자가 확정한 명칭을 허용한 별도 사례도 있지만, 이를 좌표 저장 허용으로 확대할 수 없습니다. [저장 제한](https://devtalk.kakao.com/t/api-b2b/151176), [제한된 허용 사례](https://devtalk.kakao.com/t/api/150888)
- 타사 API와의 혼용 자체는 제한하지 않는다는 답변이 있습니다. 이는 차량 탑재나 데이터 보관 허용과는 별개입니다. [혼용 안내](https://devtalk.kakao.com/t/local-api-sdk/149943)
- 네이버의 현행 Maps 약관 본문은 이번 도구에서 확보하지 못했습니다. 저장·오프라인 사용이 허용된다고 판단하지 않았습니다. [현행 약관 페이지](https://www.ncloud.com/policy/terms/maps)

카카오는 필요한 기능을 한 공급자에서 구성할 수 있는 **기술 후보**, 네이버는 **추가 검토 후보**입니다. 네이버 지역 검색은 문서상 결과 최대 5개·시작 위치 1 제한이 있습니다. 양쪽 모두 국내 주소·장소 기능은 확인했지만, 실제 픽업 입구와 한국 장소 검색 품질의 우열은 시험하지 않았습니다. [카카오 API](https://developers.kakao.com/docs/ko/local/dev-guide), [네이버 Maps](https://api.ncloud-docs.com/docs/application-maps-overview), [네이버 지역 검색](https://developers.naver.com/docs/serviceapi/search/local/local.md)

비용도 계정 조건을 확인해야 합니다.

| 공급자 | 공개 요금·쿼터 핵심 |
|---|---|
| 카카오 | 추가 사용 기준 지도 0.1원/건, 장소 검색 2원/건, 주소 변환 0.5원/건. 무료는 개발자 계정의 첫 활성 앱에만 적용 |
| 네이버 신규 Maps | 동적 지도 0.1원/건, 주소 변환 0.5원/건. 대표 계정의 월 무료량 조건 적용 |
| 네이버 구형 AI NAVER API | 지도 무료량은 2025년 7월 종료. 신규 Maps와 구분 필요 |

실제 계정 적용 여부·예산은 확인하지 않았습니다. [카카오 쿼터](https://developers.kakao.com/docs/ko/getting-started/quota), [네이버 요금](https://www.ncloud.com/charge/price/ko), [상품 전환 공지](https://www.ncloud.com/support/notice/all/1965?page=2)

통합 인터페이스는 다음처럼 제안했습니다.

- 검색 결과와 확정 약속 지점을 분리합니다. 공급자 좌표를 곧바로 영구 저장하지 않습니다.
- 좌표는 `{lat, lon, crs: "WGS84"}`로 명시하고, 건물 중심·입구·사용자 핀을 구분합니다.
- 장소 수락 시 `placeId/revision`을 원자적으로 바꾸고 이전 근접 판정을 무효화합니다.
- 검색·장소 수락으로 도착·탑승·내비 경로를 자동 변경하지 않습니다.
- REST 비밀키는 서버에 두고, 공개 SDK 키는 도메인·앱 제한을 적용합니다. 서버에는 회차 권한·요청 제한·일일 상한을 둡니다.
- 오프라인 지도나 공급자 결과 재사용은 약속하지 않습니다. 주행 중 검색·복잡한 지도 조작은 플랫폼 UX 제한에 따릅니다. [Pleos 주행 제한](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide)

실제 **Claude Opus 5.5** 검수에서 저장 모델·차량 이용 범위·대안의 미검증 문제가 지적되어 위 제안에 반영했습니다. 최초 DNS 실패 후 재시도는 종료 코드 0으로 완료했습니다. Dot은 [computer-use 스킬](C:/Users/dldyd/.codex/plugins/cache/openai-bundled/computer-use/26.1027.30824/skills/computer-use/SKILL.md)로 접근을 시도했으나 기존 탭의 다른 세션 점유로 차단되어 메시지를 보내지 않았습니다.

**변경 파일·patch·worktree는 없습니다.** 공유 파일 편집은 종료했으며, 실제 공급자 호출·한국 장소 품질 시험·AAOS·실차 검증은 미실행입니다. 이번 결과는 검토 완료이며 지도 연동 완료가 아닙니다.
