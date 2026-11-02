const $ = id => document.getElementById(id);
let data = null, loading = false, generation = 0, controller, requestStarted = 0, requestWall = 0;
const time = n => n === null ? '없음' : new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Seoul'}).format(n);
function render() {
  const allowed = $('mode').value === 'parked';
  $('lock').hidden = allowed; $('result').hidden = !allowed; $('refresh').disabled = !allowed || loading;
  $('counts').textContent = ''; $('times').textContent = '';
  if (!allowed) { $('status').textContent = ''; return; }
  if (loading) { $('status').textContent = '공급자에 확인 중…'; return; }
  if (!data) { $('status').textContent = '확인 버튼을 눌러주세요'; return; }
  const fresh = data.status === 'fresh' && Number.isFinite(data.ageMs) && data.ageMs >= 0 && data.ageMs + Math.max(performance.now() - requestStarted, Date.now() - requestWall) < 300000;
  $('status').textContent = fresh ? '최근 공급자 관측 · 일반 여석 미확인' : data.status === 'unavailable' ? '연결 실패 · 수치 표시 안 함' : '오래되거나 확인할 수 없는 관측 · 수치 표시 안 함';
  if(fresh) $('counts').textContent = `총 ${data.capacity}면 · 주차 차량 ${data.occupied}대`;
  $('times').textContent = `공급자 관측: ${time(data.observedAt)} (KST) / 서버 수신: ${time(data.fetchedAt)} (KST)`;
}
$('mode').addEventListener('change',()=>{generation++; controller?.abort(); loading=false; data=null; render();});
$('refresh').addEventListener('click',async()=>{
  requestStarted = performance.now(); requestWall = Date.now(); const current = ++generation; controller = new AbortController(); const requestController = controller; loading=true; data=null; render();
  const timeout = setTimeout(()=>requestController.abort(),10000);
  try { const response = await fetch('/api/parking',{signal:requestController.signal,cache:'no-store'}); const result = await response.json(); if(current===generation) data=result; }
  catch { if(current===generation) data={status:'unavailable',observedAt:null,fetchedAt:Date.now()}; }
  finally { clearTimeout(timeout); if(current===generation){loading=false;render();} }
});
document.addEventListener('visibilitychange',()=>{generation++; controller?.abort(); loading=false; data=null; render();});
setInterval(render,1000);
render();
