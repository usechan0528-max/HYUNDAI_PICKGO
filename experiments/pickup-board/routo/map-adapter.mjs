import { coordinate, RoutoError } from './contracts.mjs';
// SDK supplied by caller after the browser-key loader resolves. Never pass a REST secret here.
export function createRoutoMap({ sdk, elementId, center, onPick, canPick = () => true, onError = () => {} }) {
  if (!sdk?.maps?.Map || !sdk.maps.Marker || !sdk.maps.LatLng) throw new RoutoError('SDK_UNAVAILABLE', 'routo 지도 SDK를 불러오지 못했습니다.', 503);
  const literal = value => { const p = coordinate(value); return { lat: p.latitude, lng: p.longitude }; };
  const map = new sdk.maps.Map(elementId, { center: literal(center), zoom: 17, keyboardShortcuts: true });
  let marker = null, disposed = false;
  const listener = map.addListener('click', event => {
    if (disposed || !canPick()) return;
    try {
      const p = coordinate({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
      if (marker) marker.setPosition(literal(p)); else marker = new sdk.maps.Marker({ map, position: literal(p) });
      onPick(p);
    } catch { onError(new RoutoError('MAP_EVENT_INVALID', '지도 좌표를 확인할 수 없습니다.')); }
  });
  return {
    showAnchor(value) { if (disposed) return; marker?.setMap(null); marker = null; map.setCenter(new sdk.maps.LatLng(literal(value))); },
    clear() { marker?.setMap(null); marker = null; },
    dispose() { if (disposed) return; disposed = true; listener.remove(); marker?.setMap(null); marker = null;
      // No public map destroy contract verified; caller removes the dedicated container after this.
    }
  };
}
function loadSdkOnce({ browserKey, usageApproved = false, documentRef = document, windowRef = window, timeoutMs = 10000, signal } = {}) {
  if (!usageApproved || typeof browserKey !== 'string' || !browserKey.trim()) return Promise.reject(new RoutoError('MAP_NOT_CONFIGURED', '지도용 키와 이용 조건 확인이 필요합니다.', 503));
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new RoutoError('CANCELLED', '지도 로딩을 취소했습니다.', 499)); return; }
    const script = documentRef.createElement('script'); let settled = false;
    const finish = (error) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      script.onload = script.onerror = null; if (error) { script.remove(); reject(error); } else resolve(windowRef.routo);
    };
    const cancel = () => finish(new RoutoError('CANCELLED', '지도 로딩을 취소했습니다.', 499));
    const timer = setTimeout(() => finish(new RoutoError('SDK_TIMEOUT', '지도 로딩 시간이 초과됐습니다.', 504)), timeoutMs);
    script.async = true; script.referrerPolicy = 'strict-origin-when-cross-origin';
    const url = new URL('https://api.routo.com/v2/maps/map'); url.searchParams.set('key', browserKey); script.src = url.href;
    script.onload = () => finish(windowRef.routo?.maps?.Map && windowRef.routo?.maps?.Marker && windowRef.routo?.maps?.LatLng ? null : new RoutoError('SDK_UNAVAILABLE', '지도 SDK를 확인할 수 없습니다.'));
    script.onerror = () => finish(new RoutoError('SDK_LOAD_FAILED', '지도 SDK를 불러오지 못했습니다.'));
    signal?.addEventListener('abort', cancel, { once: true }); documentRef.head.append(script);
  });
}

// One SDK script per page/window. Changing keys or retrying a failed SDK boot requires a fresh page.
const sdkLoads = new WeakMap();
export function loadRoutoSdk(options = {}) {
  const windowRef = options.windowRef ?? window;
  if (options.signal?.aborted) return Promise.reject(new RoutoError('CANCELLED', '지도 로딩을 취소했습니다.', 499));
  if (options.usageApproved !== true || typeof options.browserKey !== 'string' || !options.browserKey.trim())
    return Promise.reject(new RoutoError('MAP_NOT_CONFIGURED', '지도용 키와 이용 조건 확인이 필요합니다.', 503));
  let entry = sdkLoads.get(windowRef);
  if (entry && entry.key !== options.browserKey) return Promise.reject(new RoutoError('SDK_KEY_CHANGED', '지도 키 변경 후 페이지를 새로 여세요.', 409));
  if (!entry) { entry = { key: options.browserKey, promise: loadSdkOnce({ ...options, windowRef }) }; sdkLoads.set(windowRef, entry); }
  if (!options.signal) return entry.promise;
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new RoutoError('CANCELLED', '지도 로딩을 취소했습니다.', 499));
    options.signal.addEventListener('abort', cancel, { once: true });
    entry.promise.then(resolve, reject).finally(() => options.signal.removeEventListener('abort', cancel));
  });
}
