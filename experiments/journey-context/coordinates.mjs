// Synthetic-coordinate experiment. SDK timestamp semantics are not yet established.
const validPoint = p => p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 &&
  Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
export function distanceMeters(a,b) {
  const rad=Math.PI/180;
  const dLat=(b.latitude-a.latitude)*rad, dLon=(b.longitude-a.longitude)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLon/2)**2;
  return 6_371_000*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
}

// Bounded monotone alignment to recorded samples, not road map matching or a probability model.
export function inferCoordinateJourney({history=[],observations=[],profile,consent,permission,
  source,startedAtMs,nowMs,toleranceMeters=60,maxAdvance=2,maxAgeMs=30_000,maxGapMs=30_000}) {
  const unknown=reason=>({status:'unknown',reason,candidates:[],purposeHint:null});
  if(!Array.isArray(history)||!Array.isArray(observations))return unknown('invalid-input');
  if(history.length>128||observations.length>256||history.some(r=>Array.isArray(r?.points)&&r.points.length>512))return unknown('input-limit');
  let comparisons=0;
  if(source!=='synthetic')return unknown('unverified-source-clock');
  if(!profile||!consent||!permission)return unknown('unavailable');
  if(!Number.isFinite(nowMs)||!Number.isFinite(startedAtMs)||startedAtMs>nowMs||
    !Number.isFinite(toleranceMeters)||toleranceMeters<=0||!Number.isInteger(maxAdvance)||maxAdvance<1||maxAdvance>16||!Number.isFinite(maxGapMs)||maxGapMs<=0||
    !Number.isFinite(maxAgeMs)||maxAgeMs<0)return unknown('invalid-configuration');
  if(!Array.isArray(observations)||!observations.length)return unknown('no-observation');
  let previous=startedAtMs,hasPrevious=false;
  for(const p of observations){
    if(!validPoint(p)||!Number.isFinite(p.observedAtMs)||p.observedAtMs<previous||p.observedAtMs>nowMs)
      return unknown('invalid-observation');
    if(hasPrevious&&p.observedAtMs-previous>maxGapMs)return unknown('observation-gap');
    previous=p.observedAtMs;hasPrevious=true;
  }
  if(nowMs-previous>maxAgeMs)return unknown('stale');
  const candidates=[];
  for(const route of history){
    if(!route||route.profile!==profile||!Number.isFinite(route.endedAtMs)||route.endedAtMs>=startedAtMs||
      !Array.isArray(route.points)||!route.points.length||!route.points.every(validPoint))continue;
    if(distanceMeters(observations[0],route.points[0])>toleranceMeters)continue;
    let positions=new Set([0]);
    for(const sample of observations.slice(1)){
      const next=new Set();
      for(const position of positions)
        for(let j=position;j<=Math.min(route.points.length-1,position+maxAdvance);j++){
          if(++comparisons>200_000)return unknown('comparison-limit');
          if(distanceMeters(sample,route.points[j])<=toleranceMeters)next.add(j);
        }
      positions=next;if(!positions.size)break;
    }
    if(positions.size)candidates.push({id:route.id,purpose:route.confirmedPurpose||null});
  }
  if(!candidates.length)return unknown('no-pattern');
  const purposes=new Set(candidates.map(c=>c.purpose));
  return {status:'hypothesis',reason:'synthetic-coordinate-alignment',candidates,
    purposeHint:purposes.size===1?[...purposes][0]:null};
}
