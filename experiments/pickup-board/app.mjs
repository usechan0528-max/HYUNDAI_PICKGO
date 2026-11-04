const $ = id => document.getElementById(id);
let session = null, state = null, received = 0, online = false, busy = false, polling = false, unavailable = false;
const requestTimes = new WeakMap();
let editing = false, ending = null, actionError = '', dismissConfirmed = false;
const invitation = new URLSearchParams(location.hash.slice(1));
const hasInvite = invitation.has('invite') || invitation.has('room');
const validInvite = value => value && /^[a-f0-9-]{36}$/i.test(value.id) && /^[A-Za-z0-9_-]{32}$/.test(value.invite);
let incoming = null, previousSession = null;
try { previousSession = JSON.parse(sessionStorage.getItem('pickupSession')); } catch {}
try {
  const pending = JSON.parse(sessionStorage.getItem('pickupInvitation'));
  incoming = hasInvite ? { id: invitation.get('room'), invite: invitation.get('invite') } : pending;
  if (hasInvite && pending?.id === incoming.id && pending?.invite === incoming.invite) incoming.joinId = pending.joinId;
} catch { if (hasInvite) incoming = { id: invitation.get('room'), invite: invitation.get('invite') }; }
if (incoming || hasInvite) {
  $('create').hidden = true; $('joinBox').hidden = false;
  if (!validInvite(incoming)) {
    incoming = null; $('join').disabled = true;
    $('error').textContent = '초대 주소가 올바르지 않습니다. 운전자에게 받은 링크를 다시 열어 주세요.';
    try { sessionStorage.removeItem('pickupInvitation'); } catch {}
    history.replaceState(null, '', '/');
  } else if (previousSession?.id === incoming.id && previousSession?.role === 'rider') {
    session = previousSession; incoming = null;
    try { sessionStorage.removeItem('pickupInvitation'); } catch {}
    history.replaceState(null, '', '/');
  } else {
    try { sessionStorage.setItem('pickupInvitation', JSON.stringify(incoming)); history.replaceState(null, '', '/'); }
    catch { $('notice').textContent = '브라우저 저장이 제한되어 있습니다. 참여 전에는 원래 초대 링크를 보관해 주세요.'; }
    $('joinHint').textContent = previousSession ? '참여하면 이 탭의 기존 약속 접근 정보를 새 약속으로 바꿉니다. 기존 약속은 취소되지 않지만 이 탭에서 다시 열 수 없게 됩니다. 기존 약속을 유지하려면 초대를 닫아 주세요.' : '앱 설치·회원가입 없이 참여합니다. 위치 공유는 참여 후 따로 선택할 수 있어요.';
    if (previousSession?.id === incoming.id && previousSession?.role === 'driver') {
      $('join').disabled = true; $('notice').textContent = '이 탭은 이 약속의 운전자입니다. 초대를 닫거나 탑승자의 기기에서 링크를 열어 주세요.';
    }
  }
} else session = previousSession;
const save = value => {
  session = value;
  try { sessionStorage.setItem('pickupSession', JSON.stringify(value)); return true; }
  catch { $('notice').textContent = '브라우저 저장이 제한되어 새로고침 후 참여 정보를 복원할 수 없습니다. 이 탭을 유지해 주세요.'; return false; }
};
async function api(path, body, authenticated = true) {
  const started = performance.now();
  let response;
  try { response = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(4000),
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authenticated && session ? { Authorization: `Bearer ${session.token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
  catch { throw new Error('서버에 연결할 수 없습니다.'); }
  const data = await response.json(); if (!response.ok) { const e = new Error(data.error); e.status = response.status; throw e; } requestTimes.set(data, started); return data;
}
function adopt(data) { if (!state || data.version >= state.version) { state = data; received = requestTimes.get(data); online = true; unavailable = false; } render(); }
function fresh() { return online && navigator.onLine && !document.hidden && state && performance.now() - received < 6000; }
function render() {
  if (!session) return;
  $('welcome').hidden = true;
  const valid = fresh(), active = state?.status === 'active', can = valid && active && !busy;
  const boarded = state?.stage === 'boarded', arrived = state?.stage === 'arrived';
  if (!active || boarded || state?.proposal || !state?.joined) editing = false;
  if (!active || (ending !== null && ending !== state?.version)) ending = null;
  $('board').hidden = editing || ending !== null;
  $('editPlace').hidden = !editing;
  $('endConfirm').hidden = !ending;
  $('role').textContent = session.role === 'driver' ? '운전자 화면' : '탑승자 화면';
  $('connection').textContent = valid ? '방금 서버에서 확인' : '연결 확인 필요 · 이전 기록';
  $('connection').classList.toggle('stale', !valid); $('facts').classList.toggle('stale', !valid);
  $('pickupText').textContent = !valid ? '현재 미확인' : !active ? (state.outcome === 'completed' ? '픽업 완료' : '약속 취소 · 탑승 미완료') : boarded ? '탑승 확인됨' : arrived ? '운전자 도착 알림' : '도착 알림 전';
  $('headline').textContent = $('pickupText').textContent;
  $('placeLabel').textContent = valid ? '확정 승차지점' : '이전 승차지점 · 현재 미확인';
  $('place').textContent = state?.place || '확인 전';
  $('readyText').textContent = !valid ? '현재 미확인' : !active ? '약속 종료' : boarded ? '탑승자가 직접 확인 · 종료 대기' : !state.joined ? '참여 대기' : state.ready ? '준비 완료' : '아직 준비 중';
  const canInvite = valid && active && !state?.joined && session.role === 'driver' && !!session.invite;
  $('inviteBox').hidden = !canInvite; $('copyInvite').disabled = !canInvite;
  if (valid && (state?.joined || !active) && session.invite) { delete session.invite; save(session); }
  const url = canInvite ? `${location.origin}/#room=${session.id}&invite=${session.invite}` : '';
  $('inviteLink').href = url; $('inviteText').value = url;
  if (!canInvite) { $('inviteText').hidden = true; $('inviteStatus').textContent = ''; }
  $('inviteHelp').textContent = location.origin.startsWith('https://') ? '링크를 복사해 탑승자에게 보내세요. 링크를 가진 한 사람만 참여할 수 있습니다.' : '현재는 같은 컴퓨터에서만 열리는 시연 링크입니다. 휴대폰 연결은 HTTPS 서버 구성이 필요합니다.';
  $('phoneLink').textContent = session.role === 'rider' ? '내 위치 한 번 공유 · 선택' : '탑승자 위치 공유 상태';
  $('proximityLink').hidden = session.role === 'rider';
  $('readyButtons').hidden = session.role !== 'rider' || !active || boarded;
  document.querySelectorAll('[data-ready]').forEach(b => { b.disabled = !can || boarded; b.setAttribute('aria-pressed', String(state?.ready === (b.dataset.ready === 'true'))); });
  $('proposal').hidden = !state?.proposal || unavailable;
  if (state?.proposal) {
    $('proposedPlace').textContent = state.proposal.place;
    const own = state.proposal.by === session.role;
    $('proposalLabel').textContent = !valid ? '이전 제안 · 현재 미확인' : own ? '내 제안 · 응답 대기' : '상대 제안 · 아직 미확정';
    $('proposalText').textContent = !valid ? '마지막 확인 당시 제안입니다. 현재 상태는 미확인입니다.' : own ? '상대의 응답을 기다리고 있어요. 기존 승차지점은 그대로입니다.' : '상대가 이 장소를 제안했어요. 수락할까요?';
    $('withdraw').hidden = !own; $('withdraw').disabled = !can;
    $('decisions').hidden = own; $('accept').disabled = $('reject').disabled = !can;
  }
  $('normalActions').hidden = !active || !state?.joined || !!state?.proposal || unavailable;
  $('openPlace').hidden = boarded; $('openPlace').disabled = !can || boarded;
  $('progressHelp').textContent = boarded ? '탑승이 확인됐어요. 약속을 종료해 주세요.' : arrived ? (session.role === 'driver' ? '탑승자의 탑승 확인을 기다려요.' : '차량에 탄 뒤 직접 확인해 주세요.') : (session.role === 'driver' ? '확정 장소에 도착한 뒤 알려주세요.' : '운전자의 도착 알림을 기다려요.');
  for (const [id, show] of [['arrive', session.role === 'driver' && !arrived && !boarded], ['boarded', session.role === 'rider' && arrived], ['undoArrival', session.role === 'driver' && arrived], ['undoBoarding', session.role === 'rider' && boarded]]) {
    $(id).hidden = !active || !state?.joined || !show; $(id).disabled = !can || !!state?.proposal;
  }
  $('editingCurrent').textContent = `${valid ? '현재 장소' : '이전 장소 · 현재 미확인'}: ${state?.place || '확인 전'}`;
  document.querySelectorAll('[data-place]').forEach(b => { b.disabled = !can || boarded || b.dataset.place === state?.place; b.textContent = b.dataset.place + (b.dataset.place === state?.place ? ' · 현재' : ''); });
  $('nextPlace').disabled = !can;
  $('end').hidden = !active || unavailable; $('end').disabled = !can;
  $('end').textContent = boarded ? '픽업 완료로 종료' : '약속 취소';
  $('endTitle').textContent = boarded ? '픽업을 완료할까요?' : '탑승 없이 약속을 취소할까요?';
  $('endDescription').textContent = boarded ? '탑승 확인 후 완료로 기록됩니다. 종료하면 변경하거나 확인을 취소할 수 없어요.' : '탑승 완료로 기록하지 않습니다. 취소하면 이 회차를 변경할 수 없어요.';
  $('confirmEnd').textContent = boarded ? '완료 확정' : '약속 취소 확정';
  $('confirmEnd').disabled = !can || ending !== state?.version;
  $('new').hidden = !unavailable && state?.status !== 'ended';
  const eventText = state ? `${valid ? '' : '마지막 확인 기록 · 현재 미확인: '}${state.lastEvent}` : '';
  if ($('lastEvent').textContent !== eventText) $('lastEvent').textContent = eventText;
}
async function refresh() {
  if (!session || polling || busy) return;
  polling = true;
  try { const data = await api(`/api/rooms/${session.id}`); $('error').textContent = actionError; adopt(data); }
  catch (e) { online = false; unavailable = [401,403,404].includes(e.status); $('error').textContent = `${e.message} 최신 상태를 확인할 수 없습니다.`; render(); }
  finally { polling = false; }
}
async function act(type, extra = {}) {
  if (!fresh() || busy || !state) return;
  busy = true; actionError = ''; $('error').textContent = ''; render();
  try { adopt(await api(`/api/rooms/${session.id}/actions`, { type, ...extra, version: state.version, view: state.view, requestId: crypto.randomUUID() })); }
  catch (e) { online = false; actionError = `${e.message} 최신 상태를 확인하고 다시 선택해 주세요.`; $('error').textContent = actionError; }
  finally { busy = false; render(); await refresh(); }
}
$('create').onsubmit = async e => { e.preventDefault(); const button = e.submitter; button.disabled = true;
  try { save(await api('/api/rooms', { place: $('initialPlace').value }, false)); await refresh(); }
  catch (e) { $('error').textContent = e.message; } finally { button.disabled = false; } };
$('join').onclick = async () => { $('join').disabled = true;
  if (!validInvite(incoming) || (previousSession?.id === incoming.id && previousSession?.role === 'driver')) return;
  try {
    // Persist the retry key before consuming a one-use invitation. Refuse if
    // browser storage is unavailable; otherwise a lost response is recoverable.
    try {
      incoming.joinId ||= crypto.randomUUID();
      sessionStorage.setItem('pickupInvitation', JSON.stringify(incoming));
      if (JSON.parse(sessionStorage.getItem('pickupInvitation'))?.joinId !== incoming.joinId) throw new Error('storage');
    } catch { $('notice').textContent = '브라우저 저장이 제한되어 참여하지 않았습니다. 원래 초대 링크를 기본 브라우저에서 열어 주세요.'; return; }
    const joined = await api(`/api/rooms/${incoming.id}/join`, { invite: incoming.invite, joinId: incoming.joinId }, false);
    const stored = save(joined);
    if (stored) { incoming = null; try { sessionStorage.removeItem('pickupInvitation'); } catch {} }
    history.replaceState(null, '', '/');
    await refresh();
    if (!stored) $('notice').textContent = '브라우저 저장이 제한되어 있습니다. 이 탭을 유지해 주세요. 새로고침 후 참여 재시도는 최초 참여부터 5분 이내에만 가능하며, 탭을 닫으면 복구 정보를 잃습니다.';
  }
  catch (e) { $('error').textContent = e.status === 403 ? '이미 사용되었거나 종료된 초대입니다. 참여 정보를 잃었다면 운전자에게 새 약속을 요청해 주세요.' : e.status === 404 ? '약속이 만료되었거나 서버에서 사라졌습니다. 운전자에게 새 약속을 요청해 주세요.' : `${e.message} 같은 탭에서 5분 이내에 참여를 다시 눌러 주세요.`; } finally { $('join').disabled = false; } };
$('cancelJoin').onclick = () => {
  if (incoming?.joinId && !dismissConfirmed) {
    dismissConfirmed = true; $('cancelJoin').textContent = '참여 복구 포기하고 닫기';
    $('notice').textContent = '참여 결과를 확인하지 못한 초대입니다. 닫으면 재시도 정보를 잃어 이 초대로 다시 참여하지 못할 수 있습니다. 계속하려면 참여를 다시 누르세요.';
    return;
  }
  try { sessionStorage.removeItem('pickupInvitation'); } catch {} history.replaceState(null, '', '/'); location.assign('/');
};
$('copyInvite').onclick = async () => {
  if (!fresh() || !session?.invite || state?.joined || state?.status !== 'active') return;
  const url = $('inviteText').value;
  $('inviteText').hidden = false;
  $('inviteStatus').textContent = '복사 확인 중입니다. 아래 주소를 길게 눌러 직접 복사할 수도 있습니다.';
  try { await navigator.clipboard.writeText(url); if ($('inviteText').value === url) $('inviteStatus').textContent = '초대 링크를 복사했습니다. 탑승자에게 보내세요.'; }
  catch { if ($('inviteText').value === url) { $('inviteText').focus(); $('inviteText').select(); $('inviteStatus').textContent = '자동 복사가 지원되지 않습니다. 아래 주소를 길게 눌러 직접 복사해 주세요.'; } }
};
document.querySelectorAll('[data-ready]').forEach(b => b.onclick = () => act('ready', { ready: b.dataset.ready === 'true' }));
for (const [id, type] of [['arrive','arrive'], ['boarded','board'], ['undoArrival','undoArrival'], ['undoBoarding','undoBoarding']]) $(id).onclick = () => act(type);
$('openPlace').onclick = () => { if (fresh() && !busy) { editing = true; render(); } };
$('cancelPlace').onclick = () => { editing = false; render(); };
document.querySelectorAll('[data-initial]').forEach(b => b.onclick = () => {
  $('initialPlace').value = b.dataset.initial;
  document.querySelectorAll('[data-initial]').forEach(other => other.setAttribute('aria-pressed', String(other === b)));
});
$('propose').onsubmit = async e => { e.preventDefault(); if (!e.submitter?.dataset.place) return; $('nextPlace').value = e.submitter.dataset.place; await act('propose', { place: $('nextPlace').value }); };
$('accept').onclick = () => act('accept', { proposalId: state.proposal.id });
$('reject').onclick = () => act('reject', { proposalId: state.proposal.id });
$('withdraw').onclick = () => act('withdraw', { proposalId: state.proposal.id });
$('end').onclick = () => { if (fresh() && !busy) { ending = state.version; render(); } };
$('cancelEnd').onclick = () => { ending = null; render(); };
$('confirmEnd').onclick = () => { if (ending === state?.version) return act('end'); };
$('refresh').onclick = () => { actionError = ''; $('error').textContent = ''; refresh(); };
$('new').onclick = () => { sessionStorage.removeItem('pickupSession'); location.assign('/'); };
addEventListener('offline', () => { online = false; render(); });
addEventListener('online', refresh);
// Opening a different invitation in an existing tab can be a fragment-only
// navigation. Re-enter the explicit invitation flow instead of ignoring it.
addEventListener('hashchange', () => { if (location.hash) location.reload(); });
document.addEventListener('visibilitychange', () => { online = false; render(); if (!document.hidden) refresh(); });
setInterval(() => { if (!document.hidden) refresh(); }, 2000);
setInterval(render, 500);
render(); refresh();
