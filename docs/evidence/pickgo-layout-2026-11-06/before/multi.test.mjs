import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MultiBoard } from './multi/board.mjs';
import { bestOrder } from './multi/planner.mjs';

function fixture(options = {}) {
  let now = 100000;
  const b = new MultiBoard({ now: () => now, checkPoint: p => ({ selectable: p[0] > 0 }), ...options });
  const d = b.create({ origin: [127,37], demo: options.demo ?? true });
  const read = (who = d) => b.read(d.id, who.token);
  const cmd = (who, type, extra = {}) => ({ ...read(who), requestId: randomUUID(), type, ...extra });
  const act = (type, extra = {}, who = d) => b.act(d.id, who.token, cmd(who,type,extra));
  const add = (name, stopId) => { act('add', { name, ...(stopId ? {stopId} : {point:[127.01,37.01],label:name+' 지점'}) }); return read().participants.at(-1); };
  const join = p => b.join(d.id,{invite:read().invites.find(x=>x.id===p.id).invite,joinId:randomUUID()});
  return { b,d,read,cmd,act,add,join,tick: n=>{now+=n;} };
}
test('three riders: independent identity, privacy, preparation, ordered boarding and completion', () => {
  const f=fixture(), people=['가','나','다'].map(n=>f.add(n)), riders=people.map(f.join);
  riders.forEach((r,i)=> { const s=f.read(r); assert.equal(s.participant.name,people[i].name); for(const key of ['participants','stops','invites','origin','destination'])assert.equal(s[key],undefined); f.act('ready',{ready:true},r); });
  assert.throws(()=>f.act('ready',{ready:false,participantId:people[1].id},riders[0]),/본인/);
  assert.throws(()=>f.act('ready',{ready:true}),/본인/);
  assert.throws(()=>f.act('board',{},riders[0]),/도착/);
  for(const r of riders){f.act('next');f.act('arrive');f.act('board',{},r);}
  assert.equal(f.act('end').status,'completed');
  assert.throws(()=>f.act('add',{name:'끝'}),/종료/);
});
test('same stop explicitly shared; one boarding does not advance other person',()=>{
  const f=fixture(),a=f.add('가'),b=f.add('나',a.stopId),ra=f.join(a);f.join(b);
  assert.equal(f.read().order.length,1);f.act('next');f.act('arrive');f.act('board',{},ra);
  assert.throws(()=>f.act('next'),/현재/);assert.equal(f.read().active,a.stopId);
  f.act('cancel',{participantId:b.id});assert.equal(f.read().active,null);assert.deepEqual(f.read().origin,[127.01,37.01]);assert.equal(f.act('end').status,'partial');
});
test('cancel before arrival never moves origin; immutable grouping, cancelled invite, no-show ending',()=>{
  const f=fixture(),p=f.add('가'),inv=f.read().invites[0].invite;
  const preview=f.b.preview(f.d.id,inv);assert.equal(preview.name,'가');assert.equal(preview.invite,undefined);
  f.act('next');assert.throws(()=>f.add('나',p.stopId),/현재/);
  f.act('cancel',{participantId:p.id});assert.deepEqual(f.read().origin,[127,37]);
  assert.throws(()=>f.b.join(f.d.id,{invite:inv,joinId:randomUUID()}),/유효/);assert.equal(f.act('end').status,'cancelled');
});
test('single-use invite retry is bound to same join ID and TTL',()=>{
  const f=fixture();f.add('가');const invite=f.read().invites[0].invite,joinId=randomUUID();
  const a=f.b.join(f.d.id,{invite,joinId});assert.deepEqual(f.b.join(f.d.id,{invite,joinId}),a);
  assert.throws(()=>f.b.join(f.d.id,{invite,joinId:randomUUID()}),/이미/);f.tick(300001);assert.throws(()=>f.b.join(f.d.id,{invite,joinId}),/이미/);
});
test('cross trip auth, rider driver actions, stale views and replay rejected',()=>{
  const f=fixture(),p=f.add('가'),r=f.join(p),other=f.b.create({origin:[127,37]});
  assert.throws(()=>f.b.read(f.d.id,other.token),/참여자/);assert.throws(()=>f.act('next',{},r),/운전자/);
  const c=f.cmd(f.d,'next');f.b.act(f.d.id,f.d.token,c);assert.throws(()=>f.b.act(f.d.id,f.d.token,c),/상태|처리/);
  const stale=f.cmd(f.d,'arrive');f.tick(15001);assert.throws(()=>f.b.act(f.d.id,f.d.token,stale),/조회/);
});
test('manual ordering must be a permutation and locks active first stop',()=>{
  const f=fixture();f.add('가');f.add('나');const initial=f.read().order;
  assert.throws(()=>f.act('order',{order:[initial[0],initial[0]]}),/모든/);
  f.act('order',{order:[...initial].reverse()});f.act('next');assert.throws(()=>f.act('order',{order:initial}),/고정/);
});
test('recommendation preview does not apply; ready change, expiry and duplicate apply rejected',async()=>{
  const f=fixture(),p=f.add('가');f.add('나');const r=f.join(p),initial=f.read().order;
  let rec=(await f.b.recommend(f.d.id,f.d.token,f.cmd(f.d,'recommend'))).recommendation;
  assert.deepEqual(f.read().order,initial);assert.equal(rec.mode,'demo');
  f.act('ready',{ready:true},r);assert.throws(()=>f.act('apply',{recommendationId:rec.id}),/만료/);
  rec=(await f.b.recommend(f.d.id,f.d.token,f.cmd(f.d,'recommend'))).recommendation;f.tick(60001);assert.throws(()=>f.act('apply',{recommendationId:rec.id}),/만료/);
  rec=(await f.b.recommend(f.d.id,f.d.token,f.cmd(f.d,'recommend'))).recommendation;f.act('apply',{recommendationId:rec.id});assert.deepEqual(f.read().order,rec.order);assert.throws(()=>f.act('apply',{recommendationId:rec.id}),/만료/);
});
test('real provider absent, failed, timed out, incomplete or stale never falls back to synthetic',async()=>{
  for(const provider of [null,()=>{throw Error('secret');},()=>new Promise(()=>{}),()=>({mode:'real',source:'test',observedAt:100000,expiresAt:110000,matrix:{}}),()=>({mode:'real',source:'test',observedAt:1,expiresAt:110000,matrix:{}})]){
    const f=fixture({demo:false,provider,timeout:5});f.add('가');const order=f.read().order;
    await assert.rejects(f.b.recommend(f.d.id,f.d.token,f.cmd(f.d,'recommend')),e=>e.status===503&&!e.message.includes('secret'));
    assert.deepEqual(f.read().order,order);assert.equal(f.read().recommendation,null);
  }
});
test('in-flight calculation cannot resurrect recommendation after cancellation',async()=>{
  let finish;const f=fixture({demo:false,provider:()=>new Promise(r=>{finish=r;})}),p=f.add('가');
  const task=f.b.recommend(f.d.id,f.d.token,f.cmd(f.d,'recommend'));await Promise.resolve();f.act('cancel',{participantId:p.id});finish({});await assert.rejects(task,e=>e.status===409);assert.equal(f.read().recommendation,null);
});
test('bounded participants, invalid points and expiry',()=>{
  const f=fixture();assert.throws(()=>f.b.create({origin:[-1,37]}),/지점/);assert.throws(()=>f.b.create({origin:[null,37]}),/좌표/);
  for(let i=0;i<6;i++)f.add('사람'+i);assert.throws(()=>f.add('일곱'),/6명/);f.tick(86400000);assert.throws(()=>f.read(),/만료/);
});
function matrix(nodes,value=10){return Object.fromEntries(nodes.map(a=>[a,Object.fromEntries(nodes.map(b=>[b,a===b?0:value]))]));}
test('directed costs and final destination change preferred order; stable ties and active lock',()=>{
  const m=matrix(['origin','a','b','destination']);m.origin.a=1;m.origin.b=2;m.a.b=1;m.b.a=1;
  assert.deepEqual(bestOrder(['a','b'],m).order,['a','b']);m.b.destination=100;m.a.destination=1;
  assert.deepEqual(bestOrder(['a','b'],m,{final:true}).order,['b','a']);
  assert.deepEqual(bestOrder(['a','b'],m,{final:true,active:'a'}).order,['a','b']);
  assert.deepEqual(bestOrder(['b','a'],matrix(['origin','a','b'])).order,['b','a']);
  delete m.a.b;assert.throws(()=>bestOrder(['a','b'],m),/ROUTE_MISSING/);
});
test('join, manual order, next, arrive, cancel, board all invalidate recommendations',async()=>{
  for(const kind of ['join','order','next','arrive','cancel','board']){
    const f=fixture(),p=f.add('가');f.add('나');let r;
    if(kind==='board'){r=f.join(p);f.act('next');f.act('arrive');}if(kind==='arrive')f.act('next');
    const rec=(await f.b.recommend(f.d.id,f.d.token,f.cmd(f.d,'recommend'))).recommendation;
    if(kind==='join')f.join(p);else if(kind==='order')f.act(kind,{order:f.read().order});else if(kind==='cancel')f.act(kind,{participantId:p.id});else f.act(kind,{},kind==='board'?r:f.d);
    assert.throws(()=>f.act('apply',{recommendationId:rec.id}),/만료/);
  }
});
test('arrival updates provider origin and recommendation excludes the travelled active leg',async()=>{
  let received;
  const f=fixture({demo:false,provider:input=>{
    received=input;
    const m=matrix(['origin',...input.order,'destination'],10);
    m.origin[input.order[0]]=500;
    return {mode:'real',source:'injected test fixture, not live traffic',observedAt:100000,expiresAt:110000,matrix:m};
  }});
  const p=f.add('가');f.add('나',p.stopId);f.add('다');f.act('next');f.act('arrive');
  const rec=(await f.b.recommend(f.d.id,f.d.token,f.cmd(f.d,'recommend'))).recommendation;
  assert.deepEqual(received.origin,[127.01,37.01]);assert.equal(rec.currentSeconds,10);assert.equal(rec.seconds,10);
  assert.equal(rec.order[0],p.stopId);
  const m=matrix(['origin','a','b','destination'],10);m.origin.a=500;
  assert.equal(bestOrder(['a','b'],m,{active:'a',arrived:true,final:true}).seconds,20);
  assert.equal(bestOrder(['a'],m,{active:'a',arrived:true}).seconds,0);
  assert.equal(bestOrder(['a','b'],m,{active:'a'}).seconds,510);
});
