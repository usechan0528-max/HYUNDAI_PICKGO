import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from './server.mjs';
import {RecommendationBoard} from './recommendation/board.mjs';
import {syntheticProvider} from './recommendation/providers.mjs';
import {PLACES} from './domain.mjs';
test('actual HTTP authenticated recommendation, selection and latest-evidence acceptance',async t=>{
 const server=createServer(new RecommendationBoard(Date.now,()=>performance.now(),syntheticProvider));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());const base=`http://127.0.0.1:${server.address().port}`;
 const req=async(path,body,token)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 const d=(await req('/api/rooms',{place:PLACES[2]})).data,root=`/api/rooms/${d.id}`;const r=(await req(root+'/join',{invite:d.invite})).data;
 const call=async(who,type,extra={})=>{const v=(await req(root,null,who.token)).data;return req(root+'/recommendation',{version:v.version,view:v.view,requestId:randomUUID(),type,...extra},who.token);};
 for(const who of [d,r]){const consentId=randomUUID();assert.equal((await call(who,'grant',{consentId,consent:'pickup-recommendation-continuous-v1'})).status,200);assert.equal((await call(who,'publish',{consentId,source:'synthetic',sequence:0,fix:{latitude:37,longitude:127,accuracy:5,ageMs:0}})).status,200);}
 assert.equal((await req(root+'/recommendation',null,'wrong')).status,403);
 const result=await call(d,'calculate'),s=result.data.snapshot;assert.equal(s.candidates.length,3);
 assert.equal((await call(d,'select',{snapshotId:s.id,candidateId:s.candidates[0].id,place:'injected'})).status,200);
 const view=(await req(root,null,r.token)).data;assert.equal(view.place,PLACES[2]);
 assert.equal((await call(r,'accept',{proposalId:view.proposal.id})).status,200);assert.equal((await req(root,null,r.token)).data.place,PLACES[0]);
 const denied=await fetch(base+root+'/recommendation',{headers:{Origin:'https://evil.example',Authorization:`Bearer ${r.token}`}});assert.equal(denied.status,403);
 const page=await fetch(base+'/recommendation');assert.equal(page.status,200);assert.match(await page.text(),/합성 위치/);
});
test('server cleanup removes idle expired positions without a further request',async t=>{
 let now=1000;const board=new RecommendationBoard(()=>1700000000000+now,()=>now,syntheticProvider),server=createServer(board);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
 const d=board.create(PLACES[0]),r=board.join(d.id,d.invite),consentId=randomUUID();
 await board.recommend(d.id,r.token,{...board.read(d.id,r.token),type:'grant',consentId,consent:'pickup-recommendation-continuous-v1'});
 await board.recommend(d.id,r.token,{type:'publish',consentId,sequence:0,source:'synthetic',fix:{latitude:37,longitude:127,accuracy:5,ageMs:0}});
 now+=15000;await new Promise(resolve=>setTimeout(resolve,1100));assert.equal(board.recommendations.get(d.id).rider.fix,null);
});
