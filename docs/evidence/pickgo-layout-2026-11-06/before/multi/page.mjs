const $ = id => document.getElementById(id);
const storage = 'pickgo-multi-session-v1';
let session = null, state = null, busy = false, candidates = [], pendingCancel = null, invite = null, joinId = null;
let queue = Promise.resolve(), queued = 0, recoveringJoin = false;
try { session = JSON.parse(sessionStorage.getItem(storage) || 'null'); } catch { /* No persisted session. */ }
const fragment = new URLSearchParams(location.hash.slice(1));
if (fragment.has('invite')) {
  invite = { id: fragment.get('trip'), invite: fragment.get('invite') }; session = null; joinId = crypto.randomUUID();
  try { const saved = JSON.parse(sessionStorage.getItem('pickgo-multi-join') || 'null');
    if (saved?.id === invite.id && saved.invite === invite.invite) { joinId = saved.joinId; recoveringJoin = true; }
  } catch { /* A fresh invitation still works if durable retry storage can be written. */ }
}
function save() { try { sessionStorage.setItem(storage, JSON.stringify(session)); } catch { $('message').textContent = '이 브라우저에서 복원이 불가능합니다. 화면을 닫지 마세요.'; } }
async function api(path, body, authenticated = true) {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(authenticated && session ? { Authorization: `Bearer ${session.token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(8000) });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || '요청을 완료하지 못했습니다.'); error.status = response.status; throw error; }
  return data;
}
function run(fn, quiet = false) {
  const snapshot = state ? structuredClone(state) : null;
  queued++; busy = true;
  const task = queue.then(async () => {
    if (!quiet) $('error').textContent = '';
    try { await fn(snapshot); } catch (e) {
      $('error').textContent = e.message;
      if (e.status === 409 && session) { try { await refresh(); } catch { /* Preserve the original action failure. */ } }
    }
    finally { queued--; busy = queued > 0; }
  });
  queue = task; return task;
}
function command(type, extra = {}, snapshot = state) { return { type, ...extra, requestId: crypto.randomUUID(), version: snapshot.version, view: snapshot.view }; }
async function act(type, extra, snapshot = state) { state = await api(`/api/trips/${session.id}/actions`, command(type, extra, snapshot)); render(); }
function button(text, fn, disabled = false) { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.disabled = disabled; b.onclick = () => run(fn); return b; }
function option(select, value, text) { const el = document.createElement('option'); el.value = value; el.textContent = text; select.append(el); }
function stopLabel(id) { return state.stops.find(s => s.id === id)?.label || '승차 지점'; }
function cancel(id, name) { pendingCancel = { id, snapshot: structuredClone(state) }; $('confirmText').textContent = `${name}님의 픽업만 취소합니다. 취소는 되돌릴 수 없습니다.`; $('confirm').showModal(); }
function render() {
  $('setup').hidden = true; $('invitation').hidden = true; $('trip').hidden = false;
  const driver = state.role === 'driver', ended = state.status !== 'active';
  $('driver').hidden = !driver; $('rider').hidden = driver;
  $('mode').textContent = state.demo ? '데모 모드 · 이동시간은 합성 데이터이며 실제 도로·교통과 무관합니다.' : '수동 계획 · 실제 경로 데이터 미연결';
  $('tripStatus').textContent = { active: '진행 중', completed: '모두 탑승 완료', partial: '종료 · 일부 탑승 / 일부 취소', cancelled: '모두 취소' }[state.status];
  if (!driver) {
    const p = state.participant, done = ['boarded','cancelled'].includes(p.state);
    $('myPlace').textContent = `${p.name} · ${state.stop.label}`;
    $('myStatus').textContent = `${done ? (p.state === 'boarded' ? '탑승 완료' : '취소됨') : `${state.ordinal}번째 픽업 · ${state.arrived ? '차량 도착' : '도착 전'}`} · ${p.ready ? '준비 완료' : '준비 중'}`;
    for (const id of ['ready','notReady','cancelSelf']) $(id).disabled = ended || done;
    $('board').disabled = ended || done || !state.arrived; return;
  }
  $('addPanel').hidden = ended;
  $('addPerson').querySelector('button').disabled = !!state.active || state.participants.length >= 6;
  const previous = $('pickup').value; $('pickup').replaceChildren();
  for (const id of state.order) option($('pickup'), `stop:${id}`, `같은 지점 함께 승차 · ${stopLabel(id)}`);
  candidates.forEach((c, i) => option($('pickup'), `point:${i}`, `${c.name} · 장소 ${i + 1}`));
  if ([...$('pickup').options].some(o => o.value === previous)) $('pickup').value = previous;
  $('routeSummary').textContent = `남은 지점 ${state.order.length}곳 · 최종 목적지 ${state.destination ? '설정됨' : '없음'}`;
  $('stops').replaceChildren();
  state.order.forEach((id, i) => {
    const stop = state.stops.find(s => s.id === id), li = document.createElement('li'), title = document.createElement('strong');
    title.textContent = `${stop.label}${state.active === id ? (stop.arrived ? ' · 도착' : ' · 현재 픽업') : ''}`; li.append(title);
    const controls = document.createElement('div'); controls.className = 'actions';
    const move = (offset, snapshot) => { const order = [...snapshot.order]; [order[i], order[i+offset]] = [order[i+offset], order[i]]; return act('order', { order }, snapshot); };
    controls.append(button('위로', s => move(-1, s), ended || i === 0 || (!!state.active && i === 1)), button('아래로', s => move(1, s), ended || i === state.order.length - 1 || state.active === id)); li.append(controls); $('stops').append(li);
  });
  $('people').replaceChildren();
  for (const p of state.participants) {
    const box = document.createElement('div'); box.className = 'person'; const title = document.createElement('strong'); title.textContent = p.name; box.append(title);
    const text = document.createElement('p'); text.textContent = `${stopLabel(p.stopId)} · ${p.state === 'boarded' ? '탑승 완료' : p.state === 'cancelled' ? '취소' : !p.joined ? '미참여' : p.ready ? '준비 완료' : '준비 중'}`; box.append(text);
    const invitation = state.invites.find(x => x.id === p.id);
    if (invitation) {
      const link = `${location.origin}/multi#trip=${session.id}&invite=${invitation.invite}`;
      box.append(button('초대 링크 복사', async () => {
        try { await navigator.clipboard.writeText(link); $('message').textContent = `${p.name}님의 링크를 복사했습니다. 직접 전달하세요.`; }
        catch { const field = document.createElement('input'); field.value = link; field.readOnly = true; field.setAttribute('aria-label', `${p.name} 초대 링크`); box.append(field); field.select(); }
      }));
      const a = document.createElement('a'); a.href = link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = '탑승자 화면 열기'; box.append(a);
    }
    if (!ended && !['boarded','cancelled'].includes(p.state)) box.append(button('이 사람 픽업 취소', async () => cancel(p.id, p.name)));
    $('people').append(box);
  }
  $('recommend').disabled = ended || !state.order.length;
  $('next').disabled = ended || !!state.active || !state.order.length;
  $('arrive').disabled = ended || !state.active || !!state.stops.find(s => s.id === state.active)?.arrived;
  $('end').disabled = ended || !state.participants.length || state.participants.some(p => !['boarded','cancelled'].includes(p.state));
  const r = state.recommendation;
  $('recommendation').hidden = !r || ended;
  if (r) {
    $('recommendationText').textContent = `${r.order.map(stopLabel).join(' → ')} · ${Math.round(r.currentSeconds/60)}분 → ${Math.round(r.seconds/60)}분${r.mode === 'demo' ? ' (합성값)' : ''}`;
    $('recommendationSource').textContent = `${r.source} · ${new Date(r.observedAt).toLocaleTimeString()} 기준 · 준비 중인 사람도 포함 · 적용 전 순서는 유지됩니다.`;
    $('apply').disabled = Date.now() >= r.expiresAt;
  }
}
async function refresh() {
  if (!session) return;
  let next;
  try { next = await api(`/api/trips/${session.id}`); }
  catch (e) {
    if ([401,403,404].includes(e.status)) {
      session = null; state = null;
      try { sessionStorage.removeItem(storage); } catch { /* In-memory recovery still works. */ }
      $('trip').hidden = true; $('setup').hidden = false;
      $('message').textContent = '이전 회차가 만료되었거나 참여 권한이 없습니다. 운전자는 새 회차를 만들고, 탑승자는 새 초대를 받아 주세요.';
    }
    throw e;
  }
  const changed = !state || state.version !== next.version || state.recommendation?.id !== next.recommendation?.id;
  state = next; if (changed) render();
}
$('createTrip').onsubmit = e => { e.preventDefault(); run(async () => { session = await api('/api/trips', { origin: candidates[Number($('origin').value)].point, destination: $('destination').value === '' ? null : candidates[Number($('destination').value)].point, demo: $('demo').checked }, false); save(); await refresh(); }); };
$('addPerson').onsubmit = e => { e.preventDefault(); const name = $('personName').value, selected = $('pickup').value; run(async s => { const [kind, value] = selected.split(':'); const c = candidates[Number(value)]; await act('add', { name, ...(kind === 'stop' ? {stopId:value} : {point:c.point,label:`${c.name} · 장소 ${Number(value)+1}`}) }, s); $('personName').value = ''; }); };
$('refresh').onclick = () => run(refresh);
$('recommend').onclick = () => run(async s => { state = await api(`/api/trips/${session.id}/recommend`, command('recommend', {}, s)); render(); });
$('apply').onclick = () => run(s => act('apply', { recommendationId: s.recommendation.id }, s));
for (const id of ['next','arrive','end','board']) $(id).onclick = () => run(s => act(id, {}, s));
$('ready').onclick = () => run(s => act('ready', { ready: true }, s)); $('notReady').onclick = () => run(s => act('ready', { ready: false }, s));
$('cancelSelf').onclick = () => cancel(state.participant.id, state.participant.name);
$('keep').onclick = () => $('confirm').close();
$('confirmCancel').onclick = () => { const intent = pendingCancel; return run(async () => { try { await act('cancel', { participantId: intent.id }, intent.snapshot); } finally { $('confirm').close(); } }); };
$('leave').onclick = () => { session = null; save(); location.replace('/multi'); };
$('join').onclick = () => run(async () => {
  // Persist the retry key BEFORE consuming a one-use invite. A lost response is recoverable for five minutes.
  try { sessionStorage.setItem('pickgo-multi-join', JSON.stringify({ ...invite, joinId })); }
  catch { throw new Error('이 브라우저에 참여 복구 정보를 저장할 수 없습니다. 초대는 아직 사용하지 않았습니다. 브라우저 저장을 허용한 뒤 다시 참여하세요.'); }
  let joined;
  try { joined = await api(`/api/trips/${invite.id}/join`, { invite:invite.invite, joinId }, false); }
  catch (e) {
    if ([403,404,409].includes(e.status)) {
      try { sessionStorage.removeItem('pickgo-multi-join'); } catch { /* Do not retry an invalid invite in this page. */ }
      recoveringJoin = false; $('join').disabled = true;
      $('invitationText').textContent = '이 초대로는 참여를 복구할 수 없습니다. 운전자에게 기존 픽업 취소와 새 초대를 요청하세요. 회차 총 6명 한도에 도달했다면 새 회차가 필요합니다.';
    }
    throw e;
  }
  session = joined;
  try {
    sessionStorage.setItem(storage, JSON.stringify(joined)); sessionStorage.removeItem('pickgo-multi-join');
    history.replaceState(null, '', '/multi');
  } catch { $('message').textContent = '참여했지만 브라우저 저장에 실패했습니다. 이 화면에서는 계속 사용할 수 있습니다. 새로고침 복원은 첫 요청 후 5분 이내에만 가능합니다.'; }
  invite = null; await refresh();
});
await run(async () => {
  if (session) { $('setup').hidden = true; $('trip').hidden = false; }
  let data;
  try { data = await api('/api/map', undefined, false); } catch { data = { available: false }; }
  candidates = data.available ? data.recommendations : [];
  candidates.forEach((c, i) => { option($('origin'), String(i), `${c.name} · 장소 ${i+1}`); option($('destination'), String(i), `${c.name} · 장소 ${i+1}`); });
  $('createTrip').querySelector('button').disabled = !candidates.length;
  if (!candidates.length) $('message').textContent = '사용 가능한 지도에 표시된 장소가 없습니다. 새 회차 생성은 잠시 사용할 수 없습니다.';
  if (invite) {
    $('setup').hidden = true; $('invitation').hidden = false; $('join').disabled = true;
    try { const p = await api(`/api/trips/${invite.id}/preview`, {invite: invite.invite}, false); $('invitationText').textContent = `${p.name} · ${p.stop.label}${p.demo ? ' · 합성 이동시간 시연' : ''}`; }
    catch (e) { if (!recoveringJoin) throw e; $('invitationText').textContent = '이 브라우저에서 시작한 참여를 다시 확인합니다. 첫 참여 요청 후 5분 이내에 복원할 수 있습니다.'; }
    $('join').disabled = false;
  }
  else if (session) await refresh();
});
setInterval(() => { if (!busy && session && document.visibilityState === 'visible' && !$('confirm').open) run(refresh, true); }, 5000);
