import { PhoneShare } from './phone-controller.mjs';
const $=id=>document.getElementById(id);
let session=null, state=null, freshUntil=0, sampleUntil=0, sampleSeenAt=0, sample=null, polling=false, suppressSample=false;
try { session=JSON.parse(sessionStorage.getItem('pickupSession')); } catch {}
const environment=()=>navigator.onLine && !document.hidden && globalThis.isSecureContext;
const allowed=()=>environment() && session?.role==='rider' && state?.status==='active' && state.stage!=='boarded' && performance.now()<freshUntil;
async function request(path,body,keepalive=false) {
 const response=await fetch(`/api/rooms/${session.id}${path}`,{method:body?'POST':'GET',cache:'no-store',keepalive,signal:AbortSignal.timeout(body?4000:2000),headers:{Authorization:`Bearer ${session.token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json(); if(!response.ok) {const error=new Error('서비스 확인 실패');error.status=response.status;throw error;} return data;
}
const share=new PhoneShare({geo:navigator.geolocation,send:(body,keep)=>request('/phone',body,keep),allowed,notify:text=>{if(!share.current){suppressSample=true;sample=null;}$('message').textContent=text; render();}});
function render() {
 $('consent').hidden=session?.role!=='rider';
 $('share').disabled=!allowed() || !!share.current;
 $('context').textContent=!session?'먼저 약속판에서 회차에 참여해 주세요.':performance.now()>=freshUntil?'현재 회차 미확인 · 위치 수집 중지':state?.status!=='active'?'회차가 종료되었습니다.':state.stage==='boarded'?'탑승이 확인되어 위치 공유를 종료합니다.':`${session.role==='rider'?'탑승자':'운전자'} · ${state.place}`;
 if(suppressSample || !environment() || performance.now()>=sampleUntil || state?.status!=='active' || state?.stage==='boarded') sample=null;
 $('sample').textContent=sample?`휴대폰 위치 1개 수신 · 정확도 약 ${Math.ceil(sample.accuracy)}m · 관측 ${Math.max(0,Math.floor((sample.ageMs+Math.max(0,performance.now()-sampleSeenAt))/1000))}초 전 · 자동 만료까지 ${Math.ceil((sampleUntil-performance.now())/1000)}초`:'공유된 최신 위치 없음';
 if(share.current && !allowed()) void share.stop('회차 또는 연결을 확인할 수 없어 중지했습니다.');
}
async function refresh() {
 if(!session || polling || document.hidden) return;
 polling=true; const began=performance.now(), generation=share.generation;
 try { const next=await request('');
   if(generation!==share.generation || !environment()) return;
   const placeChanged = state && state.placeRevision !== next.placeRevision;
   state=next; freshUntil=began+6000;
   if(placeChanged){sample=null;if(share.current) void share.stop('승차지점이 바뀌어 위치 공유를 중지했습니다. 다시 공유하려면 새로 동의해 주세요.');}
   render();
   if(generation!==share.generation) return;
   const location=await request('/phone'); if(generation===share.generation && environment()){sample=location.sample; sampleSeenAt=began; sampleUntil=began+(sample?.remainingMs||0);}
 } catch { freshUntil=0; sample=null; } finally {polling=false; render();}
}
$('share').onclick=()=>{if(allowed()){suppressSample=false;void share.start(state);}};
$('stop').onclick=()=>{sample=null; void share.stop();};
$('decline').onclick=()=>{sample=null; void share.stop('동의하지 않았습니다. 수동 상태 알림을 계속 이용할 수 있습니다.');};
addEventListener('offline',()=>{freshUntil=0;sample=null;void share.stop('오프라인으로 수집을 중지했습니다.');render();});
addEventListener('pagehide',()=>{void share.stop('페이지를 떠나 공유를 중지했습니다.');});
document.addEventListener('visibilitychange',()=>{freshUntil=0;sample=null;if(document.hidden) void share.stop('페이지가 보이지 않아 공유를 중지했습니다.'); else void refresh();});
addEventListener('online',()=>{void refresh();});
// Permission changes are optional browser support; an error callback still stops the watch.
navigator.permissions?.query({name:'geolocation'}).then(permission=>{permission.onchange=()=>{if(permission.state==='denied'){sample=null;void share.stop('위치 권한이 철회되었습니다.');}};}).catch(()=>{});
if(!globalThis.isSecureContext || !navigator.geolocation) $('message').textContent='이 환경은 위치 수집을 지원하지 않습니다. 휴대폰 연결에는 HTTPS 검증이 필요합니다.';
setInterval(refresh,2000);setInterval(render,250);render();void refresh();
