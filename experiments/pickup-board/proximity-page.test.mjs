import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { ProximityDetector } from './proximity/detector.mjs';
const source=(await readFile(new URL('./proximity-page.mjs',import.meta.url),'utf8')).replace("import { ProximityDetector } from './proximity/detector.mjs';",'');
async function setup(role='driver') {
  let now=1000, timer, hold;
  const events={}, nodes=Object.fromEntries(['proximityConnection','proximityPlace','manualStage','proximityState','proximityReason','proximityNotice','proximityError','demoNear','demoFar','demoDenied'].map(id=>[id,{textContent:'',disabled:false}]));
  const state={id:'fake-room',status:'active',stage:'waiting',role,place:'합성 A',placeRevision:1,version:1,proposal:null};
  const sandbox={ProximityDetector:class extends ProximityDetector{constructor(){super({now:()=>now});}},performance:{now:()=>now},JSON,AbortSignal,
    sessionStorage:{getItem:()=>JSON.stringify({id:'fake-room',role,token:'fake-token'})},navigator:{onLine:true},
    document:{hidden:false,getElementById:id=>nodes[id],addEventListener:(id,fn)=>events[id]=fn},
    addEventListener:(id,fn)=>events[id]=fn,setInterval(){},setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>{timer=null;},
    fetch:async()=>{if(hold) await hold; return {ok:true,json:async()=>({...state})};}};
  vm.createContext(sandbox);vm.runInContext(source,sandbox);await new Promise(setImmediate);
  return {nodes,state,sandbox,events,advance:n=>now+=n,render:()=>vm.runInContext('render()',sandbox),refresh:()=>vm.runInContext('refresh()',sandbox),
    near:()=>{nodes.demoNear.onclick();now+=150;const fn=timer;timer=null;fn?.();},
    hold:()=>{let resolve;hold=new Promise(r=>resolve=r);return ()=>{hold=null;resolve();};}};
}
test('UI synthetic proximity stays distinct from manual arrival and expires on render',async()=>{
  const h=await setup();h.near();assert.match(h.nodes.proximityState.textContent,/근처입니다/);assert.match(h.nodes.manualStage.textContent,/도착 알림 전/);
  h.advance(5000);await h.refresh();h.render();assert.equal(h.nodes.proximityState.textContent,'현재 미확인');
});
test('accepted revision invalidates near, including same place after A-B-A',async()=>{
  const h=await setup();h.near();h.state.placeRevision=3;h.state.version=5;await h.refresh();assert.equal(h.nodes.proximityState.textContent,'현재 미확인');
  h.near();assert.match(h.nodes.proximityNotice.textContent,/2회/);
});
test('permission denial, pending changes and manual stage block proximity hints',async()=>{
  const h=await setup();h.near();h.nodes.demoDenied.onclick();assert.equal(h.nodes.proximityState.textContent,'현재 미확인');
  h.near();assert.match(h.nodes.proximityNotice.textContent,/1회/);
  h.state.proposal={id:'fake'};await h.refresh();assert.equal(h.nodes.demoNear.disabled,true);assert.equal(h.nodes.proximityState.textContent,'현재 미확인');
  h.state.proposal=null;h.state.stage='arrived';await h.refresh();assert.equal(h.nodes.demoNear.disabled,true);
});
test('rider cannot use vehicle demo and late lifecycle response cannot reactivate it',async()=>{
  const rider=await setup('rider');assert.equal(rider.nodes.demoNear.disabled,true);
  const h=await setup();const release=h.hold();const pending=h.refresh();h.sandbox.document.hidden=true;h.events.visibilitychange();
  h.sandbox.document.hidden=false;h.events.visibilitychange();release();await pending;
  assert.equal(h.nodes.demoNear.disabled,true);assert.equal(h.nodes.proximityState.textContent,'현재 미확인');
  await h.refresh();assert.equal(h.nodes.demoNear.disabled,false);
});
