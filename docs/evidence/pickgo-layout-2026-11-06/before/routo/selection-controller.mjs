import { coordinate, toMapPoint, RoutoError } from './contracts.mjs';
// Framework-neutral state machine. No room creation or external write occurs here.
export function createSelectionController({ search, checkPoint, now = () => performance.now(), onChange = () => {}, onObserverError = () => {}, wallNow = Date.now, schedule = setTimeout, unschedule = clearTimeout }) {
  let state = { phase: 'idle', results: [], anchor: null, selection: null, error: null }, generation = 0, abort, expiryTimer, disposed = false;
  const expire = () => { if (state.phase === 'review' && now() >= state.selection.expiresAt) state = { ...state, phase: 'expired', selection: null }; };
  const snapshot = () => { expire(); return structuredClone(state); };
  const emit = () => { if (!disposed) { try { onChange(snapshot()); } catch { try { onObserverError('RENDER_FAILED'); } catch {} } } };
  const invalidate = () => { generation++; unschedule(expiryTimer); abort?.abort(); abort = new AbortController(); return generation; };
  return {
    snapshot,
    async search(query) {
      if (disposed) return;
      const gen = invalidate(); state = { phase: 'searching', results: [], anchor: null, selection: null, error: null }; emit();
      try { const results = await search({ query, signal: abort.signal }); if (disposed || gen !== generation) return;
        state = { ...state, phase: results.length ? 'results' : 'empty', results }; emit();
      } catch (error) { if (disposed || gen !== generation) return; state = { ...state, phase: 'error', error: error?.code || 'SEARCH_FAILED' }; emit(); }
    },
    selectResult(id) {
      if (disposed) return;
      const result = state.results.find(item => item.id === id); if (!result) throw new RoutoError('INVALID_RESULT', '현재 검색 결과를 선택하세요.', 400);
      invalidate(); state = { ...state, phase: 'choose-point', anchor: structuredClone(result), selection: null, error: null }; emit();
      return coordinate(result.center); // Pan only: a search center is never automatically confirmed.
    },
    async choose(value) {
      if (disposed || !state.anchor) return;
      const gen = invalidate(); state = { ...state, phase: 'checking', selection: null, error: null }; emit();
      try {
        const point = coordinate(value), started = now();
        const verdict = await checkPoint(toMapPoint(point), { signal: abort.signal });
        if (disposed || gen !== generation) return;
        // The check adapter must provide a finite validity duration. Cap it at five seconds.
        if (verdict?.selectable !== true || !Number.isFinite(verdict.validForMs) || verdict.validForMs <= 0)
          state = { ...state, phase: 'blocked', error: verdict?.reason || 'POINT_NOT_VERIFIED' };
        else {
          const expiresAt = started + Math.min(5000, verdict.validForMs);
          state = { ...state, phase: now() < expiresAt ? 'review' : 'expired', selection: { point, expiresAt,
            provenance: { searchProvider: 'routo', anchorProviderId: state.anchor.providerId, anchorCenter: coordinate(state.anchor.center), derivedFromSearch: true, coordinateSource: 'user-pin-on-routo-map' } } };
          if (state.phase === 'review') { expiryTimer = schedule(() => { if (gen === generation && !disposed) { expire(); emit(); } }, Math.max(0, expiresAt - now())); expiryTimer?.unref?.(); }
        }
      } catch (error) { if (disposed || gen !== generation) return; state = { ...state, phase: 'error', error: error?.code || 'CHECK_FAILED' }; }
      emit();
    },
    confirm() {
      if (disposed || state.phase !== 'review' || !state.selection || now() >= state.selection.expiresAt) {
        if (!disposed && state.phase === 'review') { state = { ...state, phase: 'expired', selection: null }; emit(); }
        throw new RoutoError('NOT_CONFIRMED', '위치를 다시 확인하세요.', 409);
      }
      const selection = structuredClone(state.selection); state = { ...state, phase: 'confirmed' }; emit();
      return { point: toMapPoint(selection.point), provenance: selection.provenance, validation: { confirmedAt: wallNow(), remainingMs: Math.max(0, selection.expiresAt - now()), requiresServerRevalidation: true } }; // Server MUST revalidate at write time.
    },
    cancel() { if (disposed) return; invalidate(); state = { phase: 'idle', results: [], anchor: null, selection: null, error: null }; emit(); },
    dispose() { disposed = true; invalidate(); state = { phase: 'disposed', results: [], anchor: null, selection: null, error: null }; }
  };
}
