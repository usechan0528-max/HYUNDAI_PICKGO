import test from 'node:test';
import assert from 'node:assert/strict';
import {CoordinateStream} from './coordinate-stream.mjs';
import {recommend} from './core.mjs';
import {history} from './demo/observations.mjs';
const start={profile:'owner',consent:true,permission:true,source:'synthetic',startedAtMs:100};
const point=(latitude,longitude,observedAtMs)=>({latitude,longitude,observedAtMs});
const origin=point(0,0,200),shared=point(0,.001,300),work=point(.001,.001,400);
function setup(){const stream=new CoordinateStream();return {stream,token:stream.begin(start)};}
test('incremental shared route remains ambiguous, branch feeds real recommendation',()=>{
 const {stream,token}=setup();
 assert.equal(stream.context(history,100).reason,'no-observation');
 for(const p of [origin,shared])assert.equal(stream.push(token,p,p.observedAtMs).accepted,true);
 assert.equal(stream.context(history,300).candidates.length,2);
 stream.push(token,work,400);
 const context=stream.context(history,401);
 assert.equal(context.purposeHint,'commute');
 assert.equal(recommend({catalog:[{id:'story',topic:'story',testOnly:true},{id:'reflection',topic:'reflection',testOnly:true}],
 preferences:{topics:{story:3,reflection:1},byPurpose:{commute:{reflection:4}}},context}).id,'reflection');
 assert.equal(JSON.stringify(context).includes('latitude'),false);
});
test('first observation deadline applies before samples and at arrival',()=>{
 for(const poll of [false,true]){
  const {stream,token}=setup();
  if(poll)assert.equal(stream.context(history,30101).reason,'first-observation-delay');
  assert.equal(stream.push(token,point(0,0,30101),30101).accepted,false);
  assert.equal(stream.context(history,30101).reason,'first-observation-delay');
 }
 const {stream,token}=setup();assert.equal(stream.push(token,point(0,0,30100),30100).accepted,true);
});
test('stale arrival, future, duplicates, reversed order and long gaps fail closed',()=>{
 for(const [sample,received,reason] of [[origin,30201,'stale-on-arrival'],[work,300,'invalid-observation'],
 [origin,201,'non-increasing-observation'],[point(0,0,199),201,'non-increasing-observation'],
 [point(0,.001,30201),30201,'observation-gap']]){
  const {stream,token}=setup();
  if(['non-increasing-observation','observation-gap'].includes(reason))stream.push(token,origin,200);
  assert.equal(stream.push(token,sample,received).reason,reason);
  assert.equal(stream.context(history,received).status,'unknown');
  assert.equal(stream.push(token,work,400).accepted,false);
 }
});
test('freshness expires without callbacks and backward receive/read clocks invalidate',()=>{
 const {stream,token}=setup();stream.push(token,origin,200);
 assert.equal(stream.context(history,30201).reason,'stale');
 assert.equal(stream.push(token,point(0,.001,30200),30200).reason,'invalid-receive-clock');
 const b=setup();b.stream.push(b.token,origin,200);
 assert.equal(b.stream.context(history,199).reason,'invalid-read-clock');
});
test('revocation and profile restart discard samples and ignore old callbacks',()=>{
 const {stream,token}=setup();stream.push(token,origin,200);stream.revoke();
 assert.equal(stream.context(history,300).reason,'revoked');
 const next=stream.begin({...start,profile:'other',startedAtMs:400});
 assert.equal(stream.push(token,work,500).reason,'inactive-session');
 assert.equal(stream.context(history,400).reason,'no-observation');
 stream.push(next,point(0,0,500),500);
 assert.equal(stream.context(history,500).reason,'no-pattern');
});
test('unverified SDK clocks and missing consent cannot open stream',()=>{
 for(const patch of [{source:'pleos'},{consent:false},{permission:false},{profile:null},{startedAtMs:NaN}]){
  const stream=new CoordinateStream();assert.equal(stream.begin({...start,...patch}),null);
  assert.equal(stream.context(history,200).status,'unknown');
 }
});
test('input is copied and capped; invalid new start destroys old session',()=>{
 const {stream,token}=setup();const p={...origin};stream.push(token,p,200);p.latitude=80;
 assert.equal(stream.context(history,200).candidates.length,2);
 for(let i=1;i<256;i++)assert.equal(stream.push(token,point(0,0,200+i),200+i).accepted,true);
 assert.equal(stream.push(token,point(0,0,456),456).reason,'input-limit');
 const b=setup();b.stream.begin({...start,consent:false});
 assert.equal(b.stream.push(b.token,origin,200).accepted,false);
});

test('first receive deadline cannot be bypassed with an earlier observation',()=>{
 const {stream,token}=setup();
 assert.equal(stream.push(token,point(0,0,29000),30500).reason,'first-observation-delay');
});
test('sample getters are read once before validation and retained as plain values',()=>{
 const {stream,token}=setup();let reads=0;
 const sample={get latitude(){return ++reads===1?0:80;},longitude:0,observedAtMs:200};
 assert.equal(stream.push(token,sample,200).accepted,true);assert.equal(reads,1);
 const context=stream.context(history,200);
 assert.deepEqual(Object.keys(context).sort(),['candidates','purposeHint','reason','status']);
 assert.equal(context.candidates.length,2);
 for(const candidate of context.candidates)assert.deepEqual(Object.keys(candidate).sort(),['id','purpose']);
});
test('exact gap and arrival age boundaries and equal receive times are permitted',()=>{
 const {stream,token}=setup();stream.push(token,origin,200);
 assert.equal(stream.push(token,point(0,.001,30200),30200).accepted,true);
 const b=setup();b.stream.push(b.token,origin,200);
 assert.equal(b.stream.push(b.token,shared,30300).accepted,true);
 assert.equal(b.stream.push(b.token,work,30300).accepted,true);
});
test('stale reads can recover only with continuous observations and non-reversed receipt',()=>{
 const {stream,token}=setup();stream.push(token,origin,200);
 assert.equal(stream.context(history,30201).reason,'stale');
 assert.equal(stream.push(token,point(0,.001,30199),30202).accepted,true);
 assert.equal(stream.context(history,30202).status,'hypothesis');
});
test('throwing sample access fails closed and repeated revoke is harmless',()=>{
 const {stream,token}=setup();stream.push(token,origin,200);
 assert.equal(stream.push(token,{get latitude(){throw new Error('bad input');}},300).reason,'invalid-sample');
 assert.equal(stream.context(history,300).reason,'invalid-sample');
 stream.revoke();stream.revoke();
 assert.equal(stream.context(history,400).reason,'revoked');
 assert.equal(stream.push(token,work,400).accepted,false);
});
