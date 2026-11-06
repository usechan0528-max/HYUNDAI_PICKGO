import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from './server.mjs';
import { MultiBoard } from './multi/board.mjs';
test('multi HTTP: integrated static page, 3 rider workflow, guards and existing route coexist',async t=>{
  const server=createServer(undefined,{multiBoard:new MultiBoard({checkPoint:()=>({selectable:true})})});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const req=async(path,body,token,headers={})=>{
    const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:`Bearer ${token}`} :{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};
  };
  for(const path of ['/multi','/multi/page.css','/multi/page.mjs','/'])assert.equal((await fetch(base+path)).status,200);
  const created=await req('/api/trips',{origin:[127,37],demo:true});assert.equal(created.status,201);const d=created.body;
  const read=async who=>(await req(`/api/trips/${d.id}`,undefined,who.token)).body;
  const act=async(who,type,extra={})=>{const s=await read(who);return req(`/api/trips/${d.id}/actions`,{version:s.version,view:s.view,requestId:randomUUID(),type,...extra},who.token);};
  for(let i=0;i<3;i++)assert.equal((await act(d,'add',{name:`사람${i}`,label:`지점${i}`,point:[127+i/100,37]})).status,200);
  const initial=await read(d),riders=[];
  for(const inv of initial.invites){const joined=await req(`/api/trips/${d.id}/join`,{invite:inv.invite,joinId:randomUUID()});assert.equal(joined.status,200);riders.push(joined.body);}
  assert.equal((await act(riders[0],'next')).status,403);
  for(const rider of riders){assert.equal((await act(rider,'ready',{ready:true})).status,200);await act(d,'next');await act(d,'arrive');assert.equal((await act(rider,'board')).status,200);}
  assert.equal((await act(d,'end')).body.status,'completed');
  assert.equal((await req('/api/trips',{origin:[127,37]},null,{origin:'https://evil.example'})).status,403);
  assert.equal((await req(`/api/trips/${d.id}`)).status,401);
  assert.equal((await req('/api/rooms',{place:'하나로마트 양재점'})).status,201);
});
