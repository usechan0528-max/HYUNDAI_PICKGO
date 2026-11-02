# VoiceStudio 초기 설정 확인 · 2026-11-02 KST

사용자 승인: 추천 3개 설치 및 VoiceStudio 남은 초기 설정과 정상 실행 확인.

- VoiceStudio 0.5.7 사용자별 설치: `C:/Users/dldyd/AppData/Local/Programs/VoiceStudio/VoiceStudio.exe`.
- 실행 환경: `C:/Users/dldyd/AppData/Roaming/VoiceStudio/runtime/project/.venv`, Python 3.11.16, torch/torchaudio 2.8.0+cu128.
- Python minor-version junction 경로를 읽지 못한 초기 실패 후 기존 junction은 `.install-backup`/`.junction-backup`으로 보존하고 실제 Python 디렉터리 복사. 이후 앱 bootstrap에서 패키지 224개와 cuDNN 설치, import 검사와 `.runtime-ready` 생성 확인. 복사만으로 uv python install을 재실행하면 비어 있지 않은 폴더 오류가 났던 이력도 있으며, 향후 업데이트 호환성을 보장하지 않음.
- 정상 종료 후 재실행하여 로컬 엔진 기동 및 마법사 완료, 메인 스튜디오 화면 진입 확인.
- `GET http://127.0.0.1:3900/health`: HTTP 200, status ok, version 0.5.7, CUDA RTX 3060.
- `/startup/progress`: ready, 오류 없음. `/setup/preflight`: ok=true, warnings=false, media_tools.ready=true.
- `/setup/status`: models_ready=true, missing=[] 확인.
- `GET /system/diagnose?network=false&deep=true`: 9 passed, 1 warning, 0 failures. 활성 KittenTTS가 3.8초 음성을 13.1초에 생성. 이 합성 시험은 CPU 엔진 시험이며 GPU 음성 생성 시험이 아님.
- 경고는 HuggingFace token 미설정. 토큰/계정은 생성하지 않음.
- KittenML/kitten-tts-mini-0.8 설치 및 활성화. 영어 고정 음성용으로 한국어·음성 디자인 검증이 아님.
- 마법사가 필수로 요구하는 k2-fsa/OmniVoice 모델도 다운로드. 앱에 비상업적 제한 및 별도 사용 동의 필요 표시. 사용 라이선스 동의는 하지 않았고 이 모델로 합성하지 않았음. 제출 음원 사용을 승인한 것이 아님.
- 선택적 익명 통계 공유는 아니요 선택. 워터마크 기본값 유지. 받아쓰기 모델·추가 계정·클라우드 업로드 설정 없음.

원본 결과: `docs/evidence/voicestudio-setup-2026-11-02.json`.
이번 변경: 이 문서, 해당 증거, WORK_LOG/TEST_EVIDENCE 추가 기록. 기존 앱 소스는 이 작업에서 편집하지 않음.
