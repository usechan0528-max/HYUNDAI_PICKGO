import {recommend} from '../core.mjs';
import {loadListening,saveListening} from './listening-store.mjs';

// Touch-first player. Location status cannot enter the recommendation context.
export class CockpitPlayer {
 constructor({audio,catalog,storage,onChange=()=>{}}){
  Object.assign(this,{audio,catalog,storage,onChange});
  this.ids=catalog.map(x=>x.id);const saved=loadListening(storage,this.ids);
  this.taste=saved?.taste||'story';this.resume=saved?.checkpoint||null;
  this.phase='ready';this.current=null;this.recent=[];this.generation=0;this.auto=false;this.cancelWait=null;this.lastSavedSecond=-1;
  this.listeners=[];
  const on=(name,fn)=>{audio.addEventListener(name,fn);this.listeners.push([name,fn]);};
  on('timeupdate',()=>{const second=Math.floor(audio.currentTime);if(this.phase==='playing'&&second!==this.lastSavedSecond&&second%2===0){this.lastSavedSecond=second;this.persist();}});
  on('pause',()=>{if(this.phase==='playing'&&!audio.ended){this.phase='paused';this.emit();}});
  on('ended',()=>{if(!audio.ended||!['playing','paused'].includes(this.phase))return;this.resume=null;this.persist(true);this.phase='ended';if(this.auto)void this.startNew();else{this.current=null;this.phase='exhausted';this.emit();}});
  on('error',()=>{if(!['ready','stopped','disposed'].includes(this.phase))this.fail();});
 }
 next(){
  const id=this.resume?.id||recommend({catalog:this.catalog,preferences:{topics:{story:this.taste==='story'?3:1,reflection:this.taste==='reflection'?3:1}},context:{status:'unknown',candidates:[]},recent:this.recent,currentId:this.current?.id})?.id;
  return this.catalog.find(x=>x.id===id)||null;
 }
 snapshot(){return {phase:this.phase,item:this.current||this.next(),resuming:!!this.resume,canStart:this.phase==='exhausted'||!!(this.current||this.next()),canStop:['loading','playing','paused','error'].includes(this.phase)};}
 emit(){this.onChange(this.snapshot());}
 persist(completed=false){
  let checkpoint=this.resume;
  if(this.current&&this.audio.readyState>0)checkpoint=completed?null:{id:this.current.id,seconds:this.audio.currentTime,duration:this.audio.duration};
  saveListening(this.storage,{taste:this.taste,checkpoint},this.ids);
 }
 invalidate(){this.generation++;this.cancelWait?.();this.cancelWait=null;}
 wait(event,action){return new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);this.audio.removeEventListener(event,done);this.audio.removeEventListener('error',bad);if(this.cancelWait===cancel)this.cancelWait=null;};
  const done=()=>{cleanup();resolve();},bad=()=>{cleanup();reject(new Error('media'));},cancel=()=>{cleanup();reject(new Error('cancelled'));};
  const timer=setTimeout(bad,5000);this.cancelWait=cancel;this.audio.addEventListener(event,done);this.audio.addEventListener('error',bad);try{action();}catch{bad();}
 });}
 async toggle(){
  if(['loading','disposed'].includes(this.phase))return;
  if(this.phase==='playing'){this.pause();return;}
  if(this.phase==='paused'&&this.current){this.auto=true;await this.playCurrent();return;}
  if(this.phase==='exhausted'){this.current=null;this.recent=[];}
  if(this.phase==='error'){this.audio.pause();this.current=null;this.recent=[];this.resume=null;}
  this.auto=true;await this.startNew();
 }
 pause(){if(this.phase!=='playing')return;this.persist();this.phase='paused';this.audio.pause();this.emit();}
 async playCurrent(){
  const generation=++this.generation;this.phase='loading';this.emit();
  try{await this.audio.play();if(generation!==this.generation)return;this.phase=this.audio.paused?'paused':'playing';this.emit();}
  catch{if(generation===this.generation)this.fail();}
 }
 async startNew(){
  const next=this.next();
  if(!next){this.current=null;this.phase='exhausted';this.auto=false;this.emit();return;}
  const seconds=this.resume?.id===next.id?this.resume.seconds:0;
  this.invalidate();const generation=this.generation;this.phase='loading';this.lastSavedSecond=-1;this.audio.pause();this.current=next;this.audio.src=`/audio/${next.id}.wav`;this.emit();
  try{
   if(seconds){await this.wait('loadedmetadata',()=>this.audio.load());if(generation!==this.generation)return;
    if(!Number.isFinite(this.audio.duration)||seconds>=this.audio.duration-1)throw new Error('invalid resume');
    await this.wait('seeked',()=>{this.audio.currentTime=seconds;});if(generation!==this.generation)return;
   }
   await this.audio.play();if(generation!==this.generation)return;
   this.resume=null;this.recent.push(next.id);this.phase=this.audio.paused?'paused':'playing';this.emit();
  }catch{if(generation===this.generation)this.fail();}
 }
 fail(){this.invalidate();this.auto=false;this.phase='error';this.resume=null;saveListening(this.storage,{taste:this.taste,checkpoint:null},this.ids);this.audio.pause();this.emit();}
 stop(){
  if(this.phase==='disposed')return;
  this.invalidate();this.auto=false;this.phase='stopped';this.audio.pause();this.audio.removeAttribute('src');this.audio.load();
  this.current=null;this.resume=null;this.recent=[];saveListening(this.storage,{taste:this.taste,checkpoint:null},this.ids);this.emit();
 }
 suspend(){this.persist();this.invalidate();this.auto=false;if(this.phase==='loading'){this.phase='ready';this.audio.pause();this.current=null;this.resume=loadListening(this.storage,this.ids)?.checkpoint||null;}else if(this.phase==='playing'){this.phase='paused';this.audio.pause();}this.emit();}
 dispose(){this.suspend();this.phase='disposed';for(const [name,fn] of this.listeners)this.audio.removeEventListener(name,fn);}
}
