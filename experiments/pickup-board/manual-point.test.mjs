import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { Board, PLACES } from './domain.mjs';
import { createServer } from './server.mjs';
test('synthetic point is copied, shared and cleared only when another place is accepted',()=>{
  const b=new Board(), point={mode:'synthetic-diagram',x:200,y:240};
  const d=b.create(PLACES[0],point),r=b.join(d.id,d.invite); point.x=0;
  const read=u=>b.read(u.id,u.token); const act=(u,type,extra={})=>b.act(u.id,u.token,{...read(u),type,requestId:randomUUID(),...extra});
  assert.equal(read(r).pickupPoint.x,200); const copy=read(r);copy.pickupPoint.x=999;assert.equal(read(d).pickupPoint.x,200);
  act(d,'propose',{place:PLACES[1]});assert.equal(read(r).pickupPoint.x,200);
  act(r,'accept',{proposalId:read(r).proposal.id});assert.equal(read(d).pickupPoint,null);
});
test('invalid or real-coordinate payloads cannot be treated as diagram selections',()=>{
  const b=new Board(); for(const p of [[],{},false,{mode:'real',x:0,y:0},{mode:'synthetic-diagram',x:-1,y:20},{mode:'synthetic-diagram',x:1001,y:20},{mode:'synthetic-diagram',x:20,y:601},{mode:'synthetic-diagram',x:1.5,y:20},{mode:'synthetic-diagram',x:10,y:20,latitude:37}])assert.throws(()=>b.create(PLACES[0],p),/시연 지점/);
});
test('default server persists the selected point through authenticated HTTP reads',async t=>{
  const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const root=`http://127.0.0.1:${server.address().port}`;
  const pickupPoint={mode:'synthetic-diagram',x:1000,y:600};
  const res=await fetch(root+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({place:PLACES[0],pickupPoint})});
  assert.equal(res.status,201);const d=await res.json();
  const state=await (await fetch(root+`/api/rooms/${d.id}`,{headers:{Authorization:`Bearer ${d.token}`}})).json();
  assert.deepEqual(state.pickupPoint,pickupPoint);
  const bad=await fetch(root+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({place:PLACES[0],pickupPoint:{...pickupPoint,y:601}})});assert.equal(bad.status,400);
});
