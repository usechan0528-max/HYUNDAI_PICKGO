# 픽업 위치 작업 통합 검수

상태: 로컬 통합·독립 검수·Chrome 실행 완료. 실제 차량 SDK·물리 휴대폰·외부 지도 본연동은 미완료이며, 최종 에뮬레이터 시각 검증은 창 활성화 실패로 차단되었다. 이번 요청 범위의 작업을 마감한다.

사용자 요청: 차량 근접 판단, 지도·장소 검색·주소 변환 검토, 동의 기반 탑승자 휴대폰 위치 공유를 별도 채팅에서 병렬 진행한 뒤 통합 검수·실행하고 이번 작업을 마무리한다.

## 통합 범위와 담당

총괄은 main의 기존 미커밋 변경을 보존하고 각 전용 worktree의 기준 스냅샷과 변경을 대조하여 필요한 파일만 통합한다. 구현 담당이 편집을 종료한 뒤 통합한다. 공급자 본연동·계정·유료 계약·공개·push·권한·서명키 변경은 이번 범위에 포함하지 않는다.

- 차량 근접: pickup-proximity 별도 모듈 및 합성 경계 검증. 근접과 수동 도착·탑승은 별개 상태.
- 휴대폰: pickup-phone-location 동의·일회 공유·철회·만료·회차 인증 흐름.
- 지도: pickup-map-research 공식 자료 비교와 계약 제안. 제공자를 확정하거나 연동 성공으로 표시하지 않음.

## 통합 수용 조건

1. 기존 수동 생성/참여/장소 제안·수락/도착/탑승/종료 및 Gleo 준비 회귀를 유지한다.
2. 근접 관측의 source·목적지·revision·시간·정확도 경계를 지키고 오래된 관측이나 종료 후 콜백은 근접으로 표시하지 않는다.
3. 휴대폰 동의 전에는 수집·전송하지 않는다. 철회·종료·만료·권한 오류 때 전송과 표시를 중단하고 다른 회차 접근을 거부한다.
4. 휴대폰 위치를 차량 좌표로 사용하거나 위치만으로 도착·탑승을 확정하지 않는다.
5. 실제 브라우저 두 역할에서 통합 기능과 기존 수동 흐름을 실행한다. 합성 위치와 실제 기기 위치를 구분한다.
6. 고정 통합 소스·diff·시험 결과로 실제 Claude Haiku 5.5 독립 검수를 수행하고 중요 지적을 처리한다.
7. 실제 SDK·물리 휴대폰·지도 제공자 연동이 차단되거나 미실행이면 완료 범위와 분리해 기록한다.

## 시작 증거

- 기준 파일: `work/pickup-integration/baseline/`, SHA256: `baseline-manifest.json`.
- 통합 전 `node --test experiments/pickup-board/*.test.mjs`: 종료 0, 49/49 통과.
- Dot 질문 전달: 기존 탭이 다른 세션에 점유되어 미전송. 강제 해제나 중복 대화 생성 없이 공식 원문 직접 대조를 진행한다.

## 최종 결과

### 변경과 검증

- domain.mjs: 확정 장소 placeRevision 추가. 수락 시에만 증가하여 A→B→A도 이전 관측과 구별한다.
- server.mjs, phone-domain/controller/page 및 phone.html/css: 동의·일회 공유·철회·만료·회차 인증 통합. 장소 변경 수락 시 기존 위치와 발급 권한을 제거하고 페이지는 재동의를 요구한다.
- proximity/detector.mjs와 proximity-page.*: 합성 관측 전용 근접 시연. 실제 차량 위치는 미확인으로 분리한다. 근접은 도착·탑승을 바꾸지 않는다. 장소 변경은 다음 성공 조회에서 확인하며 최대 4초 지연 가능성을 결과 옆에 명시했다.
- index.html, location-links.css: 두 위치 기능 진입점. 별도 UI 담당의 style.css 터치·스크롤 개선도 보존했다. 기존 app.mjs는 수정하지 않았다.
- 지도 조사 결과는 PICKUP_MAP_RESEARCH_2026-11-03.md에 통합. 제공자·계정·키·과금 계약은 선택하지 않았다. 후속 NaviHelper 준비 및 recommendation 작업은 이번 마감 범위 밖이다.

실행 명령 `node --test experiments/pickup-board/*.test.mjs`: 종료 0, 115/115 통과(기존49+근접39+휴대폰20+근접페이지4+통합3). 실제 loopback HTTP와 합성 위치/fake DOM 시험을 포함한다. 이후 결과 옆 안내 문구만 추가했으며 동작 소스는 동일하다. 근접 detector 시간 경계 시험은 있지만 페이지 fake clock은 고정되어 페이지 4초·6초 타이머 경계 전체를 자동 검증한 것은 아니다. phone.test.mjs의 grant/tombstone/cap, phone-page.test.mjs의 동의·장소변경, proximity.test.mjs의 5초 TTL 증거와 구별한다.

실제 Chrome 두 역할에서 생성·참여→동의 거부→합성 근접/만료→장소 제안·수락→수동 도착→탑승→완료 확정을 실행했다. 근접만으로 수동 상태가 변하지 않았고, 탑승 및 종료 후 휴대폰 공유 버튼이 잠기며 위치 없음이 표시됐다. 별도 시연 서버 4186 중지 후 '현재 회차 미확인 · 위치 수집 중지'도 확인했다. 브라우저 실제 위치 권한은 허용하지 않았으며 실제 좌표를 수집하지 않았다.

`node experiments/pickup-board/server.mjs`로 통합본 4180 실행. `adb -s emulator-5556 shell am start --user 10 -n org.example.pickuppreview/.PreviewActivity`는 종료 0. 그러나 native 화면 캡처에 앱 내용이 나타나지 않았고 Raise가 'failed to activate captured window'로 실패하여 최종 에뮬레이터 화면·스크롤·탭 확인은 미완료다. 기존 설치 WebView 하네스 실행이며 새 APK 빌드나 실제 차량 SDK 실행 증거가 아니다.

### 독립 검수와 처리

실제 Claude Haiku 5.5 고정 입력 검수 a41d60ee-9822-4a82-80c2-0eafdf82fe73 및 재검수 0d189dc6-fd44-43e3-8bf9-f8fff46db561, 모두 종료0/is_error=false/modelUsage 확인. 재검수에서 입력 범위 내 미해결 P0/P1 없음. 처음 지적된 장소 변경 후 잔존 위치/권한 및 bind 예외를 수정했다. 합성 근접의 폴링 지연은 결과 옆에 공개했다. phone 신선도 설명은 마지막 성공 조회의 요청 시작부터 6초(+250ms 검사 주기)로 정정한다. 과거 검수 입력은 수정하지 않고 원문 보존한다.

클라이언트 ageMs/좌표는 자기 보고이며 물리 위치 증명이 아니다. 회차당100개 tombstone 상한은 지연 grant 부활을 막는 제한이며 자동 재개하지 않는다. 실제 Gleo runtime은 비활성이고 준비 adapter의 엄격한 Board 계약은 PhoneBoard 결합 검증을 마친 것이 아니다.

### 증거와 남은 범위

- docs/evidence/pickup-integration-{review,followup}-{input,manifest,meta,raw,response}.*: 검수 고정 입력·실제 응답.
- docs/evidence/pickup-integration-tests-final.txt, pickup-integration-final-manifest.json: 시험과 마감 소스 해시.
- docs/evidence/pickup-integration-ended.png 및 pickup-integration-proximity.png: 실제 Chrome 실행. 근접 이미지는 결과 옆 지연 안내 문구 추가 전 캡처다.
- work/pickup-integration/phone-evidence/: 휴대폰 담당 원본 검수/시험/manifest. 개별 보고의 work/pickup-phone-location 경로는 담당 worktree 기준이며 통합 checkout에서는 이 경로로 보존했다.

실차 좌표·SDK 근접 콜백의 시간/정확도 계약, 물리 휴대폰 HTTPS·권한·배포, 외부 지도 계약·API 본연동, 최종 에뮬레이터 UI 확인은 남아 있다. 이를 완료로 표시하지 않는다. 공개·push·계정·서명키·새 권한 변경은 하지 않았다.
