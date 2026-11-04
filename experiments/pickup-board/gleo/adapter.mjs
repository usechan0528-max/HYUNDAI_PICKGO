// IN-PROCESS READINESS ONLY. No Android caller verification, receiver, or transport.
// Host authorization and session binding MUST NOT be populated from Intent extras.
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Board, Fault } from '../domain.mjs';

export const ACTIONS = Object.freeze(['GET_PICKUP_STATUS', 'REPORT_PICKUP_ARRIVAL']);
export const TICKET_TTL = 5000;
const plain = value => value !== null && typeof value === 'object' &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const fail = (name, message = 'Pickup voice integration is unavailable.') =>
  ({ functionName: name, status: 'fail', message, mode: 'voice' });
const actionName = input => {
  try { const value = Object.getOwnPropertyDescriptor(input, 'action')?.value;
    return ACTIONS.includes(value) ? value : 'UNKNOWN_ACTION';
  } catch { return 'UNKNOWN_ACTION'; }
};
const dataObject = value => plain(value) && Reflect.ownKeys(value).every(key =>
  typeof key === 'string' && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));

// Local strict candidate contract, NOT a claim about actual Gleo Intent encoding.
// Only parameterless commands; JSON whitespace permitted, BOM/double encoding denied.
export function parseCommand(input) {
  if (!dataObject(input) || Object.keys(input).some(k => !['action', 'extras'].includes(k))) throw new TypeError('Unsupported command.');
  const action = Object.getOwnPropertyDescriptor(input, 'action')?.value;
  if (!ACTIONS.includes(action)) throw new TypeError('Unsupported command.');
  if (input.extras !== undefined) {
    if (!dataObject(input.extras)) throw new TypeError('Invalid extras.');
    const keys = Object.keys(input.extras);
    if (keys.length && (keys.length !== 1 || keys[0] !== 'ACTION_PARAM' ||
        typeof input.extras.ACTION_PARAM !== 'string' ||
        Buffer.byteLength(input.extras.ACTION_PARAM, 'utf8') > 1024 ||
        !/^[\x20\t\r\n]*\{[\x20\t\r\n]*\}[\x20\t\r\n]*$/.test(input.extras.ACTION_PARAM))) {
      throw new TypeError('Invalid parameters.');
    }
  }
  return action;
}

function publicResult(name, state) {
  const progress = { waiting: 'waiting_for_arrival', arrived: 'driver_reported_arrival', boarded: 'rider_confirmed_boarding' }[state.stage];
  if (!progress || typeof state.ready !== 'boolean' || typeof state.joined !== 'boolean') throw new Error('Invalid state.');
  return { functionName: name, status: 'success', mode: 'voice',
    message: name === ACTIONS[1] ? 'The driver has reported arrival at the agreed pickup point.' : 'The current pickup status is available.',
    data: JSON.stringify([{ progress, riderReady: state.ready, riderJoined: state.joined, locationChangePending: state.proposal !== null }]) };
}

/**
 * Trusted host port: attest(invocation, phase) -> fresh one-use object
 * { invocation, phase, checkedAt: monotonic ms, caller: 'verified', ux: 'allowed', online: true }.
 * No default issuer exists. Tests supply explicit fake attestations; they are NOT
 * caller authentication or CarUxRestrictions evidence. Every phase needs a new grant.
 * Board must be the synchronous in-process Board, never an async HTTP client.
 */
export class PickupVoiceReadiness {
  #board; #attest; #now; #lastTime = -Infinity; #binding = null;
  #pending = null; #grants = new WeakSet(); #busy = false; #closed = false;
  constructor(board, { attest = () => null, now = () => performance.now() } = {}) {
    if (!(board instanceof Board) || board.read !== Board.prototype.read || board.act !== Board.prototype.act) {
      throw new TypeError('The synchronous in-process Board is required.');
    }
    this.#board = board; this.#attest = attest; this.#now = now;
  }
  // Only a trusted host may call this; no credential is returned in a ticket.
  bind(session) {
    this.#pending = null; this.#binding = null;
    if (this.#closed) return;
    if (!plain(session) || typeof session.id !== 'string' || typeof session.token !== 'string' || !session.token) return;
    this.#binding = { id: session.id, token: session.token };
  }
  clear() { this.#pending = null; this.#binding = null; }
  dispose() { this.clear(); this.#closed = true; }
  #time() {
    const time = this.#now();
    if (!Number.isFinite(time) || time < this.#lastTime) throw new Error('Invalid clock.');
    this.#lastTime = time; return time;
  }
  #authorize(invocation, phase) {
    const grant = this.#attest(invocation, phase), time = this.#time();
    if (!plain(grant) || this.#grants.has(grant)) throw new Error('Unavailable.');
    this.#grants.add(grant);
    if (grant.invocation !== invocation || grant.phase !== phase || grant.caller !== 'verified' || grant.ux !== 'allowed' || grant.online !== true ||
        !Number.isFinite(grant.checkedAt) || time < grant.checkedAt || time - grant.checkedAt >= 1000) throw new Error('Unavailable.');
    return time;
  }
  #read() {
    if (!this.#binding) throw new Error('Unavailable.');
    const state = this.#board.read(this.#binding.id, this.#binding.token);
    if (state.role !== 'driver' || state.status !== 'active') throw new Error('Unavailable.');
    return state;
  }
  prepare(input) {
    const name = actionName(input);
    if (this.#busy || this.#closed) return { response: fail(name) };
    // Even a denied/malformed new intent cancels old pending work.
    this.#pending = null;
    this.#busy = true;
    try {
      const invocation = Object.freeze({});
      const at = this.#authorize(invocation, 'prepare');
      let action;
      try { action = parseCommand(input); }
      catch { return { response: fail(name, 'This pickup voice command or its parameters are not supported.') }; }
      const state = this.#read();
      const ticket = Object.freeze({});
      this.#pending = { ticket, invocation, action, at, state, binding: this.#binding, requestId: randomUUID() };
      return { ticket };
    } catch { return { response: fail(name) }; }
    finally { this.#busy = false; }
  }
  dispatch(ticket) {
    const pending = this.#pending;
    const name = pending && pending.ticket === ticket ? pending.action : 'UNKNOWN_ACTION';
    if (this.#busy || this.#closed) return fail(name);
    this.#busy = true;
    try {
      // Consume before calling any external host port, including attest.
      this.#pending = null;
      if (!pending || pending.ticket !== ticket) return fail(name);
      const time = this.#authorize(pending.invocation, 'dispatch');
      if (this.#binding !== pending.binding || time - pending.at >= TICKET_TTL) return fail(name);
      const current = this.#read();
      if (pending.action === ACTIONS[0]) return publicResult(name, current);
      if (pending.action !== ACTIONS[1]) return fail(name);
      // No refresh-and-retry: capture the original version and lease, including place.
      if (current.version !== pending.state.version) return { functionName: name, status: 'asking',
        message: 'The pickup agreement changed. Check it and make a new arrival request.', mode: 'voice' };
      const result = this.#board.act(pending.binding.id, pending.binding.token, {
        type: 'arrive', requestId: pending.requestId, version: pending.state.version, view: pending.state.view
      });
      return publicResult(name, result);
    } catch (error) {
      return fail(name, error instanceof Fault && error.status === 409
        ? 'Arrival could not be recorded for the current pickup state. Check the agreement before trying again.'
        : 'Pickup voice integration is unavailable.');
    } finally { this.#busy = false; }
  }
}
