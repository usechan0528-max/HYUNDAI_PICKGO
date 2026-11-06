import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Board, PLACES } from './domain.mjs';
import { ACTIONS, TICKET_TTL, parseCommand, PickupVoiceReadiness } from './gleo/adapter.mjs';

const command = (action = ACTIONS[0]) => ({ action, extras: { ACTION_PARAM: '{}' } });
function fixture(options = {}) {
  let time = 100, wall = 1000, policy = {};
  const board = new Board(() => wall), driver = board.create(PLACES[0]);
  const rider = board.join(driver.id, driver.invite);
  // Explicit FAKE trusted host. Neither Android authentication nor UX SDK evidence.
  const attest = (invocation, phase) => ({ invocation, phase, checkedAt: time, caller: 'verified', ux: 'allowed', online: true, ...policy });
  const adapter = new PickupVoiceReadiness(board, { now: () => time, attest, ...options });
  adapter.bind(driver);
  const act = (session, type, extra = {}) => {
    const state = board.read(session.id, session.token);
    return board.act(session.id, session.token, { type, requestId: crypto.randomUUID(), version: state.version, view: state.view, ...extra });
  };
  return { board, driver, rider, adapter, act,
    run: (action = ACTIONS[0]) => { const p = adapter.prepare(command(action)); return p.response || adapter.dispatch(p.ticket); },
    tick: n => { time += n; wall += n; }, wall: n => { wall += n; }, policy: value => { policy = value; } };
}
const state = f => f.board.read(f.driver.id, f.driver.token);
const data = response => JSON.parse(response.data)[0];

test('candidate schema exactly matches two parameterless commands and is outside the APK', async () => {
  const schema = JSON.parse(await readFile(new URL('./gleo/contract/schema.candidate.json', import.meta.url)));
  assert.equal(schema.actionCalls.length, 2);
  assert.deepEqual(schema.actionCalls.map(x => x.function.name), ACTIONS);
  for (const entry of schema.actionCalls) {
    assert.equal(entry.type, 'function'); assert.equal(entry.function.component, 'activity');
    assert.deepEqual(entry.function.parameters, { type: 'object', properties: {}, required: [] });
    assert.match(entry.function.description, /^[\x20-\x7e]+$/);
  }
  const manifest = await readFile(new URL('./emulator-preview/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  const gradle = await readFile(new URL('./emulator-preview/app/build.gradle', import.meta.url), 'utf8');
  for (const name of ACTIONS) assert.ok(!manifest.includes(name));
  assert.ok(!gradle.includes('gleo')); assert.ok(!gradle.includes('sourceSets'));
  await assert.rejects(readFile(new URL('./emulator-preview/app/src/main/assets/schema.json', import.meta.url)), { code: 'ENOENT' });
});

test('parser accepts empty extras and JSON whitespace only; no required arguments', () => {
  for (const action of ACTIONS) for (const extras of [undefined, {}, { ACTION_PARAM: '{}' }, { ACTION_PARAM: ' \n{ \t}\r' }]) {
    assert.equal(parseCommand({ action, extras }), action);
  }
});
test('parser rejects unknown, wrong types, mixed, injected, double-encoded and oversized inputs', () => {
  const bad = [null, [], {}, { action: 'get_pickup_status' }, { action: ' GET_PICKUP_STATUS' },
    ...['board', 'accept', 'end', 'propose', 'REPORT_PICKUP_BOARDING'].map(action => ({ action })),
    { ...command(), token: 'secret' }, { ...command(), extras: null }, { ...command(), extras: [] },
    ...[null, {}, 1, true, 'null', '[]', 'false', '"{}"', '{"ready":true}', '{"a":1,"a":2}', '{', '\ufeff{}', ' '.repeat(1025)+'{}'].map(ACTION_PARAM => ({ action: ACTIONS[1], extras: { ACTION_PARAM } })),
    { action: ACTIONS[1], extras: { ACTION_PARAM: '{}', role: 'driver' } },
    { action: ACTIONS[1], extras: { token: 'secret' } }];
  for (const value of bad) assert.throws(() => parseCommand(value), TypeError);
});
test('default unconfigured adapter refuses every known action without consulting domain', () => {
  const board = new Board(() => { assert.fail('domain must not be read'); });
  const adapter = new PickupVoiceReadiness(board);
  adapter.bind({ id: 'any', token: 'secret' });
  for (const action of ACTIONS) assert.equal(adapter.prepare(command(action)).response.status, 'fail');
});
test('actual Board status uses minimal public mapping; arrival synchronizes rider view', () => {
  const f = fixture();
  assert.deepEqual(data(f.run()), { progress: 'waiting_for_arrival', riderReady: false, riderJoined: true, locationChangePending: false });
  const version = state(f).version;
  const response = f.run(ACTIONS[1]); assert.equal(response.status, 'success');
  assert.equal(state(f).version, version + 1);
  assert.equal(f.board.read(f.rider.id, f.rider.token).stage, 'arrived');
  const encoded = JSON.stringify(response);
  for (const forbidden of [f.driver.id, f.driver.token, f.rider.token, f.driver.invite, PLACES[0], 'view', 'requestId', 'lastEvent']) assert.ok(!encoded.includes(forbidden));
  assert.equal(f.run(ACTIONS[1]).status, 'fail');
  assert.equal(state(f).version, version + 1);
});
test('rider credential and forged role cannot invoke driver commands', () => {
  const f = fixture(); f.adapter.bind({ ...f.rider, role: 'driver' });
  assert.equal(f.run().status, 'fail'); assert.equal(f.run(ACTIONS[1]).status, 'fail');
  assert.equal(state(f).stage, 'waiting');
});
test('no participant, pending location change, boarded and ended states cannot arrive', () => {
  const f = fixture(); const solo = f.board.create(PLACES[0]); f.adapter.bind(solo);
  assert.equal(f.run(ACTIONS[1]).status, 'fail');
  f.adapter.bind(f.driver); f.act(f.rider, 'propose', { place: PLACES[1] });
  assert.equal(data(f.run()).locationChangePending, true);
  assert.equal(f.run(ACTIONS[1]).status, 'fail');
  f.act(f.rider, 'withdraw', { proposalId: state(f).proposal.id });
  assert.equal(f.run(ACTIONS[1]).status, 'success'); f.act(f.rider, 'board');
  assert.equal(data(f.run()).progress, 'rider_confirmed_boarding');
  assert.equal(f.run(ACTIONS[1]).status, 'fail'); f.act(f.driver, 'end');
  assert.equal(f.run().status, 'fail'); assert.equal(f.run(ACTIONS[1]).status, 'fail');
});
test('arrival captures version and refuses intervening change; query returns fresh status', () => {
  const f = fixture(); const first = f.adapter.prepare(command(ACTIONS[1]));
  f.act(f.rider, 'ready', { ready: true });
  assert.equal(f.adapter.dispatch(first.ticket).status, 'asking'); assert.equal(state(f).stage, 'waiting');
  const query = f.adapter.prepare(command()); f.act(f.rider, 'ready', { ready: false });
  assert.equal(data(f.adapter.dispatch(query.ticket)).riderReady, false);
});
test('place agreement change after preparation cannot receive old arrival', () => {
  const f = fixture(), p = f.adapter.prepare(command(ACTIONS[1]));
  f.act(f.rider, 'propose', { place: PLACES[1] });
  f.act(f.driver, 'accept', { proposalId: state(f).proposal.id });
  assert.equal(f.adapter.dispatch(p.ticket).status, 'asking'); assert.equal(state(f).stage, 'waiting');
});
test('same ticket is consumed once; new Intent invalidates old without applying either twice', () => {
  const f = fixture(); const p = f.adapter.prepare(command(ACTIONS[1]));
  const q = f.adapter.prepare(command(ACTIONS[1]));
  // Invalid dispatch consumes pending work conservatively; a fresh invocation is required.
  assert.equal(f.adapter.dispatch(p.ticket).status, 'fail');
  assert.equal(f.adapter.dispatch(q.ticket).status, 'fail');
  const r = f.adapter.prepare(command(ACTIONS[1]));
  assert.equal(f.adapter.dispatch(r.ticket).status, 'success');
  assert.equal(f.adapter.dispatch(r.ticket).status, 'fail'); assert.equal(state(f).version, 3);
});
test('simultaneously queued dispatch microtasks apply exactly once', async () => {
  const f = fixture(), p = f.adapter.prepare(command(ACTIONS[1]));
  const results = await Promise.all([1, 2, 3].map(() => Promise.resolve().then(() => f.adapter.dispatch(p.ticket))));
  assert.equal(results.filter(r => r.status === 'success').length, 1); assert.equal(state(f).version, 3);
});
test('ticket deadline, wall-clock rollback and forward expiry fail closed', () => {
  for (const advance of [TICKET_TTL, 6999, 7000, 8000]) {
    const f = fixture(), p = f.adapter.prepare(command(ACTIONS[1]));
    f.tick(advance); f.wall(-100000);
    assert.equal(f.adapter.dispatch(p.ticket).status, 'fail'); assert.equal(state(f).stage, 'waiting');
  }
  const f = fixture(), p = f.adapter.prepare(command(ACTIONS[1])); f.tick(TICKET_TTL - 1);
  assert.equal(f.adapter.dispatch(p.ticket).status, 'success');
  const g = fixture(), q = g.adapter.prepare(command(ACTIONS[1])); g.wall(8000);
  assert.equal(g.adapter.dispatch(q.ticket).status, 'fail');
});
test('monotonic clock reversal rejects dispatch', () => {
  const f = fixture(), p = f.adapter.prepare(command(ACTIONS[1])); f.tick(-1);
  assert.equal(f.adapter.dispatch(p.ticket).status, 'fail'); assert.equal(state(f).stage, 'waiting');
});
test('offline, denied/unknown/stale UX and caller are rechecked at dispatch without data leakage', () => {
  for (const policy of [{ online: false }, { online: 'true' }, { caller: 'unknown' }, { ux: 'restricted' }, { ux: 'unknown' }, { checkedAt: -900 }, { checkedAt: 9999 }, { checkedAt: NaN }]) {
    const f = fixture(), p = f.adapter.prepare(command(ACTIONS[1])); f.policy(policy);
    assert.equal(f.adapter.dispatch(p.ticket).status, 'fail'); assert.equal(state(f).stage, 'waiting');
    const withBinding = f.run(); f.adapter.clear(); assert.deepEqual(f.run(), withBinding);
    assert.deepEqual(withBinding, { functionName: ACTIONS[0], status: 'fail', message: 'Pickup voice integration is unavailable.', mode: 'voice' });
    assert.ok(!('data' in withBinding));
  }
});
test('one-use host attestation cannot be replayed or assigned to another invocation', () => {
  let grant;
  const f = fixture({ attest: (invocation, phase) => grant ||= { invocation, phase, checkedAt: 100, caller: 'verified', ux: 'allowed', online: true } });
  const p = f.adapter.prepare(command(ACTIONS[1])); assert.ok(p.ticket);
  assert.equal(f.adapter.dispatch(p.ticket).status, 'fail');
  assert.equal(f.run().status, 'fail'); assert.equal(state(f).stage, 'waiting');
  const g = fixture({ attest: (_, phase) => ({ invocation: {}, phase, checkedAt: 100, caller: 'verified', ux: 'allowed', online: true }) });
  assert.equal(g.run().status, 'fail');
});
test('clear, rebind, invalid binding, dispose and process recreation never restore pending commands', () => {
  for (const mode of ['clear', 'bind', 'invalid', 'dispose', 'restart']) {
    const f = fixture(), p = f.adapter.prepare(command(ACTIONS[1]));
    if (mode === 'bind') f.adapter.bind(f.driver);
    else if (mode === 'invalid') f.adapter.bind(null);
    else if (mode === 'restart') f.adapter = new PickupVoiceReadiness(f.board);
    else f.adapter[mode]();
    assert.equal(f.adapter.dispatch(p.ticket).status, 'fail'); assert.equal(state(f).stage, 'waiting');
  }
});
test('missing expired or restarted server room fails without room or credential in response', () => {
  const f = fixture(), p = f.adapter.prepare(command(ACTIONS[1])); f.board.rooms.clear();
  assert.equal(f.adapter.dispatch(p.ticket).status, 'fail'); assert.equal(f.run().status, 'fail');
  const g = fixture(); g.wall(86400001); assert.equal(g.run().status, 'fail');
});
test('host exceptions and synchronous reentry cannot mutate or leak exception contents', () => {
  const f = fixture({ attest: () => { throw new Error('secret-token'); } });
  assert.ok(!JSON.stringify(f.run()).includes('secret-token'));
  let adapter, nested;
  const board = new Board(), driver = board.create(PLACES[0]); board.join(driver.id, driver.invite);
  adapter = new PickupVoiceReadiness(board, { now: () => 100, attest: (invocation, phase) => {
    nested = adapter.prepare(command(ACTIONS[1]));
    return { invocation, phase, checkedAt: 100, caller: 'verified', ux: 'allowed', online: true };
  } });
  adapter.bind(driver); const p = adapter.prepare(command(ACTIONS[1]));
  assert.equal(nested.response.status, 'fail'); assert.equal(adapter.dispatch(p.ticket).status, 'success');
  assert.equal(nested.response.status, 'fail'); assert.equal(board.read(driver.id, driver.token).version, 3);
});

test('empty, fabricated and already consumed tickets return failures without throwing', () => {
  const f = fixture();
  for (const ticket of [undefined, null, {}, 'ticket']) assert.equal(f.adapter.dispatch(ticket).status, 'fail');
  assert.equal(f.run().status, 'success'); assert.equal(f.adapter.dispatch().status, 'fail');
});
test('denied new invocation cancels pending arrival even after host policy recovers', () => {
  const f = fixture(), p = f.adapter.prepare(command(ACTIONS[1]));
  f.policy({ online: false }); assert.equal(f.run().status, 'fail');
  f.policy({}); assert.equal(f.adapter.dispatch(p.ticket).status, 'fail'); assert.equal(state(f).stage, 'waiting');
});
test('accessor action is never executed; phase mismatch and async Board are rejected', () => {
  const f = fixture(); let reads = 0;
  const input = { get action() { reads++; return ACTIONS[1]; } };
  assert.throws(() => parseCommand(input), TypeError);
  assert.equal(f.adapter.prepare(input).response.status, 'fail'); assert.equal(reads, 0);
  const p = f.adapter.prepare(command(ACTIONS[1])); f.policy({ phase: 'prepare' });
  assert.equal(f.adapter.dispatch(p.ticket).status, 'fail'); assert.equal(state(f).stage, 'waiting');
  assert.throws(() => new PickupVoiceReadiness({ read() {}, async act() {} }), TypeError);
  const board = new Board(); board.act = async () => ({});
  assert.throws(() => new PickupVoiceReadiness(board), TypeError);
});
test('dispatch reentry from trusted host attestation cannot consume twice', () => {
  let ticket, nested;
  const f = fixture({ attest: (invocation, phase) => {
    if (phase === 'dispatch') nested = f.adapter.dispatch(ticket);
    return { invocation, phase, checkedAt: 100, caller: 'verified', ux: 'allowed', online: true };
  } });
  ticket = f.adapter.prepare(command(ACTIONS[1])).ticket;
  assert.equal(f.adapter.dispatch(ticket).status, 'success'); assert.equal(nested.status, 'fail');
  assert.equal(state(f).version, 3);
});
