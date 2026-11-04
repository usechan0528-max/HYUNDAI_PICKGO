# 프로젝트 분리 · 2026-11-04

사용자 승인: 기존 HYUNDAI_AI는 픽업용으로 유지, J-1은 새 비공개 J1_ARCHIVE로 분리·업로드. J-1 개발 재개 아님.

J-1 전용 experiments 4개, 전용 문서·증거·음원·APK·작업 파일을 형제 J1_ARCHIVE로 이관. 1,601개 파일 SHA256 이관 전후 일치. 상세 로컬 목록은 work/project-separation-20261104/moved-files.json. 소스 상대 경로를 유지했으며 J-1 웹의 output/j1-cockpit/fonts 의존성도 포함했다. Android env와 서명 설정은 PLEOS_TOOLS 외부 도구 루트를 받을 수 있도록 국소 수정했다.

공통 Android 도구·서명키는 기존 work/pleos-environment에 보존하고 어느 저장소에도 업로드하지 않는다. 신청서·동의서·캐시·로컬 환경·작업 초안도 업로드 제외. 원래 Git 이력·이전 원격 브랜치는 삭제하거나 재작성하지 않는다. 따라서 과거 커밋에는 J-1 이력이 남으며 최신 main의 전용 파일만 분리된다.

혼합 결정/API/시험/작업 기록은 기존 파일을 보존하고 J1_ARCHIVE/docs/history에도 분리 전 원문을 복사했다. 역사적 상대 경로는 당시 경로이며 개발 재개 지시가 아니다. 양쪽 README를 현재 실행 경로로 정리했다. 픽업 소스 변경 없음.

검증·Claude 검수·원격 업로드 결과는 아래에 추가한다.

## 분리 검증과 검수 결과

- 픽업: `node --test "experiments/pickup-board/*.test.mjs"` 176/176 통과.
- J-1: 새 루트에서 `node --test "experiments/journey-context/*.test.mjs"` 125/125 통과.
- 새 J-1 루트의 실제 서버: /, /fonts/AstaSans.ttf, /audio/story.wav 모두 HTTP200.
- 기존 도구 루트를 PLEOS_TOOLS로 지정하여 `gradle.bat -p ../J1_ARCHIVE/experiments/j1-listening --offline --no-daemon assembleDebug lintDebug` 종료0, 43 tasks, lint 0 errors/2 warnings. 기기 설치·실차 시험은 미실행. Git에 올리는 APK는 과거 검증 산출물이며 이번 재빌드로 교체하지 않았다.
- 이관 당시 1,601파일 SHA256 일치, 이후 의도된 환경/안내 수정3파일을 제외한 재검사도 통과. 그 뒤 Android 빌드가 로컬 캐시를 갱신했으므로 빌드 캐시는 최초 이관 해시와 달라질 수 있다.
- 키·환경·신청서·동의서·캐시 제외, tracked 파일 크기·제한된 비밀값 패턴 및 APK 내부 검사 통과. 모든 종류의 비밀/개인정보 부재를 보증하는 검사는 아니다.
- Claude Haiku5.5 읽기전용 검수 b75e5549-2e35-4a5b-a9e0-1bb9445a92b0, 후속 bbfb7df1-bdc7-4db8-983d-b56e8cdb842c: exit0/is_error=false. 도구 루트 실패 처리 P1은 명시 오류와 실제 빌드로 해결, 비공개 문서 제외 P1은 실제 check-ignore/인덱스 검사로 해소. 후속에서 두 P1 해소 확인. P2 최상위 캐시 검사 정규식·빈 JDK 확인 보완, 편집 파일 최종해시는 final-audit에 기록. 검수자는 직접 시험을 실행하지 않았다.

업로드 대상은 두 비공개 저장소의 main이다. 원격 결과와 최종 커밋 ID는 작업 완료 보고 및 로컬 work/project-separation-20261104/push-receipt.json으로 확인한다. 기존 HYUNDAI_AI의 과거 커밋·codex/pickup-board 브랜치는 보존한다.
