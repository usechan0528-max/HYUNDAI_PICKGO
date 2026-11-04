import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRoutoSearch } from './routo/search-provider.mjs';
import { createSelectionController } from './routo/selection-controller.mjs';
import { createRoutoMap, loadRoutoSdk } from './routo/map-adapter.mjs';
import { createPreparationServer } from './routo/server.mjs';
import { normalizeResults } from './routo/contracts.mjs';
import { connectRoutoPicker } from './routo/connect.mjs';
// Synthetic coordinates/places, not downloaded provider data or a live key.
const payload = {status:'success',total:1,result:[{poiId:1,title:'시험 장소',addrRoad:'시험 주소',center:{lat:37,lon:127},guide:{lat:37.01,lon:127.01},walkingGuide:[{lat:37.02,lon:127.02}]}]};
const result=()=>normalizeResults(payload);
const response=()=>new Response(JSON.stringify(payload));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('missing key and pending terms never perform external fetch',async()=>{
 let calls=0;const fetchImpl=()=>{calls++;};
 for(const options of [{},{apiKey:'fake-only'}]){
  const p=createRoutoSearch({...options,fetchImpl});assert.equal(p.status().ready,false);await assert.rejects(p.search({query:'장소'}));
 }
 assert.equal(calls,0);
});
test('REST request encodes query and uses lat,lon; normalized coordinates stay distinct',async()=>{
 let request;const p=createRoutoSearch({apiKey:'fake-only',usageApproved:true,fetchImpl:async(u,o)=>{request={u,o};return response();}});
 const rows=await p.search({query:'서울 & 역',near:{latitude:37,longitude:127}});
 assert.equal(request.u.origin,'https://api.routo.com');assert.equal(request.u.searchParams.get('input'),'서울 & 역');assert.equal(request.u.searchParams.get('location'),'37,127');assert.equal(request.o.redirect,'error');
 assert.deepEqual(rows[0].center,{latitude:37,longitude:127});assert.deepEqual(rows[0].guide,{latitude:37.01,longitude:127.01});assert.equal(rows[0].eligibility,'unchecked');
 assert.equal(JSON.stringify(rows).includes('fake-only'),false);assert.equal(JSON.stringify(p.status()).includes('fake-only'),false);
});
test('quota/auth/malformed replies are sanitized; zero results is valid',async()=>{
 for(const [status,code] of [[401,'KEY_REJECTED'],[403,'KEY_REJECTED'],[429,'QUOTA'],[500,'UPSTREAM']]){
  const p=createRoutoSearch({apiKey:'fake-only',usageApproved:true,fetchImpl:async()=>new Response('sensitive upstream text',{status})});
  await assert.rejects(p.search({query:'test'}),e=>e.code===code&&!e.message.includes('sensitive'));
 }
 assert.deepEqual(normalizeResults({status:'success',total:0}),[]);
 assert.throws(()=>normalizeResults({...payload,result:[{title:'bad',center:{lat:127,lon:37}}]}));
 assert.throws(()=>normalizeResults({status:'fail',total:0}));
});
test('cancel, timeout and invalid inputs fail without leaking URL/key',async()=>{
 const fetchImpl=(_u,{signal})=>new Promise((_,reject)=>{signal.addEventListener('abort',()=>reject(Error('fake-only secret URL')),{once:true});});
 const p=createRoutoSearch({apiKey:'fake-only',usageApproved:true,fetchImpl,timeoutMs:10});
 const keepAlive=setTimeout(()=>{},100);try {await assert.rejects(p.search({query:'test'}),e=>e.code==='TIMEOUT'&&!e.message.includes('fake-only'));}finally{clearTimeout(keepAlive);}
 const a=new AbortController();a.abort();await assert.rejects(p.search({query:'test',signal:a.signal}),e=>e.code==='CANCELLED');
 await assert.rejects(p.search({query:' '}),e=>e.code==='INVALID_QUERY');
 await assert.rejects(p.search({query:'test',near:{latitude:127,longitude:37}}),e=>e.code==='INVALID_COORDINATE');
});
test('latest search wins even if provider ignores abort; empty and errors clear previous point',async()=>{
 const first=deferred(),second=deferred();let n=0;
 const c=createSelectionController({search:()=>++n===1?first.promise:second.promise,checkPoint:async()=>({selectable:true,validForMs:5000})});
 const a=c.search('old'),b=c.search('new');second.resolve(result());await b;first.resolve([]);await a;
 assert.equal(c.snapshot().results.length,1);c.selectResult('result-0');await c.choose({latitude:37,longitude:127});assert.equal(c.snapshot().phase,'review');
 c.cancel();assert.equal(c.snapshot().selection,null);assert.throws(()=>c.confirm());
});
test('moving, expiry, blocked check, late validation and disposal prevent stale confirmation',async()=>{
 let time=0;const first=deferred();let n=0;
 const c=createSelectionController({search:async()=>result(),checkPoint:()=>++n===1?first.promise:Promise.resolve({selectable:false}),now:()=>time});
 await c.search('test');c.selectResult('result-0');assert.throws(()=>c.confirm());
 const a=c.choose({latitude:37,longitude:127});await c.choose({latitude:38,longitude:128});first.resolve({selectable:true,validForMs:5000});await a;
 assert.equal(c.snapshot().phase,'blocked');assert.throws(()=>c.confirm());c.dispose();assert.throws(()=>c.confirm());
 const d=createSelectionController({search:async()=>result(),checkPoint:async()=>({selectable:true,validForMs:100}),now:()=>time});
 await d.search('test');d.selectResult('result-0');await d.choose({latitude:37,longitude:127});time=100;assert.throws(()=>d.confirm());
});
test('confirmation preserves routo provenance after moving pin and cannot be repeated',async()=>{
 const c=createSelectionController({search:async()=>result(),checkPoint:async()=>({selectable:true,validForMs:1000})});
 await c.search('test');c.selectResult('result-0');await c.choose({latitude:37.1,longitude:127.1});
 const draft=c.confirm();assert.deepEqual(draft.point,[127.1,37.1]);assert.equal(draft.provenance.derivedFromSearch,true);assert.equal(draft.provenance.searchProvider,'routo');assert.throws(()=>c.confirm());
});
function sdkFake(){
 const objects={};class Map{constructor(){objects.map=this;} addListener(_name,cb){this.click=cb;return {remove:()=>this.removed=true};}setCenter(v){this.center=v;}}
 class Marker{constructor(o){objects.marker=this;this.position=o.position;}setPosition(p){this.position=p;}setMap(m){this.map=m;}}
 class LatLng{constructor(p){this.p=p;}lat(){return this.p.lat;}lng(){return this.p.lng;}}
 return {sdk:{maps:{Map,Marker,LatLng}},objects};
}
test('map adapter uses named coordinates, clears previous pins and unregisters listeners',()=>{
 const {sdk,objects}=sdkFake();let selected;const a=createRoutoMap({sdk,elementId:'map',center:{latitude:37,longitude:127},onPick:p=>selected=p});
 objects.map.click({latLng:new sdk.maps.LatLng({lat:38,lng:128})});assert.deepEqual(selected,{latitude:38,longitude:128});
 a.showAnchor({latitude:36,longitude:126});assert.equal(objects.marker.map,null);assert.equal(objects.map.center.lat(),36);
 a.dispose();assert.equal(objects.map.removed,true);
});
test('browser SDK loader refuses unconfigured key and cancels without loading',async()=>{
 let appended=0;const a=new AbortController();a.abort();
 await assert.rejects(loadRoutoSdk({documentRef:{},windowRef:{}}),e=>e.code==='MAP_NOT_CONFIGURED');
 await assert.rejects(loadRoutoSdk({browserKey:'fake-browser',usageApproved:true,signal:a.signal,documentRef:{head:{append(){appended++;}}},windowRef:{}}),e=>e.code==='CANCELLED');assert.equal(appended,0);
});
test('composed picker connects REST search, result pan, map click, validation and confirmation',async()=>{
 const {sdk,objects}=sdkFake();const p=await connectRoutoPicker({elementId:'map',center:{latitude:37,longitude:127},loadSdk:async()=>sdk,
  fetchImpl:async()=>new Response(JSON.stringify({results:result()})),checkPoint:async()=>({selectable:true,validForMs:1000})});
 await p.search('test');p.selectResult('result-0');objects.map.click({latLng:new sdk.maps.LatLng({lat:37.2,lng:127.2})});await new Promise(setImmediate);
 assert.deepEqual(p.confirm().point,[127.2,37.2]);p.dispose();assert.equal(objects.map.removed,true);
});
test('preparation HTTP server exposes status without credentials, rejects foreign origin, serves normalized search',async t=>{
 const server=createPreparationServer({apiKey:'fake-only',usageApproved:true,fetchImpl:async()=>response()});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));const root=`http://127.0.0.1:${server.address().port}`;
 const status=await (await fetch(root+'/api/routo/status')).text();assert.equal(status.includes('fake-only'),false);
 const res=await fetch(root+'/api/routo/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'test'})});assert.equal(res.status,200);assert.equal((await res.json()).results[0].provider,'routo');
 assert.equal((await fetch(root+'/api/routo/status',{headers:{Origin:'https://foreign.example'}})).status,403);
});

test('oversized upstream response cancels the stream instead of retaining it',async()=>{
 let cancelled=false;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(512001));},cancel(){cancelled=true;}});
 const p=createRoutoSearch({apiKey:'fake-only',usageApproved:true,fetchImpl:async()=>new Response(body)});
 await assert.rejects(p.search({query:'test'}),e=>e.code==='INVALID_RESPONSE');assert.equal(cancelled,true);
});
test('SDK loader handles success, transport failure and cancellation with cleanup',async()=>{
 for(const mode of ['success','error','cancel']){
  const a=new AbortController(),script={remove(){this.removed=true;}};let appended;
  const windowRef=mode==='success'?{routo:{maps:{Map:class{},Marker:class{},LatLng:class{}}}}:{};
  const loading=loadRoutoSdk({browserKey:'fake-browser',usageApproved:true,signal:a.signal,windowRef,documentRef:{createElement:()=>script,head:{append(s){appended=s;}}}});
  assert.equal(new URL(appended.src).origin,'https://api.routo.com');
  if(mode==='success'){script.onload();assert.equal(await loading,windowRef.routo);}
  else if(mode==='error'){script.onerror();await assert.rejects(loading,e=>e.code==='SDK_LOAD_FAILED');assert.equal(script.removed,true);}
  else{a.abort();await assert.rejects(loading,e=>e.code==='CANCELLED');assert.equal(script.removed,true);}
  assert.equal(script.onload,null);assert.equal(script.onerror,null);
 }
});
test('malformed map event invalidates an earlier confirmable selection',async()=>{
 const {sdk,objects}=sdkFake();let err;
 const p=await connectRoutoPicker({elementId:'map',center:{latitude:37,longitude:127},loadSdk:async()=>sdk,onMapError:e=>err=e,
  fetchImpl:async()=>new Response(JSON.stringify({results:result()})),checkPoint:async()=>({selectable:true,validForMs:1000})});
 await p.search('test');p.selectResult('result-0');objects.map.click({latLng:new sdk.maps.LatLng({lat:37,lng:127})});await new Promise(setImmediate);
 objects.map.click({latLng:null});assert.equal(err.code,'MAP_EVENT_INVALID');assert.throws(()=>p.confirm());p.dispose();
});
test('slow validation expires from request start, and missing validity cannot authorize a pin',async()=>{
 let time=0;const pending=deferred();
 const c=createSelectionController({search:async()=>result(),checkPoint:()=>pending.promise,now:()=>time});
 await c.search('test');c.selectResult('result-0');const choosing=c.choose({latitude:37,longitude:127});time=6000;pending.resolve({selectable:true,validForMs:60000});await choosing;assert.equal(c.snapshot().phase,'expired');assert.throws(()=>c.confirm());
 const d=createSelectionController({search:async()=>result(),checkPoint:async()=>({selectable:true})});await d.search('test');d.selectResult('result-0');await d.choose({latitude:37,longitude:127});assert.equal(d.snapshot().phase,'blocked');
});

test('observer failure cannot consume the confirmed draft, and expiry emits without a click',async()=>{
 let time=0,scheduled,errors=0;
 const c=createSelectionController({search:async()=>result(),checkPoint:async()=>({selectable:true,validForMs:100}),now:()=>time,
  onChange(){throw Error('render failure');},onObserverError(){errors++;},schedule:fn=>{scheduled=fn;},unschedule(){}});
 await c.search('test');c.selectResult('result-0');await c.choose({latitude:37,longitude:127});
 const draft=c.confirm();assert.equal(draft.validation.requiresServerRevalidation,true);assert.deepEqual(draft.provenance.anchorCenter,{latitude:37,longitude:127});assert.ok(errors>0);
 await c.choose({latitude:37.1,longitude:127.1});time=100;scheduled();assert.equal(c.snapshot().phase,'expired');assert.throws(()=>c.confirm());
});
test('loader reuses the same page SDK and refuses silently switching keys',async()=>{
 let appended=0;const {sdk}=sdkFake(),windowRef={routo:sdk},script={remove(){}};
 const options={browserKey:'fake-browser',usageApproved:true,windowRef,documentRef:{createElement:()=>script,head:{append(){appended++;}}}};
 const a=loadRoutoSdk(options),b=loadRoutoSdk(options);script.onload();assert.equal(await a,sdk);assert.equal(await b,sdk);assert.equal(appended,1);
 await assert.rejects(loadRoutoSdk({...options,browserKey:'different-fake'}),e=>e.code==='SDK_KEY_CHANGED');
});
test('connection preserves expected search errors and ignores pin click without a search anchor',async()=>{
 const {sdk,objects}=sdkFake();let checks=0;
 const p=await connectRoutoPicker({elementId:'map',center:{latitude:37,longitude:127},loadSdk:async()=>sdk,
  fetchImpl:async()=>new Response(JSON.stringify({code:'QUOTA'}),{status:429}),checkPoint:()=>{checks++;}});
 objects.map.click({latLng:new sdk.maps.LatLng({lat:37,lng:127})});assert.equal(objects.marker,undefined);assert.equal(checks,0);
 await p.search('test');assert.equal(p.snapshot().error,'QUOTA');p.dispose();
});
