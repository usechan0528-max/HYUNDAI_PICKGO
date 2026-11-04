import { createSelectionController } from './selection-controller.mjs';
import { createRoutoMap, loadRoutoSdk } from './map-adapter.mjs';
import { RoutoError } from './contracts.mjs';
// Host owns visible rendering and authenticated room writes; only confirmation returns a draft.
export async function connectRoutoPicker({ elementId, browserKey, usageApproved, center, checkPoint, onChange,
  onMapError, fetchImpl = fetch, loadSdk = loadRoutoSdk, signal } = {}) {
  const sdk = await loadSdk({ browserKey, usageApproved, signal });
  if (signal?.aborted) throw new RoutoError('CANCELLED', '지도 연결을 취소했습니다.', 499);
  const controller = createSelectionController({
    search: async ({ query, signal: searchSignal }) => {
      const timeout = AbortSignal.timeout(7000);
      try {
        const res = await fetchImpl('/api/routo/search', { method: 'POST', cache: 'no-store', signal: AbortSignal.any([searchSignal, timeout]),
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
        const body = await res.json();
        if (!res.ok || !Array.isArray(body.results)) {
          const known = new Set(['KEY_MISSING','USAGE_PENDING','KEY_REJECTED','QUOTA','BUSY','TIMEOUT','INVALID_QUERY']);
          throw new RoutoError(known.has(body.code) ? body.code : 'SEARCH_FAILED', '검색하지 못했습니다.');
        }
        return body.results;
      } catch (e) { if (e instanceof RoutoError) throw e; throw new RoutoError(timeout.aborted ? 'TIMEOUT' : 'SEARCH_FAILED', '검색 응답을 확인할 수 없습니다.'); }
    }, checkPoint, onChange
  });
  let map;
  try { map = createRoutoMap({ sdk, elementId, center, canPick: () => !!controller.snapshot().anchor, onPick: p => controller.choose(p), onError: error => { controller.cancel(); onMapError?.(error); } }); }
  catch (e) { controller.dispose(); throw e; }
  let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; signal?.removeEventListener('abort', dispose); controller.dispose(); map.dispose(); };
  signal?.addEventListener('abort', dispose, { once: true });
  return {
    search(query) { map.clear(); return controller.search(query); },
    selectResult(id) { map.showAnchor(controller.selectResult(id)); },
    confirm: () => controller.confirm(),
    cancel() { map.clear(); controller.cancel(); },
    snapshot: () => controller.snapshot(), dispose
  };
}
