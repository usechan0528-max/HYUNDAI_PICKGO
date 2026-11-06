import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const labelSource = (await readFile(new URL('./place-label.mjs', import.meta.url), 'utf8')).replace('export function', 'function');
const rawSource=await readFile(new URL('./app.mjs',import.meta.url),'utf8');
const source = rawSource.replace("import { placeLabel } from './place-label.mjs';", labelSource);
const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
const id='00000000-0000-4000-8000-000000000001', invite='a'.repeat(32);
const hash=`#room=${id}&invite=${invite}`;
async function page({fragment='',store=new Map(),denied=false,clipboard=false,finalSaveDenied=false}={}) {
  const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{hidden:false,disabled:false,value:'',textContent:'',classList:{toggle(){}},setAttribute(){},focus(){},select(){}}]));
  const calls=[];
  const state={id,version:1,status:'active',stage:'waiting',place:'하나로마트 양재점',joined:false,view:'view',lastEvent:'시연'};
  const location={hash:fragment,origin:'http://127.0.0.1:4180',assign(){}};
  const context={URLSearchParams,URL,AbortSignal,crypto:{randomUUID:()=> 'test-request-123'},performance:{now:()=>100},
    navigator:{onLine:true,clipboard:{writeText:async()=>{if(!clipboard)throw Error('denied');}}},location,
    history:{replaceState(){location.hash='';}},
    sessionStorage:{getItem:k=>store.get(k)||null,setItem(k,v){if(denied || (finalSaveDenied && k==='pickupSession'))throw Error('denied');store.set(k,v);},removeItem(k){store.delete(k);}},
    document:{hidden:false,getElementById:k=>nodes.get(k),querySelectorAll:()=>[],addEventListener(){}},addEventListener(){},setInterval(){},
    fetch:async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>path.endsWith('/join')?{id,role:'rider',token:'rider-token'}:{...state}};}};
  vm.createContext(context);vm.runInContext(source,context);await new Promise(setImmediate);
  return {nodes,calls,store,location,state,context};
}
test('invite survives pre-join reload without account or location collection',async()=>{
  const first=await page({fragment:hash});assert.equal(first.location.hash,'');assert.equal(first.calls.length,1);assert.ok(first.calls[0].path.endsWith('/preview'));assert.equal(first.nodes.get('invitePlace').textContent,'픽업 장소 · 하나로마트 양재점');
  const second=await page({store:first.store});assert.equal(second.nodes.get('create').hidden,true);
  await second.nodes.get('join').onclick();assert.equal(JSON.parse(second.store.get('pickupSession')).role,'rider');
  assert.equal(second.store.has('pickupInvitation'),false);
  assert.equal(second.calls.filter(c=>c.path.endsWith('/join')).length,1);
});
test('already joined rider reopens original link without consuming invitation twice',async()=>{
  const store=new Map([['pickupSession',JSON.stringify({id,role:'rider',token:'rider-token'})]]);
  const p=await page({fragment:hash,store});assert.equal(p.nodes.get('welcome').hidden,true);
  assert.equal(p.calls.some(c=>c.path.endsWith('/join')),false);assert.equal(store.has('pickupInvitation'),false);
});
test('malformed invite cannot accidentally create a driver room or call join',async()=>{
  const p=await page({fragment:'#room=bad&invite=bad'});assert.equal(p.nodes.get('create').hidden,true);
  assert.equal(p.nodes.get('join').disabled,true);assert.match(p.nodes.get('error').textContent,/초대/);assert.equal(p.calls.length,0);
});
test('storage denial keeps invitation in fragment for reload and explains limitation',async()=>{
  const p=await page({fragment:hash,denied:true});assert.equal(p.location.hash,hash);
  assert.match(p.nodes.get('notice').textContent,/저장/);
  await p.nodes.get('join').onclick();assert.equal(p.calls.filter(c=>!c.path.endsWith('/preview')).length,0);assert.match(p.nodes.get('notice').textContent,/참여하지 않았/);
});
test('same-room driver cannot replace their own credential with rider role',async()=>{
  const p=await page({fragment:hash,store:new Map([['pickupSession',JSON.stringify({id,role:'driver',token:'driver',invite})]])});
  assert.equal(p.nodes.get('join').disabled,true);await p.nodes.get('join').onclick();assert.equal(p.calls.length,0);
  assert.equal(JSON.parse(p.store.get('pickupSession')).role,'driver');
});
test('persistent notice survives refresh; reopening same invite preserves retry key',async()=>{
  const pending={id,invite,joinId:'retry-key'};
  const p=await page({fragment:hash,store:new Map([['pickupInvitation',JSON.stringify(pending)]])});
  assert.equal(JSON.parse(p.store.get('pickupInvitation')).joinId,'retry-key');
  p.nodes.get('notice').textContent='저장 안내';await p.nodes.get('join').onclick();
  await vm.runInContext('refresh()',p.context);assert.equal(p.nodes.get('notice').textContent,'저장 안내');
});
test('existing other session is preserved until explicit join; invitation can be dismissed',async()=>{
  const prior=JSON.stringify({id:'other-room',role:'driver',token:'original'});
  const p=await page({fragment:hash,store:new Map([['pickupSession',prior]])});
  assert.equal(p.store.get('pickupSession'),prior);assert.match(p.nodes.get('joinHint').textContent,/기존/);
  p.nodes.get('cancelJoin').onclick();assert.equal(p.store.has('pickupInvitation'),false);assert.equal(p.store.get('pickupSession'),prior);
});
test('dismissing an attempted invitation explains recovery loss before deleting retry key',async()=>{
  const p=await page({store:new Map([['pickupInvitation',JSON.stringify({id,invite,joinId:'retry-key'})]])});
  p.nodes.get('cancelJoin').onclick();assert.equal(p.store.has('pickupInvitation'),true);assert.match(p.nodes.get('notice').textContent,/再|재시도/);
  p.nodes.get('cancelJoin').onclick();assert.equal(p.store.has('pickupInvitation'),false);
});
test('copy failure exposes selectable link and local-only notice; used invitation gets scrubbed',async()=>{
  const p=await page({store:new Map([['pickupSession',JSON.stringify({id,role:'driver',token:'driver',invite})]])});
  await p.nodes.get('copyInvite').onclick();assert.equal(p.nodes.get('inviteText').hidden,false);
  assert.match(p.nodes.get('inviteStatus').textContent,/직접 복사/);assert.match(p.nodes.get('inviteHelp').textContent,/같은 컴퓨터/);
  p.state.joined=true;p.state.version++;await vm.runInContext('refresh()',p.context);
  assert.equal(p.nodes.get('inviteText').value,'');assert.equal(p.nodes.get('inviteLink').href,'');assert.equal(JSON.parse(p.store.get('pickupSession')).invite,undefined);
});

test('failed credential save preserves retry key and persistent five-minute recovery notice',async()=>{
  const p=await page({fragment:hash,finalSaveDenied:true});await p.nodes.get('join').onclick();
  assert.ok(JSON.parse(p.store.get('pickupInvitation')).joinId);assert.equal(p.store.has('pickupSession'),false);
  assert.match(p.nodes.get('notice').textContent,/5분/);await vm.runInContext('refresh()',p.context);assert.match(p.nodes.get('notice').textContent,/5분/);
});
