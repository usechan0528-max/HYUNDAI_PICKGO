export const STORAGE_KEY='journey-demo-listening-v1';
// Bump when the bundled takes change: preserve taste, discard stale offsets.
const MEDIA_REVISION='supertonic3-f3-2026-11-02';
const TTL=7*24*60*60*1000;
const tastes=new Set(['story','reflection']);
function clean(value,ids,now){
 if(!value||value.version!==1||!tastes.has(value.taste)||!Number.isFinite(value.savedAt)||
 value.savedAt>now||now-value.savedAt>TTL)return null;
 let checkpoint=null;
 const c=value.checkpoint;
 if(value.mediaRevision===MEDIA_REVISION&&c&&ids.includes(c.id)&&Number.isFinite(c.seconds)&&Number.isFinite(c.duration)&&
 c.seconds>=1&&c.duration>1&&c.duration<=3600&&c.seconds<c.duration-1)
 checkpoint={id:c.id,seconds:c.seconds,duration:c.duration};
 return {version:1,taste:value.taste,checkpoint,savedAt:value.savedAt};
}
export function loadListening(storage,ids,now=Date.now()){
 try{const raw=storage.getItem(STORAGE_KEY);if(!raw||raw.length>2048)return null;
 return clean(JSON.parse(raw),ids,now);}catch{return null;}
}
export function saveListening(storage,{taste,checkpoint},ids,now=Date.now()){
 const value=clean({version:1,mediaRevision:MEDIA_REVISION,taste,checkpoint,savedAt:now},ids,now);if(!value)return false;
 try{storage.setItem(STORAGE_KEY,JSON.stringify({...value,mediaRevision:MEDIA_REVISION}));return true;}catch{return false;}
}
export function clearListening(storage){try{storage.removeItem(STORAGE_KEY);return true;}catch{return false;}}
