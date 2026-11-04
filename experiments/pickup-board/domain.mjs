import { randomBytes, randomUUID } from 'node:crypto';
export const PLACES = ['하나로마트 양재점', '현대자동차 양재사옥', '서울도로교통공단 서울지부'];
export const VIEW_TTL = 8000;
const token = () => randomBytes(24).toString('base64url');
export class Fault extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const requireThat = (ok, status, message) => { if (!ok) throw new Fault(status, message); };
export class Board {
  constructor(now = Date.now) { this.now = now; this.rooms = new Map(); }
  isPlaceAllowed(place) { return PLACES.includes(place); }
  prune() { for (const [id, room] of this.rooms) {
    if (this.now() - room.createdAt > 86400000) this.rooms.delete(id);
    if (room.joinReceipt && (this.now() - room.joinReceipt.at < 0 || this.now() - room.joinReceipt.at >= 300000)) room.joinReceipt = null;
  } }
  create(place, pickupPoint = null) {
    this.prune();
    requireThat(this.isPlaceAllowed(place), 400, '후보 목록 또는 지도에서 선택 가능한 장소를 고르세요.');
    requireThat(pickupPoint === null || (typeof pickupPoint === 'object' && !Array.isArray(pickupPoint) &&
      pickupPoint.mode === 'synthetic-diagram' && Number.isInteger(pickupPoint.x) && pickupPoint.x >= 0 && pickupPoint.x <= 1000 &&
      Number.isInteger(pickupPoint.y) && pickupPoint.y >= 0 && pickupPoint.y <= 600 &&
      Object.keys(pickupPoint).every(key => ['mode', 'x', 'y'].includes(key))), 400, '시연 지점 형식을 확인하세요.');
    requireThat(this.rooms.size < 100, 429, '회차가 너무 많습니다. 로컬 서버를 재시작해 주세요.');
    const room = { id: randomUUID(), createdAt: this.now(), version: 1, placeRevision: 1, status: 'active', place,
      pickupPoint: pickupPoint ? { ...pickupPoint } : null,
      ready: false, joined: false, stage: 'waiting', outcome: null, proposal: null, lastEvent: '운전자가 픽업을 시작했습니다.',
      driver: token(), rider: null, invite: token(), views: new Map(), requests: new Set() };
    this.rooms.set(room.id, room);
    return { id: room.id, token: room.driver, invite: room.invite, role: 'driver' };
  }
  room(id) { this.prune(); const r = this.rooms.get(id); requireThat(r, 404, '없거나 만료된 픽업입니다. 서버를 다시 켜면 픽업이 사라집니다.'); return r; }
  join(id, invite, joinId) {
    const r = this.room(id);
    if (joinId !== undefined) requireThat(typeof joinId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(joinId), 400, '참여 요청 식별자가 올바르지 않습니다.');
    // Retry only the same persisted attempt; a second recipient cannot redeem
    // the consumed link. This receipt is never exposed in room reads or logs.
    if (r.status === 'active' && r.joinReceipt && r.joinReceipt.joinId === joinId && r.joinReceipt.invite === invite) return { id, token: r.rider, role: 'rider' };
    requireThat(r.status === 'active' && !r.joined && typeof invite === 'string' && invite === r.invite, 403, '초대가 유효하지 않거나 이미 사용되었습니다.');
    if (joinId) r.joinReceipt = { joinId, invite, at: this.now() };
    r.rider = token(); r.invite = null; r.joined = true; r.version++; r.lastEvent = '탑승자가 참여했습니다.';
    return { id, token: r.rider, role: 'rider' };
  }
  auth(r, credential) {
    requireThat(typeof credential === 'string' && credential.length > 0, 401, '참여 권한이 없습니다.');
    const role = credential === r.driver ? 'driver' : credential === r.rider ? 'rider' : null;
    requireThat(role, 403, '이 회차의 참여자가 아닙니다.'); return role;
  }
  read(id, credential) {
    const r = this.room(id), role = this.auth(r, credential), view = token();
    // A short bounded list tolerates polling and command requests crossing in flight.
    const views = (r.views.get(credential) || []).filter(v => this.now() - v.at < VIEW_TTL).slice(-9);
    views.push({ key: view, at: this.now() }); r.views.set(credential, views);
    return { id, role, version: r.version, placeRevision: r.placeRevision, status: r.status, place: r.place, pickupPoint: r.pickupPoint ? { ...r.pickupPoint } : null, ready: r.ready,
      joined: r.joined, stage: r.stage, outcome: r.outcome, proposal: r.proposal ? { ...r.proposal } : null, lastEvent: r.lastEvent, view, ttl: VIEW_TTL };
  }
  act(id, credential, command) {
    const r = this.room(id), role = this.auth(r, credential);
    requireThat(command && typeof command === 'object', 400, '요청 형식이 올바르지 않습니다.');
    const { requestId, version, view, type } = command;
    requireThat(typeof requestId === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(requestId), 400, '요청 식별자가 필요합니다.');
    requireThat(!r.requests.has(requestId), 409, '이미 처리된 요청입니다. 최신 상태를 확인해 주세요.');
    requireThat(r.status === 'active', 409, '종료된 픽업은 바꿀 수 없습니다.');
    requireThat(r.version === version, 409, '다른 변경이 먼저 반영됐습니다.');
    requireThat((r.views.get(credential) || []).some(v => v.key === view && this.now() - v.at < VIEW_TTL), 409, '조회한 상태가 오래되었습니다. 새로 확인해 주세요.');
    requireThat(type === 'end' || r.requests.size < 1000, 429, '회차의 변경 한도를 초과했습니다.');
    if (['ready', 'propose', 'accept'].includes(type)) requireThat(r.stage !== 'boarded', 409, '탑승 확인 후에는 준비 상태와 장소를 바꿀 수 없습니다. 잘못 눌렀다면 탑승 확인을 취소하세요.');
    if (type === 'arrive') {
      requireThat(role === 'driver', 403, '운전자만 도착을 알릴 수 있습니다.');
      requireThat(r.joined && r.stage === 'waiting' && !r.proposal, 409, '상대 참여와 장소 합의가 먼저입니다. 도착은 한 번만 누를 수 있습니다.');
      r.stage = 'arrived'; r.lastEvent = '운전자가 픽업 장소에 도착했습니다.';
    } else if (type === 'board') {
      requireThat(role === 'rider', 403, '탑승자만 탑승을 확인할 수 있습니다.');
      requireThat(r.stage === 'arrived' && !r.proposal, 409, '운전자 도착과 장소 합의가 먼저입니다.');
      r.stage = 'boarded'; r.lastEvent = '탑승자가 탑승했습니다. 종료만 남았습니다.';
    } else if (type === 'undoArrival') {
      requireThat(role === 'driver', 403, '운전자만 도착 표시를 취소할 수 있습니다.');
      requireThat(r.stage === 'arrived', 409, '탑승 확인 전 도착 표시만 취소할 수 있습니다.');
      r.stage = 'waiting'; r.lastEvent = '운전자가 도착 표시를 취소했습니다.';
    } else if (type === 'undoBoarding') {
      requireThat(role === 'rider', 403, '탑승자만 탑승 확인을 취소할 수 있습니다.');
      requireThat(r.stage === 'boarded', 409, '탑승 확인 상태가 아닙니다.');
      r.stage = 'arrived'; r.lastEvent = '탑승자가 탑승 확인을 취소했습니다. 운전자 도착은 유지됩니다.';
    } else if (type === 'ready') {
      requireThat(role === 'rider', 403, '탑승자만 준비 상태를 바꿀 수 있습니다.');
      requireThat(typeof command.ready === 'boolean', 400, '준비 상태는 참 또는 거짓이어야 합니다.');
      r.ready = command.ready; r.lastEvent = r.ready ? '탑승자가 준비를 마쳤습니다.' : '탑승자가 준비 중입니다.';
    } else if (type === 'propose') {
      requireThat(r.joined && !r.proposal, 409, '상대 참여 또는 기존 제안 처리를 기다리세요.');
      requireThat(this.isPlaceAllowed(command.place) && command.place !== r.place, 400, '현재와 다른 지점을 고르세요.');
      r.proposal = { id: randomUUID(), by: role, place: command.place };
      r.lastEvent = '장소 변경을 제안했습니다. 수락 전까지 기존 장소를 유지합니다.';
    } else if (type === 'accept' || type === 'reject') {
      requireThat(r.proposal && r.proposal.id === command.proposalId, 409, '현재 제안과 일치하지 않습니다.');
      requireThat(r.proposal.by !== role, 403, '자신의 제안을 직접 수락하거나 거절할 수 없습니다.');
      const resetArrival = type === 'accept' && r.stage === 'arrived';
      if (type === 'accept') { r.place = r.proposal.place; r.pickupPoint = null; r.placeRevision++; r.stage = 'waiting'; }
      r.proposal = null; r.lastEvent = type === 'accept' ? '변경을 수락해 픽업 장소를 바꿨습니다.' : '변경을 거절해 기존 장소를 유지합니다.';
      if (resetArrival) r.lastEvent += ' 이전 도착 표시는 취소되었습니다. 새 장소에 도착하면 다시 누르세요.';
    } else if (type === 'withdraw') {
      requireThat(r.proposal && r.proposal.id === command.proposalId, 409, '현재 제안과 일치하지 않습니다.');
      requireThat(r.proposal.by === role, 403, '제안한 사람만 철회할 수 있습니다.');
      r.proposal = null; r.lastEvent = '제안을 철회했습니다. 기존 장소를 유지합니다.';
    } else if (type === 'end') {
      r.outcome = r.stage === 'boarded' ? 'completed' : 'cancelled';
      r.status = 'ended'; r.proposal = null; r.invite = null; r.joinReceipt = null;
      r.lastEvent = `${role === 'driver' ? '운전자' : '탑승자'}가 ` + (r.outcome === 'completed' ? '탑승 후 픽업을 완료했습니다.' : '탑승 없이 픽업을 취소했습니다.');
    } else throw new Fault(400, '알 수 없는 요청입니다.');
    r.requests.add(requestId); r.version++;
    return this.read(id, credential);
  }
}
