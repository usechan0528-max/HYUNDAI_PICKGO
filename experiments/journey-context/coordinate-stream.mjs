import {inferCoordinateJourney} from './coordinates.mjs';

const unknown = reason => ({status:'unknown',reason,candidates:[],purposeHint:null});
// Synthetic clock contract only: observation and receive times share one clock.
// No timers, persistence or SDK callbacks. The owner must revoke on consent/permission loss.
export class CoordinateStream {
  #active=null;
  #reason='not-started';
  begin({profile,consent,permission,source,startedAtMs}={}) {
    this.revoke('invalid-start');
    if(source!=='synthetic'){this.#reason='unverified-source-clock';return null;}
    if(typeof profile!=='string'||!profile||consent!==true||permission!==true||
      !Number.isFinite(startedAtMs)||startedAtMs<0)return null;
    const token=Symbol('coordinate-session');
    this.#active={token,profile,startedAtMs,lastReceivedAtMs:startedAtMs,lastNowMs:startedAtMs,points:[]};
    return token;
  }
  revoke(reason='revoked') {this.#active=null;this.#reason=reason;}
  push(token,sample,receivedAtMs) {
    const s=this.#active;
    if(!s||token!==s.token)return {accepted:false,reason:'inactive-session'};
    const reject=reason=>{this.revoke(reason);return {accepted:false,reason};};
    if(!Number.isFinite(receivedAtMs)||receivedAtMs<s.lastReceivedAtMs||receivedAtMs<s.lastNowMs)
      return reject('invalid-receive-clock');
    try {
      if(sample) {
        const {latitude,longitude,observedAtMs}=sample;
        sample={latitude,longitude,observedAtMs};
      }
    } catch { return reject('invalid-sample'); }
    if(!sample||!Number.isFinite(sample.latitude)||Math.abs(sample.latitude)>90||
      !Number.isFinite(sample.longitude)||Math.abs(sample.longitude)>180||
      !Number.isFinite(sample.observedAtMs)||sample.observedAtMs<s.startedAtMs||sample.observedAtMs>receivedAtMs)
      return reject('invalid-observation');
    const previous=s.points.at(-1);
    if(previous&&sample.observedAtMs<=previous.observedAtMs)return reject('non-increasing-observation');
    if(sample.observedAtMs-(previous?.observedAtMs??s.startedAtMs)>30_000)
      return reject(previous?'observation-gap':'first-observation-delay');
    if(receivedAtMs-sample.observedAtMs>30_000)return reject('stale-on-arrival');
    if(!previous&&receivedAtMs-s.startedAtMs>30_000)return reject('first-observation-delay');
    if(s.points.length>=256)return reject('input-limit');
    // Copy only the contract fields: caller mutation and SDK extras never enter retained input.
    s.points.push({latitude:sample.latitude,longitude:sample.longitude,observedAtMs:sample.observedAtMs});
    s.lastReceivedAtMs=receivedAtMs;
    return {accepted:true,count:s.points.length};
  }
  context(history,nowMs) {
    const s=this.#active;
    if(!s)return unknown(this.#reason);
    if(!Number.isFinite(nowMs)||nowMs<s.lastReceivedAtMs||nowMs<s.lastNowMs){
      this.revoke('invalid-read-clock');return unknown(this.#reason);
    }
    s.lastNowMs=nowMs;
    if(!s.points.length&&nowMs-s.startedAtMs>30_000){
      this.revoke('first-observation-delay');return unknown(this.#reason);
    }
    return inferCoordinateJourney({history,observations:s.points,profile:s.profile,
      consent:true,permission:true,source:'synthetic',startedAtMs:s.startedAtMs,nowMs});
  }
}
