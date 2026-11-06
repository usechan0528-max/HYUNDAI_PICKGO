import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RecommendationBoard } from './recommendation/board.mjs';
import { syntheticProvider } from './recommendation/providers.mjs';
import { rankCandidates } from './recommendation/engine.mjs';
import { PLACES } from './domain.mjs';
function setup(provider=syntheticProvider){
  let now=1000;const b=new RecommendationBoard(()=>1700000000000+now,()=>now,provider);
  const d=b.create(PLACES[2]),r=b.join(d.id,d.invite);
  const command=(who,type,extra={})=>({...b.read(d.id,who.token),type,requestId:randomUUID(),...extra});
  const send=(who,type,extra={})=>b.recommend(d.id,who.token,command(who,type,extra));
  const grants={};
  const share=async(who,lon=127)=>{const consentId=randomUUID();grants[who.role]=consentId;await send(who,'grant',{consentId,consent:'pickup-recommendation-continuous-v1'});await send(who,'publish',{consentId,sequence:0,source:'synthetic',fix:{latitude:37,longitude:lon,accuracy:5,ageMs:0}});};
  return {b,d,r,command,send,share,grants,tick:n=>now+=n};
}
test('fresh route-based ranking → proposal → counterpart acceptance; never automatic',async()=>{
 const x=setup();await x.share(x.d);await x.share(x.r);const out=await x.send(x.d,'calculate');
 assert.equal(out.snapshot.candidates[0].name,PLACES[0]);assert.equal(x.b.read(x.d.id,x.d.token).place,PLACES[2]);
 await x.send(x.d,'select',{snapshotId:out.snapshot.id,candidateId:out.snapshot.candidates[0].id});
 const v=x.b.read(x.d.id,x.r.token);await x.send(x.r,'accept',{proposalId:v.proposal.id});assert.equal(x.b.read(x.d.id,x.d.token).place,PLACES[0]);
});
test('east graph changes ranking; no synthetic recommendation by default',async()=>{
 const x=setup();await x.share(x.d,127.002);await x.share(x.r,127.002);assert.equal((await x.send(x.d,'calculate')).snapshot.candidates[0].name,PLACES[1]);
 const b=new RecommendationBoard();const d=b.create(PLACES[0]);b.join(d.id,d.invite);assert.equal((await b.recommend(d.id,d.token,{type:'calculate'})).status,'provider-unavailable');
});
test('one-shot consent cannot authorize continuous sharing or client supplied route',async()=>{
 const x=setup();await assert.rejects(x.send(x.r,'grant',{consentId:randomUUID(),consent:'pickup-location-once-v1'}));
 await assert.rejects(x.send(x.r,'publish',{consentId:randomUUID(),sequence:0,fix:{}}));
 await assert.rejects(x.b.recommend(x.d.id,'wrong',{type:'calculate'}));
});
for(const kind of ['expiry','revoke','new-fix','ended','rollback'])test(`${kind} invalidates recommendation and prevents delayed selection`,async()=>{
 const x=setup();await x.share(x.d);await x.share(x.r);const out=await x.send(x.d,'calculate');
 if(kind==='expiry')x.tick(5000);
 if(kind==='revoke')await x.send(x.r,'revoke',{consentId:x.grants.rider});
 if(kind==='new-fix')await x.share(x.r,127.002);
 if(kind==='ended')x.b.act(x.d.id,x.d.token,x.command(x.d,'end'));
 if(kind==='rollback')x.tick(-1);
 await assert.rejects(x.send(x.d,'select',{snapshotId:out.snapshot.id,candidateId:out.snapshot.candidates[0].id}));
});
test('revoke tombstone rejects late grant and publish; reordered updates fail',async()=>{
 const x=setup(),consentId=randomUUID();await x.send(x.r,'revoke',{consentId});await assert.rejects(x.send(x.r,'grant',{consentId,consent:'pickup-recommendation-continuous-v1'}));
 await x.share(x.r);const p={consentId:x.grants.rider,sequence:0,source:'synthetic',fix:{latitude:37,longitude:127,accuracy:5,ageMs:0}};await assert.rejects(x.send(x.r,'publish',p));
 await x.send(x.r,'revoke',{consentId:x.grants.rider});await assert.rejects(x.send(x.r,'publish',{...p,sequence:1}));
});
test('ordinary actions cannot bypass recommendation evidence; reject still works',async()=>{
 const x=setup();await x.share(x.d);await x.share(x.r);const s=(await x.send(x.d,'calculate')).snapshot;
 await x.send(x.d,'select',{snapshotId:s.id,candidateId:s.candidates[0].id});x.tick(5000);const v=x.b.read(x.d.id,x.r.token);
 assert.throws(()=>x.b.act(x.d.id,x.r.token,x.command(x.r,'accept',{proposalId:v.proposal.id})));
 x.b.act(x.d.id,x.r.token,x.command(x.r,'reject',{proposalId:v.proposal.id}));assert.equal(x.b.read(x.d.id,x.d.token).place,PLACES[2]);
});
test('in-flight provider response cannot resurrect revoked inputs',async()=>{
 let release;const provider={mode:'synthetic',evaluate:args=>new Promise(resolve=>{release=()=>resolve(syntheticProvider.evaluate(args));})};
 const x=setup(provider);await x.share(x.d);await x.share(x.r);const pending=x.send(x.d,'calculate');await Promise.resolve();await x.send(x.r,'revoke',{consentId:x.grants.rider});release();await assert.rejects(pending);assert.equal((await x.send(x.d,'calculate').catch(()=>null)),null);
});
test('provider failures return no candidates',async()=>{const x=setup({mode:'synthetic',evaluate:async()=>{throw Error('private provider details');}});await x.share(x.d);await x.share(x.r);assert.equal((await x.send(x.d,'calculate')).status,'provider-unavailable');});
const fixture=async()=>syntheticProvider.evaluate({driver:{id:'d',at:1000,ageMs:0,latitude:37,longitude:127,accuracy:5},rider:{id:'r',at:1000,ageMs:0,latitude:37,longitude:127,accuracy:5},now:1000,wall:1700000000000});
for(const [name,mutate] of Object.entries({
 'prohibited curb':c=>c.evidence.prohibited=true,
 'closure':c=>c.evidence.closed=true,
 'vehicle class denied':c=>c.evidence.vehicleAllowed=false,
 'permission expires before arrival':c=>c.evidence.validUntil=1700000005000,
 'wrong entrance evidence':c=>c.evidence.entranceId='other',
 'no pedestrian path':c=>c.walk.pathVerified=false,
 'wrong route':c=>c.vehicle.routeId='old',
 'unknown approach':c=>c.vehicle.legalApproach=false,
 'negative travel time':c=>c.walk.seconds=-1,
 'mixed synthetic data':c=>c.mode='live',
 'unknown source':c=>c.evidence.source='',
 'stale permission evidence':c=>c.evidence.checkedAt=1700000000000-900000,
 'zero dwell permission':c=>c.evidence.maxDwellSeconds=0,
 'short stop prohibited':c=>c.evidence.stopProhibited=true,
 'bus-only':c=>c.evidence.publicTransportOnly=true,
 'taxi-only':c=>c.evidence.taxiOnly=true,
 'building interior':c=>c.evidence.positionType='building-interior',
 'motorway center':c=>c.evidence.positionType='motorway-lane'
}))test(`exclude ${name}`,async()=>{const f=await fixture();f.candidates.forEach(mutate);assert.equal(rankCandidates(f,1000,1700000000000).candidates.length,0);});
test('accuracy, future time and stale source cannot produce ranking',async()=>{for(const mutate of [f=>f.driver.accuracy=51,f=>f.rider.ageMs=15000,f=>f.driver.at=1001,f=>f.route.driverFixId='old']){const f=await fixture();mutate(f);assert.equal(rankCandidates(f,1000,1700000000000).candidates.length,0);}});
test('unconfigured live provider rejects grants and fixes server-side',async()=>{const b=new RecommendationBoard();const d=b.create(PLACES[0]),r=b.join(d.id,d.invite);for(const type of ['grant','publish'])await assert.rejects(b.recommend(d.id,r.token,{type,consentId:randomUUID(),consent:'pickup-recommendation-continuous-v1',...b.read(d.id,r.token)}),e=>e.status===409);assert.equal(b.entry(d.id).rider.fix,null);assert.equal(b.entry(d.id).rider.grant,null);});
test('expired positions prevent recommendation acceptance and delete derived summary',async()=>{const x=setup();await x.share(x.d);await x.share(x.r);const s=(await x.send(x.d,'calculate')).snapshot;await x.send(x.d,'select',{snapshotId:s.id,candidateId:s.candidates[0].id});x.tick(15000);const v=x.b.read(x.d.id,x.r.token);await assert.rejects(x.send(x.r,'accept',{proposalId:v.proposal.id}));assert.equal((await x.b.recommend(x.d.id,x.r.token)).proposalEvidence,null);assert.throws(()=>x.b.act(x.d.id,x.r.token,x.command(x.r,'accept',{proposalId:v.proposal.id})));});
test('consent ID cap remains fail closed including revoked IDs',async()=>{const x=setup();for(let i=0;i<100;i++)await x.send(x.r,'revoke',{consentId:randomUUID()});await assert.rejects(x.send(x.r,'grant',{consentId:randomUUID(),consent:'pickup-recommendation-continuous-v1'}));});
test('withdraw during provider acceptance prevents delayed acceptance',async()=>{let release,delay=false;const provider={mode:'synthetic',evaluate:args=>delay?new Promise(resolve=>release=()=>resolve(syntheticProvider.evaluate(args))):syntheticProvider.evaluate(args)};const x=setup(provider);await x.share(x.d);await x.share(x.r);const s=(await x.send(x.d,'calculate')).snapshot;await x.send(x.d,'select',{snapshotId:s.id,candidateId:s.candidates[0].id});const proposalId=x.b.read(x.d.id,x.r.token).proposal.id;delay=true;const pending=x.send(x.r,'accept',{proposalId});await Promise.resolve();x.b.act(x.d.id,x.d.token,x.command(x.d,'withdraw',{proposalId}));release();await assert.rejects(pending);assert.equal(x.b.read(x.d.id,x.r.token).place,PLACES[2]);});
test('provider timeout aborts and prevents stacking a provider that ignores abort',async()=>{let signal;const x=setup({mode:'synthetic',evaluate:args=>{signal=args.signal;return new Promise(()=>{});}});await x.share(x.d);await x.share(x.r);assert.equal((await x.send(x.d,'calculate')).status,'provider-unavailable');assert.equal(signal.aborted,true);assert.equal(x.b.entry(x.d.id).busy,true);await assert.rejects(x.send(x.d,'calculate'),e=>e.status===429);});
test('manual proposals remain explicit manual choices; recommendation origin cannot bypass binding loss',async()=>{const x=setup();x.b.act(x.d.id,x.d.token,x.command(x.d,'propose',{place:PLACES[1]}));let v=x.b.read(x.d.id,x.r.token);assert.equal(v.proposal.origin,undefined);x.b.act(x.d.id,x.r.token,x.command(x.r,'accept',{proposalId:v.proposal.id}));await x.share(x.d);await x.share(x.r);const s=(await x.send(x.d,'calculate')).snapshot;await x.send(x.d,'select',{snapshotId:s.id,candidateId:s.candidates[0].id});v=x.b.read(x.d.id,x.r.token);assert.equal(v.proposal.origin,'recommendation');x.b.entry(x.d.id).proposal=null;assert.throws(()=>x.b.act(x.d.id,x.r.token,x.command(x.r,'accept',{proposalId:v.proposal.id})));await assert.rejects(x.send(x.r,'accept',{proposalId:v.proposal.id}));});
test('accepted manual and recommended place changes revoke both continuous grants',async()=>{for(const manual of [true,false]){const x=setup();await x.share(x.d);await x.share(x.r);if(manual)x.b.act(x.d.id,x.d.token,x.command(x.d,'propose',{place:PLACES[0]}));else{const s=(await x.send(x.d,'calculate')).snapshot;await x.send(x.d,'select',{snapshotId:s.id,candidateId:s.candidates[0].id});}const proposalId=x.b.read(x.d.id,x.r.token).proposal.id;if(manual)x.b.act(x.d.id,x.r.token,x.command(x.r,'accept',{proposalId}));else await x.send(x.r,'accept',{proposalId});for(const who of [x.d,x.r]){assert.equal(x.b.entry(x.d.id)[who.role].grant,null);assert.equal(x.b.entry(x.d.id)[who.role].fix,null);await assert.rejects(x.send(who,'publish',{consentId:x.grants[who.role],sequence:2,source:'synthetic',fix:{latitude:37,longitude:127,accuracy:5,ageMs:0}}));}}});
test('explicit end remains available at mutation cap and removes locations',async()=>{const x=setup();await x.share(x.r);x.b.room(x.d.id).requests=new Set(Array.from({length:1000},(_,i)=>`used-${i}`));x.b.act(x.d.id,x.d.token,x.command(x.d,'end'));assert.equal(x.b.entry(x.d.id).rider.fix,null);});

test('ordinary curb unknown permission, parking-only ban and short dwell remain selectable',async()=>{
 for(const mutate of [c=>delete c.evidence.pickupAllowed,c=>c.evidence.parkingProhibited=true,c=>c.evidence.maxDwellSeconds=30,c=>c.evidence.enforcementCamera=true]){
  const f=await fixture();f.candidates.forEach(mutate);const out=rankCandidates(f,1000,1700000000000);
  assert.equal(out.candidates.length,3);assert.ok(out.candidates[0].advisories.includes('정차 허용 여부 미확인'));
 }
});
test('new prohibition blocks recommendation selection and manual bypass',async()=>{
 let blocked=false;const provider={mode:'synthetic',evaluate:async args=>{const f=await syntheticProvider.evaluate(args);if(blocked)f.candidates[0].evidence.stopProhibited=true;return f;}};
 const x=setup(provider);await x.share(x.d);await x.share(x.r);const s=(await x.send(x.d,'calculate')).snapshot;blocked=true;
 await assert.rejects(x.send(x.d,'select',{snapshotId:s.id,candidateId:'demo-0'}));
 assert.throws(()=>x.b.act(x.d.id,x.d.token,x.command(x.d,'propose',{place:PLACES[0]})));
 assert.throws(()=>x.b.create(PLACES[0]));
});
test('server restriction catalogue guards manual creation, proposal and acceptance',()=>{
 let blocked=false;const x=setup({...syntheticProvider,selectionEvidence:name=>name===PLACES[0]&&blocked?{positionType:'building-interior'}:{}});
 x.b.act(x.d.id,x.d.token,x.command(x.d,'propose',{place:PLACES[0]}));const proposalId=x.b.read(x.d.id,x.r.token).proposal.id;blocked=true;
 assert.throws(()=>x.b.act(x.d.id,x.r.token,x.command(x.r,'accept',{proposalId})));
 assert.throws(()=>x.b.create(PLACES[0]));
});

test('missing or stale restriction updates cannot erase a known ban',async()=>{
 let phase=0;const provider={mode:'synthetic',selectionEvidence:()=>({}),evaluate:async args=>{const f=await syntheticProvider.evaluate(args);const e=f.candidates[0].evidence;if(phase===0)e.stopProhibited=true;if(phase===1)delete e.stopProhibited;if(phase===2)e.checkedAt-=900001;return f;}};
 const x=setup(provider);await x.share(x.d);await x.share(x.r);
 for(phase=0;phase<3;phase++){const out=await x.send(x.d,'calculate');assert.ok(!out.snapshot?.candidates.some(c=>c.id==='demo-0'));assert.throws(()=>x.b.create(PLACES[0]));}
 phase=3;assert.ok((await x.send(x.d,'calculate')).snapshot.candidates.some(c=>c.id==='demo-0'));assert.doesNotThrow(()=>x.b.create(PLACES[0]));
});

test('out-of-catalogue top scores do not hide selectable catalogue candidates',async()=>{
 const x=setup({mode:'synthetic',evaluate:async args=>{const f=await syntheticProvider.evaluate(args);const alien=structuredClone(f.candidates[0]);alien.name='unbound';alien.vehicle.detourSeconds=0;alien.walk.seconds=0;f.candidates.unshift(...[0,1,2].map(i=>({...alien,id:'alien-'+i})));return f;}});
 await x.share(x.d);await x.share(x.r);assert.equal((await x.send(x.d,'calculate')).snapshot.candidates.length,3);
});

test('another entrance cannot overwrite a known ban under the same place name',async()=>{
 let change=false;const x=setup({mode:'synthetic',evaluate:async args=>{const f=await syntheticProvider.evaluate(args),c=f.candidates[0];if(change){c.entranceId=c.evidence.entranceId=c.vehicle.entranceId=c.walk.entranceId='other-entrance';}else c.evidence.stopProhibited=true;return f;}});
 await x.share(x.d);await x.share(x.r);await x.send(x.d,'calculate');change=true;
 assert.equal((await x.send(x.d,'calculate')).status,'provider-invalid');assert.throws(()=>x.b.create(PLACES[0]));
});
