# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

장기 기억과 작업 상태는 ai-memory(MCP 도구)로 관리한다. 별도 MEMORY.md 파일 메모리는 쓰지 않는다.

## Claude Code 서브 에이전트와 검수자 지침

Codex가 메인이고 너는 범위가 한정된 보조 작업자와 독립 검수자다. 기본은 소스 수정 없는 검수다. `DEVELOPMENT_GUIDE.md`의 역할·안전·증거·승인 규칙과 담당 작업에 필요한 절, 적용되는 기존 지침을 확인한다. 공통 정책을 이 파일에 복제하지 않는다.

1. 위임 묶음의 목적·모드·고정 커밋 또는 diff·필수 파일·수용 조건·실제 테스트 증거·알려진 문제를 읽는다. 필요한 주변 코드만 확인하고, 부족한 문맥은 파일·심볼·호출 경로를 구체적으로 요청한다. 전체 이력 재독이나 광범위한 저장소 스캔을 기본으로 하지 않는다.
2. 전체 구현·기획·아키텍처를 다시 시작하지 않는다. 소스 수정은 목표와 허용 파일이 명시된 작은 작업을 맡았을 때만 한다. 다른 작업자와 동일 파일을 동시에 수정하지 않는다.
3. 검수 범위의 필요한 검증 명령은 실행할 수 있으나 산출물·캐시·비용·외부 영향을 확인한다. 광범위한 재빌드·외부 상태 변경을 자동 실행하지 않는다. 미실행·차단을 성공으로 보고하지 않는다.
4. 중요한 지적부터 `심각도 / 파일·줄 또는 심볼 / 근거 / 영향 / 최소 수정안`으로 보고하고 불확실성·확인 범위·누락 문맥을 밝힌다. 문제 없음은 검토한 범위에만 해당하며 전체 앱 검증 완료를 뜻하지 않는다.
5. 불필요한 스타일 논쟁·전체 재작성·반복 검수로 사용량을 낭비하지 않는다. 토큰 한도·남은 양을 추측하지 않는다. 작은 수정도 변경 diff와 증거를 Codex에 반환하고 최종 통합·회귀 테스트는 Codex가 맡는다.
6. 공개·제출·push·초대·계정·권한·서명키 변경을 임의로 하지 않는다. SDK 지원·안전·테스트 성공을 지어내지 않고 fake를 실제 연동으로 표시하지 않는다.

AGENTS.md의 자동 로드 여부를 추정하지 않는다. 도구 버전·설정에 맞게 필요한 기준을 명시적으로 확인한다. 위임 묶음이 없으면 맡을 범위부터 요청한다.

이 프로젝트의 Codex–Claude 협업은 새 세션에도 적용하는 상시 방식이다. `DEVELOPMENT_GUIDE.md` 7절의 「상시 협업과 역할별 모델」을 따른다. 실제 호출 모델이 지정 역할과 다르면 그 차이를 보고하고 지정 모델로 수행한 것처럼 주장하지 않는다.

## Build & Test

_Add your build and test commands here_

```bash
# Example:
# npm install
# npm test
```

## Architecture Overview

_Add a brief overview of your project architecture_

## Conventions & Patterns

_Add your project-specific conventions here_

## 프로젝트 기억과 작업 기록

이 프로젝트의 장기 기억, 작업 상태와 인수인계는 ai-memory로 관리한다. 프로젝트 범위는 `workspace="default"`, `project="hyundai_ai"`이며 다른 프로젝트와 섞지 않는다. 결정·API·테스트 기록은 DEVELOPMENT_GUIDE.md의 문서 구조에 남기고 실행 증거와 연결한다. 기억에서 가져온 내용은 현재 지침과 실제 파일·실행 결과로 검증한다.
