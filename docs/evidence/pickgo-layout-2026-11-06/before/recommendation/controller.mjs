export class ContinuousShare {
  constructor({geo,send,allowed,notify=()=>{},mono=()=>performance.now(),wall=Date.now}){Object.assign(this,{geo,send,allowed,notify,mono,wall});this.generation=0;this.current=null;}
  async start(context,{synthetic=false,longitude=127}={}){
    if(this.current||!this.allowed())return;
    const generation=++this.generation,consentId=crypto.randomUUID();
    const c=this.current={consentId,generation,watch:null,timer:null,sequence:0,busy:false,until:this.mono()+600000};
    try{
      await this.send({...context,type:'grant',consentId,consent:'pickup-recommendation-continuous-v1'});
      if(this.current!==c){await this.send({type:'revoke',consentId},true).catch(()=>{});return;}
      if(!this.allowed()){await this.stop();return;}
      const publish=async (fix,sampledAt=this.mono())=>{
        if(this.current!==c||!this.allowed()||this.mono()>=c.until){if(this.current===c)await this.stop();return;}
        if(c.busy){c.pending={fix,sampledAt};return;}c.busy=true;
        try{await this.send({type:'publish',consentId,sequence:c.sequence++,source:synthetic?'synthetic':'browser-geolocation',fix:{...fix,ageMs:fix.ageMs+Math.max(0,this.mono()-sampledAt)}});if(this.current===c)this.notify('위치 공유 중 · 마지막 수신 위치를 사용합니다.');}
        catch{if(this.current===c)await this.stop('위치 갱신에 실패해 공유를 중지했습니다.');}finally{c.busy=false;const pending=c.pending;c.pending=null;if(pending&&this.current===c)void publish(pending.fix,pending.sampledAt);}
      };
      if(synthetic){const sample=()=>publish({latitude:37,longitude,accuracy:5,ageMs:0});await sample();if(this.current===c)c.timer=setInterval(sample,8000);}
      else{
        const watch=this.geo.watchPosition(p=>{
          if(this.current!==c)return;
          const ageMs=this.wall()-p.timestamp;
          if(!Number.isFinite(ageMs)||ageMs<0||ageMs>=15000){void this.stop('위치가 오래되어 중지했습니다.');return;}
          void publish({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,ageMs});
        },()=>{if(this.current===c)void this.stop('위치 권한 또는 수신 오류로 중지했습니다.');},{enableHighAccuracy:true,maximumAge:0,timeout:10000});
        if(this.current===c)c.watch=watch;else this.geo.clearWatch(watch);
      }
    }catch{if(this.current===c)await this.stop('위치 공유를 시작하지 못했습니다.');}
  }
  async stop(message='공유를 중지했습니다.'){
    const c=this.current;this.current=null;this.generation++;
    if(c){c.pending=null;if(c.watch!==null)this.geo?.clearWatch(c.watch);clearInterval(c.timer);
      try{await this.send({type:'revoke',consentId:c.consentId},true);}catch{message+=' 서버 삭제 미확인 · 마지막 위치는 관측 후 15초에 조회 만료됩니다.';}}
    this.notify(message);
  }
}
