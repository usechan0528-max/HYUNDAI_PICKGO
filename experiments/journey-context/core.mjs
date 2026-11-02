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

// Policy v1: deterministic local rules, not learned preferences or probabilities.
// Context must already have passed the caller's consent/freshness/source gates.
const list = value => Array.isArray(value) ? value : [];
const key = value => typeof value === 'string' && value.trim().length > 0;
const own = (object, name) => object && typeof object === 'object' && !Array.isArray(object) &&
  Object.hasOwn(object, name) ? object[name] : undefined;
const weight = value => Number.isFinite(value) ? Math.max(-5, Math.min(5, value)) : 0;

export function rankRecommendations(input = {}) {
  const {catalog, preferences, context, recent, currentId = null, lastTopic = null} = input ?? {};
  const items = list(catalog), prefs = preferences ?? {};
  const excluded = [], ranked = [], counts = new Map();
  for (const item of items) if (key(item?.id)) counts.set(item.id, (counts.get(item.id) || 0) + 1);
  const blocked = new Set(list(prefs.dislikedIds));
  const blockedTopics = new Set(list(prefs.dislikedTopics));
  const liked = new Set(list(prefs.likedIds));
  const heard = new Set(list(recent));
  // Reject the entire malformed context rather than silently dropping alternatives.
  const raw = context?.status === 'hypothesis' ? list(context.candidates) : [];
  const candidates = raw.length && raw.every(h => h && typeof h === 'object' &&
    (h.purpose == null || key(h.purpose))) ? raw : [];
  const mode = candidates.length ? 'journey' : 'taste-only';
  for (const c of items) {
    let reason = null;
    if (!key(c?.id) || !key(c?.topic)) reason = 'invalid-item';
    else if (counts.get(c.id) !== 1) reason = 'duplicate-id';
    else if (c.testOnly !== true) reason = 'outside-demo-catalog';
    else if (c.playable === false) reason = 'unplayable';
    else if (blocked.has(c.id) || blockedTopics.has(c.topic)) reason = 'explicit-dislike';
    else if (c.id === currentId) reason = 'currently-playing';
    else if (heard.has(c.id)) reason = 'already-heard';
    if (reason) { excluded.push({id:key(c?.id) ? c.id : null, reason}); continue; }
    const taste = weight(own(prefs.topics, c.topic));
    // Worst-case suitability is conservative; no uncalibrated route probabilities.
    // An unlabeled alternative contributes zero, never an invented purpose.
    const contextual = candidates.length ? candidates.reduce((minimum, h) => Math.min(minimum,
      h.purpose == null ? 0 : weight(own(own(prefs.byPurpose, h.purpose), c.topic))), Infinity) : 0;
    const explicitLike = liked.has(c.id) ? 1 : 0;
    const diverse = key(lastTopic) && c.topic !== lastTopic;
    const coldStart = taste === 0 && contextual === 0 && explicitLike === 0;
    ranked.push({id:c.id, score:taste + contextual + explicitLike,
      reasons:{taste, contextual, explicitLike, mode, diverse, coldStart,
        summary:[taste !== 0 ? '주제 취향 점수를 반영했습니다.' : '',
          contextual > 0 ? '가능한 운행 맥락에서 적합도가 올라갑니다.' :
          contextual < 0 ? '가능한 운행 맥락에서 적합도가 내려갑니다.' : '',
          explicitLike ? '좋아요를 반영했습니다.' : '',
          coldStart ? '이 항목의 선호 점수는 없습니다.' : ''].filter(Boolean).join(' '),
        tieBreak:key(lastTopic) ? '동점이면 직전과 다른 주제, 이후 ID 순서' : '동점이면 ID 순서'}});
  }
  // Diversity only breaks equal scores; stable UTF-16 ID order breaks remaining ties.
  ranked.sort((a,b) => b.score-a.score || Number(b.reasons.diverse)-Number(a.reasons.diverse) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {policyVersion:'rules-v1', status:ranked.length ? 'selected' : 'exhausted',
    selected:ranked[0] ?? null, ranked, excluded, mode,
    stopReason:ranked.length ? null : 'no-eligible-content'};
}

// Preserve existing player/replay API. Exhaustion never relaxes exclusions.
export function recommend(input) { return rankRecommendations(input).selected; }

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
