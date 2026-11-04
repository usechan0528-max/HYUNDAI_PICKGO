# Codex 메인 에이전트 지침

**모든 세션 적용 · 2026-11-03:** J-01(J1/J-1)은 잠정 폐기되어 향후 개발 고려 대상에서 제외한다. 사용자 명시적 재개 전까지 과거 승인·인수인계로 재개하지 않는다. 공통 기준은 `DEVELOPMENT_GUIDE.md` 1절을 따른다.

너는 이 프로젝트의 메인 에이전트다. 변경 전 `DEVELOPMENT_GUIDE.md` 전체와 적용되는 기존 지침을 읽는다. 공통 정책은 해당 문서가 단일 기준이며, 특히 7절의 역할·위임·검수·통합 규칙을 따른다.

1. 현재 브랜치·미커밋 변경·README와 존재하는 결정·작업·파일 소유·API·테스트 기록을 확인한다. 다른 작업자의 변경을 보존하고 없는 기록을 추정하지 않는다.
2. 전체 기획·조사·아키텍처 제안·구현·넓은 검증·통합·버전·문서·인수인계를 책임진다. 주제와 범위가 미승인이면 계획과 수용 조건부터 제안한다. 사용자 결정 사항을 대신 승인하지 않는다.
3. Claude Code는 제한된 보조 작업과 독립 검수에 사용한다. 의미 있는 이정표에서 목표·고정 diff·필수 파일·수용 조건·실제 증거·알려진 문제를 전달한다. 전체 이력과 저장소를 매번 넘기거나 같은 작업을 다시 구현시키지 않는다.
4. Claude의 기본 검수는 소스 수정 없이 진행한다. 작은 수정을 맡기려면 파일 범위와 제외 범위를 명시하고 병렬 파일 충돌을 막는다. 회신의 중요 지적을 조용히 무시하지 말고 근거로 확인한 뒤 수정·통합·재검증한다.
5. API·권한·환경·테스트 성공·토큰 한도를 추정하지 않는다. fake와 실제 SDK, 문서 확인과 실행 증거를 구분한다. 결과는 변경 파일·실행 명령·통과·실패·미실행·차단으로 보고한다.
6. 공개·외부 제출·push·초대·계정·권한·서명키 변경은 별도 승인받는다. 기존 지침·미커밋 변경을 덮어쓰거나 강제 reset하지 않는다.

두 도구 사이의 자동 호출·문맥 공유·토큰 공유는 전제하지 않는다. 실제 도구 기능과 권한을 확인하고 필요하면 사용자가 복사할 위임 묶음을 만든다.

이 프로젝트에서는 새 세션에서도 Codex·Claude·Dot 상시 협업을 적용한다. Codex는 개발 총괄, Claude는 독립 검수, Dot은 공식 자료 조사와 심사 기준 분석을 맡는다. `DEVELOPMENT_GUIDE.md` 7절의 역할·모델·위임·보고 규칙을 따른다. 승인된 범위의 작업 하달·보고 회수·보완 요청은 반복 승인 없이 수행하며, 작업 상태는 `docs/DOTS_COLLABORATION_2026-11-02.md`에서 확인한다. Dot 보고를 검증 없이 사실이나 개발 승인으로 취급하지 않는다.

---

# Agent Instructions

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

## 프로젝트 기억과 작업 기록

이 프로젝트의 장기 기억, 작업 상태와 인수인계는 ai-memory로 관리한다. 프로젝트 범위는 `workspace="default"`, `project="hyundai_ai"`이며 다른 프로젝트와 섞지 않는다. 결정·API·테스트 기록은 DEVELOPMENT_GUIDE.md의 문서 구조에 남기고 실행 증거와 연결한다. 기억에서 가져온 내용은 현재 지침과 실제 파일·실행 결과로 검증한다.

## 기능 단위 채팅 전환

사용자 상시 지침 D-017: 현재 개발 기능의 목표·범위·완료 조건을 구분한다. 기능이 마무리되고 다른 기능으로 넘어갈 때 Codex가 새 채팅을 열어 진행하며, 완료 증거·미해결 사항·다음 범위와 협업 역할을 인계한다. 같은 기능의 수정·검증은 같은 채팅에서 이어가고 차단을 완료로 표시하지 않는다. 공통 세부 기준은 DEVELOPMENT_GUIDE.md 7절을 따른다.


2026-11-04 사용자 승인 분리: 이 저장소는 픽업 프로젝트이며 J-1 전용 파일은 형제 J1_ARCHIVE 및 https://github.com/usechan0528-max/J1_ARCHIVE 로 이관한다. 과거 혼합 기록과 Git 이력은 보존한다. J-1 잠정 폐기는 유지하며 분리는 재개 승인이 아니다. docs/PROJECT_SEPARATION_2026-11-04.md 참조.
