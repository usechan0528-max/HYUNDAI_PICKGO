// Only source/access/transport diagnostics. Never a location or freshness certificate.
const keys=['source','generation','sequence','state','sampleCount','clockStatus'].sort();
const states=new Set(['WAITING','CALLBACK','REVOKED','ACCESS_DENIED','STOPPED','ERROR']);
export function validSdkEnvelope(value){
 return value&&typeof value==='object'&&!Array.isArray(value)&&
 JSON.stringify(Object.keys(value).sort())===JSON.stringify(keys)&&
 value.source==='pleos-sdk-1.1.3'&&value.clockStatus==='UNVERIFIED_CLOCK'&&states.has(value.state)&&
 Number.isSafeInteger(value.generation)&&value.generation>0&&Number.isSafeInteger(value.sequence)&&value.sequence>=0&&
 Number.isSafeInteger(value.sampleCount)&&value.sampleCount>=0;
}
export class SdkStatusStore {
 #value=null;#at=0;
 accept(value,receivedAtMs){
  if(!validSdkEnvelope(value)||!Number.isFinite(receivedAtMs)||receivedAtMs<0)return false;
  const old=this.#value;
  if(old&&(receivedAtMs<this.#at||value.generation<old.generation||
    (value.generation===old.generation&&(value.sequence<=old.sequence||value.sampleCount<old.sampleCount))))return false;
  if(old&&value.generation>old.generation&&value.sequence!==0)return false;
  this.#value={...value};this.#at=receivedAtMs;return true;
 }
 read(nowMs){
  if(!this.#value)return {state:'NO_BRIDGE',clockStatus:'UNVERIFIED_CLOCK',sampleCount:0};
  if(!Number.isFinite(nowMs)||nowMs<this.#at||nowMs-this.#at>5000)return {state:'NO_RECENT_STATUS',clockStatus:'UNVERIFIED_CLOCK',sampleCount:this.#value.sampleCount};
  return {state:this.#value.state,clockStatus:'UNVERIFIED_CLOCK',sampleCount:this.#value.sampleCount};
 }
}
export function sdkUnknownContext(){return {status:'unknown',reason:'unverified-sdk-clock',candidates:[],purposeHint:null};}
export function sdkStatusText(value){
 if(!value||value.clockStatus!=='UNVERIFIED_CLOCK')return 'SDK 상태 확인 불가 · 취향만 사용합니다.';
 if(value.state==='NO_BRIDGE')return 'SDK 상태 연결 대기 · 취향만 사용합니다.';
 if(value.state==='NO_RECENT_STATUS')return '최근 SDK 상태 갱신 없음 · 취향만 사용합니다.';
 if(value.state==='CALLBACK')return '실제 SDK 입력 수신 · 관측 시각 미확인으로 취향만 사용합니다.';
 if(value.state==='ACCESS_DENIED')return 'SDK 위치 권한 없음 · 취향만 사용합니다.';
 if(value.state==='REVOKED'||value.state==='STOPPED')return 'SDK 수집 종료 · 취향만 사용합니다.';
 if(value.state==='WAITING')return '실제 SDK 입력 대기 · 취향만 사용합니다.';
 return 'SDK 입력 연결 끊김 또는 오류 · 취향만 사용합니다.';
}
