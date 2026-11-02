import { describeLot, transition, canInteract, POLICY } from './domain.js';
import { makeLots, DEMO_NOW } from './fixtures.js';
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state = { now: DEMO_NOW, mode: 'unknown', connected: true, selected: null, feedback: null };
let scenario = 'normal';
let lots = makeLots(scenario);
const time = t => new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul', hourCycle: 'h23' }).format(t);
const label = s => ({ official: '보고된 여석', community: '참여 차량 관측', none: '정보 미연계' }[s]);
const freshness = v => v.age === null ? '현재성 확인 불가' : `${Math.floor(v.age / 60_000)}분 전 관측 · 시연 시계 기준`;
function dispatch(action) { state = transition(state, action, lots); render(); }
function render() {
  const allowed = canInteract(state.mode);
  $('mode').value = state.mode;
  $('scenario').value = scenario;
  $('connection').textContent = state.connected ? '연결 끊기' : '연결 복구';
  $('clock').textContent = `시연 시각 ${time(state.now)} KST · ${state.connected ? '연결됨' : '연결 끊김'} · 시계는 ‘6분 경과’로만 이동합니다. 새 관측값은 생성하지 않습니다.`;
  $('lock').hidden = allowed;
  $('lock').textContent = allowed ? '' : '상세 안내와 선택이 잠겨 있습니다. 실제 앱은 플랫폼 UX 제한을 따릅니다. 위 모의 상태 선택은 시연 전용입니다.';
  $('workspace').hidden = !allowed;
  if (!allowed) { $('lots').replaceChildren(); $('detail').replaceChildren(); return; }
  $('lots').innerHTML = lots.map(lot => {
    const v = describeLot(lot, state);
    return `<button type="button" class="lot ${state.selected === lot.id ? 'selected' : ''}" data-lot="${escape(lot.id)}" aria-pressed="${state.selected === lot.id}"><div class="lot-top"><span class="source">${label(lot.source)}</span><span>${escape(lot.walk)}</span></div><h3>${escape(lot.name)}</h3><strong class="status ${v.kind}">${escape(v.title)}</strong><p>${escape(v.detail)}</p><div class="lot-bottom"><span>${escape(lot.price)}</span><span>${freshness(v)}</span></div></button>`;
  }).join('');
  document.querySelectorAll('[data-lot]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'select', id: el.dataset.lot })));
  const lot = lots.find(l => l.id === state.selected);
  if (!lot) { $('detail').innerHTML = '<div class="empty"><span class="empty-mark">P</span><h2>근거를 보고 선택하세요.</h2><p>후보를 누르면 정보 출처와<br>진입 안내를 확인할 수 있습니다.</p><small>빈자리 예약이나 길찾기는 실행하지 않습니다.</small></div>'; return; }
  const v = describeLot(lot, state);
  $('detail').innerHTML = `<div class="detail-head"><span class="eyebrow">PARKING NOTES</span><h2>${escape(lot.name)}</h2><span class="source">${escape(lot.sourceName)}</span></div><div class="detail-body"><strong class="status ${v.kind}">${escape(v.title)}</strong><p>${escape(v.detail)}</p><dl><dt>관측 시점</dt><dd>${freshness(v)}</dd><dt>운영시간</dt><dd>${escape(lot.hours)}</dd><dt>이용 조건</dt><dd>${escape(lot.restriction)}</dd></dl><div class="entrance"><span>진입 안내 · 합성</span><h3>${escape(lot.entrance || '입구 정보 확인 필요')}</h3><p>${escape(lot.directions || '근거가 없어 임의 입구를 안내하지 않습니다.')}</p></div><div class="notice">향후 출차 대수·대기시간은 예측하지 않습니다. 참여 움직임이 있어도 빈자리가 있다는 뜻은 아닙니다.</div><details><summary>시연 판정 기준</summary><p>공식 형식 값은 ${POLICY.freshMs / 60_000}분 이상 지나면 표시를 중단합니다. 참여 관측은 최근 ${POLICY.freshMs / 60_000}분 이내 서로 다른 합성 참여자 ${POLICY.minContributors}명 이상일 때만 표시합니다. 실제 정확성·개인정보 보호를 보장하는 검증된 기준은 아닙니다.</p></details><div class="feedback"><h3>정보의 차이를 이해했나요?</h3><button type="button" data-feedback="useful">이해했어요</button><button type="button" data-feedback="unclear">아직 헷갈려요</button><p role="status">${state.feedback ? '이 화면에서만 표시한 피드백입니다. 저장·전송되지 않습니다.' : '실제 주차 성공 평가가 아닌 화면 이해도 확인입니다.'}</p></div></div>`;
  document.querySelectorAll('[data-feedback]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'feedback', value: el.dataset.feedback })));
}
$('mode').addEventListener('change', e => dispatch({ type: 'mode', value: e.target.value }));
$('scenario').addEventListener('change', e => { scenario = e.target.value; lots = makeLots(scenario); state = { ...state, now: DEMO_NOW, selected: null, feedback: null }; render(); });
$('connection').addEventListener('click', () => dispatch({ type: 'connection', value: !state.connected }));
$('advance').addEventListener('click', () => dispatch({ type: 'advance' }));
$('reset').addEventListener('click', () => { scenario = 'normal'; lots = makeLots(); state = { now: DEMO_NOW, mode: 'unknown', connected: true, selected: null, feedback: null }; render(); });
render();
