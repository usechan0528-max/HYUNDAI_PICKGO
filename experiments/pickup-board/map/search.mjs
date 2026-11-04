import {mapModel} from './service.mjs';
import {buildMapModel, MAX_DATA_AGE_MS} from './model.mjs';
import {distance,nearest,inside} from './geometry.mjs';
import {Fault} from '../domain.mjs';

const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ko').replace(/[\s\p{P}\p{S}]+/gu,'');
const within = (p,b) => p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];
export function createMapSearch(data=mapModel.data) {
  const entries=[];
  for(const f of data.features){
    const t=f.tags;
    const names=['name:ko','name','official_name','alt_name','short_name','name:en'].flatMap(k=>typeof t[k]==='string'?t[k].split(';'):[]);
    if(f.id===data.anchor.sourceId)names.unshift(data.anchor.name);
    const address=['addr:city','addr:suburb','addr:street','addr:housenumber'].map(k=>t[k]).filter(Boolean).join(' ');
    if(!names.length&&!address)continue;
    const vertices=f.type==='Point'?[f.coordinates]:f.coordinates;
    let point=f.id===data.anchor.sourceId?[...data.anchor.coordinates]:f.type==='Point'?[...f.coordinates]:[
      (Math.min(...vertices.map(p=>p[0]))+Math.max(...vertices.map(p=>p[0])))/2,
      (Math.min(...vertices.map(p=>p[1]))+Math.max(...vertices.map(p=>p[1])))/2];
    if(f.type!=='Point'&&f.id!==data.anchor.sourceId){
      if(f.type==='LineString'||!inside(point,f.coordinates)||(f.holes||[]).some(h=>inside(point,h)))point=nearest(point,f.coordinates).point;
    }
    // Clipped data can contain complete objects outside the supported map region.
    if(!within(point,data.bounds))continue;
    const kind=t.highway==='bus_stop'||t.public_transport==='platform'?'정류장':t.highway?'도로':t.building?'건물':t.shop?'상점':t.amenity?'시설':t.leisure?'공원·여가':'장소';
    entries.push({id:f.id,name:names[0]||address,address,kind,point,names:names.map(normalize),text:normalize([...names,address].join(' '))});
  }
  const byId=new Map(entries.map(e=>[e.id,e]));
  const publicEntry=({names,text,...entry})=>({...entry,point:[...entry.point]});
  function get(id){const e=byId.get(id);if(!e)throw new Fault(404,'현재 지도에서 찾을 수 없는 장소입니다. 다시 검색해 주세요.');return publicEntry(e);}
  function search(query,now=Date.now()){
    if(typeof query!=='string'||!query.trim()||query.trim().length>80)throw new Fault(400,'검색어는 1~80자로 입력하세요.');
    const q=normalize(query);if(!q)throw new Fault(400,'장소 이름이나 주소를 입력하세요.');
    const age=now-Date.parse(data.retrievedAt);
    if(age<0||age>=MAX_DATA_AGE_MS)throw new Fault(503,'지도 데이터 갱신이 필요합니다. 최신 데이터로 갱신한 뒤 다시 검색해 주세요.');
    const matched=entries.filter(e=>e.text.includes(q)).map(e=>({e,rank:e.names.includes(q)?0:e.names.some(n=>n.startsWith(q))?1:2}));
    matched.sort((a,b)=>a.rank-b.rank||distance(a.e.point,data.anchor.coordinates)-distance(b.e.point,data.anchor.coordinates)||a.e.id.localeCompare(b.e.id));
    const results=[];
    for(const {e} of matched){
      if(results.some(p=>normalize(p.name)===normalize(e.name)&&p.kind===e.kind&&(e.kind==='도로'||distance(p.point,e.point)<60)))continue;
      results.push(publicEntry(e));if(results.length===20)break;
    }
    return {results,scope:'양재사옥 주변',source:'OpenStreetMap',retrievedAt:data.retrievedAt,bounds:data.bounds,licenseUrl:'https://www.openstreetmap.org/copyright'};
  }
  // Only cache bounded derived map snapshots, never query strings or user coordinates.
  const maps=new Map();
  function mapFor(id,now=Date.now()){
    const entry=get(id);
    if(!maps.has(id)){
      const model=buildMapModel({...data,anchor:{...data.anchor,name:entry.name,sourceId:entry.id,coordinates:entry.point}});
      const snapshot=model.publicData(Date.parse(data.retrievedAt));
      snapshot.recommendations=snapshot.recommendations.map(c=>({...c,name:c.name==='사옥 주변 접근로'?'주변 접근로':c.name}));
      if(maps.size>=24)maps.delete(maps.keys().next().value);
      maps.set(id,snapshot);
    }
    const age=now-Date.parse(data.retrievedAt),available=age>=0&&age<MAX_DATA_AGE_MS;
    return {...maps.get(id),available,recommendations:available?maps.get(id).recommendations:[]};
  }
  return {search,get,mapFor};
}
export const mapSearch=createMapSearch();
