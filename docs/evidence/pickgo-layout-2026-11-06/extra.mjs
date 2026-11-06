import {Browser} from '../../../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4199',out='docs/evidence/pickgo-layout-2026-11-06';
const d=await(await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({place:'하나로마트 양재점'})})).json();
assert.ok(d.token);const b=await Browser.launch();try{const p=await b.newPage({width:390,height:844});
await p.goto(base+`/#room=${d.id}&invite=${d.invite}`);await new Promise(r=>setTimeout(r,700));
assert.match(await p.eval(()=>document.getElementById('invitePlace').textContent),/하나로마트 양재점/);
assert.equal((await(await fetch(base+'/api/rooms/'+d.id,{headers:{Authorization:'Bearer '+d.token}})).json()).joined,false);
for(const [width,height] of [[390,844],[320,568],[1224,760]]){await p.setViewport({width,height});assert.equal(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:`${out}/invite-${width}.png`});}
await p.eval(d=>{sessionStorage.clear();sessionStorage.setItem('pickupSession',JSON.stringify(d));},d);await p.goto(base+'/phone');await new Promise(r=>setTimeout(r,400));assert.equal(await p.eval(()=>document.getElementById('stop').hidden),true);
console.log('PASS latest server: preview place before joining, invitation not consumed, 3 invitation sizes without horizontal overflow, driver stop control hidden, formatter route', (await fetch(base+'/place-label.mjs')).status);
}finally{await b.close();}
