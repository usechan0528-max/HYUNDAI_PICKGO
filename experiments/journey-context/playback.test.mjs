import {sdkUnknownContext,sdkStatusText} from './demo/sdk-status.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {JourneySession,QueuePolicy,recommend,informationDestination} from './core.mjs';
import {inferCoordinateJourney} from './coordinates.mjs';
import {history,observationInput} from './demo/observations.mjs';
import {catalog} from './demo/content.mjs';
import {STORAGE_KEY,loadListening,saveListening,clearListening} from './demo/listening-store.mjs';

// Fake media events exercise app orchestration, not browser autoplay permissions or decoding.
const source=(await readFile(new URL('./demo/app.mjs',import.meta.url),'utf8')).replace(/^import .*?;\r?\n/gm,'');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness({sdkMode=false,sdkFetch,checkpoint,manualSeek=false,manualLoad=false,blockedPlay=false,deferredPlay=false,duration=20}={}){
 class Element extends EventTarget {value='';checked=false;disabled=false;textContent='';}
 class Audio extends Element {
  paused=true;ended=false;readyState=0;duration=20;src='';time=0;playPositions=[];hidden=true;
  removeAttribute(name){if(name==='src')this.src='';}
  load(){this.time=0;this.readyState=0;this.ended=false;if(this.src&&!manualLoad)queueMicrotask(()=>this.metadata());}
  metadata(){this.readyState=1;this.dispatchEvent(new Event('loadedmetadata'));}
  get currentTime(){return this.time;}
  set currentTime(value){this.time=value;if(!manualSeek)queueMicrotask(()=>this.dispatchEvent(new Event('seeked')));}
  async play(){this.playPositions.push(this.time);if(blockedPlay)throw Error('blocked');this.paused=false;this.readyState=1;this.dispatchEvent(new Event('play'));if(deferredPlay)await new Promise(resolve=>{this.resolvePlay=resolve;});}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  finish(){this.time=20;this.ended=true;this.paused=true;this.dispatchEvent(new Event('ended'));}
 }
 const elements=new Map();const audio=new Audio();audio.duration=duration;elements.set('audio',audio);
 const $=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 if(checkpoint)saveListening(storage,{taste:'story',checkpoint},catalog.map(c=>c.id));
 const window=new EventTarget();window.localStorage=storage;
 if(sdkMode){window.location={search:'?input=sdk'};window.fetch=sdkFetch||(()=>new Promise(()=>{}));}
 vm.runInNewContext(source+"\nwindow.testSnapshot=()=>({now,changes:session.queue.changes,next:session.queue.next});",{document:{getElementById:$},window,JourneySession,QueuePolicy,recommend,informationDestination,
  inferCoordinateJourney,history,observationInput,catalog,sdkUnknownContext,sdkStatusText,loadListening,saveListening,clearListening,setTimeout,clearTimeout});
 return {$,audio,storage,window,click:id=>$(id).dispatchEvent(new Event('click')),change:(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event('change'));}};
}
const checkpoint={id:'pause2',seconds:8,duration:20};
test('resume seeks before any audible play request',async()=>{
 const h=harness({checkpoint});h.click('play');await flush();
 assert.deepEqual(h.audio.playPositions,[8]);assert.equal(h.audio.paused,false);
});
test('stop during pending resume seek prevents later playback and releases controls',async()=>{
 const h=harness({checkpoint,manualSeek:true});h.click('play');await flush();h.click('stop');
 h.audio.dispatchEvent(new Event('seeked'));await flush();
 assert.equal(h.audio.paused,true);assert.equal(h.$('stop').disabled,true);
 assert.equal(h.audio.playPositions.length,0);
});
test('guest transition removes owner resume label and cannot overwrite owner checkpoint',async()=>{
 const h=harness({checkpoint});const saved=h.storage.getItem(STORAGE_KEY);
 h.change('profile','guest');
 assert.doesNotMatch(h.$('reason').textContent,/8초/);
 h.change('profile','guest');h.click('play');await flush();h.audio.currentTime=4;
 h.audio.dispatchEvent(new Event('timeupdate'));h.click('stop');
 assert.equal(h.storage.getItem(STORAGE_KEY),saved);
});
test('guest to owner preference change preserves the owner checkpoint',()=>{
 const h=harness({checkpoint});h.change('profile','guest');h.change('profile','owner');h.change('taste','reflection');
 assert.deepEqual(loadListening(h.storage,catalog.map(c=>c.id)).checkpoint,checkpoint);
});
test('pause while play is pending remains paused when the promise resolves',async()=>{
 const h=harness({deferredPlay:true});h.click('play');await flush();h.audio.pause();h.audio.resolvePlay();await flush();
 assert.equal(h.audio.paused,true);assert.match(h.$('play-status').textContent,/일시정지/);
});
test('late media error after explicit stop preserves stopped state',async()=>{
 const h=harness({checkpoint,manualLoad:true});h.click('play');await flush();h.click('stop');
 const status=h.$('play-status').textContent;h.audio.dispatchEvent(new Event('error'));await flush();
 assert.equal(h.$('play-status').textContent,status);assert.equal(h.audio.paused,true);
});
test('profile change during resume preparation cancels the owner playback',async()=>{
 const h=harness({checkpoint,manualSeek:true});h.click('play');await flush();h.change('profile','guest');
 h.audio.dispatchEvent(new Event('seeked'));await flush();assert.equal(h.audio.playPositions.length,0);
 assert.equal(h.audio.paused,true);assert.equal(h.$('stop').disabled,true);
});
test('invalid media duration discards checkpoint permanently even on pagehide',async()=>{
 const h=harness({checkpoint,duration:5});h.click('play');await flush();h.window.dispatchEvent(new Event('pagehide'));
 assert.equal(loadListening(h.storage,catalog.map(c=>c.id)).checkpoint,null);
 assert.equal(h.audio.playPositions.length,0);assert.equal(h.$('play').disabled,false);
});
test('media failure discards checkpoint and enables moving to another recommendation',async()=>{
 const h=harness({checkpoint,manualLoad:true});h.click('play');h.audio.dispatchEvent(new Event('error'));await flush();
 h.window.dispatchEvent(new Event('pagehide'));assert.equal(loadListening(h.storage,catalog.map(c=>c.id)).checkpoint,null);
 assert.equal(h.$('play').disabled,false);
});
test('owner completion after a guest toggle clears the completed checkpoint',async()=>{
 const h=harness();h.click('play');await flush();h.audio.currentTime=4;h.audio.dispatchEvent(new Event('timeupdate'));
 h.change('profile','guest');h.change('profile','owner');h.click('stop');h.audio.finish();await flush();
 assert.equal(loadListening(h.storage,catalog.map(c=>c.id)).checkpoint,null);
});
test('guest media cannot replace owner checkpoint after returning to owner',async()=>{
 const h=harness({checkpoint});h.change('profile','guest');h.click('play');await flush();h.change('profile','owner');
 h.change('taste','reflection');h.audio.finish();await flush();
 assert.deepEqual(loadListening(h.storage,catalog.map(c=>c.id)).checkpoint,checkpoint);
});
test('guest-started media and taste changes cannot write owner storage',async()=>{
 const h=harness({checkpoint});const saved=h.storage.getItem(STORAGE_KEY);
 h.change('profile','guest');h.click('play');await flush();h.change('profile','owner');h.change('taste','reflection');
 assert.equal(h.storage.getItem(STORAGE_KEY),saved);
});
test('failure of another owner item preserves the previously stored checkpoint',async()=>{
 const h=harness({checkpoint});h.change('profile','guest');h.click('play');await flush();h.change('profile','owner');
 h.click('play');await flush();assert.notEqual(h.audio.src,`/audio/${checkpoint.id}.wav`);
 h.audio.dispatchEvent(new Event('error'));h.window.dispatchEvent(new Event('pagehide'));h.change('taste','reflection');
 assert.deepEqual(loadListening(h.storage,catalog.map(c=>c.id)).checkpoint,checkpoint);
});
test('one start exhausts the four-item catalog without repetition or another click',async()=>{
 const h=harness();h.click('play');await flush();const played=[];
 for(let n=0;n<4;n++){played.push(h.audio.src);h.audio.finish();await flush();}
 assert.equal(new Set(played).size,4);assert.equal(h.audio.playPositions.length,4);
 assert.equal(h.$('stop').disabled,true);assert.equal(h.audio.paused,true);
});
test('reset during loading cancels completion and does not recreate cleared storage',async()=>{
 const h=harness({checkpoint,manualLoad:true});h.click('play');await flush();h.click('reset');
 h.audio.metadata();h.audio.dispatchEvent(new Event('seeked'));await flush();
 assert.equal(h.audio.paused,true);assert.equal(h.audio.src,'');assert.equal(h.storage.getItem(STORAGE_KEY),undefined);
});
test('rejected play ends automatic continuation',async()=>{
 const h=harness({blockedPlay:true});h.click('play');await flush();
 assert.equal(h.$('stop').disabled,true);assert.equal(h.audio.paused,true);
 h.audio.finish();await flush();assert.equal(h.audio.playPositions.length,1);
});

test('explicit SDK mode disables synthetic route strategy and keeps taste-only listening',async()=>{
 const h=harness({sdkMode:true});
 assert.equal(h.$('scene').disabled,true);assert.equal(h.$('strategy').disabled,true);
 assert.match(h.$('context').textContent,/취향만/);
 h.change('scene','explicit');h.change('strategy','B');
 assert.match(h.$('info').textContent,/판단하지 않습니다/);
 assert.equal(h.$('mode-label').textContent,'SDK · 취향 대안');
 h.click('play');await flush();assert.equal(h.audio.paused,false);
 assert.match(h.$('context').textContent,/취향만/);h.click('stop');
 h.window.dispatchEvent(new Event('pagehide'));
});
test('SDK mode preserves user-requested resume without pretending it is a route recommendation',async()=>{
 const h=harness({sdkMode:true,checkpoint});
 assert.equal(h.$('mode-label').textContent,'SDK · 이어듣기');
 assert.match(h.$('reason').textContent,/8초/);h.click('play');await flush();
 assert.deepEqual(h.audio.playPositions,[8]);h.click('stop');h.window.dispatchEvent(new Event('pagehide'));
});

test('SDK status polls do not advance recommendation clock or replacement budget',async()=>{
 const h=harness({sdkMode:true,sdkFetch:async()=>({ok:true,json:async()=>({state:'CALLBACK',clockStatus:'UNVERIFIED_CLOCK',sampleCount:3})})});
 try{const before=JSON.stringify(h.window.testSnapshot());await flush();
  for(let i=0;i<3;i++){h.window.dispatchEvent(new Event('pagehide'));h.window.dispatchEvent(new Event('pageshow'));await flush();}
  assert.equal(JSON.stringify(h.window.testSnapshot()),before);assert.match(h.$('context').textContent,/실제 SDK 입력 수신/);
 }finally{h.window.dispatchEvent(new Event('pagehide'));}
});
test('old in-flight SDK poll cannot overwrite a resumed page status',async()=>{
 const pending=[];const h=harness({sdkMode:true,sdkFetch:()=>new Promise(resolve=>pending.push(resolve))});
 try{
  h.window.dispatchEvent(new Event('pagehide'));h.window.dispatchEvent(new Event('pageshow'));
  pending[0]({ok:true,json:async()=>({state:'CALLBACK',clockStatus:'UNVERIFIED_CLOCK'})});await flush();
  assert.doesNotMatch(h.$('context').textContent,/입력 수신/);
  pending[1]({ok:true,json:async()=>({state:'ACCESS_DENIED',clockStatus:'UNVERIFIED_CLOCK'})});await flush();
  assert.match(h.$('context').textContent,/위치 권한 없음/);
 }finally{h.window.dispatchEvent(new Event('pagehide'));}
});
