import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createServer } from './server.mjs';
import { PhoneBoard } from './phone-domain.mjs';
import { PLACES } from './domain.mjs';
import { Board } from './domain.mjs';

test('lost join response retries same capability only for five minutes, never after end',()=>{
  let now=1000;const b=new Board(()=>now);const d=b.create(PLACES[0]);const joinId=randomUUID();
  const r=b.join(d.id,d.invite,joinId);assert.deepEqual(b.join(d.id,d.invite,joinId),r);
  assert.throws(()=>b.join(d.id,d.invite,randomUUID()),/초대/);
  assert.throws(()=>b.join(d.id,d.invite),/초대/);
  assert.throws(()=>b.join(d.id,'wrong',joinId),/초대/);
  assert.equal(JSON.stringify(b.read(d.id,d.token)).includes(joinId),false);
  now+=300000;assert.throws(()=>b.join(d.id,d.invite,joinId),/초대/);assert.equal(b.rooms.get(d.id).joinReceipt,null);
  const d2=b.create(PLACES[0]);const key2=randomUUID();b.join(d2.id,d2.invite,key2);
  b.act(d2.id,d2.token,{...b.read(d2.id,d2.token),type:'end',requestId:randomUUID()});
  assert.throws(()=>b.join(d2.id,d2.invite,key2),/초대/);assert.equal(b.rooms.get(d2.id).joinReceipt,null);
});

test('default RecommendationBoard preserves real HTTP phone grant/publish/read API',async t=>{
  const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const root=`http://127.0.0.1:${server.address().port}`;
  const api=async(path,body,token)=>{const res=await fetch(root+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} :{})},...(body?{body:JSON.stringify(body)}:{})});assert.ok(res.ok,`HTTP ${res.status}`);return res.json();};
  const d=await api('/api/rooms',{place:PLACES[0]});const path=`/api/rooms/${d.id}`;
  const joinId=randomUUID();const r=await api(path+'/join',{invite:d.invite,joinId});assert.deepEqual(await api(path+'/join',{invite:d.invite,joinId}),r);
  const view=await api(path,null,r.token),consentId=randomUUID();
  await api(path+'/phone',{type:'grant',consentId,consent:'pickup-location-once-v1',version:view.version,view:view.view},r.token);
  await api(path+'/phone',{type:'publish',consentId,fix:{latitude:0,longitude:0,accuracy:10,observedAt:Date.now(),ageMs:0}},r.token);
  assert.equal((await api(path+'/phone',null,d.token)).sample.latitude,0);
  await api(path+'/phone',{type:'revoke',consentId},r.token);assert.equal((await api(path+'/phone',null,d.token)).sample,null);
});

test('explicit HTTPS proxy origin: independent rider joins and completes without location',async t=>{
  const origin='https://pickup.example';
  const server=createServer(new PhoneBoard(),{publicOrigin:origin});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const request=(path,body,token,headers={})=>new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port:server.address().port,path,method:body?'POST':'GET',headers:{Host:'pickup.example',...(body?{Origin:origin,'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...headers}},res=>{
      let raw='';res.setEncoding('utf8');res.on('data',c=>raw+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,raw,data:res.headers['content-type'].includes('application/json')?JSON.parse(raw):null}));
    });req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
  });
  const page=await request('/');assert.equal(page.status,200);assert.match(page.raw,/설치·가입 없이/);
  assert.equal(page.headers['referrer-policy'],'no-referrer');assert.equal(page.headers['cache-control'],'no-store');
  assert.equal((await request('/api/rooms',{place:PLACES[0]},null,{Origin:'https://attacker.example'})).status,403);
  assert.equal((await request('/',null,null,{Host:'attacker.example','X-Forwarded-Host':'pickup.example'})).status,403);
  const d=(await request('/api/rooms',{place:PLACES[0]})).data;
  const path=`/api/rooms/${d.id}`;
  const r=(await request(path+'/join',{invite:d.invite})).data;assert.equal(r.role,'rider');assert.notEqual(d.token,r.token);
  assert.equal((await request(path+'/join',{invite:d.invite})).status,403);
  assert.equal((await request(path)).status,401);
  const read=async u=>(await request(path,null,u.token)).data;
  const act=async(u,type,extra={})=>{const s=await read(u);const result=await request(path+'/actions',{type,version:s.version,view:s.view,requestId:randomUUID(),...extra},u.token);assert.equal(result.status,200);return result.data;};
  await act(r,'ready',{ready:true});assert.equal((await read(d)).ready,true);
  const proposed=await act(r,'propose',{place:PLACES[1]});await act(d,'accept',{proposalId:proposed.proposal.id});
  assert.equal((await read(r)).place,PLACES[1]);
  await act(d,'arrive');await act(r,'board');await act(r,'end');assert.equal((await read(d)).outcome,'completed');
  assert.equal((await request(path+'/phone',null,d.token)).data.sample,null);
});
