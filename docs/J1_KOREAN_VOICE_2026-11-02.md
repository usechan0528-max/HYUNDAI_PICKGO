# J1 한국어 AI 음성 시연 검증 · 2026-11-02

## 범위와 선택
사용자가 한국어 모델 설치, J1 원고 합성 및 공모전 라이선스 검증을 승인했다. main 브랜치의 기존 미커밋 앱·SDK·협업 변경을 보존했다. 기존 content.mjs 4편을 읽어 별도 산출물만 생성했으며 기존 J1 음원 교체, APK 통합, 외부 제출은 하지 않았다.

선택은 **Supertonic 3 기본 목소리 F3**다. 한국어 지원, 약404MB 모델, CPU 실행 및 원고 낭독에 맞는 기본 음성이 이유다. KittenTTS는 기존 설치가 영어용이라 제외. OmniVoice는 설치되어도 복합/비상업 제한이 있어 이번 공모전 음원에 사용하지 않았다. 다른 대형 모델의 품질 우열은 실행 비교하지 않았다.

VoiceStudio 0.5.7의 공식 로컬 설치/설정 API로 전용 venv 설치 및 활성화. SDK supertonic1.3.1, onnxruntime1.31.1. 모델 `Supertone/supertonic-3@724fb5abbf5502583fb520898d45929e62f02c0b`, 총403,513,201 bytes. 라이선스 확인 후 해당 엔진의 사용 동의만 저장했다. 별도 계정/API키/시스템 권한 변경 없음.

- 전용 환경: `C:/Users/dldyd/AppData/Roaming/OmniVoice/engines/supertonic3/supertonic3/.venv`
- 모델: `C:/Users/dldyd/AppData/Local/OmniVoice/hf_cache/models--Supertone--supertonic-3/snapshots/724fb5abbf5502583fb520898d45929e62f02c0b`
- 합성: language ko, preset F3, speed1.0, num_step10, seed42, broadcast 효과, 앱 기본 워터마크 설정 유지. 44,100Hz PCM16 mono WAV.
- 주의: 원저장소는 공식 지원 종료/보관 상태. 고정 버전 로컬 시연 검증이며 장기 제품 지원 또는 Android 실행 검증이 아니다.

## 실행 결과

| 원고 ID | 음원 길이 | 앱 보고 생성시간 | 정규화 문자차이 CER | 잘린 샘플 | 최장 저음량 구간 |
|---|---:|---:|---:|---:|---:|
| story | 22.58초 | 50.72초 | 1.92% | 0 | 1.10초 |
| pause | 20.48초 | 40.69초 | 0.00% | 0 | 1.18초 |
| story2 | 20.07초 | 16.38초 | 1.03% | 0 | 1.02초 |
| pause2 | 19.93초 | 15.78초 | 0.00% | 0 | 1.34초 |

4개 파일 실제 생성·디코딩 통과. peak 약 -2dBFS, RMS 약 -20~-21dBFS. quiet는20ms 프레임 RMS<-50dBFS이며 파일 앞뒤 쉼도 포함한다. 생성시간은 다른 로컬 작업이 함께 실행 중인 단회 측정이다. 실시간 성능을 보장하지 않는다.

faster-whisper1.2.1 small(Systran/faster-whisper-small revision536b0662742c02347bc0e980a01041f333bce120), CPU int8/4threads, Korean, beam5, previous-text conditioning off로 재인식했다. 원고/재인식에서 공백·문장부호를 제외한 한글·영문·숫자 편집거리 CER이다. 4편 범위에서 문장 누락·반복 징후 없음. story의 의/에, story2의 역무원/영무원 표기 차이는 ASR 오류와 실제 발음을 분리하지 못하므로 오독으로 확정하지 않는다. 자연스러움·감정·피로도에 대한 직접 청취 평가, 실차 소음/스피커 검사는 미실행이다. **자동 명료도 검사는 양호하나 최종 청취 승인은 남아 있다.**

초기 검증 스크립트가 `/generate`의 WAV 응답을 JSON으로 잘못 읽어 실패했다. binary 응답/메타데이터 헤더 저장으로 수정 후4편 생성 종료0. 검증 ASR 모델 다운로드의 Windows symlink 생성은 WinError1314 실패. 이미 받은 config blob을 일반 파일로 복사하고 local snapshot을 직접 읽도록 변경하여 권한 수정 없이 재실행 종료0.

## 공모전 사용 조건

**이번 기본 목소리로 만든 J1 시연 음원은 아래 조건을 지키면 모델 라이선스상 시연 영상·발표에 사용할 수 있다고 판단한다.** 공모전 주최자의 최종 수리나 참가자 권리보증을 대신하는 판단은 아니다.

1. 모델은 OpenRAIL-M: 일반적인 비상업 전용 제한은 없지만 용도 제한이 있다. 6조는 제공자가 출력물에 권리를 주장하지 않는다고 명시하며, 출력물 사용 책임은 사용자에게 있다. 이는 출력물의 저작권 발생이나 제3자 권리 무침해를 보증하지 않는다.
2. Attachment A(e)에 따라 **AI 생성 음성임을 명확히 표시**해야 한다. 전달 HTML/NOTICE/파일명에 표시했다. J1 앱에 붙이거나 영상으로 옮기면 그 맥락에서도 잘 보이는 표시를 유지해야 한다. 음원 파일 내부에 별도 음성 고지를 삽입한 것은 아니다.
3. 타인 무단 사칭·유해 허위정보 등 Attachment A 금지 사용을 준수한다. 이번에는 기본 preset만 사용했고 음성 복제·커스텀 유료 Voice Builder를 사용하지 않았다.
4. 음원만 전달하는 것과 모델/파생모델을 재배포하거나 API로 제공하는 것은 다르다. 후자는4~5조의 라이선스 사본·고지·사용제한 전파 등 별도 의무를 이행해야 한다. 코드 MIT 재배포 시 저작권/허가문 유지.
5. VoiceStudio 프로그램 자체는 AGPL-3.0이다. 생성 음원에 프로그램 라이선스가 자동으로 적용되는 것은 아니다(2조 출력물 규정). 앱 코드 포함·수정 서비스 배포는 별도 검토 대상이다.
6. 원고는 기존 J1 `testOnly` 시연 콘텐츠다. 외부 뉴스/음악/성우 녹음을 가져오지 않았지만, 이번 모델 검증이 원고의 최초 작성 경위·최종 권리보증을 증명하지는 않는다. 공모전 기록의 저작권/제3자 이용조건은 `CONTEST_RESOURCES_2026-11-02.md` 및 공식 지정 양식 기준으로 제출 직전에 다시 확인한다. 자동 수집 제한 때문에 공모전 사이트를 추가 수집하지 않았다.

원출처(확인2026-11-02):
- https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE (고정 revision 동일 파일도 별도 보관)
- https://huggingface.co/Supertone/supertonic-3 (한국어/기본음성/코드·모델 구분)
- https://github.com/supertone-oss-archive/supertonic/blob/main/LICENSE (MIT)
- https://github.com/supertone-oss-archive/supertonic (공식지원 종료)
- https://github.com/debpalash/VoiceStudio/blob/main/LICENSE (AGPL-3.0)

## 재현과 전달

재생 묶음: `output/J1_Korean_AI_Voice/index.html`, WAV4개, NOTICE.txt, licenses/. 모두 AI 생성 음성.
재현: `python work/j1-korean-tts/generate.py` (VoiceStudio 실행 필요; 재실행은 같은 이름 결과를 덮어씀).
검사: `C:/Users/dldyd/AppData/Roaming/VoiceStudio/runtime/project/.venv/Scripts/python.exe work/j1-korean-tts/verify.py`.
원본 입력·응답·품질 수치·모델해시: `work/j1-korean-tts/`. 검증용 ASR 다운로드 약484MB가 추가되며 별도 모델 캐시에 보존됨.

## Claude 독립 검수와 처리
claude-haiku-5-5, session97135498-8a08-412f-a4e4-1cbe6df1c672, exit0/is_error=false. 고정된 품질 JSON과 모델 LICENSE 전문만 검수했으며 직접 파일/음원 청취는 하지 않았다.
- 높은 중요도: 실제 모델 라이선스 동일성 확인 요구 → 설치 snapshot LICENSE와 원출처 고정SHA 다운로드가 byte-identical임을 확인. SHA256 0d944a9110fed9a9602d60e0423a272903e7bd21ab060490774efc77c2275e9f. 원모델카드가 OpenRAIL-M/기본 프리셋을 명시함을 직접 확인했다.
- 높은 중요도: 영상 맥락에서도 AI 고지 요구 → HTML 명시 유지, NOTICE에 영상 자막 문구 추가. 영상 제작 자체는 이번 범위 밖이며 해당 의무는 향후 통합 시 남는다.
- 중간: SDK 라이선스 별도 확인 → 설치된 supertonic1.3.1 METADATA License-Expression MIT 및 동봉 LICENSE 직접 확인/전달 묶음 복사.
- 중간: F3 출처/사칭 오해 → 원모델카드의 fixed preset 설명과 설치 voice_styles/F3.json 확인. 특정 인물과 무관한 학습 데이터라는 보장은 하지 않고, 개인녹음 미업로드/제공 preset 사용으로 안내 문구를 좁혔다.
- 중간: 배포범위 확인 → 전달 폴더에 WAV4개/HTML/NOTICE/라이선스만 있고 모델ONNX/SDK 없음 확인.
- 품질 과장 방지 → ASR 수치와 청취 미실행을 분리했다. 낮은 CER를 자연스러움 보장으로 사용하지 않는다. 검수자의 원고 글자수 추정은 검사 코드의 실제 정규화 계산을 우선한다.
- 검수 미확인 항목의 추가 확인: WAV4개 mono/16bit/44.1kHz와 전달 파일 SHA256 일치 확인. 최종 공모전 AI 허용 여부/원고권리/청취는 이 자동검수로 대체하지 않는다.
검수 원문: `docs/evidence/j1-korean-voice-review-2026-11-02.json`.
