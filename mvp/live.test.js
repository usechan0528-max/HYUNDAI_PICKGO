import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./live.js',import.meta.url),'utf8');
function setup(){
 const els=Object.fromEntries(['mode','lock','result','refresh','counts','times','status'].map(id=>[id,{value:id==='mode'?'unknown':'',textContent:'',addEventListener(event,fn){this[event]=fn;}}]));
 let wall=1000000,mono=0,tick; const events={};
 const context={document:{getElementById:id=>els[id],addEventListener:(event,fn)=>events[event]=fn},Date:{now:()=>wall},performance:{now:()=>mono},Intl,Number,Math,AbortController,setTimeout:()=>1,clearTimeout:()=>{},setInterval:fn=>tick=fn,fetch:async()=>({json:async()=>({status:'fresh',ageMs:60000,observedAt:0,fetchedAt:60000,capacity:1260,occupied:110})})};
 vm.runInNewContext(source,context);
 return {els,events,tick:()=>tick(),setTime:(w,m)=>{wall=w;mono=m;}};
}
test('client hides numbers at expiry even if monotonic clock pauses in sleep',async()=>{
 const x=setup();assert.equal(x.els.refresh.disabled,true);x.els.mode.value='parked';x.els.mode.change();await x.els.refresh.click();assert.match(x.els.counts.textContent,/110/);
 x.setTime(1240000,0);x.tick();assert.equal(x.els.counts.textContent,'');
});
test('backward wall clock cannot extend freshness; visibility and mode changes discard values',async()=>{
 const x=setup();x.els.mode.value='parked';x.els.mode.change();await x.els.refresh.click();x.setTime(900000,240000);x.tick();assert.equal(x.els.counts.textContent,'');
 await x.els.refresh.click();assert.match(x.els.counts.textContent,/110/);x.events.visibilitychange();assert.equal(x.els.counts.textContent,'');
 await x.els.refresh.click();x.els.mode.value='driving';x.els.mode.change();assert.equal(x.els.result.hidden,true);assert.equal(x.els.counts.textContent,'');
});
