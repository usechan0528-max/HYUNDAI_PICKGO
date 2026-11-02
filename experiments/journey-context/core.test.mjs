import test from 'node:test';
import assert from 'node:assert/strict';
import {inferJourney, recommend, informationDestination, QueuePolicy, JourneySession} from './core.mjs';
const history = [
 {id:'commute',profile:'a',endedAt:100,zones:['home','shared','work'],confirmedPurpose:'commute',distanceKm:80,durationMinutes:90},
 {id:'shop',profile:'a',endedAt:100,zones:['home','shared','shop'],confirmedPurpose:'errand',distanceKm:5,durationMinutes:12},
 {id:'other-driver',profile:'b',endedAt:100,zones:['home','shared','secret'],confirmedPurpose:'other'},
 {id:'future',profile:'a',endedAt:900,zones:['home','shared','future'],confirmedPurpose:'other'}
];
const input = {history,profile:'a',consent:true,permission:true,now:500,startedAt:200,
 observations:[{zone:'home',at:200},{zone:'shared',at:400}]};
const catalog = [{id:'science',topic:'science',testOnly:true},{id:'news',topic:'news',testOnly:true}];
const preferences = {topics:{science:3,news:2},byPurpose:{commute:{news:4},errand:{news:-3}}};
test('shared segment preserves alternatives and excludes other drivers and future history',()=>{
 const c=inferJourney(input); assert.equal(c.status,'hypothesis');
 assert.deepEqual(c.candidates.map(x=>x.id),['commute','shop']); assert.equal(c.purposeHint,null);
});
test('branch distinguishes purpose from long distance and duration',()=>{
 const c=inferJourney({...input,observations:[...input.observations,{zone:'work',at:450}]});
 assert.equal(c.purposeHint,'commute'); assert.equal(c.candidates[0].distanceKm,80);
 assert.equal(c.candidates[0].durationMinutes,90);
 assert.equal('destination' in c.candidates[0],false);
 assert.equal(c.status,'hypothesis');
});
test('refusal, guest, stale, future observations and off-pattern all abstain',()=>{
 for(const patch of [{consent:false},{permission:false},{profile:null},{now:40_000},
 {observations:[{zone:'home',at:501}]},{observations:[{zone:'elsewhere',at:400}]}])
 assert.equal(inferJourney({...input,...patch}).status,'unknown');
});
test('ambiguous contexts use common suitability, branch can change topic, fallback is taste',()=>{
 assert.equal(recommend({catalog,preferences,context:inferJourney(input)}).id,'science');
 const branch=inferJourney({...input,observations:[...input.observations,{zone:'work',at:450}]});
 assert.equal(recommend({catalog,preferences,context:branch}).id,'news');
 assert.equal(recommend({catalog,preferences,context:inferJourney({...input,permission:false})}).id,'science');
});
test('recent and currently playing items are excluded',()=>{
 assert.equal(recommend({catalog,preferences,context:{status:'unknown'},recent:['news'],currentId:'science'}),null);
});
test('inferred destination cannot produce destination-specific information',()=>{
 assert.equal(informationDestination({source:'inference',destination:'work',at:400},500),null);
 assert.equal(informationDestination({source:'navigation',destination:'work',at:400},500),'work');
 assert.equal(informationDestination({source:'navigation',destination:'work',at:400},40_000),null);
});
test('queue changes never interrupt current content and suppress oscillation',()=>{
 const q=new QueuePolicy({minIntervalMs:100,maxChanges:1});q.current='playing';
 assert.equal(q.update('a',0),true); assert.equal(q.update('b',20),false);
 assert.equal(q.update('b',100),true);assert.equal(q.update('a',200),false);
 assert.equal(q.current,'playing');assert.equal(q.next,'b');
 q.resetForProfile(); assert.equal(q.next,null);
});
test('deleting supplied history removes derived candidates on recomputation',()=>{
 assert.equal(inferJourney({...input,history:[]}).status,'unknown');
});

test('history and current observations use the same duplicate-zone normalization',()=>{
 const h=structuredClone(history); h[0].zones=['home','home','shared','work'];
 assert.deepEqual(inferJourney({...input,history:h}).candidates.map(x=>x.id),['commute','shop']);
});
test('missing observation and recommendation context safely fall back',()=>{
 assert.equal(inferJourney({...input,observations:undefined}).status,'unknown');
 assert.equal(recommend({catalog,preferences}).id,'science');
});
test('deletion invalidates derived context and queued content without interrupting playback',()=>{
 const session=new JourneySession(history);session.tick(input);
 session.queue.current='playing';session.queue.update('news',500);
 session.eraseHistory();assert.equal(session.context.status,'unknown');
 assert.equal(session.queue.next,null);assert.equal(session.queue.current,'playing');
 assert.equal(session.tick(input).status,'unknown');
});
test('profile changes and permission revocation invalidate previously queued recommendations',()=>{
 for(const patch of [{profile:'b'},{consent:false},{permission:false}]) {
  const session=new JourneySession(history);session.tick(input);session.queue.update('news',500);
  session.tick({...input,...patch}); assert.equal(session.queue.next,null);
 }
});

test('stale and off-pattern transitions clear next while keeping playback',()=>{
 for(const patch of [{now:40_000},{observations:[{zone:'unknown',at:450}]}]) {
  const session=new JourneySession(history);session.tick(input);session.queue.current='playing';
  session.queue.update('news',500);session.tick({...input,...patch});
  assert.equal(session.queue.next,null);assert.equal(session.queue.current,'playing');
 }
});
test('invalidating derived data cannot reset the per-session replacement budget',()=>{
 const session=new JourneySession(history);
 session.queue=new QueuePolicy({minIntervalMs:10,maxChanges:1});
 assert.equal(session.queue.update('a',0),true);session.clearDerived();
 assert.equal(session.queue.update('b',5),false);
 assert.equal(session.queue.update('b',10),true);session.eraseHistory();
 assert.equal(session.queue.update('c',20),false);
});

test('consuming a queue slot allows refill without spending context replacement budget',()=>{
 const q=new QueuePolicy({minIntervalMs:100,maxChanges:1});
 q.update('a',0);q.update('b',100);assert.equal(q.changes,1);
 assert.equal(q.consumeNext(),'b');assert.equal(q.current,'b');
 assert.equal(q.update('c',101),true);assert.equal(q.changes,1);
 assert.equal(q.update('d',300),false);
 assert.equal(q.consumeNext(),'c');assert.equal(q.update('d',301),true);
});
