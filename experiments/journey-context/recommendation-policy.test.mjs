import test from 'node:test';
import assert from 'node:assert/strict';
import {rankRecommendations as rank, recommend} from './core.mjs';
const catalog = [
  {id:'a',topic:'story',testOnly:true},
  {id:'b',topic:'news',testOnly:true},
  {id:'c',topic:'story',testOnly:true}
];
const preferences = {topics:{story:3,news:2},byPurpose:{commute:{news:4},errand:{news:-3}}};
const context = (...purposes) => ({status:'hypothesis',candidates:purposes.map(purpose=>({purpose}))});

test('cold start, invalid root and empty catalog are deterministic and do not throw',()=>{
  for(const input of [undefined,null,{}, {catalog:null}]) assert.equal(rank(input).status,'exhausted');
  const result=rank({catalog});assert.equal(result.selected.id,'a');assert.equal(result.selected.reasons.coldStart,true);
  assert.deepEqual(rank({catalog:[...catalog].reverse()}), {...result, excluded:[]});
});
test('valid branch affects choice; ambiguity and unavailable context fall back conservatively',()=>{
  assert.equal(recommend({catalog,preferences,context:context('commute')}).id,'b');
  for(const ctx of [context('commute','errand'),context('commute',null),{status:'unknown'},context()])
    assert.equal(recommend({catalog,preferences,context:ctx}).id,'a');
});
test('explicit dislikes override both likes and a favorable route',()=>{
  const result=rank({catalog,preferences:{...preferences,likedIds:['b'],dislikedIds:['b']},context:context('commute')});
  assert.equal(result.selected.id,'a');assert.deepEqual(result.excluded,[{id:'b',reason:'explicit-dislike'}]);
  assert.equal(rank({catalog,preferences:{dislikedTopics:['story','news']}}).status,'exhausted');
});
test('unavailable, invalid, duplicate and non-demo entries cannot be selected',()=>{
  const result=rank({catalog:[null,{}, {id:'a',topic:'story',testOnly:true},
    {id:'a',topic:'news',testOnly:true},{id:'b',topic:'news',testOnly:true,playable:false},
    {id:'x',topic:'news'}]});
  assert.equal(result.selected,null);assert.equal(result.excluded.length,6);
  assert.equal(result.excluded.filter(x=>x.reason==='duplicate-id').length,2);
});
test('current and recent exclusions never relax on exhaustion',()=>{
  const result=rank({catalog,preferences,currentId:'a',recent:['b','c']});
  assert.equal(result.selected,null);assert.equal(result.stopReason,'no-eligible-content');
  assert.equal(recommend({catalog,preferences,currentId:'a',recent:['b','c']}),null);
});
test('explicit likes are bounded and duplicate feedback does not amplify them',()=>{
  const result=rank({catalog,preferences:{likedIds:['b','b','b']}});
  assert.equal(result.selected.id,'b');assert.equal(result.selected.score,1);
});
test('diversity breaks ties but never defeats a higher preference score',()=>{
  assert.equal(rank({catalog,lastTopic:'story'}).selected.id,'b');
  assert.equal(rank({catalog,preferences,lastTopic:'story'}).selected.id,'a');
});
test('invalid weights do not create NaN or string scores and extreme weights are clamped',()=>{
  for(const bad of [NaN,Infinity,-Infinity,'9',{},null]) {
    const result=rank({catalog,preferences:{topics:{story:bad},byPurpose:{commute:{news:bad}}},context:context('commute')});
    assert.ok(result.ranked.every(x=>Number.isFinite(x.score)));
  }
  assert.equal(rank({catalog,preferences:{topics:{story:999}}}).selected.score,5);
});
test('inherited preference keys are not treated as user choices',()=>{
  const topics=Object.create({news:5});topics.story=1;
  assert.equal(rank({catalog,preferences:{topics}}).selected.id,'a');
});
test('malformed string or array preference maps cannot contribute built-in properties',()=>{
  const c=[{id:'a',topic:'length',testOnly:true}];
  for(const bad of ['abc',[1,2,3]]) {
    assert.equal(rank({catalog:c,preferences:{topics:bad}}).selected.score,0);
    assert.equal(rank({catalog:c,preferences:{byPurpose:{commute:bad}},context:context('commute')}).selected.score,0);
  }
});
test('compatibility wrapper retains the original recommendation record contract',()=>{
  const r=recommend({catalog,preferences});
  assert.equal(r.id,'a');assert.equal(r.score,3);assert.equal(r.reasons.mode,'taste-only');
  assert.equal(Object.hasOwn(r,'topic'),false);
});
test('explanations preserve negative context, likes, and deterministic tie policy',()=>{
  const r=rank({catalog,preferences:{...preferences,likedIds:['b']},context:context('errand')}).ranked.find(x=>x.id==='b');
  assert.match(r.reasons.summary,/내려갑니다/);assert.match(r.reasons.summary,/좋아요/);
  assert.match(r.reasons.tieBreak,/ID/);
});
test('malformed route alternatives invalidate the whole context',()=>{
  for(const candidates of [[null], [{purpose:'commute'},null], [{purpose:123}], 'commute']) {
    const result=rank({catalog,preferences,context:{status:'hypothesis',candidates}});
    assert.equal(result.selected.id,'a');assert.equal(result.mode,'taste-only');
  }
});
test('ETA and SDK status alone never influence ranking',()=>{
  const baseline=rank({catalog,preferences});
  assert.deepEqual(rank({catalog,preferences,context:{status:'CALLBACK',eta:1,candidates:[{purpose:'commute'}]}}),baseline);
  assert.deepEqual(rank({catalog,preferences,eta:999,durationMinutes:1}),baseline);
});
test('inputs stay unchanged and explanations account for every score',()=>{
  const input={catalog:structuredClone(catalog),preferences:structuredClone(preferences),context:context('commute'),recent:[]};
  const copy=structuredClone(input);const result=rank(input);
  assert.deepEqual(input,copy);
  for(const r of result.ranked) {
    assert.equal(r.score,r.reasons.taste+r.reasons.contextual+r.reasons.explicitLike);
    assert.ok(r.reasons.summary.length>0);
  }
});
test('unsupported feedback input does not alter this stateless policy',()=>{
  const input={catalog,preferences,feedback:[{id:'a',type:'skip'},{id:'b',type:'complete'}]};
  assert.deepEqual(rank(input),rank({catalog,preferences}));
});
