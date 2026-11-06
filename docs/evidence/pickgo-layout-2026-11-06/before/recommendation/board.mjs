import { assessPickup } from './eligibility.mjs';
import { randomUUID } from 'node:crypto';
import { PhoneBoard } from '../phone-domain.mjs';
import { Fault, VIEW_TTL, PLACES } from '../domain.mjs';
import { rankCandidates, freshFix, POLICY } from './engine.mjs';
import { unavailableProvider } from './providers.mjs';
const check=(ok,status,message)=>{if(!ok)throw new Fault(status,message);};
const uuid=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x);
export class RecommendationBoard extends PhoneBoard {
  constructor(now=Date.now,mono=()=>performance.now(),provider=unavailableProvider) {
    super(now,mono); this.provider=provider; this.recommendations=new Map(); this.recLastMono=mono(); this.placeEvidence=new Map(); this.placeEntrances=new Map();
  }
  assertSelectable(place) {
    // A provider may supply current server-owned evidence even for manual choices.
    const current=this.provider.selectionEvidence?.(place) ?? {};
    check(assessPickup(current).selectable && assessPickup(this.placeEvidence.get(place)).selectable,409,'정차 금지 또는 차량 접근 불가 지점은 선택할 수 없습니다.');
  }
  create(place, ...args) { this.assertSelectable(place); return super.create(place,...args); }
  sweep() {
    super.sweep(); if(!this.recommendations)return;
    const at=this.mono(), invalid=!Number.isFinite(at)||at<this.recLastMono; this.recLastMono=at;
    for(const [id,e] of this.recommendations){
      const r=this.rooms.get(id); if(!r){this.recommendations.delete(id);continue;}
      for(const role of ['driver','rider']){
        const p=e[role];
        if(invalid||r.status!=='active'||r.stage==='boarded'||(p.grant&&at>=p.grant.until)){p.grant=null;p.fix=null;e.snapshot=null;}
        if(p.fix&&!freshFix(p.fix,at)){p.fix=null;e.snapshot=null;}
      }
      if(e.snapshot&&at>=e.snapshot.until)e.snapshot=null;
      // Keep only proposal binding so ordinary /actions cannot bypass revalidation.
      // Derived route summaries disappear with either party's location/consent.
      if(e.proposal&&(!e.driver.fix||!e.rider.fix||!e.driver.grant||!e.rider.grant))e.proposal.summary=null;
    }
  }
  entry(id){
    if(!this.recommendations.has(id))this.recommendations.set(id,{driver:{used:new Set(),grant:null,fix:null},rider:{used:new Set(),grant:null,fix:null},snapshot:null,proposal:null,revision:0,busy:false});
    return this.recommendations.get(id);
  }
  active(r){check(r.status==='active'&&r.stage!=='boarded'&&r.joined,409,'상대 참여와 탑승 전 회차를 확인해 주세요.');}
  clearConsent(e){for(const role of ['driver','rider']){e[role].grant=null;e[role].fix=null;}e.snapshot=null;if(e.proposal)e.proposal.summary=null;e.revision++;}
  context(r,credential,input){check(r.version===input.version&&(r.views.get(credential)||[]).some(v=>v.key===input.view&&this.now()-v.at>=0&&this.now()-v.at<VIEW_TTL),409,'최신 회차를 다시 확인해 주세요.');}
  async recommend(id,credential,input=null){
    const r=this.room(id),role=this.auth(r,credential); this.sweep(); const e=this.entry(id),p=e[role];
    if(!input)return this.status(e,role);
    check(input&&typeof input==='object',400,'추천 요청을 확인해 주세요.');
    if(input.type==='revoke'){
      check(uuid(input.consentId),400,'동의 식별자가 필요합니다.');
      if(p.used.size<100)p.used.add(input.consentId);
      if(p.grant?.id===input.consentId){p.grant=null;p.fix=null;e.snapshot=null;e.revision++;}
      this.sweep();
      return this.status(e,role);
    }
    this.active(r);
    if(['grant','publish'].includes(input.type))check(this.provider!==unavailableProvider&&this.provider.mode==='synthetic',409,'실제 추천 위치 기능이 연결되지 않아 수집하지 않습니다.');
    if(input.type==='grant'){
      this.context(r,credential,input);
      check(input.consent==='pickup-recommendation-continuous-v1'&&uuid(input.consentId),400,'추천용 연속 위치 공유에 별도로 동의해 주세요.');
      check(p.used.size<100,429,'이 회차의 위치 동의 한도(100회)를 사용했습니다. 새 회차가 필요합니다.');
      check(!p.used.has(input.consentId),409,'새 동의가 필요합니다.');
      p.used.add(input.consentId);p.grant={id:input.consentId,until:this.mono()+600000,sequence:-1};p.fix=null;e.snapshot=null;e.revision++;
    }else if(input.type==='publish'){
      check(p.grant&&p.grant.id===input.consentId,409,'공유 동의가 만료되거나 철회되었습니다.');
      check(Number.isSafeInteger(input.sequence)&&input.sequence>p.grant.sequence,409,'이전 위치 갱신입니다.');
      const f=input.fix;
      const fix=f&&{id:randomUUID(),at:this.mono(),latitude:f.latitude,longitude:f.longitude,accuracy:f.accuracy,ageMs:f.ageMs};
      check(freshFix(fix,this.mono()),400,'위치 시각 또는 정확도를 확인할 수 없습니다.');
      check(input.source===(this.provider.mode==='synthetic'?'synthetic':role==='rider'?'browser-geolocation':'verified-vehicle'),400,'위치 출처가 일치하지 않습니다.');
      // Native authenticated SDK publisher is not connected. Browser cannot impersonate it.
      check(this.provider.mode==='synthetic'||role==='rider',409,'실제 차량 위치 연결이 준비되지 않았습니다.');
      p.grant.sequence=input.sequence;p.fix=fix;e.snapshot=null;e.revision++;
    }else if(input.type==='calculate'||input.type==='accept'||input.type==='select'){
      const accepting=input.type==='accept',selecting=input.type==='select';
      let selected;
      if(selecting){
        this.context(r,credential,input);
        const s=e.snapshot;
        check(s&&s.id===input.snapshotId&&s.version===r.version&&s.revision===e.revision,409,'추천이 만료되었습니다. 다시 계산해 주세요.');
        selected=s.candidates.find(c=>c.id===input.candidateId);check(selected,400,'추천 장소를 선택해 주세요.');
      }
      if(accepting){this.context(r,credential,input);check(r.proposal?.origin==='recommendation'&&e.proposal&&e.proposal.proposalId===r.proposal.id&&input.proposalId===r.proposal.id&&r.proposal.by!==role,409,'상대의 현재 추천 제안을 확인해 주세요.');}
      if(this.provider===unavailableProvider)return {...this.status(e,role),status:'provider-unavailable'};
      check(!e.busy,429,'추천 계산 중이거나 공급자 응답이 중단됐습니다. 계속 실패하면 새 회차에서 다시 시도해 주세요.');
      check(e.driver.grant&&e.rider.grant&&freshFix(e.driver.fix,this.mono())&&freshFix(e.rider.fix,this.mono()),409,'양측의 새 위치 공유가 필요합니다.');
      const rev=e.revision,version=r.version; e.busy=true; e.snapshot=null;
      let timer,settled=false;const abort=new AbortController();
      try{
        const work=Promise.resolve().then(()=>this.provider.evaluate({driver:{...e.driver.fix},rider:{...e.rider.fix},now:this.mono(),wall:this.now(),signal:abort.signal})).finally(()=>{settled=true;e.busy=false;});
        const data=await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(new Error('timeout'));},3000);})]);
        this.sweep();this.active(r);
        check(rev===e.revision&&version===r.version&&e.driver.grant&&e.rider.grant&&freshFix(e.driver.fix,this.mono())&&freshFix(e.rider.fix,this.mono()),409,'위치나 약속이 변경되었습니다. 다시 계산해 주세요.');
        // This prototype selects names, so a name must bind to one stable entrance.
        // Reject ambiguous/rebound entrances before any restriction can be overwritten.
        const entrances=new Map(this.placeEntrances);
        for(const c of data?.candidates??[])if(PLACES.includes(c?.name)){
          if(entrances.has(c.name)&&entrances.get(c.name)!==c.entranceId)return {...this.status(e,role),status:'provider-invalid'};
          entrances.set(c.name,c.entranceId);
        }
        this.placeEntrances=entrances;
        // Store only normalized restriction facts, not raw locations, for manual-path guards.
        for(const c of data?.candidates??[])if(PLACES.includes(c?.name)&&c.mode===this.provider.mode&&c.evidence?.entranceId===c.entranceId&&c.evidence.mode===this.provider.mode&&
            Number.isFinite(c.evidence.checkedAt)&&c.evidence.checkedAt<=this.now()&&this.now()-c.evidence.checkedAt<POLICY.evidenceMaxAgeMs&&
            c.evidence.validFrom<=this.now()&&c.evidence.validUntil>this.now()){
          const {stopProhibited,prohibited,pickupAllowed,vehicleAllowed,closed,publicTransportOnly,taxiOnly,physicallyAccessible,positionType,maxDwellSeconds}=c.evidence;
          const facts={stopProhibited,prohibited,pickupAllowed,vehicleAllowed,closed,publicTransportOnly,taxiOnly,physicallyAccessible,positionType,maxDwellSeconds};
          this.placeEvidence.set(c.name,{...this.placeEvidence.get(c.name),...Object.fromEntries(Object.entries(facts).filter(([,v])=>v!==undefined))});
        }
        const ranked=rankCandidates({...data,candidates:Array.isArray(data?.candidates)?data.candidates.filter(c=>PLACES.includes(c?.name)):data?.candidates,driver:e.driver.fix,rider:e.rider.fix,mode:this.provider.mode},this.mono(),this.now());
        // Current Board only supports the named synthetic destinations. Live catalog binding remains gated.
        ranked.candidates=ranked.candidates.filter(c=>this.provider.mode==='synthetic'&&PLACES.includes(c.name)&&assessPickup(this.placeEvidence.get(c.name)).selectable&&assessPickup(this.provider.selectionEvidence?.(c.name)??{}).selectable);
        if(ranked.status==='ready'&&!ranked.candidates.length)ranked.status='catalog-unavailable';
        if(accepting){
          this.assertSelectable(r.proposal?.place);
          check(ranked.candidates.some(c=>c.id===e.proposal?.candidateId&&c.name===r.proposal?.place),409,'현재 위치와 근거로 제안 지점을 추천할 수 없습니다. 제안을 거절하거나 철회해 주세요.');
          this.context(r,credential,input);
          super.act(id,credential,{...input,type:'accept'});this.clearConsent(e);e.proposal=null;
          return {...this.status(e,role),accepted:true};
        }
        if(selecting){
          const c=ranked.candidates.find(c=>c.id===selected.id&&c.name===selected.name);
          check(c,409,'지점 조건이 변경되었습니다. 다시 추천해 주세요.');
          this.assertSelectable(c.name);this.context(r,credential,input);
          const result=super.act(id,credential,{...input,type:'propose',place:c.name});
          r.proposal.origin='recommendation';
          e.proposal={proposalId:result.proposal.id,candidateId:c.id,summary:{...c},summaryUntil:this.mono()+ranked.remainingMs};
          return {...this.status(e,role),proposed:true};
        }
        if(ranked.candidates.length)e.snapshot={...ranked,id:randomUUID(),until:this.mono()+ranked.remainingMs,revision:rev,version};
        return {...this.status(e,role),status:ranked.status};
      }catch(err){if(err instanceof Fault)throw err;return {...this.status(e,role),status:'provider-unavailable'};}
      finally{clearTimeout(timer);abort.abort();if(settled)e.busy=false;}
    }else throw new Fault(400,'알 수 없는 추천 요청입니다.');
    return this.status(e,role);
  }
  status(e,role){const s=e.snapshot;return {mode:this.provider.mode,status:this.provider===unavailableProvider?'provider-unavailable':s?'ready':'waiting',sharing:!!e[role].grant,shareRemainingMs:e[role].grant?Math.max(0,e[role].grant.until-this.mono()):0,driverFresh:!!e.driver.fix,riderFresh:!!e.rider.fix,proposalEvidence:e.proposal?.summary?{...e.proposal.summary,stale:this.mono()>=e.proposal.summaryUntil}:null,snapshot:s?{id:s.id,candidates:s.candidates,remainingMs:Math.max(0,s.until-this.mono())}:null};}
  act(id,credential,command){
    this.sweep(); const e=this.recommendations.get(id),r=this.room(id);
    if(command?.type==='accept'&&r.proposal?.origin==='recommendation'){
      throw new Fault(409,'추천 화면에서 최신 경로와 정차 근거를 다시 확인하고 수락해 주세요.');
    }
    if(command?.type==='propose')this.assertSelectable(command.place);
    if(command?.type==='accept')this.assertSelectable(r.proposal?.place);
    const result=super.act(id,credential,command);
    if(e){e.snapshot=null;if(command.type==='accept')this.clearConsent(e);if(['accept','reject','withdraw','end'].includes(command.type))e.proposal=null;}
    this.sweep();return result;
  }
}
