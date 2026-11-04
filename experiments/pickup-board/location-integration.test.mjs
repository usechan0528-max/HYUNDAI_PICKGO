import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { PhoneBoard } from './phone-domain.mjs';
import { PLACES } from './domain.mjs';
import { ProximityDetector } from './proximity/detector.mjs';
import { createServer } from './server.mjs';

test('accepted place revision changes even A-B-A; readiness and phone shares do not change it', () => {
  const board = new PhoneBoard(); const driver = board.create(PLACES[0]); const rider = board.join(driver.id,driver.invite);
  const read = who => board.read(driver.id,who.token);
  const act = (who,type,extra={}) => { const s=read(who); return board.act(driver.id,who.token,{type,...extra,version:s.version,view:s.view,requestId:randomUUID()}); };
  assert.equal(read(driver).placeRevision,1);
  act(rider,'ready',{ready:true}); assert.equal(read(driver).placeRevision,1);
  for (const place of [PLACES[1],PLACES[0]]) {
    const before=read(driver).placeRevision;
    const pending=act(driver,'propose',{place}); assert.equal(pending.placeRevision,before);
    const accepted=act(rider,'accept',{proposalId:pending.proposal.id}); assert.equal(accepted.placeRevision,before+1);
  }
  assert.equal(read(driver).placeRevision,3);
});

test('combined real HTTP: phone sharing and synthetic proximity never mark arrival; boarding clears phone sample', async t => {
  const server=createServer(); server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>new Promise(resolve=>{ server.close(resolve); server.closeAllConnections(); }));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const api=async(path,token,body)=>{
    const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    assert.ok(r.ok,`HTTP ${r.status}`); return r.json();
  };
  const driver=await api('/api/rooms',null,{place:PLACES[0]}), path=`/api/rooms/${driver.id}`;
  const rider=await api(path+'/join',null,{invite:driver.invite});
  const view=await api(path,rider.token); const consentId=randomUUID();
  await api(path+'/phone',rider.token,{type:'grant',consentId,consent:'pickup-location-once-v1',version:view.version,view:view.view});
  await api(path+'/phone',rider.token,{type:'publish',consentId,fix:{latitude:0,longitude:0,accuracy:5,observedAt:Date.now(),ageMs:0}});
  const sample=(await api(path+'/phone',driver.token)).sample; assert.equal(sample.source,'rider-phone');
  const state=await api(path,driver.token); let now=1000;
  const detector=new ProximityDetector({now:()=>now}); const gen=detector.bind(driver.id,{id:state.place,revision:state.placeRevision,latitude:0,longitude:0});
  assert.equal(detector.ingest(gen,{...sample,observedAtMonoMs:now,receivedAtMonoMs:now}).state,'unknown');
  for(let i=0;i<2;i++){now++;detector.ingest(gen,{source:'synthetic',latitude:0,longitude:0,accuracyMeters:5,observedAtMonoMs:now,receivedAtMonoMs:now});}
  assert.equal(detector.read().state,'near'); assert.equal((await api(path,driver.token)).stage,'waiting');
  const act=async(who,type)=>{const s=await api(path,who.token);return api(path+'/actions',who.token,{type,version:s.version,view:s.view,requestId:randomUUID()});};
  await act(driver,'arrive'); assert.ok((await api(path+'/phone',driver.token)).sample);
  await act(rider,'board'); assert.equal((await api(path+'/phone',driver.token)).sample,null);
  assert.equal((await act(driver,'end')).outcome,'completed');
  for(const route of ['/phone','/proximity','/proximity-page.mjs','/proximity/detector.mjs']) assert.equal((await fetch(origin+route)).status,200,route);
  for(const route of ['/phone-domain.mjs','/domain.mjs','/server.mjs']) assert.equal((await fetch(origin+route)).status,404,route);
});

test('accepted place change invalidates both published phone fix and outstanding consent', () => {
  const board=new PhoneBoard();const driver=board.create(PLACES[0]);const rider=board.join(driver.id,driver.invite);
  const act=(who,type,extra={})=>{const s=board.read(driver.id,who.token);return board.act(driver.id,who.token,{type,...extra,version:s.version,view:s.view,requestId:randomUUID()});};
  const grant=()=>{const s=board.read(driver.id,rider.token),consentId=randomUUID();board.phone(driver.id,rider.token,{type:'grant',consentId,consent:'pickup-location-once-v1',version:s.version,view:s.view});return consentId;};
  const publish=consentId=>board.phone(driver.id,rider.token,{type:'publish',consentId,fix:{latitude:0,longitude:0,accuracy:5,observedAt:Date.now(),ageMs:0}});
  let consentId=grant();publish(consentId);
  let pending=act(driver,'propose',{place:PLACES[1]});act(rider,'accept',{proposalId:pending.proposal.id});
  assert.equal(board.phone(driver.id,driver.token).sample,null);
  consentId=grant();pending=act(driver,'propose',{place:PLACES[2]});act(rider,'accept',{proposalId:pending.proposal.id});
  assert.throws(()=>publish(consentId),/만료되거나 철회/);assert.equal(board.phone(driver.id,driver.token).sample,null);
});
