// Local synthetic policy. No vehicle SDK, network, or manual arrival mutation.
export const POLICY = Object.freeze({ enterMeters: 100, exitMeters: 150, maxAccuracyMeters: 30, ttlMs: 5000, confirmations: 2 });
const finite = n => typeof n === 'number' && Number.isFinite(n);
const point = p => p && finite(p.latitude) && Math.abs(p.latitude) <= 90 && finite(p.longitude) && Math.abs(p.longitude) <= 180;
const time = n => finite(n) && n >= 0;
export function distanceMeters(a, b) {
  if (!point(a) || !point(b)) throw new TypeError('Invalid coordinates');
  const rad = Math.PI / 180, dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}
export class ProximityDetector {
  #sessionId = null; #ended = false; #now; #lastNow = -1; #clockFailed = false; #disposed = false;
  #boundAt = 0; #binding = null; #generation = null; #notified = false; #observed = -1;
  #state = 'unknown'; #reason = 'unbound'; #candidate = null; #count = 0; #fix = null;
  constructor({ now = () => performance.now() } = {}) { this.#now = now; }
  #clock() {
    const n = this.#now();
    if (!time(n) || n < this.#lastNow) this.#clockFailed = true;
    if (!this.#clockFailed) this.#lastNow = n;
    return this.#clockFailed ? null : n;
  }
  #unknown(reason) { this.#state = 'unknown'; this.#reason = reason; this.#candidate = null; this.#count = 0; this.#fix = null; }
  #result(notify = false) { return Object.freeze({ state: this.#state, reason: this.#reason, notify, source: 'synthetic', requiresManualArrival: true }); }
  // sessionId identifies one pickup, revision changes only when agreed destination changes.
  bind(sessionId, destination) {
    if (this.#disposed || this.#ended) throw new Error('Detector ended; create a new instance');
    if (this.#sessionId !== null && sessionId !== this.#sessionId) throw new Error('One detector belongs to one session');
    if (typeof sessionId !== 'string' || !sessionId || !point(destination) || typeof destination.id !== 'string' || !destination.id || !Number.isSafeInteger(destination.revision) || destination.revision < 0) throw new TypeError('Invalid binding');
    const n = this.#clock();
    if (n === null) { this.#unknown('clock-invalid'); throw new Error('Clock invalid; recreate detector'); }
    const next = { sessionId, id: destination.id, revision: destination.revision, latitude: destination.latitude, longitude: destination.longitude };
    if (this.#binding && sessionId === this.#binding.sessionId && destination.revision < this.#binding.revision) throw new Error('Old destination revision');
    const same = this.#binding && Object.keys(next).every(k => next[k] === this.#binding[k]);
    if (this.#binding && next.sessionId === this.#binding.sessionId && next.revision === this.#binding.revision && !same) { this.#generation = null; this.#unknown('destination-conflict'); throw new Error('Coordinates require a new destination revision'); }
    if (same && this.#generation) return this.#generation;
    if (!same) { this.#notified = false; this.#observed = -1; }
    this.#sessionId = sessionId; this.#boundAt = n; this.#binding = next; this.#generation = Symbol('proximity-generation'); this.#unknown('awaiting-location');
    return this.#generation;
  }
  // Host must re-bind after recovery and capture the NEW generation in callbacks.
  unavailable(reason = 'disconnected') {
    if (!['disconnected', 'permission-denied', 'unsupported', 'initializing', 'unverified-vehicle-contract', 'manual-stage', 'background'].includes(reason)) throw new TypeError('Invalid availability');
    this.#generation = null; this.#unknown(this.#disposed ? 'disposed' : reason); return this.#result();
  }
  read() {
    const n = this.#clock();
    if (this.#disposed) this.#unknown('disposed');
    else if (n === null) this.#unknown('clock-invalid');
    else if (this.#fix && (n - this.#fix.observedAtMonoMs >= POLICY.ttlMs || n - this.#fix.receivedAtMonoMs >= POLICY.ttlMs)) this.#unknown('stale');
    return this.#result();
  }
  ingest(generation, sample) {
    this.read();
    if (this.#disposed || this.#clockFailed || !this.#generation || generation !== this.#generation) return this.#result();
    const n = this.#lastNow;
    if (!sample || sample.source !== 'synthetic') { this.#unknown('unverified-vehicle-contract'); return this.#result(); }
    if (!time(sample.observedAtMonoMs) || !time(sample.receivedAtMonoMs) || sample.observedAtMonoMs > sample.receivedAtMonoMs || sample.receivedAtMonoMs > n) { this.#unknown('invalid-time'); return this.#result(); }
    if (sample.observedAtMonoMs < this.#boundAt || sample.observedAtMonoMs <= this.#observed) return this.#result(); // replay never refreshes TTL or confirms
    if (n - sample.observedAtMonoMs >= POLICY.ttlMs || n - sample.receivedAtMonoMs >= POLICY.ttlMs) { this.#unknown('stale'); return this.#result(); }
    if (!point(sample) || !finite(sample.accuracyMeters) || sample.accuracyMeters < 0 || sample.accuracyMeters > POLICY.maxAccuracyMeters) { this.#unknown('poor-location'); return this.#result(); }
    this.#observed = sample.observedAtMonoMs;
    this.#fix = { observedAtMonoMs: sample.observedAtMonoMs, receivedAtMonoMs: sample.receivedAtMonoMs };
    const distance = distanceMeters(this.#binding, sample);
    const target = distance + sample.accuracyMeters <= POLICY.enterMeters ? 'near' : distance - sample.accuracyMeters >= POLICY.exitMeters ? 'far' : null;
    if (!target || target === this.#state) { this.#candidate = null; this.#count = 0; this.#reason = this.#state === 'unknown' ? 'boundary-uncertain' : 'hysteresis'; return this.#result(); }
    this.#count = this.#candidate === target ? this.#count + 1 : 1; this.#candidate = target;
    if (this.#count < POLICY.confirmations) { this.#reason = 'confirming'; return this.#result(); }
    this.#state = target; this.#reason = 'confirmed'; this.#candidate = null; this.#count = 0;
    const notify = target === 'near' && !this.#notified;
    if (notify) this.#notified = true;
    return this.#result(notify);
  }
  canNotify(generation) { return this.read().state === 'near' && !!this.#generation && generation === this.#generation; }
  end() { this.#ended = true; this.#binding = null; this.#generation = null; this.#notified = false; this.#observed = -1; this.#unknown('ended'); }
  dispose() { this.end(); this.#disposed = true; this.#unknown('disposed'); }
}
