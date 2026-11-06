import {Browser} from '../../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import {createServer} from '../../experiments/pickup-board/server.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='docs/showcase/screenshots', raw='work/pickgo-showcase/frames';mkdirSync(raw,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`, browser=await Browser.launch();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let d=await browser.newPage({width:1280,height:720}),r=await browser.newPage({width:390,height:844});
let chapter='01 / 퇴근길 동행 픽업', caption='양재에서 만날 동행과 픽업 장소를 정합니다.',recording=true,frame=0;
const timeline=[],shots=[];let recordError;
const loop=Promise.resolve();
async function capture(){const i=String(frame++).padStart(5,'0');await d.screenshot({path:`${raw}/${i}-d.jpg`,quality:86});await r.screenshot({path:`${raw}/${i}-r.jpg`,quality:86});timeline.push({i,chapter,caption,at:Date.now()});}
async function wait(p,fn){for(let i=0;i<90;i++){if(await p.eval(fn))return;await pause(100);}throw Error('Timeout '+fn+' '+await p.eval(()=>document.body.innerText));}
async function click(p,sel){await wait(p,s=>true);await p.eval(sel=>{const el=document.querySelector(sel);if(!el||el.disabled||!el.getClientRects().length)throw Error('Cannot click '+sel);el.click();},sel);await pause(700);}
async function hold(text,ms=3200){caption=text;for(let t=0;t<ms;t+=500){await capture();await pause(250);}}
async function shot(p,name){
 const full=name==='09-location-consent'||name.startsWith('18-')||name.startsWith('19-')||name.startsWith('22-');
 if(full){const old={...p.viewport};const scroll=await p.eval(()=>scrollY);const h=await p.eval(()=>document.documentElement.scrollHeight);await p.setViewport({...old,height:Math.max(old.height,h)});await p.eval(()=>scrollTo(0,0));await pause(200);await p.screenshot({path:`${out}/${name}.png`,format:'png'});await p.setViewport(old);await p.eval(y=>scrollTo(0,y),scroll);}
 else await p.screenshot({path:`${out}/${name}.png`,format:'png'});
 shots.push(name);
}
async function refresh(p){await click(p,'#refresh');}
try{
 await d.goto(base);await r.goto(base);await shot(d,'01-home');await hold('가상 시나리오: 운전자와 동행이 퇴근 후 양재에서 만납니다.');
 await d.eval(()=>{document.getElementById('placeQuery').value='하나로마트';document.getElementById('create').requestSubmit();});await wait(d,()=>document.querySelectorAll('.search-result').length>0);await shot(d,'02-search');await hold('장소 이름을 검색합니다. 현재 검색 범위는 양재 주변 OSM 수록 장소입니다.');
 await click(d,'.search-result');await wait(d,()=>!!document.querySelector('[data-home-candidate]:not([hidden])'));await click(d,'[data-home-candidate]:not([hidden])');await shot(d,'03-candidates');await hold('주변 픽업 후보를 고릅니다. 정차 전 현장 표지를 확인합니다.');
 await click(d,'#homeManual');await wait(d,()=>!!document.querySelector('#map .leaflet-tile'));await pause(2500);await shot(d,'04-map');await hold('지도에서 위치와 차단 영역을 확인할 수도 있습니다.');
 await d.goto(base);await d.eval(()=>{document.getElementById('placeQuery').value='하나로마트';document.getElementById('create').requestSubmit();});await wait(d,()=>!!document.querySelector('.search-result'));await click(d,'.search-result');await click(d,'[data-home-candidate]:not([hidden])');await click(d,'#homeStart');await wait(d,()=>!document.getElementById('board').hidden);await shot(d,'05-invite');await hold('픽업을 시작하고 초대 링크를 동행에게 전달합니다. 메시지 자동 발송은 아닙니다.');
 const link=await d.eval(()=>document.getElementById('inviteLink').href);await r.goto(link);await shot(r,'06-rider-invitation');await hold('동행은 별도 설치·가입 없이 초대 링크에서 참여합니다. 이 영상은 같은 PC의 브라우저 시연입니다.');
 await click(r,'#join');await wait(r,()=>!document.getElementById('board').hidden);await click(r,'[data-ready="true"]');await pause(2300);await shot(d,'07-ready-driver');await shot(r,'08-ready-rider');await hold('동행이 준비 완료를 누르면 운전자 화면에 반영됩니다.');
 await r.eval(()=>document.getElementById('pickupTools').open=true);await click(r,'#phoneLink');await wait(r,()=>!document.getElementById('consent').hidden);await shot(r,'09-location-consent');await hold('위치 공유는 선택입니다. 이번 시나리오에서는 위치를 보내지 않고 진행합니다.');await click(r,'#decline');await r.goto(base);
 await click(r,'#openPlace');await shot(r,'10-change-place');await click(r,'[data-place="현대자동차 양재사옥"]');await pause(2400);await shot(d,'11-change-proposal');await hold('동행이 만날 장소 변경을 제안합니다. 상대가 수락하기 전에는 기존 장소를 유지합니다.');await click(d,'#accept');await pause(2300);await shot(d,'12-agreed');await hold('운전자가 수락하면 새 장소가 확정됩니다.');
 await click(d,'#arrive');await pause(2300);await shot(d,'13-arrival');await shot(r,'14-rider-arrival');await hold('운전자가 도착했어요를 누릅니다. 도착은 위치로 자동 판단하지 않습니다.');await click(r,'#boarded');await pause(2300);await shot(d,'15-boarded');await hold('동행이 실제 탑승 후 탑승했어요를 눌러 확인합니다.');
 await d.eval(()=>document.getElementById('pickupTools').open=true);await click(d,'#end');await click(d,'#confirmEnd');await pause(1000);await shot(d,'16-completed');await hold('탑승 확인을 마친 뒤 운전자가 픽업을 종료합니다.');
 chapter='02 / 세 명을 두 지점에서 픽업';await d.goto(base+'/multi');await wait(d,()=>document.getElementById('origin').options.length>0);await shot(d,'17-multi-setup');await hold('다음 시나리오: 동행 A·B·C를 두 지점에서 태웁니다. 기본 모드는 수동 순서입니다.');await d.eval(()=>document.getElementById('createTrip').requestSubmit());await wait(d,()=>!document.getElementById('driver').hidden);
 async function add(name,pickup){const n=await d.eval(()=>document.querySelectorAll('.person').length);await d.eval(({name,pickup})=>{document.getElementById('personName').value=name;document.getElementById('pickup').value=pickup;document.getElementById('addPerson').requestSubmit();},{name,pickup});await wait(d,`document.querySelectorAll('.person').length===${n+1}`);}
 await add('동행 A','point:0');await add('동행 B','point:1');const shared=await d.eval(()=>[...document.getElementById('pickup').options].filter(o=>o.value.startsWith('stop:'))[1].value);await add('동행 C',shared);
 await d.setViewport({width:1280,height:1100});await d.eval(()=>{const e=document.querySelector('.columns');window.scrollTo(0,e.getBoundingClientRect().top+scrollY-20);});await shot(d,'18-multi-plan');await hold('사람별 초대를 만들고, B와 C는 같은 지점 함께 승차로 묶습니다.');
 const links=await d.eval(()=>[...document.querySelectorAll('.person a')].map(a=>a.href));const riders=[];
 for(const url of links){const p=await browser.newPage({width:390,height:844});await p.goto(url,{settleMs:200});await wait(p,()=>!document.getElementById('join').disabled);r=p;await click(p,'#join');await wait(p,()=>!document.getElementById('rider').hidden);await click(p,'#ready');riders.push(p);}
 await refresh(d);await shot(d,'19-multi-ready');await shot(r,'20-multi-rider');await hold('각 동행은 본인의 초대로 참여하고 준비 상태를 알립니다.');
 while(await d.eval(()=>!document.getElementById('next').disabled)){
 await refresh(d);await click(d,'#next');await hold('다음 태울 지점을 선택합니다. 이 버튼은 현대 내비 경유 안내와 연결되지 않았습니다.',2500);await click(d,'#arrive');
 const here=[];for(const p of riders){await refresh(p);if(await p.eval(()=>!document.getElementById('board').disabled))here.push(p);}
 for(let i=0;i<here.length;i++){r=here[i];await hold('현재 지점에 도착하면 해당 동행이 각각 탑승을 확인합니다.',2200);await refresh(r);await click(r,'#board');await refresh(d);if(here.length>1&&i===0){assert.ok(await d.eval(()=>document.getElementById('next').disabled));await shot(d,'21-shared-stop');await hold('같은 지점의 두 사람 모두 탑승하거나 취소해야 다음 지점으로 넘어갑니다.');}}
 }
 await click(d,'#end');assert.equal(await d.eval(()=>document.getElementById('tripStatus').textContent),'모두 탑승 완료');await shot(d,'22-multi-completed');await hold('세 명 모두 탑승 완료. 사람별 상태와 전체 회차 결과를 구분합니다.',4500);
 writeFileSync('docs/evidence/pickgo-showcase-2026-11-06/capture-result.json',JSON.stringify({status:'passed',shots,scenario:'single UI complete; multi 3 people 2 stops complete',driverConsoleErrors:d.consoleErrors,frameCount:frame,recordError:recordError||null},null,2));
}catch(e){writeFileSync('work/pickgo-showcase/capture-error.txt',e.stack);console.error(e);process.exitCode=1;}
finally{recording=false;await loop;writeFileSync('work/pickgo-showcase/timeline.json',JSON.stringify(timeline));await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
