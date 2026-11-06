import { randomBytes, randomUUID } from 'node:crypto';
import { Fault } from '../domain.mjs';
import { mapModel } from '../map/service.mjs';
import { bestOrder, demoMatrix } from './planner.mjs';

const token = () => randomBytes(24).toString('base64url');
const ok = (condition, status, text) => { if (!condition) throw new Fault(status, text); };
const copy = value => structuredClone(value);
const pending = p => !['boarded', 'cancelled'].includes(p.state);
export class MultiBoard {
  constructor({ now = Date.now, checkPoint = p => mapModel.check(p), provider = null, timeout = 3000 } = {}) {
    this.now = now; this.checkPoint = checkPoint; this.provider = provider; this.timeout = timeout; this.trips = new Map();
  }
  prune() { for (const [id, t] of this.trips) if (this.now() - t.createdAt >= 86400000) this.trips.delete(id); }
  point(value) {
    ok(Array.isArray(value) && value.length === 2 && value.every(Number.isFinite), 400, '좌표를 확인하세요.');
    const result = this.checkPoint(value);
    ok(result?.selectable, 400, '현재 선택할 수 없는 지점입니다. 지도 조건을 확인하세요.');
    return [...value];
  }
  create({ origin, destination = null, demo = false } = {}) {
    this.prune(); ok(this.trips.size < 100, 429, '회차 한도입니다.');
    ok(typeof demo === 'boolean', 400, '데모 설정을 확인하세요.');
    const t = { id: randomUUID(), createdAt: this.now(), version: 1, driver: token(), origin: this.point(origin),
      destination: destination === null ? null : this.point(destination), demo, status: 'active', participants: [], stops: [],
      order: [], active: null, recommendation: null, views: new Map(), requests: new Set(), navigation: 'unconnected' };
    this.trips.set(t.id, t); return { id: t.id, token: t.driver, role: 'driver' };
  }
  trip(id) { this.prune(); const t = this.trips.get(id); ok(t, 404, '없거나 만료된 회차입니다.'); return t; }
  auth(t, credential) {
    ok(typeof credential === 'string' && credential.length > 0, 401, '참여 권한이 필요합니다.');
    if (credential === t.driver) return { role: 'driver' };
    const p = t.participants.find(p => p.credential === credential);
    ok(p, 403, '이 회차의 참여자가 아닙니다.'); return { role: 'rider', p };
  }
  touch(t) { t.version++; t.recommendation = null; }
  normalize(t) {
    t.order = t.order.filter(id => t.participants.some(p => p.stopId === id && pending(p)));
    if (t.active && !t.order.includes(t.active)) {
      const stop = t.stops.find(s => s.id === t.active);
      if (stop.arrived) t.origin = [...stop.point];
      t.active = null;
    }
  }
  join(id, { invite, joinId } = {}) {
    const t = this.trip(id);
    ok(t.status === 'active', 409, '종료된 회차입니다.');
    ok(typeof joinId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(joinId), 400, '참여 요청 식별자가 필요합니다.');
    const p = t.participants.find(p => typeof invite === 'string' && (p.invite === invite || p.receipt?.invite === invite));
    ok(p && p.state !== 'cancelled', 403, '유효하지 않은 초대입니다.');
    if (p.joined) {
      ok(p.receipt?.joinId === joinId && this.now() - p.receipt.at < 300000, 403, '이미 사용된 초대입니다.');
    } else {
      this.point(t.stops.find(s => s.id === p.stopId).point);
      p.joined = true; p.credential = token(); p.receipt = { invite, joinId, at: this.now() }; p.invite = null; this.touch(t);
    }
    return { id, token: p.credential, role: 'rider' };
  }
  preview(id, invite) {
    const t = this.trip(id), p = t.participants.find(p => typeof invite === 'string' && p.invite === invite);
    ok(t.status === 'active' && p && pending(p), 403, '유효하지 않거나 사용된 초대입니다.');
    return { name: p.name, stop: copy(t.stops.find(s => s.id === p.stopId)), demo: t.demo };
  }
  read(id, credential) {
    const t = this.trip(id), actor = this.auth(t, credential), view = token();
    const views = (t.views.get(credential) || []).filter(v => this.now() - v.at < 15000).slice(-9);
    views.push({ value: view, at: this.now() }); t.views.set(credential, views);
    const base = { id, version: t.version, view, role: actor.role, status: t.status, demo: t.demo, navigation: t.navigation };
    const publicPerson = p => ({ id: p.id, name: p.name, stopId: p.stopId, joined: p.joined, ready: p.ready, state: p.state });
    if (actor.role === 'rider') {
      const p = actor.p, stop = t.stops.find(s => s.id === p.stopId);
      return { ...base, participant: publicPerson(p), stop: copy(stop), ordinal: t.order.indexOf(p.stopId) + 1,
        arrived: t.active === p.stopId && stop.arrived };
    }
    return { ...base, origin: copy(t.origin), destination: copy(t.destination), active: t.active,
      stops: copy(t.stops), order: [...t.order], participants: t.participants.map(publicPerson),
      invites: t.participants.filter(p => p.invite && pending(p)).map(p => ({ id: p.id, invite: p.invite })),
      recommendation: t.recommendation && this.now() < t.recommendation.expiresAt ? copy(t.recommendation) : null };
  }
  guard(t, credential, command) {
    const actor = this.auth(t, credential);
    ok(command && typeof command === 'object', 400, '요청이 필요합니다.');
    ok(t.status === 'active', 409, '종료된 회차입니다.');
    ok(command.version === t.version, 409, '상태가 바뀌었습니다. 다시 확인하세요.');
    ok((t.views.get(credential) || []).some(v => v.value === command.view && this.now() - v.at < 15000), 409, '다시 조회한 후 진행하세요.');
    ok(typeof command.requestId === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(command.requestId), 400, '요청 식별자가 필요합니다.');
    ok(!t.requests.has(command.requestId), 409, '이미 처리한 요청입니다.');
    ok(t.requests.size < 2000 || command.type === 'end', 429, '변경 한도입니다. 회차를 종료하세요.');
    return actor;
  }
  act(id, credential, c) {
    const t = this.trip(id), actor = this.guard(t, credential, c);
    if (actor.role === 'rider') ok(['ready', 'board', 'cancel'].includes(c.type), 403, '운전자만 할 수 있습니다.');
    const person = () => {
      const p = actor.role === 'rider' ? actor.p : t.participants.find(p => p.id === c.participantId);
      ok(p && (actor.role !== 'rider' || c.participantId === undefined || c.participantId === p.id), 403, '본인 상태만 바꿀 수 있습니다.');
      ok(pending(p), 409, '이미 처리된 참가자입니다.'); return p;
    };
    switch (c.type) {
      case 'add': {
        ok(!t.active, 409, '현재 경유지 처리를 마친 뒤 추가하세요.');
        ok(t.participants.length < 6, 409, '초기 버전은 회차당 총 6명까지 지원합니다.');
        ok(typeof c.name === 'string' && c.name.trim().length > 0 && c.name.trim().length <= 30, 400, '이름은 1~30자로 입력하세요.');
        let stop = t.stops.find(s => s.id === c.stopId);
        if (c.stopId !== undefined) ok(stop && t.order.includes(stop.id), 400, '진행 중인 지점을 선택하세요.');
        if (!stop) {
          ok(typeof c.label === 'string' && c.label.trim().length > 0 && c.label.trim().length <= 80, 400, '지점 이름을 확인하세요.');
          stop = { id: randomUUID(), label: c.label.trim(), point: this.point(c.point), arrived: false };
          t.stops.push(stop); t.order.push(stop.id);
        } else this.point(stop.point);
        t.participants.push({ id: randomUUID(), name: c.name.trim(), stopId: stop.id, invite: token(), credential: null,
          joined: false, ready: false, state: 'waiting' }); break;
      }
      case 'ready': {
        ok(actor.role === 'rider', 403, '준비 상태는 본인이 변경합니다.'); const p = person();
        ok(typeof c.ready === 'boolean', 400, '준비 상태를 확인하세요.'); p.ready = c.ready; break;
      }
      case 'order': {
        ok(Array.isArray(c.order) && c.order.length === t.order.length && new Set(c.order).size === t.order.length && c.order.every(x => t.order.includes(x)), 400, '모든 남은 지점이 한 번씩 필요합니다.');
        ok(!t.active || c.order[0] === t.active, 409, '진행 중인 첫 지점은 고정됩니다.'); t.order = [...c.order]; break;
      }
      case 'apply': {
        const r = t.recommendation;
        ok(r && r.id === c.recommendationId && r.version === t.version && this.now() < r.expiresAt && this.now() >= r.observedAt, 409, '추천이 만료되었습니다. 다시 계산하세요.');
        t.order = [...r.order]; break;
      }
      case 'next': {
        ok(!t.active && t.order.length, 409, '현재 지점의 탑승 또는 취소를 먼저 확인하세요.');
        const stop = t.stops.find(s => s.id === t.order[0]); this.point(stop.point);
        t.active = stop.id; stop.arrived = false; break;
      }
      case 'arrive': {
        ok(t.active, 409, '다음 픽업을 먼저 선택하세요.');
        const stop = t.stops.find(s => s.id === t.active); ok(!stop.arrived, 409, '이미 도착 표시되었습니다.');
        stop.arrived = true; t.origin = [...stop.point]; break;
      }
      case 'board': {
        ok(actor.role === 'rider', 403, '탑승은 본인이 확인합니다.'); const p = person();
        ok(t.active === p.stopId && t.stops.find(s => s.id === p.stopId).arrived, 409, '본인 지점에 도착한 뒤 확인하세요.'); p.state = 'boarded'; break;
      }
      case 'cancel': { const p = person(); p.state = 'cancelled'; p.invite = null; p.receipt = null; break; }
      case 'end': {
        ok(t.participants.length && t.participants.every(p => !pending(p)), 409, '남은 사람의 탑승 또는 취소를 확인하세요.');
        t.status = t.participants.every(p => p.state === 'boarded') ? 'completed' : t.participants.some(p => p.state === 'boarded') ? 'partial' : 'cancelled'; break;
      }
      default: throw new Fault(400, '지원하지 않는 동작입니다.');
    }
    t.requests.add(c.requestId); this.normalize(t); this.touch(t); return this.read(id, credential);
  }
  async recommend(id, credential, c) {
    const t = this.trip(id), actor = this.guard(t, credential, c);
    ok(actor.role === 'driver', 403, '운전자만 추천을 볼 수 있습니다.');
    ok(t.order.length > 0, 409, '남은 픽업 지점이 없습니다.');
    ok(t.demo || this.provider, 503, '실제 경로 데이터가 연결되지 않았습니다. 수동 순서를 사용하세요.');
    const version = t.version, generation = token(); t.recommendation = null; t.calculation = generation;
    t.requests.add(c.requestId);
    const input = copy({ origin: t.origin, destination: t.destination, stops: t.stops.filter(s => t.order.includes(s.id)), order: t.order, now: this.now() });
    let timer; const controller = new AbortController();
    try {
      const data = await Promise.race([
        Promise.resolve().then(() => t.demo ? demoMatrix(input) : this.provider(input, controller.signal)),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('TIMEOUT')); }, this.timeout); })
      ]);
      ok(this.trips.get(id) === t && t.status === 'active' && this.now() - t.createdAt < 86400000 && t.version === version && t.calculation === generation, 409, '계산 중 상태가 바뀌었습니다. 다시 계산하세요.');
      ok(data && data.mode === (t.demo ? 'demo' : 'real') && typeof data.source === 'string' && data.source.length > 0 &&
        Number.isFinite(data.observedAt) && data.observedAt <= this.now() && Number.isFinite(data.expiresAt) && data.expiresAt > this.now() && this.now() - data.observedAt < 60000,
      503, '경로 데이터가 오래되었거나 유효하지 않습니다.');
      const result = bestOrder(t.order, data.matrix, { final: !!t.destination, active: t.active,
        arrived: !!t.stops.find(s => s.id === t.active)?.arrived });
      t.recommendation = { ...result, id: token(), version, source: data.source, mode: data.mode, observedAt: data.observedAt,
        expiresAt: Math.min(data.expiresAt, data.observedAt + 60000) };
      return this.read(id, credential);
    } catch (e) { if (e instanceof Fault) throw e; throw new Fault(503, '경로 계산을 완료하지 못했습니다. 수동 순서는 유지됩니다.'); }
    finally { clearTimeout(timer); }
  }
}
