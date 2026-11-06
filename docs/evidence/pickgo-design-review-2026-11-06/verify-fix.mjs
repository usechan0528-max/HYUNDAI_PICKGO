import {Browser} from '../../../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import {createServer} from '../../../experiments/pickup-board/server.mjs';
import assert from 'node:assert/strict';
const out='docs/evidence/pickgo-design-review-2026-11-06',server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,b=await Browser.launch(),pause=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const d=await b.newPage({width:1280,height:720}),r=await b.newPage({width:390,height:844});await d.goto(base);
 const s=await d.eval(async()=>{const x=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({point:[127.0351004,37.4639150]})});if(!x.ok)throw Error(await x.text());const s=await x.json();sessionStorage.setItem('pickupSession',JSON.stringify(s));return s;});
 await d.goto(base);await r.goto(`${base}/#room=${s.id}&invite=${s.invite}`);await r.eval(()=>document.getElementById('join').click());await pause(1300);await d.eval(()=>document.getElementById('refresh').click());await pause(400);
 for(const [p,name] of [[d,'fixed-driver'],[r,'fixed-rider']]){assert.equal(await p.eval(()=>document.getElementById('place').textContent),'지도에서 선택한 장소');assert.ok(!await p.eval(()=>document.body.innerText.includes('37.4639150')));await p.screenshot({path:`${out}/${name}.png`});}
 await r.eval(()=>document.getElementById('openPlace').click());assert.ok((await r.eval(()=>document.getElementById('editingCurrent').textContent)).includes('지도에서 선택한 장소'));await r.goto(base+'/phone');await pause(500);assert.ok((await r.eval(()=>document.getElementById('context').textContent)).includes('지도에서 선택한 장소'));await r.screenshot({path:`${out}/fixed-phone.png`});
 const proposed=[127.0358465,37.4661039];
 await r.eval(async point=>{const s=JSON.parse(sessionStorage.getItem('pickupSession'));const h={Authorization:`Bearer ${s.token}`,'Content-Type':'application/json'};const state=await(await fetch(`/api/rooms/${s.id}`,{headers:h})).json();const res=await fetch(`/api/rooms/${s.id}/actions`,{method:'POST',headers:h,body:JSON.stringify({type:'proposePoint',point,version:state.version,view:state.view,requestId:crypto.randomUUID()})});if(!res.ok)throw Error(await res.text());},proposed);
 await d.eval(()=>document.getElementById('refresh').click());await pause(400);assert.equal(await d.eval(()=>document.getElementById('proposedPlace').textContent),'지도에서 제안한 장소');await d.screenshot({path:`${out}/fixed-proposal.png`});await d.eval(()=>document.getElementById('accept').click());await pause(600);
 const after=await d.eval(async()=>{const s=JSON.parse(sessionStorage.getItem('pickupSession'));return(await fetch(`/api/rooms/${s.id}`,{headers:{Authorization:`Bearer ${s.token}`}})).json();});assert.deepEqual(after.mapPoint,proposed);assert.equal(after.place,'지도 핀 (37.4661039, 127.0358465)');assert.equal(after.proposal,null);assert.equal(await d.eval(()=>document.getElementById('place').textContent),'지도에서 선택한 장소');
 for(const path of ['/proximity','/recommendation']){await d.goto(base+path);await pause(500);assert.ok(!await d.eval(()=>document.body.innerText.includes('37.4661039')));console.log('PASS supplemental screen',path);}
 console.log('PASS real Chrome: driver/rider/editor/phone/proposal/accept; canonical place and mapPoint preserved.');
}finally{await b.close();await new Promise(r=>server.close(r));}
