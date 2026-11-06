import { placeLabel } from './place-label.mjs';
const $ = id => document.getElementById(id);
let session = null, state = null, received = 0, online = false, busy = false, polling = false, unavailable = false;
const requestTimes = new WeakMap();
let toolsAttention = false;
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
    $('error').textContent = '잘못된 초대 링크입니다. 운전자에게 다시 받으세요.';
    try { sessionStorage.removeItem('pickupInvitation'); } catch {}
    history.replaceState(null, '', '/');
  } else if (previousSession?.id === incoming.id && previousSession?.role === 'rider') {
    session = previousSession; incoming = null;
    try { sessionStorage.removeItem('pickupInvitation'); } catch {}
    history.replaceState(null, '', '/');
  } else {
    try { sessionStorage.setItem('pickupInvitation', JSON.stringify(incoming)); history.replaceState(null, '', '/'); }
    catch { $('notice').textContent = '이 브라우저는 저장이 막혀 있습니다. 참여할 때까지 초대 링크를 지우지 마세요.'; }
    $('joinHint').textContent = previousSession ? '참여하면 이 탭의 기존 픽업은 다시 열 수 없습니다(취소되지는 않습니다). 유지하려면 초대를 닫으세요.' : '위치 공유는 참여 후 선택합니다.';
    if (previousSession?.id === incoming.id && previousSession?.role === 'driver') {
      $('join').disabled = true; $('notice').textContent = '이 탭은 이 픽업의 운전자 화면입니다. 링크는 탑승자 기기에서 여세요.';
    }
  }
} else session = previousSession;
$('pickupQuestion').textContent = incoming || session?.role === 'rider' ? '어디서 탈까요?' : '어디서 태울까요?';
const save = value => {
  session = value;
  try { sessionStorage.setItem('pickupSession', JSON.stringify(value)); return true; }
  catch { $('notice').textContent = '저장이 막혀 새로고침하면 참여 정보가 사라집니다. 이 탭을 닫지 마세요.'; return false; }
};
async function api(path, body, authenticated = true) {
  const started = performance.now();
  let response;
  try { response = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(4000),
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authenticated && session ? { Authorization: `Bearer ${session.token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
  catch { throw new Error('서버에 연결할 수 없습니다.'); }
  let data;
  try { data = await response.json(); } catch { const e = new Error('서버 응답을 확인하지 못했습니다. 다시 시도해 주세요.'); e.status = response.status; throw e; }
  if (!response.ok) { const e = new Error(data.error); e.status = response.status; throw e; } requestTimes.set(data, started); return data;
}
function adopt(data) { if (!state || data.version >= state.version) { state = data; received = requestTimes.get(data); online = true; unavailable = false; } render(); }
function fresh() { return online && navigator.onLine && !document.hidden && state && performance.now() - received < 6000; }
function render() {
  if (!session) return;
  $('welcome').hidden = true;
  const valid = fresh(), active = state?.status === 'active', can = valid && active && !busy;
  const attention = !!state && (!valid || !active);
  if (attention && !toolsAttention) $('pickupTools').open = true;
  toolsAttention = attention;
  const boarded = state?.stage === 'boarded', arrived = state?.stage === 'arrived';
  if (!active || boarded || state?.proposal || !state?.joined) editing = false;
  if (!active || (ending !== null && ending !== state?.version)) ending = null;
  $('board').hidden = editing || ending !== null;
  $('editPlace').hidden = !editing;
  $('endConfirm').hidden = !ending;
  $('editQuestion').textContent = session.role === 'rider' ? '어디서 탈까요?' : '어디서 태울까요?';
  $('role').textContent = session.role === 'driver' ? '운전자 화면' : '탑승자 화면';
  $('connection').textContent = valid ? '픽업 현황 연결됨' : '연결 확인 필요 · 이전 기록';
  $('connection').classList.toggle('stale', !valid); $('facts').classList.toggle('stale', !valid);
  $('pickupText').textContent = !valid ? '현재 미확인' : !active ? (state.outcome === 'completed' ? '픽업 완료' : '픽업 취소') : boarded ? '탑승 완료' : arrived ? '운전자 도착' : '운전자 도착 전';
  $('headline').textContent = $('pickupText').textContent;
  $('placeLabel').textContent = valid ? '픽업 장소' : '이전 픽업 장소 · 현재 미확인';
  $('place').textContent = placeLabel(state?.place);
  $('placeConfirmed').hidden = !(valid && active && state?.joined && !state?.proposal && state?.place);
  $('selectedPoint').textContent = state?.mapPoint ? `${valid ? '' : '이전 기록 · '}선택한 장소 · 현장 표지 확인` : state?.pickupPoint ? `${valid ? '' : '이전 기록 · ' }선택한 장소` : '';
  $('readyText').textContent = !valid ? '현재 미확인' : !active ? '픽업 종료' : boarded ? '탑승 완료 · 종료 대기' : !state.joined ? '탑승자 참여 대기' : state.ready ? '탑승자 준비 완료' : '탑승자 준비 중';
  const canInvite = valid && active && !state?.joined && session.role === 'driver' && !!session.invite;
  $('inviteBox').hidden = !canInvite; $('copyInvite').disabled = !canInvite;
  if (valid && (state?.joined || !active) && session.invite) { delete session.invite; save(session); }
  const url = canInvite ? `${location.origin}/#room=${session.id}&invite=${session.invite}` : '';
  $('inviteLink').href = url; $('inviteText').value = url;
  if (!canInvite) { $('inviteText').hidden = true; $('inviteStatus').textContent = ''; }
  $('inviteHelp').hidden = !location.origin.startsWith('https://');
  $('inviteHelp').textContent = location.origin.startsWith('https://') ? '탑승자 1명에게 링크를 보내세요.' : '같은 컴퓨터용 시연 링크 · 휴대폰 연결은 HTTPS 필요';
  $('phoneLink').textContent = session.role === 'rider' ? '내 위치 공유 · 선택' : '탑승자 위치';
  $('proximityLink').hidden = session.role === 'rider';
  $('readyButtons').hidden = session.role !== 'rider' || !active || boarded;
  document.querySelectorAll('[data-ready]').forEach(b => { b.disabled = !can || boarded; b.setAttribute('aria-pressed', String(state?.ready === (b.dataset.ready === 'true'))); });
  $('proposal').hidden = !state?.proposal || unavailable;
  if (state?.proposal) {
    $('proposedPlace').textContent = placeLabel(state.proposal.place, true);
    const own = state.proposal.by === session.role;
    $('proposalLabel').textContent = !valid ? '이전 제안 · 현재 미확인' : own ? '내 제안 · 응답 대기' : '상대 제안';
    $('proposalText').textContent = !valid ? '마지막으로 확인한 제안입니다. 현재 상태는 미확인입니다.' : own ? '상대가 수락할 때까지 기존 장소를 유지합니다.' : '이 장소에서 만날까요?';
    $('withdraw').hidden = !own; $('withdraw').disabled = !can;
    $('decisions').hidden = own; $('accept').disabled = $('reject').disabled = !can;
  }
  $('normalActions').hidden = !active || !state?.joined || !!state?.proposal || unavailable;
  $('openPlace').hidden = boarded; $('openPlace').disabled = !can || boarded;
  $('progressHelp').textContent = boarded ? '모두 탔다면 픽업을 종료하세요.' : arrived ? (session.role === 'driver' ? '탑승 확인 대기' : '차에 탔다면 ‘탑승했어요’를 누르세요.') : (session.role === 'driver' ? '' : '운전자 도착 대기');
  for (const [id, show] of [['arrive', session.role === 'driver' && !arrived && !boarded], ['boarded', session.role === 'rider' && arrived], ['undoArrival', session.role === 'driver' && arrived], ['undoBoarding', session.role === 'rider' && boarded]]) {
    $(id).hidden = !active || !state?.joined || !show; $(id).disabled = !can || !!state?.proposal;
  }
  $('editingCurrent').textContent = `${valid ? '현재 장소' : '이전 장소 · 현재 미확인'}: ${placeLabel(state?.place)}`;
  document.querySelectorAll('[data-place]').forEach(b => { b.disabled = !can || boarded || b.dataset.place === state?.place; b.textContent = b.dataset.place + (b.dataset.place === state?.place ? ' · 현재' : ''); });
  $('nextPlace').disabled = !can;
  $('end').hidden = !active || unavailable; $('end').disabled = !can;
  $('end').textContent = boarded ? '픽업 완료' : '픽업 취소';
  $('endTitle').textContent = boarded ? '픽업을 완료할까요?' : '탑승 없이 픽업을 취소할까요?';
  $('endDescription').textContent = boarded ? '완료로 기록합니다. 이후에는 되돌릴 수 없습니다.' : '미탑승 취소로 기록합니다. 이후에는 되돌릴 수 없습니다.';
  $('confirmEnd').textContent = boarded ? '완료 확정' : '취소 확정';
  $('confirmEnd').disabled = !can || ending !== state?.version;
  $('new').hidden = !unavailable && state?.status !== 'ended';
  const eventText = state ? `${valid ? '' : '마지막 확인 기록 · 현재 미확인: '}${state.lastEvent}` : '';
  if ($('lastEvent').textContent !== eventText) {
    $('lastEvent').textContent = eventText;
    $('actionAnnouncement').textContent = eventText;
  }
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
  catch (e) { online = false; actionError = `${e.message} 최신 상태를 보고 다시 누르세요.`; $('error').textContent = actionError; }
  finally { busy = false; render(); await refresh(); }
}
let homeGeneration=0, homeCandidates=[], homeSelected=null, homeCreating=false, homePlace=null, homeResults=[];
const homeButtons=[...document.querySelectorAll('[data-home-candidate]')];
function renderHomeCandidates() {
  homeButtons.forEach((b,i)=>{const c=homeCandidates[i];b.hidden=!c;b.disabled=homeCreating||!c;b.textContent=c?`${i+1}. ${c.name} · 직선 ${c.distanceM}m`:'';b.setAttribute('aria-pressed',String(!!c&&c===homeSelected));});
  $('homeStart').disabled=homeCreating||!homeSelected;
  $('homeStart').textContent=homeSelected?'여기서 픽업':'픽업 장소를 선택하세요';
  for(const id of ['placeQuery','searchPlaces','homeManual'])$(id).disabled=homeCreating;
}
function resetHomeSearch() {
  homeGeneration++;homeCandidates=[];homeSelected=null;homePlace=null;homeResults=[];
  $('searchResults').replaceChildren();
  $('homeResults').hidden=true;$('homeResults').open=true;$('homeCandidates').hidden=true;renderHomeCandidates();
}
async function searchPlaces() {
  if(homeCreating||session||incoming)return;resetHomeSearch();
  const query=$('placeQuery').value.trim();
  if(!query){$('searchStatus').textContent='장소 이름을 입력해 주세요.';return;}
  const generation=homeGeneration;$('searchStatus').textContent='장소를 검색하는 중…';
  try{
    const data=await api('/api/map/search',{query},false);
    if(generation!==homeGeneration)return;
    homeResults=data.results;
    $('homeResults').hidden=false;
    $('searchStatus').textContent=homeResults.length?`검색 결과 ${homeResults.length}곳 · 양재 주변 지도`:'현재 양재 주변 지도에서 찾지 못했습니다. 다른 장소 이름이나 도로명으로 검색해 주세요.';
    for(const place of homeResults){
      const button=document.createElement('button');button.type='button';button.className='secondary search-result';
      const title=document.createElement('strong'),detail=document.createElement('span');
      title.textContent=place.name;detail.textContent=[place.kind,place.address||'양재 주변'].filter(Boolean).join(' · ');
      button.append(title,detail);button.onclick=()=>selectHomePlace(place);$('searchResults').append(button);
    }
  }catch(e){if(generation!==homeGeneration)return;$('searchStatus').textContent=`검색하지 못했습니다. ${e.message}`;}
}
$('placeQuery').oninput=()=>{if(homeCreating)return;resetHomeSearch();$('searchStatus').textContent='';};
$('placeQuery').onkeydown=e=>{if(e.key==='Enter'&&e.isComposing)e.preventDefault();};
$('create').onsubmit=e=>{e.preventDefault();return searchPlaces();};
async function selectHomePlace(place){
  if(homeCreating||!homeResults.includes(place))return;homePlace=place;
  $('homeResults').open=false;
  $('homeCandidateHeading').textContent=`${place.name} 주변 픽업 장소`;
  const generation=++homeGeneration;homeCandidates=[];homeSelected=null;
  $('homeCandidates').hidden=false;$('homeCandidateStatus').textContent='주변 픽업 장소를 불러오는 중…';renderHomeCandidates();$('homeCandidateHeading').focus();
  try {const data=await api(`/api/map?place=${encodeURIComponent(place.id)}`,undefined,false);if(generation!==homeGeneration)return;
    homeCandidates=data.available?data.recommendations.slice(0,3):[];
    $('homeCandidateStatus').textContent=homeCandidates.length?`주변 픽업 장소 ${homeCandidates.length}곳`:data.available?'이 장소 주변에는 추천할 장소가 없습니다. 직접 지도에서 확인해 주세요.':'지도 데이터 갱신이 필요합니다.';
  }catch(e){if(generation!==homeGeneration)return;$('homeCandidateStatus').textContent=`장소를 불러오지 못했습니다. 검색 결과를 펼쳐 다시 선택해 주세요. ${e.message}`;}
  renderHomeCandidates();
};
homeButtons.forEach((b,i)=>b.onclick=()=>{if(homeCreating)return;homeSelected=homeCandidates[i]||null;renderHomeCandidates();});
$('homeManual').onclick=()=>{if(!homeCreating&&homePlace&&!$('homeCandidates').hidden)location.assign(`/map?place=${encodeURIComponent(homePlace.id)}`);};
$('homeStart').onclick=async()=>{
  if(homeCreating||!homeSelected||session||incoming)return;
  homeCreating=true;$('error').textContent='';renderHomeCandidates();
  try{save(await api('/api/rooms',{point:homeSelected.point},false));await refresh();}
  catch(e){$('error').textContent=e.message;if([400,409].includes(e.status)){homeSelected=null;homeCandidates=[];$('homeCandidateStatus').textContent='선택 가능한 장소가 바뀌었습니다. 검색 결과를 펼쳐 다시 선택해 최신 장소 목록을 확인하세요.';}}
  finally{homeCreating=false;renderHomeCandidates();}
};
$('join').onclick = async () => { $('join').disabled = true;
  if (!validInvite(incoming) || (previousSession?.id === incoming.id && previousSession?.role === 'driver')) return;
  try {
    // Persist the retry key before consuming a one-use invitation. Refuse if
    // browser storage is unavailable; otherwise a lost response is recoverable.
    try {
      incoming.joinId ||= crypto.randomUUID();
      sessionStorage.setItem('pickupInvitation', JSON.stringify(incoming));
      if (JSON.parse(sessionStorage.getItem('pickupInvitation'))?.joinId !== incoming.joinId) throw new Error('storage');
    } catch { $('notice').textContent = '저장이 막혀 참여하지 않았습니다. 초대 링크를 기본 브라우저에서 여세요.'; return; }
    const joined = await api(`/api/rooms/${incoming.id}/join`, { invite: incoming.invite, joinId: incoming.joinId }, false);
    const stored = save(joined);
    if (stored) { incoming = null; try { sessionStorage.removeItem('pickupInvitation'); } catch {} }
    history.replaceState(null, '', '/');
    await refresh();
    if (!stored) $('notice').textContent = '저장이 막혀 있습니다. 이 탭을 닫지 마세요. 새로고침 후 재참여는 첫 참여부터 5분 안에만 됩니다.';
  }
  catch (e) { $('error').textContent = e.status === 403 ? '이미 쓰였거나 끝난 초대입니다. 운전자에게 새 링크를 받으세요.' : e.status === 404 ? '만료된 픽업입니다. 운전자에게 새 링크를 받으세요.' : `${e.message} 이 탭에서 5분 안에 참여를 다시 누르세요.`; } finally { $('join').disabled = false; } };
$('cancelJoin').onclick = () => {
  if (incoming?.joinId && !dismissConfirmed) {
    dismissConfirmed = true; $('cancelJoin').textContent = '재참여 포기하고 닫기';
    $('notice').textContent = '참여 결과를 확인하지 못했습니다. 닫으면 재시도 정보가 사라져 이 초대로 다시 참여하지 못할 수 있습니다. 계속하려면 참여를 누르세요.';
    return;
  }
  try { sessionStorage.removeItem('pickupInvitation'); } catch {} history.replaceState(null, '', '/'); location.assign('/');
};
$('copyInvite').onclick = async () => {
  if (!fresh() || !session?.invite || state?.joined || state?.status !== 'active') return;
  const url = $('inviteText').value;
  $('inviteText').hidden = false;
  $('inviteStatus').textContent = '복사 중입니다. 아래 주소를 길게 눌러 직접 복사해도 됩니다.';
  try { await navigator.clipboard.writeText(url); if ($('inviteText').value === url) $('inviteStatus').textContent = '복사했습니다. 탑승자에게 보내세요.'; }
  catch { if ($('inviteText').value === url) { $('inviteText').focus(); $('inviteText').select(); $('inviteStatus').textContent = '자동 복사가 안 됩니다. 아래 주소를 길게 눌러 직접 복사하세요.'; } }
};
document.querySelectorAll('[data-ready]').forEach(b => b.onclick = () => act('ready', { ready: b.dataset.ready === 'true' }));
for (const [id, type] of [['arrive','arrive'], ['boarded','board'], ['undoArrival','undoArrival'], ['undoBoarding','undoBoarding']]) $(id).onclick = () => act(type);
$('openPlace').onclick = () => { if (fresh() && !busy) { editing = true; render(); } };
$('cancelPlace').onclick = () => { editing = false; render(); };
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
