import {sdkUnknownContext,sdkStatusText} from '/sdk-status.mjs';
import {JourneySession,QueuePolicy,recommend,informationDestination} from '/core.mjs';
import {catalog} from '/content.mjs';
import {loadListening,saveListening,clearListening} from '/listening-store.mjs';
let storage;try{storage=window.localStorage;}catch{storage=null;}
const contentIds=catalog.map(c=>c.id);
let resumePending=null,lastSavedSecond=-1,savingAllowed=false,playbackProfile=null,checkpointDiscarded=false;
import {inferCoordinateJourney} from '/coordinates.mjs';
import {history,observationInput} from '/observations.mjs';
const $=id=>document.getElementById(id);
let session,now,recent=[],appliedReason='',appliedMode='',currentId=null,playGeneration=0,playbackPhase='idle',autoContinue=false;
const audio=$('audio');
const sdkMode=window.location?.search==='?input=sdk';
let sdkStatus={state:'WAITING',clockStatus:'UNVERIFIED_CLOCK'};
const item=id=>catalog.find(c=>c.id===id);
let cancelMediaWait=null;
function cancelPendingPlayback(){playGeneration++;cancelMediaWait?.();}
function waitForMedia(event,action){
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);audio.removeEventListener(event,done);audio.removeEventListener('error',failed);if(cancelMediaWait===cancel)cancelMediaWait=null;};
  const done=()=>{cleanup();resolve();};
  const failed=()=>{cleanup();reject(new Error('media unavailable'));};
  const cancel=()=>{cleanup();reject(new Error('playback cancelled'));};
  const timer=setTimeout(failed,5000);
  cancelMediaWait=cancel;audio.addEventListener(event,done);audio.addEventListener('error',failed);
  try{action();}catch{failed();}
 });
}
function reset(forget=false){
 const cleared=forget?clearListening(storage):true;
 savingAllowed=false;playbackProfile=null;checkpointDiscarded=false;
 $('storage-status').textContent=forget?(cleared?'저장 정보를 삭제했습니다. 다시 재생하거나 취향을 바꾸면 저장이 재개됩니다.':'브라우저 저장에 접근할 수 없어 삭제 여부를 확인하지 못했습니다.'):'취향과 중간 재생 위치만 이 브라우저에 저장합니다. 위치·경로는 저장하지 않습니다.';
 const saved=forget?null:loadListening(storage,contentIds);
 resumePending=saved?.checkpoint||null;lastSavedSecond=-1;cancelPendingPlayback();playbackPhase='idle';autoContinue=false;
 $('strategy').value=sdkMode?'A':'C';$('taste').value=saved?.taste||'story';$('scene').value='shared';$('profile').value='owner';$('consent').checked=true;
 audio.pause();audio.removeAttribute('src');audio.load();audio.hidden=true;
 session=new JourneySession(history,inferCoordinateJourney);session.queue=new QueuePolicy({minIntervalMs:60_000,maxChanges:3});
 now=100_000;recent=[];currentId=null;appliedReason='';appliedMode='';$('play-status').textContent='';
 $('now-title').textContent='아직 재생하지 않았어요';$('now-caption').textContent='이동 시작을 한 번 누르면 다음 콘텐츠까지 이어서 듣습니다.';update();}
function update(){
 now+=61_000; // Explicit synthetic clock: each scenario interaction advances simulated time.
 const scene=$('scene').value,profile=$('profile').value,consent=$('consent').checked;
 let context=sdkMode?sdkUnknownContext():session.tick(observationInput({scene,profile,consent,now}));
 const nav=!sdkMode&&scene==='explicit'&&consent&&profile==='owner'?{source:'navigation',destination:'시험 사무실',at:now}:null;
 const destination=informationDestination(nav,now);
 // Fixture-only mapping: this destination was labelled commute in the synthetic setup, not inferred from an address.
 if(destination)context={status:'hypothesis',candidates:[{purpose:'commute'}],purposeHint:'commute'};
 const status=context.status==='hypothesis'?(context.candidates.length>1?'두 경로가 아직 겹칩니다. 목적지는 미확인입니다.':`${destination?'지정한 내비 목적지':'과거 패턴과 일치하는 경로 후보'}를 사용합니다.`):'경로를 판단할 수 없어 취향을 사용합니다.';
 $('context').textContent=status;
 $('info').textContent=destination?`명시 목적지: ${destination}. 실제 날씨·교통 정보는 연결하지 않았습니다.`:'목적지 관련 정보는 제공하지 않습니다.';
 const strategy=$('strategy').value;
 if(strategy==='A')context={status:'unknown',candidates:[]};
 if(strategy==='B')context=consent&&profile==='owner'?{status:'hypothesis',candidates:history.filter(h=>h.departureSlot==='morning'&&h.profile===profile&&h.endedAtMs<100).map(h=>({purpose:h.confirmedPurpose}))}:{status:'unknown',candidates:[]};
 if(sdkMode){context=sdkUnknownContext();$('context').textContent=sdkStatusText(sdkStatus);$('info').textContent='경로·목적지·관측 신선도는 판단하지 않습니다.';}
 const taste=$('taste').value;
 const preferences={topics:{story:taste==='story'?3:1,reflection:taste==='reflection'?3:1},
 byPurpose:{commute:{reflection:4},errand:{reflection:-3}}};
 let proposal=recommend({catalog,preferences,context,currentId,recent});
 if(!currentId&&resumePending&&profile==='owner')proposal={id:resumePending.id,reasons:{mode:'resume'}};
 const before=session.queue.next;
 const changed=proposal&&session.queue.update(proposal.id,now);
 if(changed)appliedMode=strategy;
 if(changed)appliedReason=proposal.reasons.mode==='resume'?`이전에 멈춘 ${Math.floor(resumePending.seconds)}초부터 이어듣습니다.`:proposal.reasons.mode==='journey'?'선택한 취향과 시연용 운행별 선호를 함께 반영했습니다.':'경로 판단 대신 선택한 취향을 반영했습니다.';
 if(!session.queue.next)appliedReason='';
 if(sdkMode)appliedMode='SDK';
 const next=item(session.queue.next);
 $('mode-label').textContent=next&&appliedMode!==strategy?`${appliedMode} 추천 유지 · 선택 ${strategy}`:`${strategy} 방식`;
 if(strategy==='A')$('context').textContent='A 방식은 경로와 시간대를 사용하지 않고 취향만 반영합니다.';
 if(strategy==='B')$('context').textContent=consent&&profile==='owner'?'B 방식은 합성 아침 시간대의 과거 패턴을 사용합니다.':'이력 사용이 없어 취향만 반영합니다.';
 if(sdkMode){$('mode-label').textContent=!currentId&&resumePending&&profile==='owner'?'SDK · 이어듣기':'SDK · 취향 대안';$('context').textContent=sdkStatusText(sdkStatus);}
 $('next-title').textContent=next?.title||'다음 추천이 없습니다';
 $('transcript').textContent=next?.text||'새로운 시연 세션에서 다시 확인할 수 있습니다.';
 $('reason').textContent=next?appliedReason+(!changed&&proposal?.id!==before?' 이번 세션의 잦은 교체를 막기 위해 기존 추천을 유지합니다.':''):'현재/최근 재생 제외 또는 세션 갱신 제한에 도달했습니다. 시연을 처음부터 시작할 수 있습니다.';
 $('play').disabled=!next||playbackPhase==='loading';
 $('play').textContent=currentId?'다음으로':resumePending&&profile==='owner'?'이동 시작 · 이어듣기':'이동 시작 · 바로 듣기';
 $('stop').disabled=!autoContinue;
}
async function startNext(){
 if(playbackPhase==='loading')return;
 const next=item(session.queue.next);if(!next){autoContinue=false;$('stop').disabled=true;$('play-status').textContent='다음 콘텐츠가 없어 자동 이어듣기를 멈췄습니다.';return;}
 // A user starts the listening session; natural completion may advance within that session.
 playbackProfile=$('profile').value;savingAllowed=playbackProfile==='owner';lastSavedSecond=-1;checkpointDiscarded=false;
 const resumeSeconds=$('profile').value==='owner'&&resumePending?.id===next.id?resumePending.seconds:0;
 if(resumePending&&!resumeSeconds){$('storage-status').textContent='이전 이어듣기 대신 새 추천을 시작합니다.';resumePending=null;}
 const generation=++playGeneration;playbackPhase='loading';

 audio.pause();currentId=session.queue.consumeNext();
 recent=[...recent,next.id];audio.hidden=false;audio.src=`/audio/${next.id}.wav`;
 $('now-title').textContent=next.title;$('now-caption').textContent=next.label+' · 한국어 시연 콘텐츠';
 $('play-status').textContent='재생을 준비합니다.';update();
 try{
 if(resumeSeconds){
  await waitForMedia('loadedmetadata',()=>audio.load());
  if(generation!==playGeneration)return;
  if(!Number.isFinite(audio.duration)||resumeSeconds>=audio.duration-1){discardResume();throw new Error('resume outside media');}
  await waitForMedia('seeked',()=>{audio.currentTime=resumeSeconds;});
  if(generation!==playGeneration)return;
 }
 await audio.play();if(generation!==playGeneration)return;
 resumePending=null;
 playbackPhase=audio.paused?'paused':'playing';$('play').disabled=!session.queue.next;$('play-status').textContent=audio.paused?'일시정지 · 오디오 재생 버튼으로 이어 들을 수 있습니다.':'자동 이어듣기 중 · 상황이 바뀌어도 현재 콘텐츠는 유지합니다.';}
 catch{if(generation!==playGeneration)return;playbackPhase='error';autoContinue=false;audio.pause();$('stop').disabled=true;$('play').disabled=!session.queue.next;$('play-status').textContent='이어듣기 또는 자동 재생 요청이 허용되지 않았거나 음원을 불러오지 못했습니다. 오디오 재생 버튼으로 다시 시도하세요.';}
}
$('play').addEventListener('click',()=>{if(playbackPhase==='loading')return;autoContinue=true;void startNext();});
$('stop').addEventListener('click',()=>{persistListening();autoContinue=false;cancelPendingPlayback();playbackPhase='stopped';audio.pause();$('stop').disabled=true;$('play').disabled=!session.queue.next;$('play-status').textContent='이동 듣기를 종료했습니다. 다시 들으려면 오디오 재생 버튼 또는 다음으로를 누르세요.';});
audio.addEventListener('pause',()=>{if(currentId&&!audio.ended&&audio.paused&&playbackPhase==='playing'){playbackPhase='paused';$('play-status').textContent='일시정지 · 오디오 재생 버튼으로 이어 들을 수 있습니다.';}});
audio.addEventListener('play',()=>{if(audio.paused||playbackPhase==='loading')return;playbackPhase='playing';$('play-status').textContent='재생 중 · 현재 콘텐츠를 유지합니다.';});
audio.addEventListener('ended',()=>{if(!audio.ended)return;persistListening(true);playbackPhase='ended';if(autoContinue){void startNext();}else{$('play-status').textContent='재생이 끝났습니다.';}});
audio.addEventListener('error',()=>{if(playbackPhase==='idle'||playbackPhase==='stopped')return;discardResume();cancelPendingPlayback();playbackPhase='error';autoContinue=false;audio.pause();$('stop').disabled=true;$('play').disabled=!session.queue.next;$('play-status').textContent='음원을 불러오지 못했습니다. 로컬 서버와 음원 파일을 확인하세요.';});
for(const id of ['scene','strategy','taste','consent'])$(id).addEventListener('change',update);
$('reset').addEventListener('click',()=>reset(true));
function discardResume(){
 const saved=loadListening(storage,contentIds)?.checkpoint;
 resumePending=saved&&saved.id!==currentId?saved:null;
 checkpointDiscarded=!resumePending;persistListening();
}
function persistListening(completed=false){
 if(!savingAllowed||$('profile').value!=='owner')return;
 const checkpoint=checkpointDiscarded?null:resumePending||(playbackProfile==='owner'&&currentId&&audio.readyState>0?
  (completed?null:{id:currentId,seconds:audio.currentTime,duration:audio.duration}):loadListening(storage,contentIds)?.checkpoint);
 const ok=saveListening(storage,{taste:$('taste').value,checkpoint},contentIds);
 $('storage-status').textContent=ok?'취향과 중간 재생 위치만 이 브라우저에 저장했습니다. 위치·경로는 저장하지 않습니다.':'브라우저 저장이 불가능합니다. 이번 듣기는 계속할 수 있습니다.';
}
$('taste').addEventListener('change',()=>{savingAllowed=$('profile').value==='owner'&&(!playbackProfile||playbackProfile==='owner');persistListening();});
$('profile').addEventListener('change',()=>{const owner=$('profile').value==='owner';resumePending=owner&&playbackProfile!=='owner'?loadListening(storage,contentIds)?.checkpoint||null:null;lastSavedSecond=-1;savingAllowed=owner&&playbackProfile==='owner';
 if(playbackPhase==='loading'){cancelPendingPlayback();autoContinue=false;playbackPhase='stopped';audio.pause();$('play-status').textContent='프로필이 바뀌어 준비 중인 재생을 중단했습니다.';}
 update();});
audio.addEventListener('timeupdate',()=>{const second=Math.floor(audio.currentTime);if(second!==lastSavedSecond&&second%2===0&&playbackPhase!=='loading'){lastSavedSecond=second;persistListening();}});
window.addEventListener('pagehide',()=>persistListening());
reset();

if(sdkMode){
 $('input-badge').textContent='실제 SDK · 시각 미확인';$('input-tag').textContent='실제 SDK 상태';
 $('strategy').disabled=true;$('scene').disabled=true;
 $('input-disclaimer').textContent='SDK 수신 상태만 연결한 로컬 시연입니다. 실제 위치 기반 추천과 실차 동작은 검증하지 않았습니다.';
 $('input-note').textContent='실제 SDK 수신 상태만 연결합니다. 좌표와 원시 시각은 이 브라우저로 보내지 않습니다.';
 let timer=null,active=false,epoch=0;
 async function poll(generation){
  try{const response=await window.fetch('/sdk-status',{cache:'no-store'});const value=response.ok?await response.json():null;
   if(!active||generation!==epoch)return;sdkStatus=value;
  }catch{if(!active||generation!==epoch)return;sdkStatus=null;}
  $('context').textContent=sdkStatusText(sdkStatus);if(active&&generation===epoch)timer=setTimeout(()=>poll(generation),2000);
 }
 const start=()=>{if(active)return;active=true;poll(++epoch);};
 window.addEventListener('pagehide',()=>{active=false;epoch++;clearTimeout(timer);});
 window.addEventListener('pageshow',start);start();
}
