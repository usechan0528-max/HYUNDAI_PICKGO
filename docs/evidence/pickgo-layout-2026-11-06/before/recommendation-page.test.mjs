import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const labelSource = (await readFile(new URL('./place-label.mjs', import.meta.url), 'utf8')).replace('export function', 'function');
const rawSource=(await readFile(new URL('./recommendation/page.mjs',import.meta.url),'utf8')).replace("import { ContinuousShare } from './controller.mjs';",'');
const source = rawSource.replace("import { placeLabel } from '../place-label.mjs';", labelSource);
const flush=()=>new Promise(r=>setImmediate(r));
async function harness(candidate={}){
 let now=100, pending=null;const timers=[],events={},elements=new Map();
 const element=()=>({hidden:false,disabled:false,textContent:'',children:[],append(...c){this.children.push(...c);},replaceChildren(...c){this.children=c;}});
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const document={hidden:false,getElementById:get,createElement:element,addEventListener:(e,f)=>events[e]=f};
 const snapshot={id:'snapshot',remainingMs:5000,candidates:[{id:'one',name:'Other place',reason:'route evidence',approach:'entrance',source:'synthetic',reference:'fixture',checkedAt:1,validUntil:999999,maxDwellSeconds:120,...candidate}]};
 const status=()=>({mode:'synthetic',driverFresh:true,riderFresh:true,snapshot});
 const state={status:'active',stage:'waiting',joined:true,place:'Current',version:1,view:'lease'};
 const share={current:null,generation:0,async start(){},async stop(){this.generation++;this.current=null;}};
 const context={document,navigator:{onLine:true},performance:{now:()=>now},sessionStorage:{getItem:()=>JSON.stringify({id:'room',token:'token',role:'rider'})},ContinuousShare:class{constructor(options){share.notify=options.notify;return share;}},crypto:{randomUUID:()=> 'request'},AbortSignal:{timeout:()=>null},Date,console,setInterval:f=>timers.push(f),addEventListener:(e,f)=>events[e]=f,
 fetch:async(url,options)=>{const body=options.body&&JSON.parse(options.body);if(body?.type==='calculate'&&pending)return pending;return{ok:true,json:async()=>url.endsWith('/recommendation')?status():state};}};
 vm.runInNewContext(source,context);await flush();return{get,timers,events,document,context,share,tick:n=>now+=n,delay:()=>{let resolve;pending=new Promise(r=>resolve=r);return()=>resolve({ok:true,json:async()=>status()});}};
}
test('page clears candidates at response-relative expiry and offline',async()=>{const x=await harness();assert.equal(x.get('candidates').children.length,1);x.tick(5000);x.timers[1]();assert.equal(x.get('candidates').children.length,0);x.events.offline();assert.equal(x.get('calculate').disabled,true);});
test('page hides candidate snapshot immediately on local sharing invalidation',async()=>{const x=await harness();x.share.notify('stopped');assert.equal(x.get('candidates').children.length,0);});
test('late calculate response after page hide cannot render candidates',async()=>{const x=await harness(),resolve=x.delay();x.get('calculate').onclick();x.document.hidden=true;x.events.visibilitychange();resolve();await flush();assert.equal(x.get('candidates').children.length,0);assert.equal(x.get('calculate').disabled,true);});

test('unknown stopping conditions are visible without inventing a legal time limit',async()=>{const x=await harness({maxDwellSeconds:null,advisories:['정차 허용 여부 미확인']});const text=x.get('candidates').children[0].children[2].textContent;assert.match(text,/정차 시간 제한 미확인/);assert.match(text,/정차 허용 여부 미확인/);assert.doesNotMatch(text,/한도 null초/);});
