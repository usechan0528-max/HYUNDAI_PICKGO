import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalize,createParkingService} from './parking.mjs';
import {createServer} from './server.mjs';
const fixture=JSON.parse(await readFile(new URL('../docs/evidence/seoul-parking-first-response-2026-11-02.json',import.meta.url)));
const row=fixture.selected_row;
const now=Date.parse(row.NOW_PRK_VHCL_UPDT_TM.replace(' ','T')+'+09:00')+60000;
const payload=(patch={})=>({GetParkingInfo:{RESULT:{CODE:'INFO-000'},row:[{...row,...patch}]}});
test('real response fixture preserves reported quantities and distinguishes arithmetic difference',()=>{const x=normalize(payload(),now); assert.equal(x.status,'fresh'); assert.equal(x.difference,1150); assert.equal(x.occupied,110);});
test('stale, future, impossible dates/counts, and disabled feed hide numbers',()=>{
 for(const [patch,at] of [[{},now+240000],[{},now-60001],[{NOW_PRK_VHCL_UPDT_TM:'2026-02-30 00:00:00'},now],[{NOW_PRK_VHCL_CNT:1261},now],[{NOW_PRK_VHCL_CNT:-1},now],[{NOW_PRK_VHCL_CNT:'110'},now],[{PRK_STTS_YN:'0'},now]]) { const x=normalize(payload(patch),at);assert.equal(x.difference,null); }
 assert.equal(normalize(payload({NOW_PRK_VHCL_CNT:1260}),now).difference,0);
 assert.throws(()=>normalize(payload({PKLT_CD:'other'}),now)); assert.throws(()=>normalize({RESULT:{CODE:'ERROR'}},now));
});
test('single flight and cache suppress requests; refresh failure never returns old success',async()=>{
 let calls=0,t=now; const svc=createParkingService({clock:()=>t,fetchImpl:async()=>{calls++; if(calls>1)throw Error('offline');return new Response(JSON.stringify(payload()));}});
 const pair=await Promise.all([svc(),svc()]);assert.equal(calls,1);assert.equal(pair[0].status,'fresh');await svc();assert.equal(calls,1);t+=60000;assert.equal((await svc()).status,'unavailable');assert.equal(calls,2);
});
test('oversize and malformed responses fail closed',async()=>{for(const body of ['invalid','x'.repeat(262145)]) {const svc=createParkingService({fetchImpl:async()=>new Response(body)});assert.equal((await svc()).status,'unavailable');}});
test('same-origin API returns data, failures and method policy',async()=>{
 const server=createServer({parkingService:async()=>({status:'unavailable'})}); await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{ const url=`http://127.0.0.1:${server.address().port}`;assert.equal((await fetch(url+'/api/parking')).status,503);assert.equal((await fetch(url+'/api/parking',{method:'HEAD'})).status,405);assert.equal((await fetch(url+'/live')).status,200); }
 finally{await new Promise(r=>server.close(r));}
});

test('cached observation is re-evaluated across five-minute boundary',async()=>{
 let t=now+239000,calls=0;
 const svc=createParkingService({clock:()=>t,fetchImpl:async()=>{calls++;return new Response(JSON.stringify(payload()));}});
 assert.equal((await svc()).status,'fresh'); t+=1000;
 const result=await svc(); assert.equal(result.status,'stale'); assert.equal(result.capacity,null); assert.equal(result.ageMs,300000); assert.equal(calls,1);
});
test('API success contract and same-origin browser policy',async()=>{
 const server=createServer({parkingService:async()=>({...normalize(payload(),now),ageMs:60000})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const url=`http://127.0.0.1:${server.address().port}`;const r=await fetch(url+'/api/parking');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal((await r.json()).occupied,110);assert.match((await fetch(url+'/live')).headers.get('content-security-policy'),/connect-src 'self'/);}
 finally{await new Promise(r=>server.close(r));}
});
