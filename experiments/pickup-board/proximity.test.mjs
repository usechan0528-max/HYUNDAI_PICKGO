import test from 'node:test';
import assert from 'node:assert/strict';
import { ProximityDetector, distanceMeters, POLICY } from './proximity/detector.mjs';
import { Board, PLACES } from './domain.mjs';
const destination = { id: 'synthetic-place', revision: 1, latitude: 0, longitude: 0 };
const at = meters => ({ latitude: meters / 6371008.8 * 180 / Math.PI, longitude: 0 });
function setup() {
  let now = 1000; const d = new ProximityDetector({ now: () => now }); let token = d.bind('room', destination);
  const sample = (m = 0, extras = {}) => ({ ...at(m), accuracyMeters: 5, observedAtMonoMs: now, receivedAtMonoMs: now, source: 'synthetic', ...extras });
  return { d, get token() { return token; }, set: n => { now = n; }, sample,
    push(m = 0, extras = {}) { now += 100; return d.ingest(token, sample(m, extras)); },
    bind(value = destination) { token = d.bind('room', value); return token; } };
}
test('geodesic calculation, dateline, poles and invalid coordinates', () => {
  assert.equal(distanceMeters(destination, destination), 0);
  assert.ok(Math.abs(distanceMeters(destination, at(100)) - 100) < 1e-8);
  assert.ok(distanceMeters({latitude:0,longitude:179.999}, {latitude:0,longitude:-179.999}) < 223);
  assert.ok(Number.isFinite(distanceMeters({latitude:90,longitude:0},{latitude:-90,longitude:180})));
  assert.throws(() => distanceMeters({latitude:NaN,longitude:0}, destination));
});
test('two separate fixes confirm near; notification fires only once and reads never repeat it', () => {
  const x = setup(); assert.equal(x.push().state, 'unknown');
  assert.equal(x.push().notify, true); assert.equal(x.d.read().notify, false);
  assert.equal(x.push().notify, false); assert.equal(x.d.canNotify(x.token), true);
});
test('entry and exit accuracy margins and hysteresis', () => {
  const x = setup(); x.push(94.99); assert.equal(x.push(94.99).state,'near');
  x.push(100); assert.equal(x.push(149).state,'near');
  assert.equal(x.push(155.01).state,'near'); assert.equal(x.push(155.01).state,'far');
  x.push(0); assert.equal(x.push(0).notify,false);
  const y=setup(); y.push(95.01); assert.equal(y.push(95.01).state,'unknown');
});
test('uncertain valid sample resets candidate; unknown needs two far observations', () => {
  const x=setup(); x.push(); x.push(125); assert.equal(x.push().state,'unknown');
  assert.equal(x.push().state,'near'); x.d.unavailable(); x.bind();
  assert.equal(x.push(200).state,'unknown'); assert.equal(x.push(200).state,'far');
});
test('TTL expires at exactly 5000 ms on read without new callback', () => {
  const x=setup(); x.push(); x.push(); x.set(6199); assert.equal(x.d.read().state,'near');
  x.set(6200); assert.equal(x.d.read().reason,'stale'); assert.equal(x.d.canNotify(x.token),false);
  assert.equal(x.push().state,'unknown'); assert.equal(x.push().notify,false);
});
test('first candidate must remain fresh; two observations across expiry cannot confirm', () => {
  const x=setup(); x.push(); x.set(6100); assert.equal(x.push().state,'unknown'); assert.equal(x.push().state,'near');
});
test('duplicate and out-of-order observations cannot confirm or refresh freshness', () => {
  const x=setup(); x.push(); const s=x.sample(); x.set(1200); assert.equal(x.d.ingest(x.token,s).state,'unknown');
  assert.equal(x.push().state,'near'); x.set(6200); x.d.ingest(x.token,s); x.set(6300); assert.equal(x.d.read().state,'unknown');
});
test('observation time cannot be replaced by fresh receipt time', () => {
  const x=setup(); x.set(10000); assert.equal(x.d.ingest(x.token,x.sample(0,{observedAtMonoMs:5000})).reason,'stale');
});
for(const bad of [NaN, Infinity, -1, '1000', null]) test(`invalid time rejected ${String(bad)}`,()=>{
  const x=setup(); assert.equal(x.push(0,{observedAtMonoMs:bad}).reason,'invalid-time');
});
test('future, observation after receipt, and backwards host clock fail closed', () => {
  const x=setup(); assert.equal(x.push(0,{receivedAtMonoMs:9999}).reason,'invalid-time');
  assert.equal(x.push(0,{observedAtMonoMs:1300}).reason,'invalid-time');
  x.set(100); assert.equal(x.d.read().reason,'clock-invalid'); x.set(10000); assert.equal(x.d.read().reason,'clock-invalid'); assert.throws(()=>x.bind());
});
for (const bad of [-1,30.001,NaN,Infinity,'5',null]) test(`invalid accuracy rejected ${String(bad)}`,()=>{
  const x=setup(); assert.equal(x.push(0,{accuracyMeters:bad}).reason,'poor-location');
});
test('accuracy max is inclusive; coordinates reject invalid latitude/longitude',()=>{
  const x=setup(); x.push(0,{accuracyMeters:30}); assert.equal(x.push(0,{accuracyMeters:30}).state,'near');
  for(const p of [{latitude:91},{longitude:181},{latitude:'0'},{longitude:NaN}]) assert.equal(x.push(0,p).reason,'poor-location');
});
test('vehicle or unlabelled input never enters synthetic policy',()=>{
  const x=setup(); for(const source of ['vehicle',undefined,'phone']) assert.equal(x.push(0,{source}).reason,'unverified-vehicle-contract');
});
for(const reason of ['permission-denied','disconnected','unsupported','initializing','manual-stage','background']) test(`${reason} invalidates old generation and recovery does not repeat notification`,()=>{
  const x=setup(); x.push(); x.push(); const old=x.token; x.d.unavailable(reason);
  assert.equal(x.d.ingest(old,x.sample()).reason,reason); x.bind(); assert.notEqual(x.token,old);
  assert.equal(x.d.ingest(old,x.sample()).state,'unknown'); x.push(); assert.equal(x.push().notify,false);
});
test('same binding idempotent; new revision invalidates callbacks and gives new notification',()=>{
  const x=setup(); x.push(); x.push(); const old=x.token; assert.equal(x.bind(),old);
  x.bind({...destination,revision:2}); assert.notEqual(x.token,old); assert.equal(x.d.ingest(old,x.sample()).state,'unknown');
  x.push(); assert.equal(x.push().notify,true); assert.throws(()=>x.bind(destination),/Old/);
});
test('conflicting coordinates with same revision invalidate previous state and token',()=>{
  const x=setup(); x.push(); x.push(); assert.throws(()=>x.bind({...destination,latitude:1}),/revision/);
  assert.equal(x.d.read().reason,'destination-conflict'); assert.equal(x.d.canNotify(x.token),false);
});
test('pre-bind observation cannot be used for a new destination',()=>{
  const x=setup(); const s=x.sample(); x.set(2000); x.bind({...destination,revision:2}); assert.equal(x.d.ingest(x.token,s).state,'unknown');
});
test('end/dispose clear state and reject delayed callback',()=>{
  const x=setup(); x.push(); x.push(); x.d.end(); assert.equal(x.d.ingest(x.token,x.sample()).reason,'ended');
  x.d.dispose(); assert.equal(x.d.read().reason,'disposed'); assert.throws(()=>x.bind());
});
test('isolated detector calls leave Board unchanged; manual Board actions still operate',()=>{
  const b=new Board(()=>1000), driver=b.create(PLACES[0]), rider=b.join(driver.id,driver.invite);
  const x=setup(); x.push(); x.push(); let v=b.read(driver.id,driver.token); assert.equal(v.stage,'waiting');
  b.act(driver.id,driver.token,{type:'arrive',view:v.view,version:v.version,requestId:'manual-arrival'});
  x.d.unavailable('manual-stage'); v=b.read(rider.id,rider.token);
  b.act(rider.id,rider.token,{type:'board',view:v.view,version:v.version,requestId:'manual-boarding'});
  assert.equal(b.read(driver.id,driver.token).stage,'boarded'); assert.equal(x.d.read().state,'unknown');
});
test('review M1: stale replay cannot downgrade still fresh near',()=>{
  const x=setup(); x.push(); const old=x.sample(); x.push(); x.set(6100);
  assert.equal(x.d.read().state,'near'); assert.equal(x.d.ingest(x.token,old).state,'near');
});
test('review M2: changing destination ID requires increasing revision',()=>{
  const x=setup(); x.push(); x.push(); assert.throws(()=>x.bind({...destination,id:'other'}),/revision/);
  assert.equal(x.d.read().state,'unknown');
});
test('review L3: rejected poor fix does not consume valid observation timestamp',()=>{
  const x=setup(); const s=x.sample(); x.d.ingest(x.token,{...s,accuracyMeters:31});
  x.d.ingest(x.token,s); assert.equal(x.push().state,'near');
});
test('exact computed accuracy margins include enter100 and exit150 boundaries',()=>{
  const x=setup(); const m=80, accuracyMeters=100-distanceMeters(destination,at(m));
  x.push(m,{accuracyMeters}); assert.equal(x.push(m,{accuracyMeters}).state,'near');
  const out=170, accuracy=distanceMeters(destination,at(out))-150;
  x.push(out,{accuracyMeters:accuracy}); assert.equal(x.push(out,{accuracyMeters:accuracy}).state,'far');
});
test('review follow-up: end is terminal even for the same session',()=>{
  const x=setup(); x.push(); x.push(); x.d.end(); assert.throws(()=>x.bind(),/ended/);
  assert.equal(x.d.ingest(x.token,x.sample()).reason,'ended');
});
test('review follow-up: detector cannot switch sessions to reset revision history',()=>{
  const x=setup(); x.bind({...destination,revision:3});
  assert.throws(()=>x.d.bind('other',destination),/one session/);
  assert.throws(()=>x.bind(destination),/Old/);
});
