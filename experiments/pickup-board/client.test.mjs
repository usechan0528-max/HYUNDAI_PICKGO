// Lightweight fake DOM/network regression tests, not a substitute for real browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./app.mjs', import.meta.url), 'utf8');
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
async function harness(initialFailure = null) {
  let now=100, failure=initialFailure, actionFailure=null;
  const element=()=>({hidden:false,disabled:false,textContent:'',classList:{toggle(){}},setAttribute(){},querySelector(){return this.child ||= element();}});
  const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],element()]));
  const buttons=[{...element(),dataset:{ready:'true'}},{...element(),dataset:{ready:'false'}}];
  const places=[...html.matchAll(/data-place="([^"]+)"/g)].map(m=>({...element(),dataset:{place:m[1]}}));
  const state={id:'demo',role:'driver',version:1,status:'active',place:'가상 문화센터 정문',ready:true,joined:false,
    proposal:{id:'proposal',by:'rider',place:'가상 공원 안내소'},lastEvent:'변경 제안',view:'view'};
  const sandbox={URLSearchParams,AbortSignal,crypto:{randomUUID:()=> 'test-request-123'},performance:{now:()=>now},navigator:{onLine:true},
    location:{hash:'',origin:'http://127.0.0.1:4180'},history:{replaceState(){}},
    sessionStorage:{getItem:key=>key==='pickupSession'?JSON.stringify({id:'demo',token:'fake-test-only',role:'driver',invite:'fake-invite'}):null,setItem(){},removeItem(){}},
    document:{hidden:false,getElementById:id=>nodes.get(id),querySelectorAll:selector=>selector==='[data-ready]'?buttons:selector==='[data-place]'?places:[],addEventListener(){}},
    addEventListener(){},setInterval(){},
    fetch:async(path)=>path.endsWith('/actions') && actionFailure ? {ok:false,status:actionFailure,json:async()=>({error:'다른 변경이 있습니다.'})} : failure==='network'?Promise.reject(new Error('offline')):{ok:!failure,status:failure||200,json:async()=>failure?{error:'test error'}:{...state}}};
  vm.createContext(sandbox); vm.runInContext(source,sandbox); await new Promise(setImmediate);
  return {nodes,buttons,places,state,failAction:v=>{actionFailure=v;},act:type=>vm.runInContext(`act('${type}')`,sandbox),fail:v=>{failure=v;},advance:n=>{now+=n;},refresh:()=>vm.runInContext('refresh()',sandbox),render:()=>vm.runInContext('render()',sandbox)};
}
test('HTTP error then successful refresh removes the accidental new-session escape',async()=>{
  const h=await harness(); h.fail(403); await h.refresh(); assert.equal(h.nodes.get('new').hidden,false);
  assert.equal(h.nodes.get('end').hidden,true); assert.equal(h.nodes.get('proposal').hidden,true);
  h.fail(null); await h.refresh(); assert.equal(h.nodes.get('new').hidden,true);
  assert.equal(h.nodes.get('error').textContent,''); assert.equal(h.nodes.get('proposal').hidden,false);
  assert.equal(h.nodes.get('readyText').textContent,'참여 대기');
});
test('connection failure labels every stale fact and locks all mutation controls',async()=>{
  const h=await harness(); h.fail('network'); await h.refresh();
  assert.equal(h.nodes.get('readyText').textContent,'현재 미확인');
  for(const id of ['placeLabel','proposalText','lastEvent']) assert.match(h.nodes.get(id).textContent,/현재.*미확인/);
  for(const id of ['accept','reject','withdraw','confirmEnd','end','nextPlace']) assert.equal(h.nodes.get(id).disabled,true,id);
  assert.equal(h.nodes.get('inviteBox').hidden,true);
  assert.ok(h.buttons.every(b=>b.disabled));
});
test('six-second client expiry locks even without a completed network failure',async()=>{
  const h=await harness(); h.advance(6000); h.render();
  assert.match(h.nodes.get('connection').textContent,/이전 기록/); assert.equal(h.nodes.get('end').disabled,true);
  assert.equal(h.nodes.get('readyText').textContent,'현재 미확인');
});
test('place editor blocks current place and offline writes; remote proposal closes editor',async()=>{
  const h=await harness(); h.state.joined=true; h.state.proposal=null; await h.refresh();
  h.nodes.get('openPlace').onclick(); assert.equal(h.nodes.get('editPlace').hidden,false); assert.equal(h.nodes.get('board').hidden,true);
  assert.equal(h.places.find(b=>b.dataset.place===h.state.place).disabled,true);
  h.fail('network'); await h.refresh(); assert.ok(h.places.every(b=>b.disabled));
  h.fail(null); h.state.version++; h.state.proposal={id:'new',by:'rider',place:'가상 공원 안내소'}; await h.refresh();
  assert.equal(h.nodes.get('editPlace').hidden,true); assert.equal(h.nodes.get('board').hidden,false);
});
test('end confirmation isolates controls and cancellation preserves the shared round',async()=>{
  const h=await harness(); h.nodes.get('end').onclick(); assert.equal(h.nodes.get('endConfirm').hidden,false); assert.equal(h.nodes.get('board').hidden,true);
  h.nodes.get('cancelEnd').onclick(); assert.equal(h.nodes.get('endConfirm').hidden,true); assert.equal(h.state.status,'active');
});

test('initial network failure preserves session; ended rounds offer a new start',async()=>{
  const h=await harness('network'); assert.equal(h.nodes.get('new').hidden,true);
  h.fail(null); h.state.status='ended'; h.state.proposal=null; await h.refresh();
  assert.equal(h.nodes.get('new').hidden,false); assert.equal(h.nodes.get('end').hidden,true);
  assert.equal(h.nodes.get('proposal').hidden,true); assert.equal(h.nodes.get('readyText').textContent,'약속 종료');
});

test('manual status labels and owner controls follow stage; stale locks them',async()=>{
 const h=await harness(); h.state.joined=true; h.state.proposal=null; h.state.stage='waiting'; await h.refresh();
 assert.equal(h.nodes.get('arrive').hidden,false); assert.equal(h.nodes.get('boarded').hidden,true);
 h.state.stage='arrived'; h.state.version++; await h.refresh();
 assert.equal(h.nodes.get('arrive').hidden,true); assert.equal(h.nodes.get('undoArrival').hidden,false);
 assert.equal(h.nodes.get('pickupText').textContent,'운전자 도착 알림');
 h.fail('network'); await h.refresh(); assert.equal(h.nodes.get('pickupText').textContent,'현재 미확인');
 for(const id of ['arrive','boarded','undoArrival','undoBoarding']) assert.equal(h.nodes.get(id).disabled,true);
});
test('remote boarding or undo invalidates an open end confirmation',async()=>{
 const h=await harness(); h.state.joined=true; h.state.proposal=null; h.state.stage='arrived'; await h.refresh();
 h.nodes.get('end').onclick(); assert.match(h.nodes.get('endTitle').textContent,/탑승 없이/);
 h.state.stage='boarded'; h.state.version++; await h.refresh();
 assert.equal(h.nodes.get('endConfirm').hidden,true); assert.equal(h.nodes.get('confirmEnd').disabled,true);
 h.nodes.get('end').onclick(); assert.match(h.nodes.get('endTitle').textContent,/완료/);
 assert.equal(h.nodes.get('openPlace').hidden,true);
 h.state.stage='arrived'; h.state.version++; await h.refresh(); assert.equal(h.nodes.get('endConfirm').hidden,true);
});

test('rejected action remains explained across successful polling until explicit refresh',async()=>{
 const h=await harness(); h.failAction(409); await h.act('arrive');
 assert.match(h.nodes.get('error').textContent,/다른 변경/); await h.refresh();
 assert.match(h.nodes.get('error').textContent,/다른 변경/);
 h.nodes.get('refresh').onclick(); await new Promise(setImmediate);
 assert.equal(h.nodes.get('error').textContent,'');
});
