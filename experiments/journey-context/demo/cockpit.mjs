import {CockpitPlayer} from './cockpit-player.mjs';
import {catalog} from './content.mjs';
const $=id=>document.getElementById(id);
let storage;try{storage=window.localStorage;}catch{storage=null;}
const player=new CockpitPlayer({audio:$('audio'),catalog,storage,onChange:render});
function render(s){
 const labels={playing:'잠깐 멈춤',paused:'이어서 듣기',loading:'준비 중',error:'다시 시도'};
 $('play-label').textContent=labels[s.phase]||(s.resuming?'이어서 듣기':'바로 듣기');
 $('play').disabled=s.phase==='loading'||!s.canStart;
 $('stop').disabled=!s.canStop;
 $('heading').textContent=({playing:'지금 듣고 있어요',paused:'잠시 멈췄어요',stopped:'듣기를 종료했어요',error:'재생하지 못했어요',exhausted:'모두 들었어요'})[s.phase]||'지금, 이야기 한 편 들어보세요';
 $('content-title').textContent=s.item?.title||'다음 콘텐츠가 없어요';
 $('caption').textContent=s.item?`${s.item.label} · AI 생성 음성`:'';
 $('play').querySelector('.glyph').innerHTML=s.phase==='playing'?'<svg viewBox="0 0 32 32"><path d="M7 5h6v22H7zM19 5h6v22h-6z"/></svg>':'<svg viewBox="0 0 32 32"><path d="M8 4 28 16 8 28Z"/></svg>';
 $('status').textContent=({playing:'끝나면 다음 이야기로 이어집니다',paused:'이어서 듣기를 누르면 계속해요',loading:'음원을 준비하고 있어요',stopped:'다시 누르면 새로 시작해요',error:'음원을 확인한 뒤 다시 시도하세요',exhausted:'이번 듣기를 마쳤어요'})[s.phase]||(s.resuming?'이어서 듣기를 눌러 계속하세요':'바로 듣기를 눌러 시작하세요');
}
$('play').addEventListener('click',()=>void player.toggle());
$('stop').addEventListener('click',()=>player.stop());
// No simulated microphone success or recognition timers in the connected screen.
$('voice').disabled=true;$('voice').textContent='준비 중';
$('voice-message').textContent='음성 인식 미연결';$('voice-detail').textContent='지금은 터치로 조작해 주세요';
render(player.snapshot());
const sdkMode=new URLSearchParams(location.search).get('input')==='sdk';
let active=false,epoch=0,timer,request;
async function poll(generation){
 const controller=new AbortController();request=controller;const timeout=setTimeout(()=>controller.abort(),4000);
 let value=null;try{const response=await fetch('/sdk-status',{signal:controller.signal,cache:'no-store'});if(response.ok)value=await response.json();}catch{}finally{clearTimeout(timeout);}
 if(!active||epoch!==generation)return;
 const valid=value?.clockStatus==='UNVERIFIED_CLOCK';
 $('context').textContent=valid&&value.state==='CALLBACK'?'관측 시각 미확인 · 기본 추천':'경로 정보 없음 · 기본 추천';
 $('connection').textContent=!valid?'SDK 상태 확인 불가':value.state==='CALLBACK'?'SDK 수신 중 · 시각 미확인':value.state==='NO_RECENT_STATUS'?'SDK 상태 갱신 없음':value.state==='ACCESS_DENIED'?'SDK 위치 권한 없음':['STOPPED','REVOKED'].includes(value.state)?'SDK 수집 종료':value.state==='ERROR'?'SDK 입력 오류':'SDK 연결 대기';
 timer=setTimeout(()=>poll(generation),2000);
}
function start(){if(active||!sdkMode)return;active=true;void poll(++epoch);}
window.addEventListener('pagehide',()=>{active=false;epoch++;clearTimeout(timer);request?.abort();player.suspend();});
window.addEventListener('pageshow',start);
document.addEventListener('visibilitychange',()=>{if(document.hidden)player.suspend();});
if(sdkMode)start();else $('connection').textContent='로컬 재생 · 경로 미연결';
