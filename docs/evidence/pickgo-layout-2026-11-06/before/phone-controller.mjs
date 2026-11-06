// Injected browser/service ports permit synthetic tests without collecting real location.
export class PhoneShare {
  constructor({ geo, send, allowed, notify, wall = Date.now, mono = () => performance.now(), schedule = setTimeout, cancel = clearTimeout, id = () => crypto.randomUUID() }) {
    Object.assign(this,{geo,send,allowed,notify,wall,mono,schedule,cancel,id}); this.generation=0; this.current=null; this.watch=null; this.timer=null; this.phase='idle';
  }
  clear() { if(this.watch !== null) this.geo.clearWatch(this.watch); this.watch=null; if(this.timer !== null) this.cancel(this.timer); this.timer=null; }
  async stop(message='이 기기에서 공유를 중지했습니다.') {
    const old=this.current; ++this.generation; this.clear(); this.current=null; this.phase='idle';
    this.notify(old ? `${message} 서버 삭제 확인 중입니다.` : message);
    if (!old) return;
    try { await this.send({type:'revoke',consentId:old},true); if(!this.current) this.notify(`${message} 서버 삭제를 확인했습니다.`); }
    catch { if(!this.current) this.notify(`${message} 서버 삭제 미확인 · 마지막 전송 후 최대 30초에 만료됩니다.`); }
  }
  async start(snapshot) {
    if(this.current || !this.allowed() || !this.geo) return;
    const generation=++this.generation, consentId=this.id(), started=this.wall(), deadline=this.mono()+15000;
    this.current=consentId; this.phase='grant'; this.notify('동의 확인 중입니다. 아직 위치를 수집하지 않습니다.');
    const live=()=>this.generation===generation && this.current===consentId && this.allowed() && this.mono()<deadline;
    this.timer=this.schedule(()=>{ if(this.generation===generation) void this.stop('위치 확인 시간이 초과되었습니다.'); },15000);
    try {
      await this.send({type:'grant',consentId,consent:'pickup-location-once-v1',version:snapshot.version,view:snapshot.view});
      if(!live()) { if(this.generation===generation) await this.stop(); return; }
      this.phase='collecting'; this.notify('브라우저 위치 권한을 허용하면 한 번만 공유합니다.');
      this.watch=this.geo.watchPosition(async position=>{
        if(!live() || this.phase!=='collecting') return;
        const {latitude,longitude,accuracy}=position.coords, observedAt=position.timestamp;
        if(![latitude,longitude,accuracy,observedAt].every(Number.isFinite) || accuracy<=0 || accuracy>100 || Math.abs(latitude)>90 || Math.abs(longitude)>180 || observedAt<started || this.wall()-observedAt>=15000 || observedAt>this.wall()) {
          await this.stop('정확하거나 새로운 위치를 얻지 못했습니다. 수동 상태 알림을 이용해 주세요.'); return;
        }
        this.clear(); this.phase='sending';
        try {
          await this.send({type:'publish',consentId,fix:{latitude,longitude,accuracy,observedAt,ageMs:this.wall()-observedAt}});
          if(!live()) { if(this.generation===generation) await this.stop(); return; }
          this.phase='shared'; this.notify('이번 회차 운전자에게 1회 공유했습니다. 30초에 조회가 만료되고 다음 정리 주기에 삭제됩니다.');
          this.timer=this.schedule(()=>{ if(this.generation===generation) void this.stop('공유 시간이 끝났습니다.'); },30000);
        } catch (error) { if(this.generation===generation) await this.stop(error.status>=400 && error.status<500?'서버가 위치를 받지 않았습니다. 다시 확인하고 동의해 주세요.':'전송 결과를 확인하지 못했습니다.'); }
      }, async error=>{ if(this.generation===generation) await this.stop(error.code===1?'위치 권한이 거부되었습니다.':error.code===3?'위치 확인 시간이 초과되었습니다.':'위치를 확인할 수 없습니다.'); },{maximumAge:0,timeout:10000,enableHighAccuracy:true});
    } catch (error) { if(this.generation===generation) await this.stop(error.status===429?'이 회차의 위치 공유 요청 한도를 초과했습니다. 수동 상태 알림을 이용해 주세요.':error.status===409?'회차 상태가 바뀌었습니다. 새로 확인한 뒤 다시 동의해 주세요.':'동의를 확인하지 못했습니다. 새로 확인한 뒤 다시 선택해 주세요.'); }
  }
}
