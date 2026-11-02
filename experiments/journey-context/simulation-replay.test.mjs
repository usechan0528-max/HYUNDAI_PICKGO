import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {replaySyntheticJourney} from './simulation-replay.mjs';
import {history} from './demo/observations.mjs';
import {catalog} from './demo/content.mjs';

const preferences = {topics:{story:3,reflection:1},byPurpose:{commute:{reflection:4},errand:{reflection:-3}}};
const begin = (at=100,session='a',patch={}) => ({type:'begin',at,session,source:'synthetic',profile:'owner',consent:true,permission:true,...patch});
const point = (at,latitude,longitude,session='a') => ({type:'point',at,session,sample:{latitude,longitude,observedAtMs:at}});
const common = [begin(),point(200,0,0),point(300,0,.001)];
const run = events => replaySyntheticJourney({events,history,catalog,preferences});
const last = result => result.rows.at(-1);

test('incremental driving keeps ambiguous routes, applies branch preference, preserves current item',()=>{
  const result=run([...common,{type:'consume',at:301},point(400,.001,.001)]);
  assert.equal(result.rows[2].context.candidates.length,2);
  assert.deepEqual(result.rows[2].context.candidates,[{id:'work',purpose:'commute'},{id:'shop',purpose:'errand'}]);
  assert.equal(result.rows[2].context.purposeHint,null);
  assert.equal(result.rows[2].proposal,'story');
  assert.equal(last(result).context.purposeHint,'commute');
  assert.equal(last(result).proposal,'pause');
  // The previous queued story2 is retained during the replacement cooldown.
  assert.equal(last(result).next,'story2');
  assert.equal(last(result).current,'story');
  assert.equal(result.mediaPlayback,false);
});

test('continuous stationary updates do not certify arrival; cooldown permits one later branch replacement',()=>{
  const result=run([...common,{type:'consume',at:301},point(400,.001,.001),
    point(30400,.001,.001),point(60400,.001,.001)]);
  assert.equal(last(result).context.status,'hypothesis');
  assert.equal(last(result).next,'pause');
  assert.equal(last(result).current,'story');
  assert.equal(last(result).replacements,1);
});

test('route deviation clears contextual next and falls back without replacing current',()=>{
  const result=run([...common,{type:'consume',at:301},point(400,.001,.001),
    point(30400,.001,.001),point(60400,.001,.001),point(60500,.02,.02)]);
  const row=last(result);
  assert.equal(row.context.reason,'no-pattern');
  assert.equal(row.mode,'taste-only');
  assert.equal(row.proposal,'story2');
  assert.equal(row.next,null); // Invalid contextual content must not survive a blocked replacement.
  assert.equal(row.current,'story');
  assert.equal(row.replacements,1);
});

test('silence expires context on tick, even without another callback',()=>{
  const result=run([...common,point(400,.001,.001),{type:'tick',at:30401}]);
  assert.equal(last(result).context.reason,'stale');
  assert.equal(last(result).mode,'taste-only');
  assert.equal(last(result).context.candidates.length,0);
});

test('consume after silence cannot start a stale contextual queued item',()=>{
  const result=run([...common,{type:'consume',at:301},point(400,.001,.001),
    point(30400,.001,.001),point(60400,.001,.001),{type:'consume',at:90401}]);
  assert.equal(result.rows.at(-2).next,'pause');
  assert.equal(result.rows.at(-2).mode,'journey');
  assert.equal(result.rows.at(-2).queuedMode,'journey');
  assert.equal(last(result).context.reason,'stale');
  assert.equal(last(result).input.consumed,null);
  assert.equal(last(result).current,'story');
});

test('taste-only listening remains consumable without a location fix',()=>{
  const result=run([begin(),{type:'tick',at:30101},{type:'consume',at:30200},
    {type:'consume',at:30300}]);
  assert.equal(result.rows[1].queuedMode,'taste-only');
  assert.equal(result.rows[2].input.consumed,'story');
  assert.equal(last(result).input.consumed,'story2');
  assert.equal(last(result).mode,'taste-only');
});

for (const type of ['disconnect','consent-revoked','permission-revoked','arrival','route-change']) {
  test(`${type} clears derived context and ignores a queued late callback`,()=>{
    const result=run([...common,{type:'consume',at:301},point(400,.001,.001),
      {type,at:500},point(600,.001,.001)]);
    const row=last(result);
    assert.equal(row.context.reason,type);
    assert.equal(row.context.candidates.length,0);
    assert.equal(row.input.reason,'inactive-session');
    assert.equal(row.mode,'taste-only');
    assert.equal(row.current,'story');
  });
}

test('explicit restart after route change separates old callbacks and resolves new branch',()=>{
  const result=run([...common,{type:'route-change',at:400},begin(500,'b'),
    point(600,.001,.001),point(700,0,0,'b'),point(800,0,.001,'b'),point(900,-.001,.001,'b')]);
  assert.equal(result.rows[5].input.reason,'inactive-session');
  assert.equal(last(result).context.purposeHint,'errand');
  assert.equal(last(result).proposal,'story');
});

test('restart requires explicit consent and permission and cannot promote real SDK data',()=>{
  for(const [patch,reason] of [[{consent:false},'invalid-start'],[{permission:false},'invalid-start'],[{source:'pleos-sdk-1.1.3'},'unverified-source-clock']]) {
    const result=run([...common,{type:'disconnect',at:400},begin(500,'b',patch),point(600,0,0,'b')]);
    assert.equal(result.rows[4].input.accepted,false);
    assert.equal(last(result).context.reason,reason);
    assert.equal(last(result).context.status,'unknown');
    assert.equal(last(result).mode,'taste-only');
  }
});

test('another profile can start but cannot borrow owner route history',()=>{
  const result=run([begin(100,'a',{profile:'guest'}),point(200,0,0),point(300,0,.001),point(400,.001,.001)]);
  assert.equal(result.rows[0].input.accepted,true);
  assert.equal(last(result).context.reason,'no-pattern');
  assert.deepEqual(last(result).context.candidates,[]);
});

test('fallback fills at exact cooldown boundary; consuming content is not a replacement',()=>{
  const result=run([...common,{type:'consume',at:301},point(400,.001,.001),
    point(30400,.001,.001),point(60400,.001,.001),point(60500,.02,.02),
    {type:'tick',at:120399},{type:'tick',at:120400},{type:'consume',at:120401}]);
  assert.equal(result.rows.at(-3).next,null);
  assert.equal(result.rows.at(-2).next,'story2');
  assert.equal(result.rows.at(-2).replacements,2);
  assert.equal(last(result).input.consumed,'story2');
  assert.equal(last(result).replacements,2);
});

test('exhausted replacement budget remains empty until explicit new listening session',()=>{
  const result=run([begin(),begin(60100,'b'),begin(120100,'c'),begin(180100,'d'),
    {type:'disconnect',at:180200},{type:'tick',at:240200},{type:'consume',at:240201},
    {type:'reset-listening',at:240202}]);
  assert.equal(result.rows[3].replacements,3);
  assert.equal(result.rows[5].next,null);
  assert.equal(result.rows[6].input.consumed,null);
  assert.equal(last(result).next,'story');
  assert.equal(last(result).replacements,0);
  assert.equal(last(result).current,null);
});

test('returning after an off-route point does not invent route recovery',()=>{
  const result=run([...common,point(400,.02,.02),point(500,.001,.001)]);
  assert.equal(last(result).context.reason,'no-pattern');
});

test('reconnect never restores the contextual replacement budget',()=>{
  const result=run([...common,{type:'consume',at:301},point(400,.001,.001),
    point(30400,.001,.001),point(60400,.001,.001),{type:'disconnect',at:60500},begin(60600,'b')]);
  assert.equal(last(result).replacements,1);
  assert.equal(last(result).next,null);
});

test('offline report contains no raw coordinates; malformed event clocks fail explicitly',()=>{
  const result=run([...common,point(400,.001,.001)]);
  assert.equal(result.sdkValidated,false);
  assert.equal(JSON.stringify(result).includes('latitude'),false);
  assert.equal(JSON.stringify(result).includes('longitude'),false);
  assert.throws(()=>run([begin(),{type:'tick',at:99}]),/clock/);
  assert.throws(()=>run([begin(),begin(200)]),/unique/);
  assert.throws(()=>run([{type:'made-up',at:100}]),/unknown/);
});

test('documented command emits the complete bounded scenario report',()=>{
  const report=JSON.parse(execFileSync(process.execPath,[fileURLToPath(new URL('./run-simulation.mjs',import.meta.url))],{encoding:'utf8',timeout:10000}));
  assert.equal(report.rows.length,16);
  assert.equal(report.source,'synthetic');
  assert.equal(report.sdkValidated,false);
  assert.equal(report.mediaPlayback,false);
  assert.equal(report.rows.at(-1).context.reason,'arrival');
  assert.equal(report.rows.at(-1).mode,'taste-only');
  assert.equal(report.rows[9].input.reason,'inactive-session');
});
