import {distance,nearest,inside,offset,circle} from './geometry.mjs';
export const MAX_DATA_AGE_MS=7*86400000;
const vehicleRoads=new Set(['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','residential','unclassified','service','living_street']);
const prohibitedRoads=new Set(['motorway','motorway_link','trunk','trunk_link','busway','construction','proposed']);
const walkOnly=new Set(['footway','pedestrian','steps','cycleway','path','platform']);
const explicitWidth=t=>/^\d+(?:\.\d+)?\s*m?$/.test(String(t.width??'').trim())?Number.parseFloat(t.width):NaN;
const width=t=>Math.min(35,Math.max(4,explicitWidth(t)||Number.parseFloat(t.lanes)*3.2||({primary:16,secondary:12,tertiary:8,service:5}[t.highway]||6)));
const denied=t=>['no','private'].includes(t.motor_vehicle??t.vehicle??t.access);
const stoppingBan=t=>Object.entries(t).some(([k,v])=> /^(stopping|parking(:.*)?(:restriction)?)$/.test(k)&&(v==='no_stopping'||k==='stopping'&&v==='no'));
export function buildMapModel(data){
  const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
  if(!data||!point(data.anchor?.coordinates)||!Array.isArray(data.bounds)||data.bounds.length!==4||!data.bounds.every(Number.isFinite)||data.bounds[0]>=data.bounds[2]||data.bounds[1]>=data.bounds[3]||!Array.isArray(data.features)||!Number.isFinite(Date.parse(data.retrievedAt)))throw Error('Invalid map dataset');
  for(const f of data.features){
    if(!f.tags||typeof f.id!=='string'||!['Point','LineString','Polygon'].includes(f.type))throw Error('Invalid map feature');
    if(f.type==='Point'?!point(f.coordinates):!Array.isArray(f.coordinates)||f.coordinates.length<2||!f.coordinates.every(point))throw Error('Invalid map geometry');
    if(f.type==='LineString'&&vehicleRoads.has(f.tags.highway)&&(!Array.isArray(f.nodeIds)||f.nodeIds.length!==f.coordinates.length))throw Error('Missing road node identities');
    if(f.holes&&(!Array.isArray(f.holes)||f.holes.some(h=>!Array.isArray(h)||h.length<4||!h.every(point)||distance(h[0],h.at(-1))>0.01)))throw Error('Invalid polygon holes');
    if(f.type==='Polygon'&&(f.coordinates.length<4||distance(f.coordinates[0],f.coordinates.at(-1))>0.01))throw Error('Open polygon ring');
  }
  const roads=data.features.filter(f=>f.type==='LineString'&&vehicleRoads.has(f.tags.highway));
  const zones=[];
  const add=(f,reason,radius=0)=>zones.push({id:f.id+':'+reason,sourceId:f.id,type:f.type,coordinates:f.coordinates,holes:f.holes||[],reason,radius});
  for(const f of data.features){
    const t=f.tags;
    if(f.type==='Polygon'&&t.building&&t.building!=='no')add(f,'건물 내부');
    else if(f.type==='Polygon'&&(t.natural==='water'||t.waterway==='riverbank'))add(f,'수역');
    if(t.highway==='bus_stop'||t.public_transport==='platform'&&t.bus==='yes')add(f,'버스정류장 10m',10);
    if(t.highway==='crossing'||t.footway==='crossing')add(f,'횡단보도 주변 10m',10);
    if(t.emergency==='fire_hydrant')add(f,'소화전 주변 5m',5);
    if(t.amenity==='taxi')add(f,'택시 전용 공간',6);
    if(t.traffic_calming==='island'||t.highway==='traffic_island')add(f,'안전지대 주변 10m',10);
    if(t['zone:traffic']==='KR:school'||t['zone:maxspeed']==='KR:school')add(f,'어린이보호구역 표시',f.type==='LineString'?width(t)/2:0);
    if(f.type==='LineString'){
      if(prohibitedRoads.has(t.highway))add(f,'자동차전용·고속도로 / 전용·공사 차로',width(t)/2+2);
      else if(denied(t)&&vehicleRoads.has(t.highway))add(f,'일반차 접근 제한',width(t)/2);
      else if(stoppingBan(t))add(f,'지도에 표시된 정차 금지',width(t)/2+2);
      else if(walkOnly.has(t.highway))add(f,'보행·자전거 전용 공간',1.5);
      if(t.tunnel==='yes')add(f,'터널',width(t)/2+1);
      if(t.railway&&!['abandoned','disused'].includes(t.railway))add(f,'철도 선로',2);
      if(vehicleRoads.has(t.highway)&&width(t)>=9)add(f,'다차로 도로 중앙',Math.max(1,width(t)/2-1.5));
    }
  }
  // Junction buffers are derived from road graph, not surveyed legal boundaries.
  const junctions=new Map();
  for(const r of roads.filter(r=>!prohibitedRoads.has(r.tags.highway)&&r.tags.tunnel!=='yes'))r.nodeIds?.forEach((id,i)=>{
    const key=`${id}:${r.tags.layer||'0'}`;
    if(!junctions.has(key))junctions.set(key,{point:r.coordinates[i],neighbors:new Set(),w:0,id});
    const j=junctions.get(key);if(i)j.neighbors.add(r.nodeIds[i-1]);if(i+1<r.nodeIds.length)j.neighbors.add(r.nodeIds[i+1]);j.w=Math.max(j.w,width(r.tags));
  });
  for(const j of junctions.values())if(j.neighbors.size>=3)add({id:`junction/${j.id}`,type:'Point',coordinates:j.point},'교차로·모퉁이 추정 보호범위',j.w/2+5);
  function check(point,now=Date.now()){
    const result={selectable:false,point,reasons:[],advisories:['미수록 금지표지·시간대 제한은 현장에서 확인하세요. 선택·정차 책임은 사용자에게 있습니다.']};
    if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)){result.reasons=['좌표 형식 오류'];return result;}
    const [x,y]=point,[w,s,e,n]=data.bounds;
    if(x<w||x>e||y<s||y>n){result.reasons=['양재 데이터 범위 밖'];return result;}
    const age=now-Date.parse(data.retrievedAt);
    if(!Number.isFinite(age)||age<0||age>=MAX_DATA_AGE_MS){result.reasons=['지도 판정 데이터 갱신 필요'];return result;}
    for(const z of zones){
      const hit=z.type==='Point'?distance(point,z.coordinates)<=z.radius:z.type==='Polygon'?(inside(point,z.coordinates)&&!z.holes.some(h=>inside(point,h)))||nearest(point,z.coordinates).distance<=z.radius:nearest(point,z.coordinates).distance<=z.radius;
      if(hit)result.reasons.push(z.reason);
    }
    result.reasons=[...new Set(result.reasons)];
    const near=roads.map(r=>({r,...nearest(point,r.coordinates)})).sort((a,b)=>a.distance-b.distance)[0];
    result.road=near?.r.tags.name||'이름 없는 접근로';result.roadId=near?.r.id??null;
    if(!near||near.distance>25)result.advisories.push('차량 접근 경로 미확인');
    if(near&&near.r.tags.access==='customers')result.advisories.push('시설 이용객 접근 조건 확인');
    result.selectable=result.reasons.length===0;return result;
  }
  function recommendations(now=Date.now()){
    const candidates=[];
    for(const r of roads){
      if(!Number.isFinite(explicitWidth(r.tags))||explicitWidth(r.tags)<3||!['service','residential','unclassified','living_street'].includes(r.tags.highway)||denied(r.tags)||r.tags.tunnel==='yes'||r.tags.bridge==='yes')continue;
      for(let i=1;i<r.coordinates.length;i++){
        const a=r.coordinates[i-1],b=r.coordinates[i];if(distance(a,b)<18)continue;
        for(const side of [-1,1]){
          const point=offset(a,b,side*(width(r.tags)/2+0.8)).map(v=>Number(v.toFixed(7)));
          const d=distance(point,data.anchor.coordinates);if(d>800)continue;
          const c=check(point,now);if(!c.selectable)continue;
          candidates.push({...c,id:`${r.id}:${i}:${side}`,name:r.tags.name||'사옥 주변 접근로',widthSource:'OSM width tag',roadWidthM:explicitWidth(r.tags),distanceM:Math.round(d),sourceId:r.id,score:d+(r.tags.access==='customers'?80:0)});
        }
      }
    }
    const picked=[];
    for(const c of candidates.sort((a,b)=>a.score-b.score||a.id.localeCompare(b.id)))if(picked.every(p=>distance(p.point,c.point)>90)){picked.push(c);if(picked.length===3)break;}
    return picked;
  }
  return {data,zones,check,recommendations,publicData(now=Date.now()){
    return {anchor:data.anchor,bounds:data.bounds,retrievedAt:data.retrievedAt,coverage:data.coverage,source:data.source,licenseUrl:data.licenseUrl,
      limitations:['OSM에 없는 금지표지·어린이보호구역·시간대/임시 통제는 포함되지 않을 수 있습니다.','교차로 보호범위와 도로폭은 지도에서 추정한 값입니다.'],
      zones:zones.map(z=>({...z,displayGeometry:z.type==='Point'?{type:'Polygon',coordinates:[circle(z.coordinates,z.radius)]}:z.type==='Polygon'?{type:'Polygon',coordinates:[z.coordinates,...z.holes]}:{type:'LineString',coordinates:z.coordinates}})),
      recommendations:recommendations(now)};
  }};
}
