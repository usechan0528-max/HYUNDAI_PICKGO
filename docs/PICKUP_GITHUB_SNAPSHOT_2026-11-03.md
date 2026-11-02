# 픽업 개발 GitHub 스냅샷 · 2026-11-03

사용자의 GitHub 커밋 요청에 따라 기존 codex/pickup-board의 8cf151903f0c0b118823150d013143b12dfb168d 위에 완료된 픽업 MVP·차량 UI·수동 도착/탑승·Gleo 준비 소스 및 검증자료를 보존한다. main과 공유 작업 파일/index는 변경하지 않는다.

수동 상태 7개와 Gleo 준비 source/contract/test의 최종 manifest SHA256 일치 확인. 고정 복사본에서 `node --test experiments/pickup-board/*.test.mjs` 종료0, 49/49 통과. 현재 작업에서는 Android 빌드·브라우저·에뮬레이터를 재실행하지 않았고 과거 결과는 해당 보고서에 한정한다. 실제 Gleo·SDK·실차 연동 완료 아님.

진행 중인 위치/근접/휴대폰 통합 소스·전용 문서, 작업 폴더, 설치물, 키, local.properties, .env, 새 APK는 제외했다. 공통 기록의 진행 중 상태는 완료 주장으로 바꾸지 않았다. J-01 잠정 폐기 지침도 반영하며 과거 구현은 이력으로만 보존한다.

제한된 비밀값 패턴·금지 확장자·파일 크기 검사 통과. 모든 비밀 부재 보증은 아니다. diff 공백 검사는 원본 검수입력/빌드로그/라이선스의 기존 공백을 보고했으므로 완전 통과로 표시하지 않고 원본을 보존했다.

Claude Haiku5.5 읽기 전용 커밋 구성 검수: 첫 호출은 placeholder, 두 번째는 실행되지 않은 계획 도구 문자열만 반환하여 유효 검수로 인정하지 않았다. 도구/MCP 비활성은 유지하고 CLI plan 모드를 해제한 세 번째 호출 세션 1199d9c8-e8fc-46c8-b3c4-31a2985500de, is_error=false. 결과:

## 결론: P0/P1 구성 문제 없음

읽기 전용 검수만 수행했습니다. 도구를 실행하지 않았고 커밋, push, 파일 수정도 하지 않았습니다. 아래 판단은 전달받은 `git diff --stat`과 요약 정보만 근거로 합니다.

## 확인한 범위

- **포함 대상**: 수동 상태 소스 7개와 Gleo 소스 3개(`adapter.mjs`, `gleo.test.mjs`, `contract/schema.candidate.json`)가 stat에 있습니다. 근접·휴대폰·지도 통합 소스와 전용 문서(`PICKUP_LOCATION_INTEGRATION`, `PICKUP_MAP_RESEARCH`)는 stat에 없어 제외된 것으로 보입니다.
- **README 링크**: `experiments/pickup-board/README.md`와 docs 링크 대부분은 stat에 포함되어 있습니다.
- **APK/SDK 계열**: `.apk`, `.aar`, `.jar`, `local.properties`, 빌드 산출물은 stat에 보이지 않습니다. emulator-preview는 Gradle 소스 파일만 포함합니다.

## 비차단 관찰 (P0/P1 아님)

1. **깨진 링크 가능성**: `README.md`의 "선정 기획" 링크가 `docs/IDEA_TOURNAMENT_2026-11-02.md`를 가리키지만, 이 파일은 stat에 없습니다. 커밋 전에 파일을 포함하거나 링크를 제거하는 편이 좋습니다.
2. **미포함 수정 파일**: `docs/evidence/dot-coordination-review-input-2026-11-02.txt`는 작업 트리에서 수정되어 있지만 stat에 없습니다. 의도적 제외인지 확인이 필요합니다.
3. **바이너리 크기**: `fonts/AstaSans.ttf`가 약 5.7MB입니다. OFL 라이선스 파일은 함께 포함되어 있습니다.
4. **로컬 경로 노출 여부**: `*-meta.json`과 `*-raw.json` 증거 파일에 `C:\Users\...` 같은 로컬 경로가 들어 있을 수 있습니다. 비밀값 정규식 검사는 통과했다고 하지만, 경로 노출은 별도로 확인할 가치가 있습니다.

## 검증하지 못한 항목

- SHA256 일치, snapshot에서의 Node 49/49 통과, 제외 검사, 고정 tree `c7d52ad…`와 stat의 일치 여부는 제가 실행하지 않았습니다. 담당자 보고를 그대로 인용한 것입니다.
- 이번 검수는 기존 소스 전체의 재검수가 아닙니다.

요청하시면 위 항목 중 1번과 4번을 읽기 전용으로 확인하고 결과를 정리하겠습니다. 커밋과 push는 지금 실행하지 않았습니다.

Codex 확인: 선정 기획 문서는 부모 커밋에서 상속되어 고정 tree에 존재함을 git cat-file로 확인했다. dot-coordination 입력의 기존 공백 차이는 의도적으로 제외했다. 폰트는 OFL을 동봉했으며 25MB 파일 상한 안에 있다. 비공개 저장소의 검수 기록에는 기존 실행 환경 경로가 있을 수 있으며 개인 자격 증명·키와는 구분해 보존했다.

기존 기능 검수는 STATUS/GLEO/DESIGN/EMULATOR 보고서의 범위와 지적 처리를 따른다. 이번 구성 검수가 전체 소스의 추가 기능 검수를 의미하지 않는다.
