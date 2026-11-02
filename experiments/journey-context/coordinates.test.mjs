import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceMeters,inferCoordinateJourney} from './coordinates.mjs';
import {recommend} from './core.mjs';
// Invented equatorial coordinates, not a user's route or a real destination.
const p=(lat,lon,at=200)=>({latitude:lat,longitude:lon,observedAtMs:at});
const origin=p(0,0),shared=p(0,.001,300),work=p(.001,.001,400),shop=p(-.001,.001,400);
const history=[{id:'work',profile:'a',endedAtMs:100,points:[origin,shared,work],confirmedPurpose:'commute'},
 {id:'shop',profile:'a',endedAtMs:100,points:[origin,shared,shop],confirmedPurpose:'errand'}];
const input={history,observations:[origin,shared],profile:'a',consent:true,permission:true,
 source:'synthetic',startedAtMs:150,nowMs:500};
test('distance uses angular geometry including dateline',()=>{
 assert.ok(distanceMeters(p(0,0),p(0,.001))>110);
 assert.ok(distanceMeters(p(0,179.999),p(0,-179.999))<225);
});
test('coordinate jitter keeps shared alternatives then identifies a branch as hypothesis',()=>{
 const noisy=[p(.0001,0),p(.0001,.001,300)];
 assert.deepEqual(inferCoordinateJourney({...input,observations:noisy}).candidates.map(x=>x.id),['work','shop']);
 const c=inferCoordinateJourney({...input,observations:[...noisy,p(.0011,.001,400)]});
 assert.equal(c.status,'hypothesis');assert.equal(c.purposeHint,'commute');
 assert.deepEqual(c.candidates,[{id:'work',purpose:'commute'}]);
});
test('off-route and returning to origin do not fabricate a matched continuation',()=>{
 for(const point of [p(.01,.01,400),p(0,0,400)])
 assert.equal(inferCoordinateJourney({...input,observations:[...input.observations,point]}).status,'unknown');
});
test('missing, stale, out-of-order, future, invalid coordinates and actual SDK clock all abstain',()=>{
 for(const patch of [{observations:[]},{nowMs:40_000},{observations:[shared,origin]},
 {observations:[p(0,0,600)]},{observations:[p(91,0)]},{source:'pleos'},
 {consent:false},{permission:false},{profile:null}])
 assert.equal(inferCoordinateJourney({...input,...patch}).status,'unknown');
});
test('future and other-driver histories never become candidates',()=>{
 const extra=[{...history[0],id:'future',endedAtMs:150},{...history[0],id:'other',profile:'b'}];
 assert.deepEqual(inferCoordinateJourney({...input,history:[...history,...extra]}),inferCoordinateJourney(input));
});
test('repeated historical paths remain ambiguous rather than claiming probability',()=>{
 const duplicate={...history[0],id:'alternate-purpose',confirmedPurpose:'other'};
 const c=inferCoordinateJourney({...input,history:[history[0],duplicate],observations:[origin,shared,work]});
 assert.equal(c.candidates.length,2);assert.equal(c.purposeHint,null);assert.equal('confidence' in c,false);
});
test('coordinate output connects to the existing recommender without exposing raw locations',()=>{
 const c=inferCoordinateJourney({...input,observations:[origin,shared,work]});
 const choice=recommend({catalog:[{id:'a',topic:'story',testOnly:true},{id:'b',topic:'reflection',testOnly:true}],
 preferences:{topics:{story:3,reflection:1},byPurpose:{commute:{reflection:4}}},context:c});
 assert.equal(choice.id,'b');assert.equal(JSON.stringify(c).includes('latitude'),false);
});

// One deterministic seed; these samples do not represent a measured GPS error distribution.
test('seeded per-point noise preserves a known branch within matching radius',()=>{
 let seed=1729;const noise=()=>{seed=(1664525*seed+1013904223)>>>0;return (seed/2**32-.5)*.0002;};
 for(let run=0;run<20;run++){
  const observations=[origin,shared,work].map(o=>({...o,latitude:o.latitude+noise(),longitude:o.longitude+noise()}));
  assert.deepEqual(inferCoordinateJourney({...input,observations}).candidates.map(x=>x.id),['work']);
 }
});
test('overlapping matching radii keep ambiguity near adjacent shared and branch points',()=>{
 const c=inferCoordinateJourney({...input,observations:[origin,shared,p(.0005,.001,400)]});
 assert.equal(c.candidates.length,2);assert.equal(c.purposeHint,null);
});
test('gaps, malformed collections and excessive inputs abstain without trimming candidates',()=>{
 for(const patch of [{history:null},{observations:null},{history:Array(129).fill(history[0])},
 {observations:Array(257).fill(origin)},{history:[{...history[0],points:Array(513).fill(origin)}]},
 {observations:[origin,{...shared,observedAtMs:40_000}],nowMs:40_001}])
 assert.equal(inferCoordinateJourney({...input,...patch}).status,'unknown');
});
test('alignment work budget stops pathological overlapping samples',()=>{
 const dense={...history[0],points:Array(512).fill(origin)};
 const observations=Array.from({length:256},(_,i)=>({...origin,observedAtMs:200+i}));
 const c=inferCoordinateJourney({...input,history:[dense,dense],observations,maxAdvance:16});
 assert.equal(c.reason,'comparison-limit');
});
