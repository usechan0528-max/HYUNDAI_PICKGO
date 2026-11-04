# 픽업 프로젝트를 다른 컴퓨터에서 실행하기

공동작업자 기본 환경은 Node.js 22 이상(npm 포함) 설치 후 저장소 루트에서 `npm run setup`으로 설정합니다. 사전 확인은 `npm run setup:plan`, 설치 후 확인은 `npm run doctor`입니다. Windows 프로그램·프로젝트 스킬을 설치하고 개인 인증/플러그인/Pleos의 남은 설정 목록을 만듭니다. [설치 도구 안내](tools/team-setup/README.md).

```sh
git clone https://github.com/usechan0528-max/HYUNDAI_AI.git
cd HYUNDAI_AI
node experiments/pickup-board/server.mjs
node --test "experiments/pickup-board/*.test.mjs"
```

Node.js 22 이상. http://127.0.0.1:4180 은 같은 컴퓨터 전용입니다. 실제 휴대폰 HTTPS·차량 SDK·Gleo 연동 완료가 아닙니다. [현재 실행 계약](experiments/pickup-board/README.md)을 확인합니다.

J-1은 https://github.com/usechan0528-max/J1_ARCHIVE 에서 별도로 복제합니다. 과거 J-1 작업 지시를 픽업에 적용하지 않습니다. AGENTS.md·DEVELOPMENT_GUIDE.md·최신 결정과 검증 기록을 읽고 미커밋 변경을 보존합니다. 현재 ai-memory 범위는 default/hyundai_ai입니다. SDK·서명키·개인 신청서·로컬 도구는 GitHub에 포함하지 않습니다.
