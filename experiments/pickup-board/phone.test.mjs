import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PhoneBoard } from './phone-domain.mjs';
import { PhoneShare } from './phone-controller.mjs';
import { PLACES } from './domain.mjs';
import { createServer } from './server.mjs';
function setup() {
 let wall=100000, mono=1000;
 const board=new PhoneBoard(()=>wall,()=>mono), driver=board.create(PLACES[0]), rider=board.join(driver.id,driver.invite);
 const read=()=>board.read(driver.id,rider.token);
 const send=(body,token=rider.token,id=driver.id)=>board.phone(id,token,body);
 const grant=()=>{const consentId=randomUUID();send({type:'grant',consentId,consent:'pickup-location-once-v1',...read()});return consentId;};
 const fix=()=>({latitude:35,longitude:128,accuracy:20,observedAt:wall,ageMs:0});
 const act=(who,type)=>board.act(driver.id,who.token,{...board.read(driver.id,who.token),type,requestId:randomUUID()});
 return {board,driver,rider,send,read,grant,fix,act,advance:n=>{wall+=n;mono+=n;},rewind:()=>{mono--;},location:()=>board.phone(driver.id,driver.token)};
}
test('phone requires explicit consent, correct rider and same room; no location in ordinary read',()=>{
 const h=setup(); assert.equal(h.location().sample,null);
 assert.throws(()=>h.send({type:'publish',consentId:randomUUID(),fix:h.fix()}));
 assert.throws(()=>h.send({type:'grant',consentId:randomUUID(),...h.read()},h.driver.token));
 assert.throws(()=>h.send({type:'grant',consentId:randomUUID(),...h.read()}));
 const other=h.board.create(PLACES[0]); assert.throws(()=>h.board.phone(other.id,h.rider.token));
 const id=h.grant();h.send({type:'publish',consentId:id,fix:h.fix()});assert.equal(h.location().sample.source,'rider-phone');
 assert.equal(h.read().sample,undefined);assert.equal(h.board.room(h.driver.id).phone,undefined);
 assert.throws(()=>h.send({type:'publish',consentId:id,fix:h.fix()}));
});
test('revoke-before-grant tombstone, stale revoke, late publish and consumed replay cannot resurrect',()=>{
 const h=setup(), id=randomUUID(), view=h.read();h.send({type:'revoke',consentId:id});
 assert.throws(()=>h.send({type:'grant',consentId:id,consent:'pickup-location-once-v1',...view}));
 const live=h.grant();h.send({type:'publish',consentId:live,fix:h.fix()});h.advance(9000);
 h.send({type:'revoke',consentId:live});assert.equal(h.location().sample,null);
 assert.throws(()=>h.send({type:'publish',consentId:live,fix:h.fix()}));
 assert.throws(()=>h.send({type:'grant',consentId:live,consent:'pickup-location-once-v1',...h.read()}));
});
test('read and sweep enforce grant20s/sample30s boundaries and monotonic rollback',()=>{
 const h=setup(),id=h.grant();h.advance(20000);assert.throws(()=>h.send({type:'publish',consentId:id,fix:h.fix()}));
 const next=h.grant();h.send({type:'publish',consentId:next,fix:h.fix()});h.advance(29999);assert.ok(h.location().sample);
 h.advance(1);assert.equal(h.location().sample,null);assert.equal(h.board.locations.get(h.driver.id).sample,null);
 const third=h.grant();h.send({type:'publish',consentId:third,fix:h.fix()});h.rewind();assert.equal(h.location().sample,null);
});
test('invalid accuracy/ranges/types/old/future fixes rejected without version changes',()=>{
 const h=setup(),id=h.grant(),version=h.read().version;
 for(const extra of [{latitude:91},{longitude:-181},{accuracy:0},{accuracy:101},{latitude:'35'},{accuracy:NaN},{ageMs:15000},{ageMs:-1},{ageMs:'0'}]) {
 assert.throws(()=>h.send({type:'publish',consentId:id,fix:{...h.fix(),...extra}}));assert.equal(h.location().sample,null);
 }
 assert.equal(h.read().version,version);h.send({type:'publish',consentId:id,fix:h.fix()});assert.equal(h.read().version,version);
});
test('boarding/end synchronously erase and undo does not restore; new consent supersedes prior',()=>{
 const h=setup(),old=h.grant(),current=h.grant();assert.throws(()=>h.send({type:'publish',consentId:old,fix:h.fix()}));
 h.send({type:'publish',consentId:current,fix:h.fix()});h.act(h.driver,'arrive');h.act(h.rider,'board');
 assert.equal(h.board.locations.get(h.driver.id).sample,null);assert.throws(()=>h.grant());
 h.act(h.rider,'undoBoarding');assert.equal(h.location().sample,null);
 const id=h.grant();h.send({type:'publish',consentId:id,fix:h.fix()});h.act(h.driver,'end');assert.equal(h.location().sample,null);assert.throws(()=>h.grant());
 h.send({type:'revoke',consentId:id});
});
test('grant requires fresh actual view and bounded IDs; room prune deletes raw coordinate memory',()=>{
 const h=setup(),old=h.read();h.advance(8000);assert.throws(()=>h.send({type:'grant',consentId:randomUUID(),consent:'pickup-location-once-v1',...old}));
 const id=h.grant();h.send({type:'publish',consentId:id,fix:h.fix()});
 h.advance(86400001);h.board.prune();h.board.sweep();assert.equal(h.board.locations.size,0);
 const q=setup();for(let n=0;n<100;n++)q.send({type:'revoke',consentId:randomUUID()});assert.throws(()=>q.grant());
});
function client() {
 let ok=true,wall=100000,mono=1000,success,error,watches=0,cleared=0;
 const sends=[],messages=[],timers=new Set();let send=async body=>{sends.push(body);return {};};
 const share=new PhoneShare({geo:{watchPosition(s,e){success=s;error=e;watches++;return 17;},clearWatch(){cleared++;}},send:(...args)=>send(...args),allowed:()=>ok,notify:m=>messages.push(m),wall:()=>wall,mono:()=>mono,id:randomUUID,schedule:fn=>{timers.add(fn);return fn;},cancel:fn=>timers.delete(fn)});
 return {share,sends,messages,timers,get watches(){return watches;},get cleared(){return cleared;},setSend:fn=>{send=fn;},deny:()=>{ok=false;},advance:n=>{wall+=n;mono+=n;},success:()=>success({coords:{latitude:35,longitude:128,accuracy:20},timestamp:wall}),bad:()=>success({coords:{latitude:35,longitude:128,accuracy:101},timestamp:wall}),error:code=>error({code})};
}
test('client never collects before explicit start and server grant; stop ignores late callbacks',async()=>{
 const h=client();assert.equal(h.watches,0);await h.share.start({version:2,view:'fake'});assert.equal(h.watches,1);
 await h.share.stop();await h.success();assert.equal(h.sends.filter(x=>x.type==='publish').length,0);assert.equal(h.cleared,1);
});
test('pending grant stop sends revoke and late grant cannot start watch',async()=>{
 const h=client();let resolve;h.setSend(body=>{h.sends.push(body);return body.type==='grant'?new Promise(r=>resolve=r):Promise.resolve({});});
 const pending=h.share.start({});await h.share.stop();resolve({});await pending;assert.equal(h.watches,0);assert.equal(h.sends.at(-1).type,'revoke');
});
test('one shot clears watch, ignores duplicate callback and stop deletes published fix',async()=>{
 const h=client();await h.share.start({});await h.success();await h.success();assert.equal(h.cleared,1);assert.equal(h.sends.filter(x=>x.type==='publish').length,1);
 assert.equal(h.share.phase,'shared');await h.share.stop();assert.equal(h.sends.at(-1).type,'revoke');
});
test('denied/offline/inaccurate/timeout and failed delete are explicit; no automatic restart',async()=>{
 for(const mode of ['permission','offline','accuracy','timeout']) {
 const h=client();await h.share.start({});
 if(mode==='permission')await h.error(1);if(mode==='offline'){h.deny();await h.share.stop();}if(mode==='accuracy')await h.bad();if(mode==='timeout'){for(const fn of [...h.timers])fn();await new Promise(setImmediate);}
 assert.equal(h.share.current,null);assert.equal(h.cleared,1);assert.equal(h.sends.filter(x=>x.type==='publish').length,0);
 }
 const h=client();await h.share.start({});h.setSend(async()=>{throw Error('offline');});await h.share.stop();assert.match(h.messages.at(-1),/삭제 미확인/);
});
test('HTTP real transport authenticates phone endpoint and enforces delete and no-store',async()=>{
 const h=setup(),server=createServer(h.board);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
 const origin=`http://127.0.0.1:${server.address().port}`,path=`${origin}/api/rooms/${h.driver.id}/phone`;
 const request=(body,token=h.rider.token)=>fetch(path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const consentId=randomUUID();let response=await request({type:'grant',consentId,consent:'pickup-location-once-v1',...h.read()});assert.equal(response.status,200);
 response=await request({type:'publish',consentId,fix:h.fix()});assert.equal(response.status,200);
 response=await request(null,h.driver.token);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok((await response.json()).sample);
 assert.equal((await request(null,'wrong')).status,403);await request({type:'revoke',consentId});assert.equal((await(await request(null,h.driver.token)).json()).sample,null);
 for(const path of ['/phone','/phone-page.mjs','/phone-controller.mjs','/phone.css'])assert.equal((await fetch(origin+path)).status,200);
 }finally{await new Promise(r=>server.close(r));}
});

test('device epoch skew is metadata and does not defeat bounded same-clock age/TTL',()=>{
 const h=setup(),id=h.grant();h.send({type:'publish',consentId:id,fix:{...h.fix(),observedAt:900000000,ageMs:100}});
 assert.equal(h.location().sample.ageMs,100);h.advance(1000);assert.equal(h.location().sample.ageMs,1100);assert.equal(h.location().sample.remainingMs,29000);
});

test('HTTP phone rejects driver grant, late publish, bad origin and malformed bodies',async()=>{
 const h=setup(),server=createServer(h.board);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {const origin=`http://127.0.0.1:${server.address().port}`,path=`${origin}/api/rooms/${h.driver.id}/phone`;
 const headers={Authorization:`Bearer ${h.rider.token}`,'Content-Type':'application/json'};
 const body={type:'grant',consentId:randomUUID(),consent:'pickup-location-once-v1',...h.read()};
 assert.equal((await fetch(path,{method:'POST',headers:{...headers,Authorization:`Bearer ${h.driver.token}`},body:JSON.stringify(body)})).status,403);
 assert.equal((await fetch(path,{method:'POST',headers:{...headers,Origin:'https://invalid.example'},body:JSON.stringify(body)})).status,403);
 assert.equal((await fetch(path,{method:'POST',headers,body:'{'})).status,400);
 assert.equal((await fetch(path,{method:'POST',headers,body:'x'.repeat(4097)})).status,413);
 assert.equal((await fetch(path,{method:'POST',headers:{...headers,'Content-Type':'text/plain'},body:'{}'})).status,415);
 const consentId=h.grant();h.send({type:'revoke',consentId});assert.equal((await fetch(path,{method:'POST',headers,body:JSON.stringify({type:'publish',consentId,fix:h.fix()})})).status,409);
 h.act(h.driver,'end');const result=await fetch(path,{headers});assert.equal(result.status,200);assert.equal((await result.json()).sample,null);
 }finally{await new Promise(r=>server.close(r));}
});

test('grant cap and stale state errors do not invite blind retries and never collect',async()=>{
 for(const status of [429,409]){const h=client();h.setSend(async body=>{if(body.type==='grant')throw Object.assign(Error('rejected'),{status});return {};});await h.share.start({});assert.equal(h.watches,0);assert.match(h.messages.at(-1),status===429?/한도/:/상태가 바뀌/);}
});
