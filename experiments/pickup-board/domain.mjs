import { randomBytes, randomUUID } from 'node:crypto';
export const PLACES = ['가상 문화센터 정문', '가상 문화센터 동쪽 입구', '가상 공원 안내소'];
export const VIEW_TTL = 8000;
const token = () => randomBytes(24).toString('base64url');
export class Fault extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const requireThat = (ok, status, message) => { if (!ok) throw new Fault(status, message); };
export class Board {
  constructor(now = Date.now) { this.now = now; this.rooms = new Map(); }
  prune() { for (const [id, room] of this.rooms) if (this.now() - room.createdAt > 86400000) this.rooms.delete(id); }
  create(place) {
    this.prune();
    requireThat(PLACES.includes(place), 400, '목록에서 승차지점을 선택해 주세요.');
    requireThat(this.rooms.size < 100, 429, '회차가 너무 많습니다. 로컬 서버를 재시작해 주세요.');
    const room = { id: randomUUID(), createdAt: this.now(), version: 1, status: 'active', place,
      ready: false, joined: false, stage: 'waiting', outcome: null, proposal: null, lastEvent: '운전자가 약속을 만들었습니다.',
      driver: token(), rider: null, invite: token(), views: new Map(), requests: new Set() };
    this.rooms.set(room.id, room);
    return { id: room.id, token: room.driver, invite: room.invite, role: 'driver' };
  }
  room(id) { this.prune(); const r = this.rooms.get(id); requireThat(r, 404, '회차가 없거나 만료되었습니다. 서버 재시작 시 회차가 사라집니다.'); return r; }
  join(id, invite) {
    const r = this.room(id);
    requireThat(r.status === 'active' && !r.joined && typeof invite === 'string' && invite === r.invite, 403, '초대가 유효하지 않거나 이미 사용되었습니다.');
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
    return { id, role, version: r.version, status: r.status, place: r.place, ready: r.ready,
      joined: r.joined, stage: r.stage, outcome: r.outcome, proposal: r.proposal ? { ...r.proposal } : null, lastEvent: r.lastEvent, view, ttl: VIEW_TTL };
  }
  act(id, credential, command) {
    const r = this.room(id), role = this.auth(r, credential);
    requireThat(command && typeof command === 'object', 400, '요청 형식이 올바르지 않습니다.');
    const { requestId, version, view, type } = command;
    requireThat(typeof requestId === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(requestId), 400, '요청 식별자가 필요합니다.');
    requireThat(!r.requests.has(requestId), 409, '이미 처리된 요청입니다. 최신 상태를 확인해 주세요.');
    requireThat(r.status === 'active', 409, '종료된 회차는 바꿀 수 없습니다.');
    requireThat(r.version === version, 409, '다른 변경이 있습니다. 최신 상태를 확인하고 다시 선택해 주세요.');
    requireThat((r.views.get(credential) || []).some(v => v.key === view && this.now() - v.at < VIEW_TTL), 409, '조회한 상태가 오래되었습니다. 새로 확인해 주세요.');
    requireThat(r.requests.size < 1000, 429, '회차의 변경 한도를 초과했습니다.');
    if (['ready', 'propose', 'accept'].includes(type)) requireThat(r.stage !== 'boarded', 409, '탑승 확인 후에는 준비나 장소를 바꿀 수 없습니다. 잘못 눌렀다면 탑승 확인을 취소해 주세요.');
    if (type === 'arrive') {
      requireThat(role === 'driver', 403, '운전자만 도착을 알릴 수 있습니다.');
      requireThat(r.joined && r.stage === 'waiting' && !r.proposal, 409, '상대 참여와 장소 합의를 확인해 주세요. 도착은 한 번만 알릴 수 있습니다.');
      r.stage = 'arrived'; r.lastEvent = '운전자가 확정 승차지점에 도착했다고 알렸습니다.';
    } else if (type === 'board') {
      requireThat(role === 'rider', 403, '탑승자만 탑승을 확인할 수 있습니다.');
      requireThat(r.stage === 'arrived' && !r.proposal, 409, '운전자 도착과 장소 합의를 먼저 확인해 주세요.');
      r.stage = 'boarded'; r.lastEvent = '탑승자가 탑승했다고 확인했습니다. 약속 종료를 기다립니다.';
    } else if (type === 'undoArrival') {
      requireThat(role === 'driver', 403, '운전자만 도착 표시를 취소할 수 있습니다.');
      requireThat(r.stage === 'arrived', 409, '탑승 확인 전 도착 표시만 취소할 수 있습니다.');
      r.stage = 'waiting'; r.lastEvent = '운전자가 도착 표시를 취소했습니다.';
    } else if (type === 'undoBoarding') {
      requireThat(role === 'rider', 403, '탑승자만 탑승 확인을 취소할 수 있습니다.');
      requireThat(r.stage === 'boarded', 409, '탑승 확인 상태가 아닙니다.');
      r.stage = 'arrived'; r.lastEvent = '탑승자가 탑승 확인을 취소했습니다. 운전자 도착 표시는 유지됩니다.';
    } else if (type === 'ready') {
      requireThat(role === 'rider', 403, '탑승자만 준비 상태를 바꿀 수 있습니다.');
      requireThat(typeof command.ready === 'boolean', 400, '준비 상태는 참 또는 거짓이어야 합니다.');
      r.ready = command.ready; r.lastEvent = r.ready ? '탑승자가 준비되었습니다.' : '탑승자가 아직 준비 중입니다.';
    } else if (type === 'propose') {
      requireThat(r.joined && !r.proposal, 409, '상대 참여 또는 기존 제안 처리를 기다려 주세요.');
      requireThat(PLACES.includes(command.place) && command.place !== r.place, 400, '현재 지점과 다른 지점을 선택해 주세요.');
      r.proposal = { id: randomUUID(), by: role, place: command.place };
      r.lastEvent = '장소 변경을 제안했습니다. 아직 확정되지 않았습니다.';
    } else if (type === 'accept' || type === 'reject') {
      requireThat(r.proposal && r.proposal.id === command.proposalId, 409, '현재 제안과 일치하지 않습니다.');
      requireThat(r.proposal.by !== role, 403, '자신의 제안을 직접 수락하거나 거절할 수 없습니다.');
      const resetArrival = type === 'accept' && r.stage === 'arrived';
      if (type === 'accept') { r.place = r.proposal.place; r.stage = 'waiting'; }
      r.proposal = null; r.lastEvent = type === 'accept' ? '변경이 수락되어 승차지점을 변경했습니다.' : '변경이 거절되어 기존 승차지점을 유지합니다.';
      if (resetArrival) r.lastEvent += ' 이전 도착 표시는 취소되었습니다. 새 장소에서 다시 알려주세요.';
    } else if (type === 'withdraw') {
      requireThat(r.proposal && r.proposal.id === command.proposalId, 409, '현재 제안과 일치하지 않습니다.');
      requireThat(r.proposal.by === role, 403, '제안한 사람만 철회할 수 있습니다.');
      r.proposal = null; r.lastEvent = '제안을 철회해 기존 승차지점을 유지합니다.';
    } else if (type === 'end') {
      r.outcome = r.stage === 'boarded' ? 'completed' : 'cancelled';
      r.status = 'ended'; r.proposal = null; r.invite = null;
      r.lastEvent = `${role === 'driver' ? '운전자' : '탑승자'}가 ` + (r.outcome === 'completed' ? '탑승 확인 후 이번 픽업을 완료했습니다.' : '탑승 완료 없이 이번 약속을 취소했습니다.');
    } else throw new Fault(400, '알 수 없는 요청입니다.');
    r.requests.add(requestId); r.version++;
    return this.read(id, credential);
  }
}
