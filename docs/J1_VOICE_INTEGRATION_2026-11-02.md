# J1 한국어 생성음원 적용 · 2026-11-02

사용자 승인: 생성한국어4편 J1시연적용, AI표시 및 실제재생확인. main 브랜치, 기존 타작업 미커밋변경 보존. 이번 범위는 같은 한국어 시연 음원의 통합이며 SDK추천기/시연디자인의 변경이 아님.

## 변경
- demo/audio/story.wav,story2.wav,pause.wav,pause2.wav: 직전 생성F3 WAV로 교체. 원본 대비SHA256 일치4/4. 이전 WAV와 변경전 소스는 work/j1-voice-integration/before에 복사보존.
- demo/index.html: 재생기 바로 위에 항상 보이는 `AI 생성 음성 · Supertonic 3`, audio aria-describedby 및 footer 출처표시.
- demo/app.mjs: 한국어 시연콘텐츠 캡션. 재생/추천/SDK 로직변경 없음.
- demo/listening-store.mjs: 음원 revision을 저장해 예전 음원의 offset만 폐기하고 취향 유지. 이번 음원의 checkpoint는 보존. 저장키나 위치정보 정책변경 없음.
- demo/audio/NOTICE.txt, licenses/: 생성원출처 및 모델OpenRAIL-M, 코드/SDK MIT 사본 동봉. 모델ONNX/SDK는 웹배포에 포함하지 않음. 정적 서버 경로/권한 변경 없음.

## 검증
- node --test experiments/journey-context/*.test.mjs: 76/76통과, 실패0. 옛 음원checkpoint무효화/취향보존/신음원offset roundtrip 회귀시험 추가.
- HTTP200 WAV4개를 생성원본과 byte단위비교, SHA256 일치. bytes0-43 Range206/내용확인4/4. 다운로드 성공만으로 실제재생을 주장하지 않음.
- 실제 Chrome http://127.0.0.1:4177/의 이동시작/다음으로 버튼으로4편재생: 각각 currentTime>0, readyState4, paused=false, muted=false, error=null. 길이22.580045/20.072404/20.480590/19.925283초.
- 첫 이동시작 후 사용자 추가조작 없이 마지막 pause2의 ended=true/time=duration 및 다음콘텐츠없음 종료를 관찰. 이어서4편 개별전환검증도 수행.
- story10.774496초에서 기본오디오 일시정지→새로고침→10초이어듣기표시→버튼클릭 후11.586380초 paused=false로 복원 확인.
- AI표시는 재생전/재생중/종료 AX와 screenshot으로 확인. 증거캡처는 화면 업데이트 시점상 종료 클릭 직전 재생프레임이며, 종료 상태는 AX관찰로 확인했다.
- 마지막 이동듣기종료 클릭, 시연 탭은 사용자용으로 열어둠. 스피커의 실제 소리를 청취한 평가나 실차/Pleos APK재생 검증은 아님.

증거: evidence/j1-voice-integration-http-2026-11-02.json, browser-2026-11-02.json, j1-voice-integration-2026-11-02.png, tests-2026-11-02.txt. 브라우저 증거는 관찰한 media DOM속성 값이며 오디오출력장치/시스템음량을 인증하지 않는다.

## 독립 검수
Claude Haiku5.5(`claude-haiku-5-5`), session ed9cc101-bf12-4e3b-a5b1-8d51104e205f, exit0/is_errorfalse. 변경 직전 snapshot diff, 실제앱/서버/저장코드와 HTTP/브라우저증거를 전달. P0/P1없음, 입력범위조건부통과. 첫 호출은 도구없는 환경에서 Read/Glob 형식의 요청만 출력하여 완료검수로 인정하지 않고 필요한 자료를 추가해 재호출했다.
- 수동 MEDIA_REVISION 갱신 누락 가능성: README 음원교체 체크리스트 추가.
- clean 반환형에 revision 포함 권고: 실행결함이 아닌 구조제안으로 미반영. 공개 loadListening 반환형은 유지하고 저장시검증/직렬화에만 revision사용, 기존/신규회귀시험 통과.
- byteRange416/전체테스트출력/완주증거 입력누락: 누락은 소스결함과 구분. 실제76개통과 원문을 evidence에 보관. 이미 도구로 관찰한 자연완료/ended 값을 브라우저증거에 출처와 함께 추가 기록. 기존 Range 단위시험 포함. 추가 구현 불필요.
- 해시 독립확인 한계: Codex가 HTTP본문과 생성원본을 실제byte비교했으며, reviewer가 직접 파일접근한 것은 아님. 원생성 quality evidence 및 이번 HTTP해시 기록 연결.
- STORE FULL은 검수입력의 전체저장모듈 구분 제목이며 용량오류 메시지가 아님.
