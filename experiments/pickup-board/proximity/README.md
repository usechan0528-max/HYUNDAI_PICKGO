# Pickup proximity integration (synthetic only)

This module does not collect location, call Pleos, change Board state, expose HTTP routes, or send notifications. It returns local hints. Keep existing arrive/board/undo/end actions and authorization unchanged. A near hint is not arrival, boarding, safe parking, route distance, or ETA.

## Contract and lifetime

`new ProximityDetector({ now })` uses the host's monotonic millisecond clock (default performance.now). `bind(sessionId, {id, revision, latitude, longitude})` returns an opaque generation token. `revision` is a nonnegative safe integer for the agreed destination, monotonically increasing within a pickup. Do not use the board version (ready/action changes are not destination changes). Map `point.lat/lon` at the integration boundary. Use one detector per active driver/pickup and dispose on role/account changes.

Samples: `{latitude, longitude, accuracyMeters, observedAtMonoMs, receivedAtMonoMs, source:'synthetic'}`. Both times must be in the SAME process/clock domain as `now`. Do not forward browser phone timestamps, epoch Date.now, or Pleos timestampMillis into this interface. Vehicle/phone/unlabelled source is rejected. Pleos confidence is not an accuracy in meters without a verified contract. No production override is supplied.

`ingest(token, sample)` returns `{state:'unknown'|'near'|'far', reason, notify, source:'synthetic', requiresManualArrival:true}`. `notify` is a synchronous one-shot suggestion, not a delivery acknowledgement. `read()` returns current freshness and never repeats notify. Call read on every render and timer tick (e.g. 250ms while visible), and immediately before presenting a hint. Do not cache a near result indefinitely. Optional async presentation must also check `canNotify(capturedToken)` just before displaying, and discard queued work on every lifecycle change. Never call arrive/board from proximity.

Policy is a DEMO assumption: entry distance + accuracy <=100m, exit distance - accuracy >=150m, accuracy <=30m, observation AND receipt age <5000ms, two strictly increasing qualifying observations. The band resets candidates but holds a fresh confirmed state. Two samples may come from the same synthetic burst; this is not statistical independence or confidence. Zero accuracy is allowed for an exact synthetic fixture. Accuracy margins are not a real-world assurance.

Call unavailable(reason) on denial, unsupported service, disconnect, background/visibility loss, manual arrived/boarded state; it clears state and token but preserves the notification latch for that destination. Recovery requires bind again and NEW callback registration capturing the returned token. Old callbacks never become valid again. Manual action errors must be resolved from authoritative Board status before resuming. `end()` for completed/cancelled/lost rooms; `dispose()` on teardown. A new detector/process resets the local latch: no cross-restart exactly-once guarantee. Current implementation stores no coordinates in output/logs; destination remains in local memory until end/dispose.

Same bind is idempotent. Changing coordinates without a new revision invalidates the current generation and throws; a lower revision is rejected without replacing the current destination. Wrong-generation callbacks are no-ops. Clock reversal/nonfinite clock fails closed for the life of the instance; recreate after resolving clock origin. Pending proposals are not new confirmed destinations. On accepted place change allocate a new revision and bind before allowing further callbacks.

## Integration example

```js
import { ProximityDetector } from './proximity/detector.mjs';
const detector = new ProximityDetector();
let generation;
function synchronize(view, agreedDestination) {
  if (view.status === 'ended') { detector.end(); return; }
  if (view.status !== 'active') { detector.unavailable('disconnected'); return; }
  if (view.stage !== 'waiting') { detector.unavailable('manual-stage'); return; }
  generation = detector.bind(view.id, agreedDestination);
}
function syntheticCallback(capturedGeneration, sample) {
  const result = detector.ingest(capturedGeneration, sample);
  if (result.notify && detector.canNotify(capturedGeneration)) {
    // Display once: '데모: 약속 장소 근처 · 도착은 직접 확인해 주세요'.
  }
  return detector.read();
}
// Timer/render: detector.read(); accepted place: synchronize(view,newDestination).
// Each callback closure captures generation at registration, not a mutable global.
// Disconnect/background: detector.unavailable('disconnected'/'background').
// Fresh authoritative recovery: synchronize(...) and install new callback closure.
// Actual vehicle mode: detector.unavailable('unverified-vehicle-contract').
// Never feed a synthetic sample to the real-vehicle UI path.
// Leave old manual controls available under their existing Board/UX rules.
```

## Verification

`node --test experiments/pickup-board/*.test.mjs`. Synthetic geodesic/time/lifecycle tests and existing real loopback HTTP/Board tests are separate from SDK runtime verification. This worktree does not alter the existing UI, server, Board, Android preview, or Gleo modules. Integration owner adds the explicit demo UI and reruns the suite. Actual SDK/vehicle proximity remains unverified and disabled.

Review clarifications: notifications are at-most-once suggestions within one binding lifetime, and may be lost if the host drops a queued suggestion. No delivered-once guarantee or automatic retry. A confirmed ended/lost session must not be reactivated; end clears its latch and bind itself is not a server lifecycle authority. An invalid/poor new fix resets a near state immediately. `now` is trusted injected host infrastructure: a monotonically increasing wall clock cannot be detected merely from numeric values. Production monotonic clock origin still needs verification. The Board test is isolated coexistence evidence, not UI wiring evidence.

Final lifecycle guard: a detector is permanently bound to its first valid sessionId. Switching sessions throws; end() is terminal and cannot be re-bound even to the same session. Allocate a NEW detector for a new pickup; dispose the old one. This is process-local, not persistence.
