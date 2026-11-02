import {CoordinateStream} from './coordinate-stream.mjs';
import {QueuePolicy, recommend} from './core.mjs';

// Offline test harness, NOT a live adapter or media player. All times and arrival/
// disconnect events are explicitly supplied fixtures on one synthetic clock.
export function replaySyntheticJourney({events, history, catalog, preferences}) {
  const stream = new CoordinateStream();
  const queue = new QueuePolicy();
  const tokens = new Map();
  const recent = [];
  const rows = [];
  let lastAt = -Infinity;
  let queuedMode = null;
  for (const event of events) {
    const {at, type} = event;
    if (!Number.isFinite(at) || at < 0 || at < lastAt) throw new Error('invalid replay clock');
    lastAt = at;
    let input = null;
    if (type === 'begin') {
      if (typeof event.session !== 'string' || !event.session || tokens.has(event.session)) {
        throw new Error('replay session IDs must be unique');
      }
      const token = stream.begin({source:event.source, profile:event.profile,
        consent:event.consent, permission:event.permission, startedAtMs:at});
      tokens.set(event.session, token);
      // Starting a new input segment never resets the listening replacement budget.
      queue.next = null;
      input = {accepted:token !== null};
    } else if (type === 'point') {
      input = stream.push(tokens.get(event.session), event.sample, at);
    } else if (['disconnect','consent-revoked','permission-revoked','arrival','route-change'].includes(type)) {
      stream.revoke(type);
      queue.next = null;
    } else if (type === 'consume') {
      // Recheck at the selection boundary, not only on the previous input tick.
      if (stream.context(history, at).status !== 'hypothesis' && queuedMode === 'journey') queue.next = null;
      const id = queue.consumeNext();
      if (id) recent.push(id);
      input = {consumed:id};
    } else if (type === 'reset-listening') {
      // Explicit new listening session only; input reconnect must never do this.
      queue.resetForProfile();
      recent.length = 0;
    } else if (type !== 'tick') {
      throw new Error('unknown replay event');
    }
    const context = stream.context(history, at);
    if (context.status !== 'hypothesis' && queuedMode === 'journey') queue.next = null;
    if (!queue.next) queuedMode = null;
    const proposal = recommend({catalog, preferences, context, recent, currentId:queue.current});
    const changed = proposal ? queue.update(proposal.id, at) : false;
    if (changed) queuedMode = proposal.reasons.mode;
    rows.push({event:type, at, input, context, proposal:proposal?.id ?? null,
      mode:proposal?.reasons.mode ?? null, current:queue.current, next:queue.next,
      queuedMode, changed, replacements:queue.changes});
  }
  return {source:'synthetic', scope:'offline-policy-replay', mediaPlayback:false,
    sdkValidated:false, rows};
}
