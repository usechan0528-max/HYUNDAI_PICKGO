// Fake DOM checks cover failure/queue contracts; real Chrome workflow is recorded separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const source=await readFile(new URL('./multi/page.mjs',import.meta.url),'utf8');
const html=await readFile(new URL('./multi/page.html',import.meta.url),'utf8');
const rider={id:'trip',version:1,view:'old-view',role:'rider',status:'active',demo:true,participant:{id:'p',name:'가',state:'waiting',ready:false},stop:{label:'지점'},ordinal:1,arrived:false};
async function harness({hash='',saved={},failSessionSave=false,previewFailure=false,joinFailure=false,mapFailure=false,failRetrySave=false,actionConflict=false,readStatus=200,joinStatus=200}={}){
  function element(){return {children:[],value:'',textContent:'',hidden:false,disabled:false,open:false,append(...v){this.children.push(...v);},replaceChildren(){this.children=[];},get options(){return this.children;},querySelector(){return this.child??=element();},setAttribute(){},showModal(){this.open=true;},close(){this.open=false;},select(){}};}
  const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],element()]));
  const values=new Map(Object.entries(saved)),requests=[],history=[],callbacks=[];
  const ctx={URLSearchParams,AbortSignal,structuredClone,Date,crypto:{randomUUID},navigator:{},
    location:{hash,origin:'http://127.0.0.1:4196',replace(){}},history:{replaceState:(...v)=>history.push(v)},
    sessionStorage:{getItem:k=>values.get(k)??null,setItem(k,v){if((failSessionSave&&k==='pickgo-multi-session-v1')||(failRetrySave&&k==='pickgo-multi-join'))throw Error('quota');values.set(k,v);},removeItem:k=>values.delete(k)},
    document:{visibilityState:'visible',getElementById:id=>nodes.get(id),createElement:element},setInterval:fn=>callbacks.push(fn),
    fetch:async(path,options={})=>{
      const body=options.body?JSON.parse(options.body):null;requests.push({path,body});
      if(path==='/api/map'){if(mapFailure)throw Error('map offline');return {ok:true,json:async()=>({available:false})};}
      if(path.endsWith('/preview'))return {ok:!previewFailure,json:async()=>previewFailure?{error:'used'}:{name:'가',stop:{label:'지점',point:[127,37]},demo:true}};
      if(path.endsWith('/join')){if(joinFailure)throw Error('response lost');return {ok:joinStatus===200,status:joinStatus,json:async()=>joinStatus===200?{id:'trip',token:'rider-token',role:'rider'}:{error:'이미 사용된 초대입니다.'}};}
      if(path.endsWith('/actions')&&actionConflict)return {ok:false,status:409,json:async()=>({error:'상태가 바뀌었습니다.'})};
      if(path==='/api/trips/trip'&&readStatus!==200)return {ok:false,status:readStatus,json:async()=>({error:'회차 조회 실패'})};
      return {ok:true,json:async()=>structuredClone(rider)};
    }};
  vm.createContext(ctx);
  await vm.runInContext(`(async()=>{${source}\nglobalThis.h={run,refresh,setState:s=>{state=s;},getSession:()=>session};})()`,ctx);
  return {ctx,nodes,requests,values,history,callbacks};
}
test('queued click retains viewed revision and recommendation instead of applying a new one',async()=>{
  const h=await harness({saved:{'pickgo-multi-session-v1':JSON.stringify({id:'trip',token:'driver'})}});
  h.ctx.h.setState({...rider,role:'driver',version:10,view:'view10',recommendation:{id:'seen'}});
  let release;const held=h.ctx.h.run(()=>new Promise(r=>{release=r;}));await Promise.resolve();
  const click=h.nodes.get('apply').onclick();
  h.ctx.h.setState({...rider,role:'driver',version:11,view:'view11',recommendation:{id:'unseen'}});release();await held;await click;
  const sent=h.requests.find(r=>r.path.endsWith('/actions')).body;
  assert.equal(sent.version,10);assert.equal(sent.view,'view10');assert.equal(sent.recommendationId,'seen');
});
test('join credential storage failure preserves memory session and persisted retry key',async()=>{
  const h=await harness({hash:'#trip=trip&invite=invite',failSessionSave:true});
  await h.nodes.get('join').onclick();
  assert.equal(h.ctx.h.getSession().token,'rider-token');assert.ok(h.values.has('pickgo-multi-join'));
  assert.equal(h.history.length,0);assert.match(h.nodes.get('message').textContent,/5분/);assert.equal(h.nodes.get('rider').hidden,false);
});
test('lost join response can retry after reload using same key even when preview is consumed',async()=>{
  const first=await harness({hash:'#trip=trip&invite=invite',joinFailure:true});await first.nodes.get('join').onclick();
  const sent=first.requests.find(r=>r.path.endsWith('/join')).body;
  const second=await harness({hash:'#trip=trip&invite=invite',saved:Object.fromEntries(first.values),previewFailure:true});
  assert.equal(second.nodes.get('join').disabled,false);await second.nodes.get('join').onclick();
  assert.equal(second.requests.find(r=>r.path.endsWith('/join')).body.joinId,sent.joinId);
  assert.equal(second.ctx.h.getSession().token,'rider-token');assert.equal(second.values.has('pickgo-multi-join'),false);
});
test('map failure does not prevent existing participant from restoring their trip',async()=>{
  const h=await harness({mapFailure:true,saved:{'pickgo-multi-session-v1':JSON.stringify({id:'trip',token:'rider'})}});
  assert.equal(h.nodes.get('trip').hidden,false);assert.equal(h.nodes.get('rider').hidden,false);assert.match(h.nodes.get('myPlace').textContent,/가/);
});
test('cancel confirmation keeps revision from opening the dialog',async()=>{
  const h=await harness({saved:{'pickgo-multi-session-v1':JSON.stringify({id:'trip',token:'rider'})}});
  h.nodes.get('cancelSelf').onclick();h.ctx.h.setState({...rider,version:2,view:'new'});
  await h.nodes.get('confirmCancel').onclick();assert.equal(h.requests.find(r=>r.path.endsWith('/actions')).body.version,1);
});
test('stale cancellation closes dialog, refreshes and keeps failure visible',async()=>{
  const h=await harness({actionConflict:true,saved:{'pickgo-multi-session-v1':JSON.stringify({id:'trip',token:'rider'})}});
  h.nodes.get('cancelSelf').onclick();await h.nodes.get('confirmCancel').onclick();
  assert.equal(h.nodes.get('confirm').open,false);assert.match(h.nodes.get('error').textContent,/상태/);
  assert.equal(h.requests.at(-1).path,'/api/trips/trip');
});
test('unwritable recovery storage preserves unused invitation and explains remedy',async()=>{
  const h=await harness({hash:'#trip=trip&invite=invite',failRetrySave:true});await h.nodes.get('join').onclick();
  assert.equal(h.requests.some(r=>r.path.endsWith('/join')),false);assert.match(h.nodes.get('error').textContent,/아직 사용하지/);
});
test('rapid clicks retain original revision, rather than silently rebasing user intent',async()=>{
  const h=await harness({saved:{'pickgo-multi-session-v1':JSON.stringify({id:'trip',token:'rider'})}});
  await Promise.all([h.nodes.get('ready').onclick(),h.nodes.get('notReady').onclick()]);
  const requests=h.requests.filter(r=>r.path.endsWith('/actions'));assert.equal(requests.length,2);assert.ok(requests.every(r=>r.body.version===1));assert.deepEqual(requests.map(r=>r.body.ready),[true,false]);
});
test('expired or invalid restored sessions return to setup and stop polling',async()=>{
  for(const readStatus of [401,403,404]){
    const h=await harness({readStatus,saved:{'pickgo-multi-session-v1':JSON.stringify({id:'trip',token:'rider'})}});
    assert.equal(h.ctx.h.getSession(),null);assert.equal(h.values.has('pickgo-multi-session-v1'),false);
    assert.equal(h.nodes.get('setup').hidden,false);assert.equal(h.nodes.get('trip').hidden,true);
    assert.match(h.nodes.get('message').textContent,/새 초대/);
    const n=h.requests.length;h.callbacks[0]();await Promise.resolve();assert.equal(h.requests.length,n);
  }
});
test('temporary server failure keeps the saved session for reconnect',async()=>{
  const h=await harness({readStatus:503,saved:{'pickgo-multi-session-v1':JSON.stringify({id:'trip',token:'rider'})}});
  assert.equal(h.ctx.h.getSession().token,'rider');assert.ok(h.values.has('pickgo-multi-session-v1'));
});
test('unrecoverable invitation stops retrying and explains cancel/reinvite limits',async()=>{
  for(const joinStatus of [403,404,409]){
    const h=await harness({hash:'#trip=trip&invite=invite',joinStatus});await h.nodes.get('join').onclick();
    assert.equal(h.nodes.get('join').disabled,true);assert.equal(h.values.has('pickgo-multi-join'),false);
    assert.equal(h.ctx.h.getSession(),null);assert.match(h.nodes.get('invitationText').textContent,/새 초대/);
  }
});
