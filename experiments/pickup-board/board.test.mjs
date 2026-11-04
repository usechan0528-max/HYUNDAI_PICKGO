import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Board, PLACES, VIEW_TTL } from './domain.mjs';
import { createServer } from './server.mjs';
function setup() {
  let clock = 1000; const b = new Board(() => clock), d = b.create(PLACES[0]), r = b.join(d.id, d.invite);
  const read = (u = d) => b.read(u.id, u.token);
  const cmd = (u, type, extra = {}, snapshot = read(u)) => b.act(u.id, u.token, { ...snapshot, requestId: randomUUID(), type, ...extra });
  return { b, d, r, read, cmd, advance: ms => { clock += ms; } };
}
test('two participants share ready, pending, accepted and ended state', () => {
  const { d,r,read,cmd } = setup();
  cmd(r,'ready',{ready:true}); assert.equal(read(d).ready,true);
  cmd(d,'propose',{place:PLACES[1]}); assert.equal(read(r).place,PLACES[0]);
  cmd(r,'accept',{proposalId:read(r).proposal.id}); assert.equal(read(d).place,PLACES[1]);
  cmd(d,'end'); assert.equal(read(r).status,'ended');
  assert.throws(()=>cmd(r,'ready',{ready:false}),/종료/);
});
test('self acceptance and driver readiness are forbidden', () => {
  const {d,read,cmd}=setup(); cmd(d,'propose',{place:PLACES[1]});
  assert.throws(()=>cmd(d,'accept',{proposalId:read().proposal.id}),/자신/);
  assert.throws(()=>cmd(d,'ready',{ready:true}),/탑승자만/);
});
test('reject preserves the agreed place; old proposal cannot be accepted', () => {
  const {d,r,read,cmd}=setup(); cmd(r,'propose',{place:PLACES[1]}); const old=read().proposal.id;
  cmd(d,'reject',{proposalId:old}); assert.equal(read().place,PLACES[0]);
  cmd(r,'propose',{place:PLACES[2]}); assert.throws(()=>cmd(d,'accept',{proposalId:old}),/일치/);
});
test('one-use invitation, wrong and cross-room credentials rejected', () => {
  const {b,d}=setup(), other=b.create(PLACES[2]);
  assert.throws(()=>b.join(d.id,d.invite),/초대/);
  assert.throws(()=>b.read(d.id,other.token),/참여자/);
  assert.throws(()=>b.read(d.id,null),/권한/);
  assert.throws(()=>b.read(d.id,''),/권한/);
  assert.throws(()=>b.join(other.id,'bad'),/초대/);
});
test('stale concurrent writes, repeated request IDs and replaced proposals rejected', () => {
  const {b,d,r,read,cmd}=setup(), snapshot=read(d);
  cmd(r,'ready',{ready:true}); assert.throws(()=>cmd(d,'propose',{place:PLACES[1]},snapshot),/다른 변경/);
  const command={...read(d),requestId:randomUUID(),type:'propose',place:PLACES[1]}; b.act(d.id,d.token,command);
  assert.throws(()=>b.act(d.id,d.token,command),/이미 처리/);
  assert.throws(()=>cmd(r,'propose',{place:PLACES[2]}),/기존 제안/);
});
test('server-issued read lease expires at boundary and cannot be fabricated', () => {
  const {d,read,cmd,advance}=setup(), s=read(d); advance(VIEW_TTL);
  assert.throws(()=>cmd(d,'end',{},s),/오래/);
  assert.throws(()=>cmd(d,'end',{}, {...read(d),view:'forged'}),/오래/);
  cmd(d,'end');
});
test('end before join revokes invite and pending proposal is cleared on end', () => {
  const b=new Board(), d=b.create(PLACES[0]), s=b.read(d.id,d.token);
  b.act(d.id,d.token,{...s,type:'end',requestId:randomUUID()});
  assert.throws(()=>b.join(d.id,d.invite),/초대/);
  const x=setup(); x.cmd(x.d,'propose',{place:PLACES[1]}); x.cmd(x.r,'end'); assert.equal(x.read().proposal,null);
});
test('malformed and unsupported commands do not change state', () => {
  const {b,d,cmd,read}=setup(), v=read().version;
  assert.throws(()=>b.create('real address'),/목록/);
  assert.throws(()=>cmd(d,'propose',{place:'invalid'}),/다른 지점/);
  assert.throws(()=>cmd(d,'unknown'),/알 수/);
  assert.equal(read().version,v);
});
test('memory lifetime and restart are explicit disappearance, not phantom success', () => {
  const {b,d,advance}=setup(); advance(86400001); assert.throws(()=>b.read(d.id,d.token),/만료/);
  assert.throws(()=>new Board().read(d.id,d.token),/없거나/);
});
test('withdraw belongs to proposer; foreign read leases and cross-room writes fail', () => {
  const {b,d,r,read,cmd}=setup(); cmd(d,'propose',{place:PLACES[1]}); const proposalId=read().proposal.id;
  assert.throws(()=>cmd(r,'withdraw',{proposalId}),/제안한/);
  assert.throws(()=>cmd(d,'reject',{proposalId}),/자신/);
  assert.throws(()=>cmd(r,'accept',{proposalId},{...read(r),view:read(d).view}),/오래/);
  const other=b.create(PLACES[2]); assert.throws(()=>b.act(d.id,other.token,{...read(d),type:'end',requestId:randomUUID()}),/참여자/);
  cmd(d,'withdraw',{proposalId}); assert.equal(read().place,PLACES[0]); assert.equal(read().proposal,null);
  cmd(r,'propose',{place:PLACES[2]}); cmd(d,'accept',{proposalId:read().proposal.id});
  assert.equal(read().lastEvent,'변경이 수락되어 승차지점을 변경했습니다.');
});
test('HTTP integration: create/join/read/write, isolation, input and origin defenses', async t => {
  const server=createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>server.close(r))); const root=`http://127.0.0.1:${server.address().port}`;
  const post=async(path,body,token)=>fetch(root+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  const created=await post('/api/rooms',{place:PLACES[0]}); assert.equal(created.status,201); const d=await created.json();
  const joined=await post(`/api/rooms/${d.id}/join`,{invite:d.invite}); const r=await joined.json();
  const get=()=>fetch(`${root}/api/rooms/${d.id}`,{headers:{Authorization:`Bearer ${r.token}`}});
  const view=await (await get()).json();
  assert.equal((await post(`/api/rooms/${d.id}/actions`,{...view,type:'ready',ready:true,requestId:randomUUID()},r.token)).status,200);
  assert.equal((await (await get()).json()).ready,true);
  assert.equal((await fetch(`${root}/api/rooms/${d.id}`)).status,401);
  assert.equal((await fetch(root,{headers:{Origin:'https://example.com'}})).status,403);
  assert.equal((await post('/api/rooms',null)).status,400);
  assert.equal((await fetch(root+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
  assert.equal((await post('/api/rooms',{place:'x'.repeat(5000)})).status,413);
  assert.equal((await fetch(root+'/domain.mjs')).status,404);
  const page=await fetch(root); assert.equal(page.status,200); assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal(page.headers.get('cache-control'),'no-store');
});

test('manual arrival and boarding require owner, order and explicit end',()=>{
 const {d,r,cmd,read}=setup();
 assert.throws(()=>cmd(r,'arrive'),/운전자만/); assert.throws(()=>cmd(r,'board'),/먼저/);
 cmd(r,'ready',{ready:true}); assert.equal(read().stage,'waiting');
 cmd(r,'ready',{ready:false}); cmd(d,'arrive'); assert.equal(read(r).stage,'arrived');
 assert.throws(()=>cmd(d,'board'),/탑승자만/); assert.throws(()=>cmd(d,'arrive'),/한 번/);
 cmd(r,'board'); assert.equal(read(d).stage,'boarded'); assert.equal(read().status,'active');
 assert.equal(read().ready,false); assert.equal(read().outcome,null);
 assert.throws(()=>cmd(r,'board'),/먼저/);
 for(const u of [d,r]) assert.throws(()=>cmd(u,'propose',{place:PLACES[1]}),/탑승 확인 후/);
 assert.throws(()=>cmd(r,'ready',{ready:true}),/탑승 확인 후/);
 cmd(d,'end'); assert.equal(read(r).outcome,'completed');
 for(const type of ['arrive','board','undoArrival','undoBoarding','end']) assert.throws(()=>cmd(r,type),/종료/);
});
test('role-owned mistake undo and cancellation preserve truthful outcome',()=>{
 const {d,r,cmd,read}=setup();
 assert.throws(()=>cmd(d,'undoArrival'),/탑승 확인 전/);
 cmd(d,'arrive'); assert.throws(()=>cmd(r,'undoArrival'),/운전자만/);
 cmd(d,'undoArrival'); assert.equal(read().stage,'waiting');
 cmd(d,'arrive'); cmd(r,'board'); assert.throws(()=>cmd(d,'undoArrival'),/탑승 확인 전/);
 assert.throws(()=>cmd(d,'undoBoarding'),/탑승자만/);
 cmd(r,'undoBoarding'); assert.equal(read().stage,'arrived');
 cmd(r,'end'); assert.equal(read().outcome,'cancelled');
});
test('proposal resolution invalidates arrival only on accepted changed place',()=>{
 const {d,r,cmd,read}=setup(); cmd(d,'arrive');
 for(const resolution of ['reject','withdraw','accept']) {
  cmd(d,'propose',{place:PLACES[1]}); const proposalId=read().proposal.id;
  assert.throws(()=>cmd(r,'board'),/합의/);
  cmd(resolution==='withdraw'?d:r,resolution,{proposalId});
  assert.equal(read().stage,resolution==='accept'?'waiting':'arrived');
 }
 assert.equal(read().place,PLACES[1]); assert.match(read().lastEvent,/도착 표시는 취소/);
 assert.throws(()=>cmd(r,'board'),/먼저/); cmd(d,'arrive'); cmd(r,'board');
});
test('arrival needs join and resolved proposals; end clears pending and cancels',()=>{
 const b=new Board(), d=b.create(PLACES[0]);
 const action=(type)=>b.act(d.id,d.token,{...b.read(d.id,d.token),type,requestId:randomUUID()});
 assert.throws(()=>action('arrive'),/상대 참여/); action('end'); assert.equal(b.read(d.id,d.token).outcome,'cancelled');
 const x=setup(); x.cmd(x.r,'propose',{place:PLACES[1]}); assert.throws(()=>x.cmd(x.d,'arrive'),/장소 합의/);
 x.cmd(x.d,'end'); assert.equal(x.read().proposal,null); assert.equal(x.read().outcome,'cancelled');
});
test('stage commands reject duplicate, stale version, foreign and expired leases',()=>{
 const {b,d,r,cmd,read,advance}=setup(); const first={...read(d),type:'arrive',requestId:randomUUID()};
 b.act(d.id,d.token,first); assert.throws(()=>b.act(d.id,d.token,first),/이미 처리/);
 const riderView=read(r); cmd(d,'undoArrival'); assert.throws(()=>cmd(r,'board',{},riderView),/다른 변경/);
 const expired=read(d); advance(VIEW_TTL); assert.throws(()=>cmd(d,'arrive',{},expired),/오래/);
 assert.throws(()=>cmd(d,'arrive',{}, {...read(d),view:read(r).view}),/오래/);
 cmd(d,'arrive'); const undoView=read(d); cmd(r,'board'); assert.throws(()=>cmd(d,'undoArrival',{},undoView),/다른 변경/);
 const endView=read(d); cmd(r,'undoBoarding'); assert.throws(()=>cmd(d,'end',{},endView),/다른 변경/);
 assert.equal(read().status,'active'); assert.equal(read().stage,'arrived');
});

 test('boarding preserves true readiness without deriving it; end names the actor',()=>{
 const {r,d,cmd,read}=setup(); cmd(r,'ready',{ready:true}); cmd(d,'arrive'); cmd(r,'board');
 assert.equal(read().ready,true); cmd(r,'end'); assert.match(read().lastEvent,/탑승자가/);
 });

test('HTTP manual lifecycle shares stage/outcome and rejects a stale end after undo',async t=>{
 const server=createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>server.close(r))); const root=`http://127.0.0.1:${server.address().port}`;
 const post=async(path,body,token)=>fetch(root+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
 const d=await(await post('/api/rooms',{place:PLACES[0]})).json();
 const r=await(await post(`/api/rooms/${d.id}/join`,{invite:d.invite})).json();
 const read=async u=>(await fetch(`${root}/api/rooms/${u.id}`,{headers:{Authorization:`Bearer ${u.token}`}})).json();
 const act=async(u,type,snapshot)=>post(`/api/rooms/${u.id}/actions`,{...(snapshot || await read(u)),type,requestId:randomUUID()},u.token);
 assert.equal((await act(r,'arrive')).status,403);
 assert.equal((await act(d,'arrive')).status,200); assert.equal((await read(r)).stage,'arrived');
 assert.equal((await act(r,'board')).status,200); const completedView=await read(d);
 assert.equal(completedView.stage,'boarded'); assert.equal(completedView.status,'active');
 assert.equal((await act(r,'undoBoarding')).status,200);
 assert.equal((await act(d,'end',completedView)).status,409); assert.equal((await read(d)).status,'active');
 assert.equal((await act(d,'end')).status,200); assert.equal((await read(r)).outcome,'cancelled');
 assert.equal((await act(r,'board')).status,409);
});
