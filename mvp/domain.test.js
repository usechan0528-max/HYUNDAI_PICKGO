import test from 'node:test';
import assert from 'node:assert/strict';
import { describeLot, transition, POLICY } from './domain.js';
import { makeLots, DEMO_NOW } from './fixtures.js';
const state = { now: DEMO_NOW, mode: 'parked', connected: true, selected: null, feedback: null };

test('fresh provider count is shown, including zero (not unknown)', () => {
  assert.equal(describeLot(makeLots()[0], state).available, 12);
  assert.equal(describeLot(makeLots('full')[0], state).available, 0);
  assert.equal(describeLot(makeLots('full')[0], state).kind, 'official');
});
test('freshness boundary suppresses old counts at exactly five minutes', () => {
  const l = makeLots()[0]; l.observedAt = DEMO_NOW - POLICY.freshMs;
  assert.equal(describeLot(l, state).kind, 'stale');
  assert.equal(describeLot(l, state).available, null);
  l.observedAt += 1; assert.equal(describeLot(l, state).available, 12);
});
test('malformed values and future timestamps never become available spaces', () => {
  const l = makeLots()[0];
  for (const value of [-1, 101, NaN, Infinity, '12', 1.5, null]) {
    assert.equal(describeLot({ ...l, available: value }, state).kind, 'unknown');
  }
  for (const stamp of [DEMO_NOW + 1, null, NaN]) {
    assert.equal(describeLot({ ...l, observedAt: stamp }, state).kind, 'unknown');
  }
});
test('missing source, disconnect and stale values do not mean zero spaces', () => {
  assert.equal(describeLot(makeLots()[2], state).available, null);
  assert.equal(describeLot(makeLots()[0], { ...state, connected: false }).kind, 'offline');
  assert.equal(describeLot(makeLots('stale')[0], state).available, null);
});
test('community observations never create a space count or an exit forecast', () => {
  const v = describeLot(makeLots()[1], state);
  assert.equal(v.kind, 'community'); assert.equal(v.available, null);
  assert.equal(v.title, '최근 참여 차량 움직임 관측');
  assert.equal(describeLot(makeLots('sparse')[1], state).kind, 'unknown');
});
test('repeated signals from one participant do not meet the sample threshold', () => {
  const lot = makeLots()[1]; lot.events = Array(20).fill(lot.events[0]);
  assert.equal(describeLot(lot, state).kind, 'unknown');
});
test('wrong lot, expired, unconsented, ambiguous and future events are excluded', () => {
  for (const patch of [{ lotId: 'other' }, { consented: false }, { attribution: 'ambiguous' },
    { at: DEMO_NOW + 1 }, { at: DEMO_NOW - POLICY.freshMs }, { contributor: '' }, { kind: 'exit' }]) {
    const lot = makeLots()[1]; lot.events[0] = { ...lot.events[0], ...patch };
    assert.equal(describeLot(lot, state).kind, 'unknown', JSON.stringify(patch));
  }
});
test('malformed event collections fail closed', () => {
  const lot = makeLots()[1];
  for (const events of [null, {}, [null, undefined, {}, 1]]) {
    assert.equal(describeLot({ ...lot, events }, state).kind, 'unknown');
  }
});
test('mode transition clears selected details; unknown cannot select or send feedback', () => {
  const lots = makeLots();
  const selected = transition(state, { type: 'select', id: 'central' }, lots);
  for (const mode of ['unknown', 'restricted', 'invalid']) {
    const locked = transition(selected, { type: 'mode', value: mode }, lots);
    assert.equal(locked.selected, null);
    assert.equal(transition(locked, { type: 'select', id: 'central' }, lots).selected, null);
    assert.equal(transition(locked, { type: 'feedback', value: 'useful' }, lots).feedback, null);
    assert.equal(describeLot(lots[0], locked).kind, 'locked');
  }
});
test('switching lots clears feedback and invalid selections are ignored', () => {
  const lots = makeLots();
  let s = transition(state, { type: 'select', id: 'central' }, lots);
  s = transition(s, { type: 'feedback', value: 'useful' }, lots);
  assert.equal(s.feedback, 'useful');
  s = transition(s, { type: 'select', id: 'garden' }, lots);
  assert.equal(s.feedback, null);
  assert.equal(transition(s, { type: 'select', id: 'invalid' }, lots), s);
});
test('time advance expires provider and community data; reconnect does not refresh timestamps', () => {
  const lots = makeLots();
  let s = transition(state, { type: 'advance' }, lots);
  s = transition(s, { type: 'connection', value: false }, lots);
  s = transition(s, { type: 'connection', value: true }, lots);
  assert.equal(describeLot(lots[0], s).kind, 'stale');
  assert.equal(describeLot(lots[1], s).kind, 'unknown');
});
