import {Browser} from '../../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import {createServer} from '../../experiments/pickup-board/server.mjs';
import {MultiBoard} from '../../experiments/pickup-board/multi/board.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const out='docs/evidence/pickgo-multi-2026-11-06';
const multi=new MultiBoard(),server=createServer(undefined,{multiBoard:multi});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await Browser.launch();
const checks=[];
const wait=async(p,fn)=>{for(let i=0;i<80;i++){if(await p.eval(fn))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out '+fn);};
const click=async(p,id)=>{await p.eval(async id=>{const e=document.getElementById(id);if(e.disabled)throw Error(id+' disabled');await e.onclick();},id);};
const refresh=p=>click(p,'refresh');
const snap=async(p,name)=>{assert.ok(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow');await p.screenshot({path:`${out}/${name}.png`,format:'png',fullPage:true});};
async function create(d,demo){await d.goto(base+'/multi',{settleMs:150});await wait(d,()=>document.getElementById('origin').options.length>0);await d.eval(demo=>{document.getElementById('demo').checked=demo;document.getElementById('createTrip').requestSubmit();},demo);await wait(d,()=>!document.getElementById('driver').hidden);}
async function add(d,name,pickup){const before=await d.eval(()=>document.querySelectorAll('.person').length);await d.eval(({name,pickup})=>{document.getElementById('personName').value=name;document.getElementById('pickup').value=pickup;document.getElementById('addPerson').requestSubmit();},{name,pickup});await wait(d,`document.querySelectorAll('.person').length===${before+1}`);}
async function join(url){const p=await browser.newPage({width:390,height:844});await p.goto(url,{settleMs:150});await wait(p,()=>!document.getElementById('join').disabled);await click(p,'join');await wait(p,()=>!document.getElementById('rider').hidden);return p;}
try{
 const d=await browser.newPage();await create(d,true);
 await add(d,'가','point:0');await add(d,'나','point:1');
 const same=await d.eval(()=>[...document.getElementById('pickup').options].filter(o=>o.value.startsWith('stop:'))[1].value);
 await add(d,'다',same);
 const links=await d.eval(()=>[...document.querySelectorAll('.person a')].map(a=>a.href));
 const riders=[];for(const link of links)riders.push(await join(link));
 await refresh(riders[0]);await click(riders[0],'ready');await refresh(riders[1]);await click(riders[1],'ready');await refresh(d);
 await snap(d,'driver-1440');await snap(riders[2],'rider-390');
 await d.setViewport({width:390,height:844});await snap(d,'driver-390');await d.setViewport({width:1440,height:900});
 await click(d,'recommend');assert.ok(await d.eval(()=>!document.getElementById('recommendation').hidden));await click(d,'apply');
 // All participants have independent sessions; shared stop blocks advancement after only one boarding.
 let sharedChecked=false;
 while(await d.eval(()=>!document.getElementById('next').disabled)){
   await click(d,'next');await click(d,'arrive');
   const here=[];for(const p of riders){await refresh(p);if(await p.eval(()=>!document.getElementById('board').disabled))here.push(p);}
   for(let i=0;i<here.length;i++){await refresh(here[i]);await click(here[i],'board');await refresh(d);if(here.length>1&&i===0){assert.ok(await d.eval(()=>document.getElementById('next').disabled));sharedChecked=true;}}
 }
 assert.ok(sharedChecked);await click(d,'end');assert.equal(await d.eval(()=>document.getElementById('tripStatus').textContent),'모두 탑승 완료');
 await d.send('Page.reload');await wait(d,()=>document.getElementById('tripStatus').textContent==='모두 탑승 완료');await snap(d,'completed');checks.push('3 riders / 2 stops, recommendation apply, individual boarding, shared stop lock, completion and reload');
 assert.ok(riders.every(p=>p.consoleErrors.length===0));assert.equal(d.consoleErrors.length,0);
 // Stale cancellation opened before another person changes readiness.
 const d2=await browser.newPage();await create(d2,false);await add(d2,'취소검증','point:0');
 const r=await join(await d2.eval(()=>document.querySelector('.person a').href));await refresh(d2);
 await d2.eval(()=>[...document.querySelectorAll('.person button')].find(b=>b.textContent==='이 사람 픽업 취소').click());await wait(d2,()=>document.getElementById('confirm').open);
 await click(r,'ready');await click(d2,'confirmCancel');assert.ok(await d2.eval(()=>!document.getElementById('confirm').open&&document.getElementById('error').textContent.includes('상태')));
 await refresh(r);assert.ok(await r.eval(()=>!document.getElementById('cancelSelf').disabled));
 await click(d2,'recommend');assert.match(await d2.eval(()=>document.getElementById('error').textContent),/실제 경로/);
 await click(r,'cancelSelf');await click(r,'confirmCancel');await refresh(d2);await click(d2,'end');assert.equal(await d2.eval(()=>document.getElementById('tripStatus').textContent),'모두 취소');checks.push('stale cancel rejected and dialog closed, manual recommendation unavailable, explicit all-cancel outcome');
 const d3=await browser.newPage();await create(d3,false);await add(d3,'부분탑승','point:0');await add(d3,'부분취소','point:0');
 const urls=await d3.eval(()=>[...document.querySelectorAll('.person a')].map(a=>a.href));const a=await join(urls[0]),b=await join(urls[1]);
 await refresh(d3);await click(d3,'next');await click(d3,'arrive');await refresh(a);await click(a,'board');
 await refresh(b);await click(b,'cancelSelf');await click(b,'confirmCancel');await refresh(d3);await click(d3,'end');
 assert.equal(await d3.eval(()=>document.getElementById('tripStatus').textContent),'종료 · 일부 탑승 / 일부 취소');checks.push('partial completion distinguishes boarded and cancelled participants');
 const net=await browser.newPage({width:390,height:844});await create(net,false);await add(net,'연결확인','point:0');
 await net.send('Network.enable');await net.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});await refresh(net);
 assert.ok(await net.eval(()=>document.getElementById('error').textContent.length>0));
 await net.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await refresh(net);
 assert.equal(await net.eval(()=>document.getElementById('error').textContent),'');assert.equal(await net.eval(()=>document.querySelectorAll('.person').length),1);
 await net.eval(()=>window.scrollTo(0,document.body.scrollHeight));assert.ok(await net.eval(()=>scrollY>0),'mobile page can scroll to lower actions');checks.push('offline error and explicit reconnect preserves trip; mobile scrolling');
 multi.trips.clear();await net.send('Page.reload');await wait(net,()=>!document.getElementById('setup').hidden&&document.getElementById('message').textContent.includes('새 초대'));
 assert.ok(await net.eval(()=>document.getElementById('trip').hidden&&!sessionStorage.getItem('pickgo-multi-session-v1')));await snap(net,'expired-session-390');checks.push('server-side session loss returns to setup with recovery guidance');
 writeFileSync(`${out}/browser.json`,JSON.stringify({checks,status:'passed',driverErrors:d.consoleErrors,riderErrors:riders.flatMap(p=>p.consoleErrors)},null,2));console.log(JSON.stringify({checks,status:'passed'}));
}catch(e){writeFileSync(`${out}/browser-failure.txt`,e.stack);throw e;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
