export const SOURCE = 'http://openapi.seoul.go.kr:8088/sample/json/GetParkingInfo/1/5/';
export const LOT_ID = '171721';
export function normalize(payload, now = Date.now()) {
  const api = payload?.GetParkingInfo;
  if (api?.RESULT?.CODE !== 'INFO-000' || !Array.isArray(api.row)) throw Error('provider');
  const row = api.row.find(r => r.PKLT_CD === LOT_ID);
  if (!row) throw Error('missing');
  const stamp = row.NOW_PRK_VHCL_UPDT_TM;
  const observed = typeof stamp === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(stamp) ? Date.parse(stamp.replace(' ', 'T') + '+09:00') : NaN;
  const validTime = Number.isFinite(observed) && new Date(observed + 9*3600000).toISOString().slice(0,19).replace('T',' ') === stamp;
  const capacity = row.TPKCT, occupied = row.NOW_PRK_VHCL_CNT;
  const validCounts = Number.isInteger(capacity) && capacity > 0 && Number.isInteger(occupied) && occupied >= 0 && occupied <= capacity;
  const age = now - observed;
  const status = !validTime || age < 0 || row.PRK_STTS_YN !== '1' || !validCounts ? 'unknown' : age >= 300000 ? 'stale' : 'fresh';
  return { id: LOT_ID, name: '세종로 공영주차장(시)', address: '종로구 세종로 80-1', status, observedAt: validTime ? observed : null, fetchedAt: now,
    capacity: status === 'fresh' ? capacity : null, occupied: status === 'fresh' ? occupied : null,
    difference: status === 'fresh' ? capacity - occupied : null };
}
export function createParkingService({fetchImpl = fetch, clock = Date.now} = {}) {
  let cached, expires = 0, pending;
  function responseAtNow(value) {
    const now = clock();
    const ageMs = value.observedAt === null ? null : now - value.observedAt;
    const expired = value.status === 'fresh' && (ageMs < 0 || ageMs >= 300000);
    return {...value, ageMs, respondedAt: now, ...(expired ? {status: ageMs < 0 ? 'unknown' : 'stale', capacity:null, occupied:null, difference:null} : {})};
  }
  return async function getParking() {
    if (cached && clock() < expires) return responseAtNow(cached);
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetchImpl(SOURCE, {signal: AbortSignal.timeout(8000), redirect: 'error'});
        if (!response.ok) { await response.body?.cancel(); throw Error('http'); }
        const reader = response.body.getReader();
        const chunks = []; let size = 0;
        try { while (true) { const {done,value} = await reader.read(); if(done) break; size += value.length; if(size > 262144) throw Error('size'); chunks.push(value); } }
        finally { await reader.cancel(); }
        cached = normalize(JSON.parse(Buffer.concat(chunks).toString('utf8')), clock());
      } catch { cached = {id: LOT_ID, status: 'unavailable', fetchedAt: clock(), observedAt: null, capacity:null, occupied:null, difference:null}; }
      expires = clock() + 60000;
      return responseAtNow(cached);
    })();
    try { return await pending; } finally { pending = null; }
  };
}
