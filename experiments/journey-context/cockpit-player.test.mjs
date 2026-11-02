import test from 'node:test';
import assert from 'node:assert/strict';
import {CockpitPlayer} from './demo/cockpit-player.mjs';
import {catalog} from './demo/content.mjs';
import {saveListening,loadListening} from './demo/listening-store.mjs';
class Audio extends EventTarget{
 paused=true;ended=false;readyState=1;duration=60;_time=0;plays=0;src='';deferred=null;reject=false;
 get currentTime(){return this._time;}set currentTime(v){this._time=v;queueMicrotask(()=>this.dispatchEvent(new Event('seeked')));}
 async play(){this.plays++;if(this.reject)throw Error('blocked');this.paused=false;this.ended=false;if(this.deferred)await this.deferred;}
 pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
 load(){queueMicrotask(()=>this.dispatchEvent(new Event('loadedmetadata')));}
 removeAttribute(){this.src='';this._time=0;}
 end(){this.ended=true;this.paused=true;this.dispatchEvent(new Event('pause'));this.dispatchEvent(new Event('ended'));}
}
function setup(){const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};const audio=new Audio();const player=new CockpitPlayer({audio,catalog,storage});return {audio,player,storage};}
const settle=()=>new Promise(r=>setImmediate(r));
test('cockpit touch play, pause, resume uses the same audio; stop clears explicit session',async()=>{
 const {audio,player,storage}=setup();await player.toggle();const src=audio.src;audio.currentTime=8;player.pause();assert.equal(player.phase,'paused');await player.toggle();assert.equal(audio.src,src);assert.equal(audio.currentTime,8);player.stop();assert.equal(audio.paused,true);assert.equal(player.phase,'stopped');assert.equal(loadListening(storage,player.ids).checkpoint,null);await player.toggle();assert.equal(audio.currentTime,0);
});
test('natural media completion with pause event advances until catalog exhausted, without repeat',async()=>{
 const {audio,player}=setup();await player.toggle();const ids=[];for(let i=0;i<4;i++){ids.push(player.current.id);audio.end();await settle();}assert.equal(new Set(ids).size,4);assert.equal(player.phase,'exhausted');assert.equal(audio.plays,4);await player.toggle();assert.equal(player.phase,'playing');
});
test('late play promise after stop cannot restart UI or auto queue',async()=>{
 const {audio,player}=setup();let resolve;audio.deferred=new Promise(r=>resolve=r);const pending=player.toggle();player.stop();resolve();await pending;assert.equal(player.phase,'stopped');assert.equal(player.auto,false);assert.equal(audio.paused,true);audio.end();await settle();assert.equal(audio.plays,1);
});
test('resume loads real metadata and seeks stored checkpoint before playback',async()=>{
 const {audio,storage}=setup();saveListening(storage,{taste:'story',checkpoint:{id:'story',seconds:12,duration:60}},catalog.map(c=>c.id));const player=new CockpitPlayer({audio,catalog,storage});await player.toggle();assert.equal(audio.currentTime,12);assert.equal(player.current.id,'story');assert.equal(player.phase,'playing');
});
test('invalid saved offset fails closed and explicit retry starts from beginning',async()=>{
 const {audio,storage}=setup();saveListening(storage,{taste:'story',checkpoint:{id:'story',seconds:12,duration:60}},catalog.map(c=>c.id));audio.duration=10;const player=new CockpitPlayer({audio,catalog,storage});await player.toggle();assert.equal(player.phase,'error');assert.equal(audio.plays,0);assert.equal(loadListening(storage,player.ids).checkpoint,null);await player.toggle();assert.equal(player.phase,'playing');
});
test('play rejection does not auto retry and explicit touch can retry',async()=>{
 const {audio,player}=setup();audio.reject=true;await player.toggle();assert.equal(player.phase,'error');await settle();assert.equal(audio.plays,1);audio.reject=false;await player.toggle();assert.equal(player.phase,'playing');
});
test('suspend saves checkpoint, pauses audio and only explicit resume reactivates auto-next',async()=>{
 const {audio,player,storage}=setup();await player.toggle();audio.currentTime=10;player.suspend();assert.equal(loadListening(storage,player.ids).checkpoint.seconds,10);assert.equal(audio.paused,true);assert.equal(player.auto,false);await player.toggle();assert.equal(player.auto,true);
});
test('no storage still plays with taste fallback',async()=>{
 const audio=new Audio();const player=new CockpitPlayer({audio,catalog,storage:null});await player.toggle();assert.equal(player.current.topic,'story');assert.equal(player.phase,'playing');player.stop();assert.equal(audio.paused,true);
});
test('pause before ended flag still advances once; duplicate ended during loading is ignored',async()=>{
 const {audio,player}=setup();await player.toggle();const id=player.current.id;audio.pause();audio.ended=true;audio.dispatchEvent(new Event('ended'));await settle();assert.notEqual(player.current.id,id);assert.equal(audio.plays,2);
});
test('stop cancels pending resume seek and removes event waiters',async()=>{
 const {audio,storage}=setup();saveListening(storage,{taste:'story',checkpoint:{id:'story',seconds:12,duration:60}},catalog.map(c=>c.id));audio.load=()=>{};const player=new CockpitPlayer({audio,catalog,storage});const pending=player.toggle();player.stop();audio.dispatchEvent(new Event('loadedmetadata'));await pending;assert.equal(audio.plays,0);assert.equal(player.phase,'stopped');assert.equal(player.cancelWait,null);
});
test('media error mid-play stops auto continuation and dispose detaches callbacks',async()=>{
 const {audio,player,storage}=setup();await player.toggle();audio.dispatchEvent(new Event('error'));assert.equal(player.phase,'error');assert.equal(player.auto,false);assert.equal(loadListening(storage,player.ids).checkpoint,null);player.dispose();audio.end();assert.equal(player.phase,'disposed');assert.equal(audio.plays,1);
});
