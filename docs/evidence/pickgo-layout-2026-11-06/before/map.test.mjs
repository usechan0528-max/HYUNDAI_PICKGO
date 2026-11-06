import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildMapModel,MAX_DATA_AGE_MS} from './map/model.mjs';
import {mapModel,mapData} from './map/service.mjs';
import {MapBoard,decodePoint} from './map/board.mjs';
import {createServer} from './server.mjs';
import {inside,distance,offset} from './map/geometry.mjs';
const now=Date.parse(mapModel.data.retrievedAt)+1000;
const points=()=>mapModel.recommendations(now);
test('real OSM anchor, source geometry and generated candidates',()=>{
 assert.equal(mapModel.data.anchor.sourceId,'way/144376088');assert.ok(mapModel.data.features.length>1000);
 assert.ok(mapModel.check(mapModel.data.anchor.coordinates,now).reasons.includes('건물 내부'));
 const p=points();assert.equal(p.length,3);for(const c of p){assert.equal(mapModel.check(c.point,now).selectable,true);assert.match(c.sourceId,/^way\//);assert.ok(c.distanceM<800);}
});
test('real bus stop, crossing and motorway centres cannot be selected',()=>{
 for(const pred of [f=>f.tags.highway==='bus_stop',f=>f.tags.highway==='crossing',f=>f.tags.highway==='motorway'&&f.type==='LineString']){
 const f=mapModel.data.features.find(pred);const p=f.type==='Point'?f.coordinates:f.coordinates.find(p=>p[0]>127.032&&p[0]<127.050&&p[1]>37.455&&p[1]<37.471);assert.ok(p);assert.equal(mapModel.check(p,now).selectable,false);
 }
});
test('unknown legal conditions remain freely selectable outside blocked features',()=>{
 const model=buildMapModel({...mapModel.data,features:[]});const point=[127.042,37.464];const r=model.check(point,now);assert.equal(r.selectable,true);assert.ok(r.advisories.includes('차량 접근 경로 미확인'));
});
test('coverage, malformed and expired data fail without legal-allowed inference',()=>{
 for(const p of [null,[],[127,37],['127.04',37.46],[Infinity,37.46],[127.04,37.46,1]])assert.equal(mapModel.check(p,now).selectable,false);
 assert.equal(mapModel.check(points()[0].point,now+MAX_DATA_AGE_MS).selectable,false);
 assert.equal(mapModel.check(points()[0].point,Date.parse(mapModel.data.retrievedAt)-1).selectable,false);
 assert.equal(mapData(now+MAX_DATA_AGE_MS).recommendations.length,0);
});
test('parking-only restriction is not no-stopping; no_stopping is blocked',()=>{
 const road={id:'way/test',type:'LineString',coordinates:[[127.041,37.464],[127.043,37.464]],nodeIds:[1,2],tags:{highway:'service',parking:'no'}};
 let m=buildMapModel({...mapModel.data,features:[road]});assert.equal(m.check([127.042,37.464],now).selectable,true);
 road.tags={'highway':'service','parking:right':'no'};m=buildMapModel({...mapModel.data,features:[road]});assert.equal(m.check([127.042,37.464],now).selectable,true);
 road.tags['parking:right:restriction']='no_stopping';m=buildMapModel({...mapModel.data,features:[road]});assert.equal(m.check([127.042,37.464],now).selectable,false);
});
test('polygon edge and hole-free ring checks, metric offsets',()=>{
 const ring=[[127,37],[127.001,37],[127.001,37.001],[127,37.001],[127,37]];
 assert.equal(inside([127.0005,37.0005],ring),true);assert.equal(inside([127,37],ring),true);assert.equal(inside([127.002,37],ring),false);assert.ok(distance(offset([127,37],[127.001,37],5),[127.0005,37])>4.99);
});
test('map pin create, counterpart propose and accept preserve coordinates and consent reset',()=>{
 const b=new MapBoard(()=>now,()=>1000);const [a,c]=points();const d=b.createPoint(a.point),r=b.join(d.id,d.invite);const cmd=(who,type,extra={})=>({...b.read(d.id,who.token),type,requestId:randomUUID(),...extra});
 let state=b.read(d.id,d.token);assert.deepEqual(state.mapPoint,a.point);assert.deepEqual(decodePoint(state.place),a.point);
 b.act(d.id,r.token,cmd(r,'proposePoint',{point:c.point}));state=b.read(d.id,d.token);assert.deepEqual(state.mapPoint,a.point);assert.deepEqual(state.proposal.mapPoint,c.point);
 b.act(d.id,d.token,cmd(d,'accept',{proposalId:state.proposal.id}));state=b.read(d.id,d.token);assert.deepEqual(state.mapPoint,c.point);assert.equal(state.placeRevision,2);
});
test('forged create/propose names, direct API points and stale acceptance cannot bypass checks',()=>{
 let at=now;const b=new MapBoard(()=>at,()=>1000);const bad=mapModel.data.anchor.coordinates;
 assert.throws(()=>b.createPoint(bad));assert.throws(()=>b.create(`지도 핀 (${bad[1].toFixed(7)}, ${bad[0].toFixed(7)})`));
 const [a,c]=points(),d=b.createPoint(a.point),r=b.join(d.id,d.invite);let v=b.read(d.id,d.token);
 assert.throws(()=>b.act(d.id,d.token,{...v,type:'proposePoint',point:bad,requestId:randomUUID()}));
 b.act(d.id,d.token,{...v,type:'proposePoint',point:c.point,requestId:randomUUID()});at+=MAX_DATA_AGE_MS;
 // Room TTL is shorter than data expiry; either expired room or geometry rejects.
 assert.throws(()=>b.act(d.id,r.token,{type:'accept',requestId:randomUUID()}));
});
test('HTTP real-map page, checking, pin creation and restricted direct requests',async t=>{
 const server=createServer(new MapBoard(()=>now,()=>1000));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`;
 const page=await fetch(base+'/map');assert.equal(page.status,200);assert.equal(page.headers.get('referrer-policy'),'strict-origin-when-cross-origin');assert.match(page.headers.get('content-security-policy'),/tile.openstreetmap.org/);assert.match(await page.text(),/현장 확인/);
 const metadata=await(await fetch(base+'/api/map')).json();assert.equal(metadata.coverage,'partial');assert.equal(metadata.recommendations.length,3);
 const post=(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/rooms',{point:mapModel.data.anchor.coordinates})).status,400);
 const allowed=points()[0].point;assert.equal((await(await post('/api/map/check',{point:allowed})).json()).selectable,true);
 assert.equal((await post('/api/rooms',{point:allowed})).status,201);
 assert.equal((await fetch(base+'/map/vendor/leaflet.js')).status,200);
});

test('recommendations require explicit road width, while manual unknown-width pins remain selectable',()=>{
 const road={id:'way/test',type:'LineString',coordinates:[[127.041,37.464],[127.043,37.464]],nodeIds:[1,2],tags:{highway:'service'}};
 const m=buildMapModel({...mapModel.data,features:[road]});assert.equal(m.recommendations(now).length,0);assert.equal(m.check([127.042,37.464],now).selectable,true);
 for(const c of points()){assert.equal(c.widthSource,'OSM width tag');assert.ok(c.roadWidthM>=3);}
});
test('invalid graph geometry fails to load and multipolygon courtyard is not a building',()=>{
 assert.throws(()=>buildMapModel({...mapModel.data,features:[{id:'bad',type:'LineString',tags:{highway:'service'},coordinates:[[127.04,37.46],[127.041,37.46]]}]}));
 const ring=[[127.04,37.46],[127.044,37.46],[127.044,37.464],[127.04,37.464],[127.04,37.46]],hole=[[127.041,37.461],[127.043,37.461],[127.043,37.463],[127.041,37.463],[127.041,37.461]];
 const m=buildMapModel({...mapModel.data,features:[{id:'building',type:'Polygon',coordinates:ring,holes:[hole],tags:{building:'yes'}}]});
 assert.equal(m.check([127.042,37.462],now).selectable,true);assert.equal(m.check([127.0405,37.4605],now).selectable,false);
 assert.ok(mapModel.data.features.some(f=>f.id.startsWith('relation/6942680')));
});
test('expired data blocks acceptance while the room is still alive',()=>{
 let at=Date.parse(mapModel.data.retrievedAt)+MAX_DATA_AGE_MS-1000;const b=new MapBoard(()=>at,()=>1000),[a,c]=points(),d=b.createPoint(a.point),r=b.join(d.id,d.invite);const v=b.read(d.id,d.token);
 b.act(d.id,d.token,{...v,type:'proposePoint',point:c.point,requestId:randomUUID()});at+=1100;const next=b.read(d.id,r.token);
 assert.throws(()=>b.act(d.id,r.token,{...next,type:'accept',proposalId:next.proposal.id,requestId:randomUUID()}));assert.deepEqual(b.read(d.id,d.token).mapPoint,a.point);
});

test('ambiguous width units and multi-values never produce recommendations',()=>{
 for(const width of ['3 ft','3;2.5','3-4','unknown']){
  const road={id:'way/test',type:'LineString',coordinates:[[127.041,37.464],[127.043,37.464]],nodeIds:[1,2],tags:{highway:'service',width}};
  assert.equal(buildMapModel({...mapModel.data,features:[road]}).recommendations(now).length,0);
 }
});
