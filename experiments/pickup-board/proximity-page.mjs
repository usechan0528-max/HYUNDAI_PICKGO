import { ProximityDetector } from './proximity/detector.mjs';
const $ = id => document.getElementById(id);
const detector = new ProximityDetector();
let session, state, received = -Infinity, connected = false, generation, context, polling = false, demoTimer, notices = 0, lifecycle = 0;
try { session = JSON.parse(sessionStorage.getItem('pickupSession')); } catch {}
const fresh = () => connected && navigator.onLine && !document.hidden && performance.now() - received < 4000;
const usable = () => fresh() && state?.status === 'active' && state?.stage === 'waiting' && state?.role === 'driver' && !state?.proposal;
const cancel = reason => { clearTimeout(demoTimer); generation = null; detector.unavailable(reason); };
function render() {
  if (!fresh()) cancel(document.hidden ? 'background' : 'disconnected');
  if (state?.status === 'ended') { clearTimeout(demoTimer); generation = null; detector.end(); }
  else if (state && (state.stage !== 'waiting' || state.proposal)) cancel('manual-stage');
  $('proximityConnection').textContent = fresh() ? '방금 서버에서 확인' : '현재 회차 미확인';
  $('proximityPlace').textContent = fresh() ? state.place : '현재 승차지점 미확인';
  $('manualStage').textContent = !fresh() ? '직접 확인 상태: 미확인' : `직접 확인 상태: ${state.status === 'ended' ? '약속 종료' : state.stage === 'boarded' ? '탑승 확인됨' : state.stage === 'arrived' ? '운전자 도착 알림' : '도착 알림 전'}`;
  const value = detector.read();
  $('proximityState').textContent = value.state === 'near' ? '근처입니다 · 합성 좌표' : value.state === 'far' ? '아직 멀어요 · 합성 좌표' : '현재 미확인';
  $('proximityReason').textContent = !session ? '약속판에서 운전자 회차를 먼저 만들어 주세요.' : !fresh() ? '서버와 회차를 다시 확인해야 합니다.' : state.role !== 'driver' ? '차량 근접 시연은 운전자 화면에서 확인해 주세요.' : !usable() ? '장소 합의 전이나 수동 도착·탑승·종료 후에는 시연을 중지합니다.' : value.reason === 'stale' ? '관측이 만료됐습니다.' : value.reason === 'permission-denied' ? '위치 권한 거부를 시연했습니다.' : value.reason === 'confirming' ? '새 관측을 한 번 더 확인 중입니다.' : '두 번의 새 관측으로 판정하며 실제 차량 도착을 보장하지 않습니다.';
  $('proximityNotice').textContent = notices ? `이 시연 화면에서 발생한 근접 알림: ${notices}회 · 과거 시연 기록` : '근접 알림 없음';
  for (const id of ['demoNear','demoFar','demoDenied']) $(id).disabled = !usable();
}
async function refresh() {
  if (!session || polling || document.hidden) { render(); return; }
  polling = true; const started = performance.now(), capturedLifecycle = lifecycle;
  try {
    const response = await fetch(`/api/rooms/${session.id}`, { cache:'no-store', headers:{Authorization:`Bearer ${session.token}`}, signal:AbortSignal.timeout(3000) });
    const next = await response.json(); if (!response.ok) throw new Error('회차를 확인할 수 없습니다.');
    if (capturedLifecycle !== lifecycle || document.hidden || !navigator.onLine) return;
    if (state && next.version < state.version) throw new Error('이전 회차 응답입니다.');
    if (!Number.isSafeInteger(next.placeRevision) || next.placeRevision < 1) throw new Error('목적지 버전이 없습니다.');
    if (context && (context.id !== next.id || context.revision !== next.placeRevision)) cancel('initializing');
    if (!context || context.id !== next.id || context.revision !== next.placeRevision) context = {id:next.id, place:next.place, revision:next.placeRevision};
    state = next; received = started; connected = true; $('proximityError').textContent = '';
  } catch { connected = false; $('proximityError').textContent = '서버 연결 또는 참여 권한을 확인해 주세요.'; }
  finally { polling = false; render(); }
}
function simulate(near) {
  if (!usable()) return;
  clearTimeout(demoTimer);
  // Fixed synthetic origin; this is not a real pickup point or phone coordinate.
  let captured;
  try { captured = detector.bind(context.id, {id:context.place,revision:context.revision,latitude:0,longitude:0}); }
  catch { cancel('initializing'); $('proximityError').textContent = '관측 기준을 확인할 수 없습니다. 페이지를 다시 열어 주세요.'; render(); return; }
  generation = captured;
  const emit = () => {
    if (!usable() || generation !== captured) return;
    const now = performance.now();
    const result = detector.ingest(captured, {latitude:near ? 0.0001 : 0.003,longitude:0,accuracyMeters:5,observedAtMonoMs:now,receivedAtMonoMs:now,source:'synthetic'});
    if (result.notify && detector.canNotify(captured)) notices++;
    render();
  };
  emit(); demoTimer = setTimeout(emit, 150);
}
$('demoNear').onclick = () => simulate(true);
$('demoFar').onclick = () => simulate(false);
$('demoDenied').onclick = () => { cancel('permission-denied'); render(); };
addEventListener('offline', () => { lifecycle++; connected = false; cancel('disconnected'); render(); });
addEventListener('online', refresh);
addEventListener('pagehide', () => { lifecycle++; connected = false; cancel('background'); });
addEventListener('pageshow', refresh);
document.addEventListener('visibilitychange', () => { lifecycle++; connected = false; cancel('background'); render(); if (!document.hidden) refresh(); });
setInterval(refresh, 2000); setInterval(render, 250); refresh();
