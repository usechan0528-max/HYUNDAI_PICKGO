import { ContinuousShare } from './controller.mjs';
const $=id=>document.getElementById(id);
let session=null,state=null,result=null,until=0,freshUntil=0,busy=false,polling=false,renderedSnapshot=null;
try{session=JSON.parse(sessionStorage.getItem('pickupSession'));}catch{}
const environment=()=>navigator.onLine&&!document.hidden;
const allowed=()=>environment()&&state?.status==='active'&&state?.stage!=='boarded'&&state?.joined&&performance.now()<freshUntil;
async function request(path,body,keepalive=false){
 const response=await fetch(`/api/rooms/${session.id}${path}`,{method:body?'POST':'GET',cache:'no-store',keepalive,signal:AbortSignal.timeout(4000),headers:{Authorization:`Bearer ${session.token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();if(!response.ok)throw Error(data.error||'연결을 확인해 주세요.');return data;
}
const share=new ContinuousShare({geo:navigator.geolocation,allowed,send:(body,keep)=>request('/recommendation',body,keep),notify:text=>{if(!share.current){result=null;$('message').textContent=text;}else if(result){result={...result,snapshot:null};}render();}});
const context=()=>({version:state.version,view:state.view,requestId:crypto.randomUUID()});
function render(){
 const can=allowed()&&!busy;
 $('context').textContent=!session?'약속판에서 먼저 회차에 참여해 주세요.':!allowed()?'현재 회차 미확인 또는 공유 불가':`${session.role==='driver'?'운전자':'탑승자'} · 확정 지점: ${state.place}`;
 for(const id of ['west','east'])$(id).disabled=!can||!!share.current||result?.mode!=='synthetic';
 $('calculate').disabled=!can||!result?.driverFresh||!result?.riderFresh;
 $('sharing').textContent=`내 공유 ${share.current?'켜짐':'꺼짐'} · 차량 ${result?.driverFresh?'최신':'미확인'} · 탑승자 ${result?.riderFresh?'최신':'미확인'}`;
 if(!can||!result?.snapshot||performance.now()>=until){$('candidates').replaceChildren();renderedSnapshot=null;}
 $('proposal').hidden=!state?.proposal||!allowed();
 if(state?.proposal){$('proposed').textContent=state.proposal.place;const e=result?.proposalEvidence;$('proposalEvidence').textContent=e?`제안 당시 근거${e.stale?' · 현재 재확인 필요':''}: ${e.reason} · ${e.source} (${e.reference}) · 확인 ${new Date(e.checkedAt).toLocaleTimeString()} · 유효 ${new Date(e.validUntil).toLocaleTimeString()}. 수락 시 최신 위치·경로·정차 근거를 다시 확인합니다.`:'추천 근거가 없거나 현재 미확인입니다. 추천 화면 수락은 검증된 추천 제안에만 적용됩니다.';const own=state.proposal.by===session.role;$('accept').hidden=$('reject').hidden=own;$('withdraw').hidden=!own;for(const id of ['accept','reject','withdraw'])$(id).disabled=!can;}
 if(share.current&&(!allowed()||performance.now()>=share.current.until))void share.stop('위치 공유 조건이 끝나 중지했습니다.');
}
const statuses={'provider-invalid':'장소와 진입로 정보가 일치하지 않습니다. 다시 확인해 주세요.','provider-unavailable':'실제 위치·경로·정차 데이터가 연결되지 않았습니다. 수동 장소 합의를 이용해 주세요.','no-eligible-candidate':'정차·접근 근거를 만족하는 장소가 없습니다.','location-unavailable':'양측의 새 위치가 필요합니다.','route-unavailable':'현재 위치에 맞는 경로가 없습니다.','catalog-unavailable':'검증된 장소 대장이 연결되지 않았습니다.'};
function show(data,began){
 result=data;until=began+(data.snapshot?.remainingMs||0);$('mode').textContent=data.mode==='synthetic'?'합성 위치·경로·정차 근거 시연':'실제 연동 준비 · 추천 비활성';
 if(statuses[data.status])$('message').textContent=statuses[data.status];
 if(!allowed()||!data.snapshot||performance.now()>=until){$('candidates').replaceChildren();renderedSnapshot=null;return;}
 const renderKey=`${data.snapshot.id}:${state.version}`;if(renderedSnapshot===renderKey)return;
 $('candidates').replaceChildren();renderedSnapshot=renderKey;
 for(const [i,c] of (data.snapshot?.candidates||[]).entries()){
  const b=document.createElement('button');b.className='candidate';b.disabled=!!state.proposal||c.name===state.place;
  const title=document.createElement('strong');title.textContent=`${i+1}. ${c.name}`;
  const reason=document.createElement('span');reason.textContent=c.reason;
  const evidence=document.createElement('small');evidence.textContent=`${c.approach} · ${c.source} (${c.reference}) · 확인 ${new Date(c.checkedAt).toLocaleTimeString()} · 유효 ${new Date(c.validUntil).toLocaleTimeString()} · ${c.maxDwellSeconds == null ? '정차 시간 제한 미확인' : `확인된 정차 한도 ${c.maxDwellSeconds}초`} · ${(c.advisories||[]).join(' · ')} · 위치 정확도는 합성 5m`;
  b.append(title,reason,evidence);b.onclick=()=>run('select',{snapshotId:data.snapshot.id,candidateId:c.id});$('candidates').append(b);
 }
}
async function refresh(){if(!session||polling||busy||document.hidden)return;polling=true;const began=performance.now(),generation=share.generation;try{
 const next=await request('');if(!environment()||generation!==share.generation)return;
 const placeChanged=state&&state.placeRevision!==next.placeRevision;
 state=next;freshUntil=began+6000;
 if(placeChanged&&share.current){await share.stop('승차지점이 바뀌어 공유를 중지했습니다. 새 지점에서는 다시 동의해 주세요.');return;}
 const data=await request('/recommendation');if(environment()&&generation===share.generation)show(data,began);
 }catch{freshUntil=0;result=null;$('message').textContent='연결을 확인할 수 없어 추천을 지웠습니다.';}finally{polling=false;render();}}
async function run(type,extra={}){if(!allowed()||busy)return;busy=true;const began=performance.now(),generation=share.generation;$('candidates').replaceChildren();try{
 const path=['reject','withdraw'].includes(type)?'/actions':'/recommendation';
 if(type==='accept'){state=await request('');freshUntil=performance.now();freshUntil+=5000;if(!environment()||generation!==share.generation)return;}
 const data=await request(path,{...context(),type,...extra});
 if(environment()&&generation===share.generation){if(data.accepted)await share.stop('장소를 수락하여 위치 공유를 중지했습니다. 다시 공유하려면 새 동의가 필요합니다.');else if(path==='/recommendation')show(data,began);$('message').textContent=data.proposed?'변경 제안 완료 · 상대 수락 대기':data.accepted?'상대 제안을 수락했습니다. 위치 공유는 중지되었습니다.':statuses[data.status]||'최신 상태를 확인했습니다.';}
 }catch(e){$('message').textContent=e.message;result=null;}finally{busy=false;await refresh();render();}}
for(const [id,longitude]of [['west',127],['east',127.002]])$(id).onclick=()=>{if(allowed()&&result?.mode==='synthetic')void share.start(context(),{synthetic:true,longitude});};
$('stop').onclick=()=>{result=null;void share.stop();};$('calculate').onclick=()=>run('calculate');
for(const type of ['accept','reject','withdraw'])$(type).onclick=()=>run(type,{proposalId:state?.proposal?.id});
for(const event of ['offline','pagehide'])addEventListener(event,()=>{freshUntil=0;result=null;void share.stop();render();});
document.addEventListener('visibilitychange',()=>{freshUntil=0;result=null;if(document.hidden)void share.stop();else void refresh();render();});
setInterval(refresh,2000);setInterval(render,250);render();void refresh();
