import {Browser} from '../../../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import {createServer} from '../../../experiments/pickup-board/server.mjs';
import {MapBoard} from '../../../experiments/pickup-board/map/board.mjs';
import {MultiBoard} from '../../../experiments/pickup-board/multi/board.mjs';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='docs/evidence/pickgo-layout-2026-11-06',board=new MapBoard(),multi=new MultiBoard();
const server=createServer(board,{multiBoard:multi});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await Browser.launch(),pause=ms=>new Promise(r=>setTimeout(r,ms));
const d=board.createPoint([127.0351004,37.4639150]),r=board.join(d.id,d.invite,randomUUID());
const single=(who,type,extra={})=>{const s=board.read(d.id,who.token);return board.act(d.id,who.token,{type,...extra,version:s.version,view:s.view,requestId:randomUUID()});};
const trip=multi.create({origin:[127.0351004,37.4639150]}),riders=[];
const act=(who,type,extra={})=>{const s=multi.read(trip.id,who.token);return multi.act(trip.id,who.token,{type,...extra,version:s.version,view:s.view,requestId:randomUUID()});};
let shared;
for(let i=0;i<6;i++){
 act(trip,'add',{name:`동행 ${String.fromCharCode(65+i)}`,...(i>0?{stopId:shared}:{point:[127.0358465,37.4661039],label:'매헌로6길 · 함께 탈 장소'})});
 const s=multi.read(trip.id,trip.token),p=s.participants.at(-1);shared=p.stopId;const rider=multi.join(trip.id,{invite:s.invites.find(x=>x.id===p.id).invite,joinId:randomUUID()});riders.push(rider);act(rider,'ready',{ready:true});
}
act(trip,'next');act(trip,'arrive');act(riders[0],'board');
const metrics=[];
async function load(p,path,session,key='pickupSession'){await p.goto(base);await p.eval(({session,key})=>{sessionStorage.clear();if(session)sessionStorage.setItem(key,JSON.stringify(session));},{session,key});await p.goto(base+path);await pause(500);}
async function shot(p,name){await p.screenshot({path:`${out}/${name}.png`});}
async function measure(p,name){
 const result=await p.eval(async()=>{
  const main=document.querySelector('main'),doc=document.documentElement;
  const scroll=main.scrollHeight>main.clientHeight+1&&/(auto|scroll)/.test(getComputedStyle(main).overflowY)?main:document.scrollingElement;
  const atTop=scroll.scrollTop;scroll.scrollTop=0;
  const horizontal=[...document.querySelectorAll('main,section,.panel,.workgrid,.columns')].filter(e=>e.getClientRects().length&&e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>({id:e.id,cls:e.className,w:e.clientWidth,sw:e.scrollWidth}));
  const controls=[...document.querySelectorAll('button,a.button,input:not([type=hidden]),select,summary')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden');
  const bad=[];
  for(const e of controls){
   if([...document.querySelectorAll('details:not([open])')].some(d=>d.contains(e)&&!(e.tagName==='SUMMARY'&&e.parentElement===d)))continue;
   e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
   const z=e.getBoundingClientRect();let top=0,bottom=innerHeight,left=0,right=innerWidth;
   const modal=e.closest('dialog:modal');for(let a=e.parentElement;a;a=a===modal?null:a.parentElement){const s=getComputedStyle(a);if(/auto|scroll|hidden|clip/.test(s.overflowY)){const r=a.getBoundingClientRect();top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom);}if(/auto|scroll|hidden|clip/.test(s.overflowX)){const r=a.getBoundingClientRect();left=Math.max(left,r.left);right=Math.min(right,r.right);}}
   if(z.height<=bottom-top+2&&(z.top<top-2||z.bottom>bottom+2)||z.left<left-2||z.right>right+2)bad.push({id:e.id,text:e.innerText.slice(0,35),rect:[z.left,z.top,z.right,z.bottom],clip:[left,top,right,bottom]});
  }
  scroll.scrollTop=0;
  return {width:innerWidth,height:innerHeight,pageWidth:doc.scrollWidth,scrollPort:scroll.tagName,scrollHeight:scroll.scrollHeight,clientHeight:scroll.clientHeight,horizontal,bad,controls:controls.length};
 });metrics.push({name,...result});assert.ok(result.pageWidth<=result.width+2,`${name} page horizontal`);assert.deepEqual(result.horizontal,[],`${name} content horizontal`);assert.deepEqual(result.bad,[],`${name} unreachable controls`);
}
try{
 const p=await browser.newPage({width:1224,height:760});
 const sizes=[[1224,760],[1280,720],[1024,600],[390,844],[320,568],[844,390],[640,380]];
 for(const [width,height] of sizes){
  await p.setViewport({width,height});const tag=`${width}x${height}`;
  await load(p,'/',d);await measure(p,`single-${tag}`);await shot(p,`single-${tag}`);
  await p.eval(()=>document.getElementById('pickupTools').open=true);await measure(p,`tools-${tag}`);
  await p.eval(()=>document.getElementById('openPlace').click());await measure(p,`edit-${tag}`);
  await load(p,'/multi',trip,'pickgo-multi-session-v1');assert.ok((await p.eval(()=>document.getElementById('currentStopStatus').textContent)).includes('6명 중 1명 탑승'));await measure(p,`multi-${tag}`);await shot(p,`multi-${tag}`);
  await p.eval(()=>{document.querySelector('.route-details').open=true;document.getElementById('addPanel').open=true;});await measure(p,`multi-expanded-${tag}`);
  await load(p,'/',r);await measure(p,`single-rider-${tag}`);await shot(p,`single-rider-${tag}`);await p.eval(()=>document.getElementById('openPlace').click());await measure(p,`rider-edit-${tag}`);
  await load(p,'/multi',riders[1],'pickgo-multi-session-v1');await measure(p,`rider-${tag}`);await shot(p,`rider-${tag}`);
  await p.eval(()=>document.getElementById('cancelSelf').click());await measure(p,`cancel-dialog-${tag}`);await p.eval(()=>document.getElementById('keep').click());
  await load(p,'/phone',r);await measure(p,`phone-${tag}`);await shot(p,`phone-${tag}`);await p.eval(()=>document.querySelector('.consent-details').open=true);await measure(p,`phone-details-${tag}`);
 }
 await p.setViewport({width:1224,height:760});await load(p,'/',null);await p.eval(()=>{document.getElementById('placeQuery').value='하나로마트';document.getElementById('create').requestSubmit();});await pause(600);await measure(p,'search-1224');await shot(p,'search-1224');await p.eval(()=>document.querySelector('.search-result').click());await pause(600);await p.eval(()=>document.querySelector('[data-home-candidate="1"]').click());await measure(p,'candidates-1224');await shot(p,'candidates-1224');
 await p.eval(()=>document.getElementById('homeManual').click());await pause(2200);assert.equal(await p.eval(()=>new URLSearchParams(location.search).get('candidate')),'1');
 for(const [width,height] of [[1224,760],[390,844],[844,390],[320,568]]){await p.setViewport({width,height});await pause(400);await measure(p,`map-${width}x${height}`);await shot(p,`map-${width}x${height}`);await p.eval(()=>document.querySelector('.map-options').open=true);await measure(p,`map-open-${width}x${height}`);await p.eval(()=>document.querySelector('.map-options').open=false);}
 single(d,'arrive');single(r,'board');await load(p,'/',d);assert.equal(await p.eval(()=>document.getElementById('completePickup').hidden),false);await measure(p,'complete-320');await shot(p,'complete-320');await p.eval(()=>document.getElementById('completePickup').click());await measure(p,'complete-confirm-320');await p.eval(()=>document.getElementById('confirmEnd').click());await pause(500);assert.equal(board.read(d.id,d.token).status,'ended');
 console.log('PASS',metrics.length,'layout/state checks; actual viewport + desktop/mobile/landscape/compact reflow, all scrollable controls reachable.');
}finally{writeFileSync(`${out}/layout-metrics.json`,JSON.stringify(metrics,null,2));await browser.close();await new Promise(r=>server.close(r));}


