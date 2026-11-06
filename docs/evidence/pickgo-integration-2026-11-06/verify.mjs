import {Browser} from '../../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='docs/evidence/pickgo-integration-2026-11-06';
const adb=(...args)=>execFileSync('work/pleos-environment/android-sdk/platform-tools/adb.exe',['-s','emulator-5556',...args],{timeout:20000});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const pid=adb('shell','pidof','org.example.pickgonavigation').toString().trim();
adb('forward','tcp:9416','localabstract:webview_devtools_remote_'+pid);
const tabs=await(await fetch('http://127.0.0.1:9416/json')).json();
const ws=new WebSocket(tabs.find(t=>t.url.startsWith('http://127.0.0.1:4194')).webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);let seq=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}};
async function ev(fn){const id=++seq;const p=new Promise(r=>pending.set(id,r));ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:`(${fn})()`,awaitPromise:true,returnByValue:true}}));const m=await p;if(m.result?.exceptionDetails)throw Error(JSON.stringify(m.result.exceptionDetails));return m.result?.result?.value;}
const driver={eval:ev};
async function wait(p,fn){for(let i=0;i<60;i++){if(await p.eval(fn))return;await pause(250);}console.log('Failure UI',await p.eval(()=>document.body.innerText));throw Error('timeout '+fn);}
async function click(p,id){await p.eval(new Function(`document.getElementById('${id}').click()`));await pause(700);}
function shot(name){writeFileSync(`${out}/${name}.png`,adb('exec-out','screencap','-p'));}
function xml(name){adb('shell','uiautomator','dump','/sdcard/pickgo-integration.xml');const x=adb('shell','cat','/sdcard/pickgo-integration.xml').toString();writeFileSync(`${out}/${name}.xml`,x);return x;}
const browser=await Browser.launch();
try{
 await ev(()=>{sessionStorage.removeItem('pickgo-multi-session-v1');location.assign('/');});await wait(driver,()=>!!document.querySelector('a[href="/multi"]'));
 await ev(()=>document.querySelector('a[href="/multi"]').click());await wait(driver,()=>document.querySelectorAll('#origin option').length>0);
 await ev(()=>document.getElementById('createTrip').requestSubmit());await wait(driver,()=>!document.getElementById('trip').hidden);
 await ev(()=>{document.getElementById('personName').value='통합시험 A';document.getElementById('addPerson').requestSubmit();});
 await wait(driver,()=>!!document.querySelector('#people a'));
 const multiLink=await ev(()=>document.querySelector('#people a').href);
 const rider=await browser.newPage({width:390,height:900});await rider.goto(multiLink);await wait(rider,()=>!document.getElementById('invitation').hidden && !document.getElementById('join').disabled);await click(rider,'join');await wait(rider,()=>!document.getElementById('rider').hidden);await click(rider,'ready');
 await wait(driver,()=>document.getElementById('people').innerText.includes('준비 완료'));
 await click(driver,'next');await wait(driver,()=>!document.getElementById('arrive').disabled);await click(driver,'arrive');
 await wait(rider,()=>!document.getElementById('board').disabled);await click(rider,'board');await wait(driver,()=>!document.getElementById('end').disabled);await click(driver,'end');
 await wait(driver,()=>document.getElementById('tripStatus').textContent==='모두 탑승 완료');shot('01-multi-completed');
 assert.match(xml('01-multi-completed'),/확정 지점으로 현대 내비 안내 시작[^>]*enabled="false"/);
 console.log('PASS emulator multi entry / create / invite / ready / next / arrive / board / completion; native disabled');
 await ev(()=>document.querySelector('header a').click());await wait(driver,()=>!!document.getElementById('create')?.onsubmit);await pause(1000);
 await ev(()=>{document.getElementById('placeQuery').value='하나로마트';document.getElementById('searchPlaces').click();});await wait(driver,()=>document.querySelectorAll('.search-result').length>1);shot('02-search');
 await ev(()=>document.querySelector('.search-result').click());await wait(driver,()=>document.querySelectorAll('[data-home-candidate]:not([hidden])').length>0);
 await ev(()=>document.querySelector('[data-home-candidate]').click());await click(driver,'homeStart');await wait(driver,()=>!document.getElementById('board').hidden);
 const invite=await ev(()=>document.getElementById('inviteLink').href);const singleRider=await browser.newPage({width:390,height:900});await singleRider.goto(invite);await wait(singleRider,()=>!document.getElementById('joinBox').hidden);await click(singleRider,'join');await wait(singleRider,()=>!document.getElementById('board').hidden);
 await singleRider.eval(()=>document.querySelector('[data-ready="true"]').click());
 await pause(4000);
 const state=await ev(async()=>{const d=JSON.parse(sessionStorage.getItem('pickupSession'));const s=await(await fetch('/api/rooms/'+d.id,{headers:{Authorization:'Bearer '+d.token}})).json();return {joined:s.joined,mapPoint:s.mapPoint,placeRevision:s.placeRevision,version:s.version,status:s.status,proposal:!!s.proposal};});
 assert.equal(state.joined,true);assert.equal(state.proposal,false);assert.ok(state.mapPoint);writeFileSync(`${out}/selected-state.json`,JSON.stringify(state,null,2));shot('03-single-agreed');
 const before=adb('logcat','-d','-v','threadtime','--pid='+pid,'PickgoNavigation:I','*:S').toString();
 const ui=xml('03-single-agreed');const node=ui.match(/<node[^>]*text="확정 지점으로 현대 내비 안내 시작"[^>]*>/)?.[0];assert.ok(node);assert.match(node,/enabled="true"/);const b=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
 adb('shell','input','tap',String(Math.round((b[0]+b[2])/2)),String(Math.round((b[1]+b[3])/2)));
 console.log('Native explicit start tapped once; no navigation UI taps after this');
 await pause(12000);shot('04-navigation');await pause(12000);console.log('Observing destination and route state, 24 seconds elapsed');await pause(12000);await pause(14000);
 adb('shell','am','start','--user','10','-n','org.example.pickgonavigation/.NavigationActivity');await pause(2500);shot('05-return-retained');assert.match(xml('05-return-retained'),/45초 관찰 종료 시점/);
 adb('shell','am','start','--user','10','-n','org.example.pickgonavigation/.NavigationActivity');await pause(1500);assert.match(xml('06-repeat'),/45초 관찰 종료 시점/);
 const full=adb('logcat','-d','-v','threadtime','--pid='+pid,'PickgoNavigation:I','*:S').toString();const log=full.split('\n').filter(l=>!before.includes(l)).join('\n');writeFileSync(`${out}/runtime.log`,log);
 assert.equal((log.match(/REQUEST_ROUTE_SENT/g)||[]).length,1);assert.match(log,/DESTINATION_MATCH=true/);assert.match(log,/MODE=ROUTE_GUIDING/);assert.match(log,/OBSERVATION_FINISHED/);
 const activities=adb('shell','dumpsys','activity','activities').toString();assert.equal(activities.split('\n').filter(l=>l.includes('* Hist')&&l.includes('org.example.pickgonavigation/.NavigationActivity')).length,1);
 writeFileSync(`${out}/summary.json`,JSON.stringify({multiBasicFlow:true,singleSearchSelectJoin:true,point:state.mapPoint,routeRequests:1,destinationMatches:true,routeGuiding:true,retainedAfter45Seconds:true,repeatLaunchOneActivity:true,participant:'headless Chrome UI; not physical phone',navigationTapsAfterNativeStart:0},null,2));
 console.log('PASS single OSM -> rider UI agreement -> native -> destination match / ROUTE_GUIDING -> 45s return / repeat launch');
}finally{await browser.close();ws.close();}

