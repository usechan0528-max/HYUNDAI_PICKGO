const dedupe = zones => zones.filter((z, i) => !i || z !== zones[i - 1]);

// Synthetic zone-sequence experiment; no GPS/SDK adapter or calibrated probabilities.
export function inferJourney({ history = [], profile, consent, permission, observations = [],
  now, startedAt, maxAgeMs = 30_000 }) {
  const unknown = reason => ({ status: 'unknown', reason, candidates: [], purposeHint: null });
  if (!profile || !consent || !permission) return unknown('unavailable');
  if (!Number.isFinite(now) || !Number.isFinite(startedAt) || startedAt > now ||
      !Number.isFinite(maxAgeMs) || maxAgeMs < 0) return unknown('invalid-clock');
  if (!observations.length) return unknown('no-observation');
  let last = startedAt;
  for (const o of observations) {
    if (!o.zone || !Number.isFinite(o.at) || o.at < last || o.at > now)
      return unknown('invalid-observation');
    last = o.at;
  }
  if (now - last > maxAgeMs) return unknown('stale');
  const prefix = dedupe(observations.map(o => o.zone));
  const candidates = history.filter(h => h.profile === profile && Number.isFinite(h.endedAt) &&
    h.endedAt < startedAt && Array.isArray(h.zones) && dedupe(h.zones).length >= prefix.length &&
    prefix.every((z, i) => dedupe(h.zones)[i] === z));
  if (!candidates.length) return unknown('no-pattern');
  // Even a single match is a hypothesis, never a confirmed destination.
  const purposes = new Set(candidates.map(h => h.confirmedPurpose || null));
  return { status: 'hypothesis', reason: 'synthetic-prefix-match',
    candidates: candidates.map(h => ({ id: h.id,
      purpose: h.confirmedPurpose || null, distanceKm: h.distanceKm,
      durationMinutes: h.durationMinutes })),
    purposeHint: purposes.size === 1 ? [...purposes][0] : null };
}

export function recommend({ catalog, preferences, context = null, recent = [], currentId = null }) {
  const candidates = context?.status === 'hypothesis' ? context.candidates : [];
  const ranked = catalog.filter(c => c.testOnly === true && c.id !== currentId &&
    !recent.includes(c.id)).map(c => {
    const taste = preferences.topics?.[c.topic] || 0;
    const contextual = candidates.length ? Math.min(...candidates.map(h =>
      preferences.byPurpose?.[h.purpose]?.[c.topic] || 0)) : 0;
    return { id: c.id, score: taste + contextual,
      reasons: { taste, contextual, mode: candidates.length ? 'journey' : 'taste-only' } };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return ranked[0] || null;
}

// A fresh, explicitly supplied destination only. Inferred routes cannot open this gate.
export function informationDestination(nav, now, maxAgeMs = 30_000) {
  if (!nav || !['navigation', 'parked-confirmation'].includes(nav.source) ||
      !nav.destination || !Number.isFinite(maxAgeMs) || maxAgeMs < 0 || !Number.isFinite(now) || !Number.isFinite(nav.at) ||
      nav.at > now || now - nav.at > maxAgeMs) return null;
  return nav.destination;
}

// Caller supplies current from player events; this policy does not implement playback.
export class QueuePolicy {
  constructor({ minIntervalMs = 60_000, maxChanges = 3 } = {}) {
    this.current = null; this.next = null; this.lastChange = -Infinity;
    this.changes = 0; this.initialPlacementAllowed = true; this.minIntervalMs = minIntervalMs; this.maxChanges = maxChanges;
  }
  update(id, now) {
    if (!id || id === this.current || id === this.next || !Number.isFinite(now)) return false;
    if (!this.initialPlacementAllowed && (now - this.lastChange < this.minIntervalMs ||
        this.changes >= this.maxChanges)) return false;
    if (!this.initialPlacementAllowed) this.changes++;
    this.initialPlacementAllowed = false;
    this.next = id; this.lastChange = now;
    return true;
  }
  consumeNext() {
    const id = this.next;
    if (!id) return null;
    this.current = id; this.next = null;
    this.initialPlacementAllowed = true; // Refilling after listening is not a context-driven replacement.
    return id;
  }
  resetForProfile() {
    this.current = null; this.next = null; this.lastChange = -Infinity; this.changes = 0; this.initialPlacementAllowed = true;
  }
}

// Single-session coordinator: no persistence; caller supplies current permission each tick.
export class JourneySession {
  constructor(history = [], infer = inferJourney) {
    this.infer = infer;
    this.history = structuredClone(history);
    this.context = { status: 'unknown', candidates: [], purposeHint: null };
    this.queue = new QueuePolicy();
    this.profile = null;
  }
  clearDerived() {
    this.context = { status: 'unknown', candidates: [], purposeHint: null };
    this.queue.next = null;
    // Invalidation must not reset the session-wide replacement budget.
  }
  eraseHistory() {
    this.history = [];
    this.clearDerived(); // Does not interrupt already playing content.
  }
  tick(input) {
    if (input.profile !== this.profile || !input.consent || !input.permission)
      this.clearDerived();
    this.profile = input.profile;
    this.context = this.infer({ ...input, history: this.history });
    if (this.context.status !== 'hypothesis') this.queue.next = null;
    // Caller: tick -> recommend using returned context -> queue.update.
    // Unknown context uses taste-only recommendations, subject to the same queue budget.
    return this.context;
  }
}
