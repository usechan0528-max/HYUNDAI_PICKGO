# C02 각진 디자인 및 Pleos 에뮬레이터 검토

2026-11-02 사용자 요청: 에뮬레이터에서 실행해 현대차톤과 어울리는지 다시 검토, 더 각진 인터페이스 선호. 기존 C02 디자인 수정/검증의 연속이며 새 제품 기능을 시작하지 않았다. main의 기존 미커밋 변경 보존, commit/push 없음.

## 반영과 판단

기존 Asta Sans·중립 검정/차콜/흰색·확정지점과미확정제안 분리를 유지했다. style.css에서 패널/초대패널 radius16→0, 버튼/링크 radius12→2 CSS px로 변경했다. 버튼 크기/명암/기능은 그대로다. 직각 면과 수평·수직 정렬이 에뮬레이터 앱 메뉴 및 시스템 하단의 직선 제어와 자연스럽게 이어진다는 Codex 시각 판단이다. 이는 모든 현대차UI가 직각이라는 주장이나 공식radius규격 인증이 아니다.

에뮬레이터의 좌측 차량그림·상단상태바·하단공조바는 실제 Pleos 시스템이다. 앱에서 흉내낸 것이 아니다. 현재 시스템은 밝은 차량 영역과 어두운 하단바를 함께 표시한다. 픽업의 중립 차콜은 어두운 바와 연결되며 밝은 주행동버튼으로 우선순위를 준다. 하단/상단 보조문구는 축소된 호스트 캡처에서 작아 보이며 실차 가독성을 주장하지 않는다.

## 실행 경로와 범위

기존 웹 앱을 에뮬레이터에서 직접 볼 수 있도록 experiments/pickup-board/emulator-preview에 작은 debug WebView 하네스를 추가했다. 독립 제품 Android 구현이 아니다. [Android 공식 WebView 문서](https://developer.android.com/develop/ui/views/layout/webapps/webview)를 확인하여 WebView/loadUrl/JavaScript/INTERNET 설정을 적용했다(2026-11-02 확인). 기존 local server에 adb reverse tcp:4180 tcp:4180로 연결한다. URL은 정확히127.0.0.1:4180이며 localhost별칭/외부host예외를 서버에 추가하지 않았다.

외부 origin/파일/콘텐츠접근 차단, JSbridge없음, loopback만cleartext허용. INTERNET normal권한만 선언하고 기존debug키를 재사용했다. 새창탑승링크는 PC브라우저시험 안내 후 차단하여 단일WebView의 운전자세션 덮어쓰기를 방지했다. 실제 두역할완전흐름은 기존PC웹검증범위다. CarUxRestrictions나실제Gleo는 이번에 연결하지 않았다. 주행금지문구유지/distractionOptimized미선언.

## 실제 실행 증거

- 장치: emulator-5556, Connect_on_x86_64_emulator/Pleos, API34. physical2560×1440, density160. WindowManager에 앱창[853,90,2535,1300],1682×1210. 이를 CSSpx=dp 또는 실제 물리터치크기 인증으로 해석하지 않는다.
- 기존전화전체창이 시각적으로 새앱위에 남았고 dumpsys상preview는resumed였다. 단순프로세스실행을화면성공으로보지않고 실제UI에서 전화아이콘재선택→픽업P재선택 후정상분할렌더 확인. 설정·권한 우회 없음.
- 앱목록에서픽업UI검토실행, 실제약속만들기→참여대기/정문표시→약속종료→확인화면→계속진행→원래회차유지를클릭확인했다. 최종하네스재설치후약속생성과탑승링크클릭후운전자화면보존도확인. 토스트문구는캡처시점에서직접확인하지못했으므로코드구현과시각관찰을구분한다.
- Node17/17(domain/HTTP11+fakeDOM6)통과. CSS lint0fail7warn(기존의미라벨). Android assembleDebug/lintDebug 성공, 최종lint0오류1경고(API28지원에대한fullBackupContent명시권고;실행장치API34). 이번변경에새로운상태회귀시험은추가하지않았다.
- 빌드중 존재하지않는gradle-user-home 경로조회와Python기본cp949읽기가한차례실패했다. 실제기존기본Gradle캐시/명시UTF8로진행하여최종빌드성공. 로그최종판과실패이력구분.

주요증거: evidence/pickup-emulator-angular-welcome.png, angular-board.png, angular-confirm.png, final-emulator.png. build-final/tests/css-lint/android-lint텍스트. 전용work에는실행입력·중간파일도보존했다. APK는output/Pickup_UI_Preview_0.1_debug.apk로로컬복사했다.

## Claude 독립 검토

실제claude-haiku-5-5, 세션16c08a33-1844-436b-9678-ee8e9a485deb, exit0/is_errorfalse. Read도구만허용하고명시PNG2개와고정소스만전달했다. Claude가두이미지를실제로Read확인했다고회신했다. 전체저장소·다른파일·편집·명령실행은위임하지않았다.

Claude는직각패널/거의직각버튼이사용자방향에맞고, 중립차콜/흰색이Pleos하단바와어울리며, 확인화면도앱영역안에머문다고평가했다. 밝은버튼강조와작은보조문구는실차에서확인해야할사항으로남겼다. 구체적코드P0/P1결함은제시하지않았다. localhost표현과이미지만으로전체실행흐름을판정할수없다는지적은정확한127.0.0.1사용/실제UI클릭기록/dumpsys/빌드결과로구분했다. Claude의이미지판정이Codex의실행증거를대체하지않는다.

## 미실행과 유지할 한계

실차·주행중사용·CarUxRestrictions변화·SDK권한·신선도·native백그라운드수명주기·release서명/제출 검증은이번범위아니다. 에뮬레이터의본문물리크기/폰트로딩/터치목표를별도instrumentation으로계측하지않았다. CSS기존가로세로8크기증거는이전보고서이며 이번에는native분할창실행을추가했다. 시각수정만으로공식차량규격충족을선언하지않는다. 사용자에게는실제에뮬레이터캡처와변경된소스를제공한다.
