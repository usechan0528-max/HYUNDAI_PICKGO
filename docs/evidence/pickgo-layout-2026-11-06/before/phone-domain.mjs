import { Board, Fault, VIEW_TTL } from './domain.mjs';
export const LOCATION_TTL = 30000, GRANT_TTL = 20000;
const check = (ok, status, message) => { if (!ok) throw new Fault(status, message); };
const uuid = x => typeof x === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
// Coordinates are deliberately kept outside Board rooms, events and action history.
export class PhoneBoard extends Board {
  constructor(now = Date.now, mono = () => performance.now()) { super(now); this.mono = mono; this.locations = new Map(); this.lastMono = mono(); }
  sweep() {
    const at = this.mono();
    if (!Number.isFinite(at) || at < this.lastMono) {
      for (const entry of this.locations.values()) { entry.grant = null; entry.sample = null; }
    }
    this.lastMono = at;
    for (const [id, entry] of this.locations) {
      const room = this.rooms.get(id);
      if (!room) { this.locations.delete(id); continue; }
      if (room.status !== 'active' || room.stage === 'boarded') { entry.grant = null; entry.sample = null; }
      if (entry.grant && at >= entry.grant.until) entry.grant = null;
      if (entry.sample && at >= entry.sample.until) entry.sample = null;
    }
  }
  act(...args) {
    const result = super.act(...args);
    if (args[2]?.type === 'accept') {
      const entry = this.locations.get(args[0]);
      if (entry) { entry.grant = null; entry.sample = null; }
    }
    this.sweep(); return result;
  }
  phone(id, credential, input = null) {
    const room = this.room(id), role = this.auth(room, credential);
    this.sweep();
    let entry = this.locations.get(id);
    if (!input) {
      const sample = entry?.sample;
      return { source: 'rider-phone', sample: sample ? { ...sample.fix, source: 'rider-phone', receivedAt: sample.receivedAt, ageMs: sample.ageAtReceipt + this.mono() - sample.receivedMono,
        remainingMs: Math.max(0, sample.until - this.mono()) } : null };
    }
    check(role === 'rider', 403, '탑승자만 위치를 공유하거나 삭제할 수 있습니다.');
    check(typeof input === 'object' && uuid(input.consentId), 400, '공유 요청 형식이 올바르지 않습니다.');
    check(['grant','publish','revoke'].includes(input.type), 400, '알 수 없는 위치 요청입니다.');
    if (!entry) { entry = { ids: new Set(), grant: null, sample: null }; this.locations.set(id, entry); }
    const { consentId, type } = input;
    // Retain used IDs for the entire room lifetime: late grant/publish cannot resurrect consent.
    if (type === 'revoke') {
      // Bounded tombstones; when full, all future grants fail closed.
      if (entry.ids.size < 100) entry.ids.add(consentId);
      if (entry.grant?.id === consentId) entry.grant = null;
      if (entry.sample?.id === consentId) entry.sample = null;
      return { deleted: true };
    }
    check(room.status === 'active' && room.stage !== 'boarded', 409, '종료되었거나 탑승한 회차입니다.');
    const at = this.mono();
    check(Number.isFinite(at), 409, '시각을 확인할 수 없습니다.');
    if (type === 'grant') {
      check(entry.ids.size < 100, 429, '이 회차의 위치 공유 횟수를 초과했습니다.');
      check(!entry.ids.has(consentId), 409, '새 동의 요청이 필요합니다.');
      check(input.consent === 'pickup-location-once-v1', 400, '위치 공유 안내에 동의해 주세요.');
      check(room.version === input.version && (room.views.get(credential) || []).some(v => v.key === input.view && this.now()-v.at >= 0 && this.now()-v.at < VIEW_TTL), 409, '회차를 다시 확인하고 동의해 주세요.');
      entry.ids.add(consentId); entry.sample = null;
      entry.grant = { id: consentId, until: at + GRANT_TTL, wall: this.now() };
      return { granted: true, expiresInMs: GRANT_TTL };
    }
    const grant = entry.grant;
    check(grant && grant.id === consentId && at < grant.until, 409, '공유 동의가 만료되거나 철회되었습니다.');
    const f = input.fix;
    check(f && ['latitude','longitude','accuracy','observedAt','ageMs'].every(k => typeof f[k] === 'number' && Number.isFinite(f[k])), 400, '위치 값을 확인할 수 없습니다.');
    check(Math.abs(f.latitude) <= 90 && Math.abs(f.longitude) <= 180 && f.accuracy > 0 && f.accuracy <= 100, 400, '위치 정확도가 부족합니다. 수동 상태 알림을 이용해 주세요.');
    // Device observation epoch is metadata; compare age only within the same device clock.
    // The authenticated client reports age; this is not proof of physical location.
    check(f.ageMs >= 0 && f.ageMs < 15000, 409, '위치 시각을 확인할 수 없습니다. 다시 동의해 주세요.');
    entry.grant = null;
    entry.sample = { id: consentId, until: at + LOCATION_TTL, receivedAt: this.now(), receivedMono: at, ageAtReceipt: f.ageMs,
      fix: { latitude:f.latitude, longitude:f.longitude, accuracy:f.accuracy, observedAt:f.observedAt } };
    return { shared: true, expiresInMs: LOCATION_TTL };
  }
}
