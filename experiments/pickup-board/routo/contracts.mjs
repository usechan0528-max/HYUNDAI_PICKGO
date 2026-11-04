export class RoutoError extends Error {
  constructor(code, message, status = 502) { super(message); this.name = 'RoutoError'; this.code = code; this.status = status; }
}
export function coordinate(value) {
  if (!value || typeof value !== 'object' || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180)
    throw new RoutoError('INVALID_COORDINATE', '좌표 형식을 확인하세요.', 400);
  return { latitude: value.latitude, longitude: value.longitude };
}
export const toMapPoint = value => { const p = coordinate(value); return [p.longitude, p.latitude]; };
export const fromRestPoint = value => coordinate({ latitude: value?.lat, longitude: value?.lon });
export function normalizeResults(body) {
  if (body?.status !== 'success' || !Number.isInteger(body.total) || body.total < 0 || (!Array.isArray(body.result) && body.total !== 0))
    throw new RoutoError('INVALID_RESPONSE', '검색 응답을 확인할 수 없습니다.');
  return (body.result || []).slice(0, 10).map((item, index) => {
    const center = fromRestPoint(item.center);
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 160) : '';
    const address = typeof item.addrRoad === 'string' ? item.addrRoad.slice(0, 300) : typeof item.addr === 'string' ? item.addr.slice(0, 300) : '';
    if (!title && !address) throw new RoutoError('INVALID_RESPONSE', '검색 장소의 이름과 주소가 없습니다.');
    return { id: `result-${index}`, provider: 'routo', providerId: Number.isSafeInteger(item.poiId) ? String(item.poiId) : null,
      title: title || address, address, center, guide: item.guide ? fromRestPoint(item.guide) : null,
      walkingGuides: Array.isArray(item.walkingGuide) ? item.walkingGuide.slice(0, 10).map(fromRestPoint) : [],
      eligibility: 'unchecked' };
  });
}
