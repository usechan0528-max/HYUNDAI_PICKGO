import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { PhoneShare } from './phone-controller.mjs';
const labelSource = (await readFile(new URL('./place-label.mjs', import.meta.url), 'utf8')).replace('export function', 'function');
const rawSource=(await readFile(new URL('./phone-page.mjs',import.meta.url),'utf8')).replace("import { PhoneShare } from './phone-controller.mjs';",'');
const source = rawSource.replace("import { placeLabel } from './place-label.mjs';", labelSource);
async function harness(role='rider') {
 const nodes=Object.fromEntries(['context','consent','share','stop','decline','message','sample'].map(id=>[id,{textContent:'',hidden:false,disabled:false}]));
 const events={},timers=new Set();let hold=null,watches=0;
 const state={status:'active',stage:'waiting',place:'synthetic',placeRevision:1,version:2,view:'view'};
 const fix={source:'rider-phone',accuracy:20,ageMs:0,observedAt:Date.now(),remainingMs:30000};
 const box={PhoneShare:class extends PhoneShare {constructor(args){super({...args,schedule:fn=>{timers.add(fn);return fn;},cancel:fn=>timers.delete(fn),id:()=> '11111111-1111-4111-8111-111111111111'});}},performance:{now:()=>1000},Date,JSON,Math,AbortSignal,isSecureContext:true,
 navigator:{onLine:true,geolocation:{watchPosition(){watches++;return 4;},clearWatch(){}}},sessionStorage:{getItem:()=>JSON.stringify({id:'fake',token:'fake',role})},
 document:{hidden:false,getElementById:id=>nodes[id],addEventListener:(name,fn)=>events[name]=fn},addEventListener:(name,fn)=>events[name]=fn,setInterval(){},
 fetch:async(path,options)=>{if(hold && !options.body)await hold;return {ok:true,json:async()=>options.body?{}:path.endsWith('/phone')?{sample:fix}:{...state}};}};
 vm.createContext(box);vm.runInContext(source,box);await new Promise(setImmediate);
 return {nodes,events,box,state,get watches(){return watches;},hold:p=>{hold=p;},refresh:()=>vm.runInContext('refresh()',box),value:code=>vm.runInContext(code,box)};
}
test('page shows explicit consent without collection, driver has no consent controls',async()=>{
 const h=await harness();assert.equal(h.watches,0);assert.equal(h.nodes.consent.hidden,false);assert.equal(h.nodes.share.disabled,false);
 await h.nodes.decline.onclick();assert.equal(h.watches,0);assert.match(h.nodes.message.textContent,/동의하지/);
 const driver=await harness('driver');assert.equal(driver.nodes.consent.hidden,true);assert.equal(driver.nodes.share.disabled,true);assert.match(driver.nodes.sample.textContent,/휴대폰 위치 1개 수신/);assert.match(driver.nodes.sample.textContent,/20m/);
});
test('pagehide while GET pending cannot restore fresh authority or old sample',async()=>{
 const h=await harness();let done;h.hold(new Promise(r=>done=r));const pending=h.refresh();h.box.document.hidden=true;h.events.pagehide();done();await pending;
 assert.equal(h.value('allowed()'),false);assert.match(h.nodes.sample.textContent,/없음/);assert.equal(h.value('share.current'),null);
});
test('late sample after decline cannot reappear and ended/boarded render clears immediately',async()=>{
 const h=await harness();let done;h.hold(new Promise(r=>done=r));const pending=h.refresh();h.nodes.decline.onclick();done();await pending;assert.match(h.nodes.sample.textContent,/없음/);
 h.hold(null);h.state.stage='boarded';await h.refresh();assert.match(h.nodes.sample.textContent,/없음/);assert.equal(h.nodes.share.disabled,true);
 h.state.status='ended';await h.refresh();assert.match(h.nodes.context.textContent,/종료/);assert.match(h.nodes.sample.textContent,/없음/);
});

test('poll started after stop cannot re-show old remote sample while delete is pending',async()=>{
 const h=await harness();h.nodes.stop.onclick();await h.refresh();assert.match(h.nodes.sample.textContent,/없음/);assert.equal(h.value('suppressSample'),true);
});

test('fresh explicit consent clears local suppression without auto-resuming from a poll',async()=>{
 const h=await harness();h.nodes.decline.onclick();await h.refresh();assert.equal(h.watches,0);assert.match(h.nodes.sample.textContent,/없음/);
 h.nodes.share.onclick();await new Promise(setImmediate);assert.equal(h.value('suppressSample'),false);assert.equal(h.watches,1);
 await h.refresh();assert.match(h.nodes.sample.textContent,/휴대폰 위치 1개 수신/);await h.value('share.stop()');
});

test('accepted place revision stops collection and requires a new explicit consent',async()=>{
 const h=await harness();h.nodes.share.onclick();await new Promise(setImmediate);assert.equal(h.watches,1);
 h.state.placeRevision=2;h.state.place='new synthetic';h.state.version++;
 await h.refresh();assert.equal(h.value('share.current'),null);assert.equal(h.value('suppressSample'),true);
 assert.match(h.nodes.message.textContent,/승차지점이 바뀌어/);assert.match(h.nodes.sample.textContent,/없음/);
 await h.refresh();assert.equal(h.watches,1);
});
