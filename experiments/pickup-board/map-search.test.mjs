import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createMapSearch,mapSearch} from './map/search.mjs';
import {mapModel} from './map/service.mjs';
import {MAX_DATA_AGE_MS} from './map/model.mjs';
import {inside,nearest} from './map/geometry.mjs';
import {createServer} from './server.mjs';

beforeEach(t=>t.mock.method(Date,'now',()=>Date.parse(mapModel.data.retrievedAt)+1000));

test('actual OSM names, alternate labels and spaced Korean search return source coordinates',()=>{
  const r=mapSearch.search('하 나 로 마 트');assert.ok(r.results.length>1);
  const place=r.results.find(p=>p.id==='node/8329707444');assert.ok(place);assert.deepEqual(place.point,[127.0430637,37.4624096]);
  assert.ok(mapSearch.search('현대자동차').results.some(p=>p.id===mapModel.data.anchor.sourceId));
  assert.equal(mapSearch.search('없는장소123456').results.length,0);
  for(const query of [null,{},'', ' ', '!?!', 'a'.repeat(81)])assert.throws(()=>mapSearch.search(query),e=>e.status===400);
});
test('map selection changes anchor and never bypasses expired data or unknown place ids',()=>{
  const place=mapSearch.search('하나로마트').results[0],now=Date.parse(mapModel.data.retrievedAt)+1000;
  const map=mapSearch.mapFor(place.id,now);assert.deepEqual(map.anchor.coordinates,place.point);assert.equal(map.anchor.sourceId,place.id);
  for(const c of map.recommendations)assert.equal(mapModel.check(c.point,now).selectable,true);
  assert.deepEqual(mapSearch.mapFor(place.id,now+MAX_DATA_AGE_MS).recommendations,[]);
  assert.throws(()=>mapSearch.mapFor('unknown/1'),e=>e.status===404);
});
test('outside dataset objects are not exposed and returned coordinates cannot mutate index',()=>{
  const search=createMapSearch({...mapModel.data,features:[{id:'node/out',type:'Point',tags:{name:'외부'},coordinates:[0,0]},...mapModel.data.features]});
  assert.equal(search.search('외부').results.length,0);
  const a=search.search('하나로마트').results[0];const original=[...a.point];a.point[0]=0;assert.deepEqual(search.get(a.id).point,original);
});
test('real HTTP search, anchor map selection and invalid inputs preserve local origin boundary',async t=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(body,origin)=>fetch(base+'/api/map/search',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
  const res=await post({query:'하나로마트'});assert.equal(res.status,200);const body=await res.json();assert.ok(body.results.length);
  const map=await (await fetch(base+'/api/map?place='+encodeURIComponent(body.results[0].id))).json();assert.equal(map.anchor.sourceId,body.results[0].id);
  assert.equal((await post({query:''})).status,400);assert.equal((await post({query:'양재'},'https://example.com')).status,403);
  assert.equal((await fetch(base+'/api/map?place=missing')).status,404);
});

test('line and concave polygon representative coordinates lie on the actual geometry',()=>{
 const line={id:'way/testline',tags:{name:'테스트도로'},type:'LineString',coordinates:[[127.033,37.456],[127.033,37.46],[127.04,37.46]]};
 const polygon={id:'way/testpoly',tags:{name:'테스트건물'},type:'Polygon',coordinates:[[127.033,37.456],[127.04,37.456],[127.04,37.457],[127.034,37.457],[127.034,37.46],[127.033,37.46],[127.033,37.456]]};
 const search=createMapSearch({...mapModel.data,features:[line,polygon]});
 assert.ok(nearest(search.get(line.id).point,line.coordinates).distance<0.01);
 assert.ok(inside(search.get(polygon.id).point,polygon.coordinates));
});
test('expired and future-dated search datasets require refresh before offering results',()=>{
 const now=Date.parse(mapModel.data.retrievedAt);
 assert.throws(()=>mapSearch.search('하나로마트',now+MAX_DATA_AGE_MS),e=>e.status===503);
 assert.throws(()=>mapSearch.search('하나로마트',now-1),e=>e.status===503);
});
