import {Browser} from '../../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import {createServer} from '../../experiments/pickup-board/server.mjs';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await Browser.launch(),results=[];
const wait=async(page,fn)=>{for(let i=0;i<80;i++){if(await page.eval(fn))return;await new Promise(r=>setTimeout(r,200));}throw Error('Browser condition timed out: '+fn);};
try{
 for(const [width,height] of [[1440,900],[1280,600],[768,1024],[390,844]]){
  const p=await browser.newPage({width,height});await p.goto(base+'/map');
  await wait(p,()=>document.querySelectorAll('.candidate').length===3);
  assert.equal(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await p.eval(()=>document.querySelector('.candidate').click());
  await wait(p,()=>!document.getElementById('confirm').disabled);
  assert.equal(await p.eval(()=>{const r=document.getElementById('confirm').getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight}),true);
  await p.eval(()=>{document.getElementById('confirm').scrollIntoView({block:'center'});document.getElementById('confirm').focus()});
  await p.screenshot({path:`work/pickgo-map-style/selected-${width}.png`,format:'png'});
  // Native map click on the anchor marker must retain the blocked state.
  await p.eval(()=>document.querySelector('.pin-anchor').parentElement.click());
  await wait(p,()=>document.getElementById('selectionTitle').textContent==='선택할 수 없는 지점');
  assert.equal(await p.eval(()=>document.getElementById('confirm').disabled),true);
  await p.eval(()=>{const z=document.getElementById('zones');z.click();z.click();document.getElementById('home').click();document.querySelectorAll('.candidate')[1].click()});
  await wait(p,()=>!document.getElementById('confirm').disabled);
  await p.eval(()=>document.getElementById('confirm').click());
  await wait(p,()=>location.pathname==='/'&&!document.getElementById('board').hidden);
  assert.equal(await p.eval(async()=>{const s=JSON.parse(sessionStorage.getItem('pickupSession'));const r=await fetch('/api/rooms/'+s.id,{headers:{Authorization:'Bearer '+s.token}});return Array.isArray((await r.json()).mapPoint)}),true);
  results.push({width,height,horizontalOverflow:false,candidateSelect:true,blockedAnchor:true,toggleAndHome:true,createAndReturn:true});
  await p.close();
 }
 const p=await browser.newPage({width:1440,height:900});await p.goto(base+'/');
 assert.equal(await p.eval(()=>document.querySelector('#welcome').children.length),3);
 await p.screenshot({path:'work/pickgo-map-style/main-after.png',format:'png'});
 await p.eval(()=>document.querySelector('#create a[href="/map"]').click());await wait(p,()=>location.pathname==='/map');
 results.push({mainMapLink:true});
 writeFileSync('work/pickgo-map-style/browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
