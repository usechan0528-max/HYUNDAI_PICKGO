import { coordinate, normalizeResults, RoutoError } from './contracts.mjs';
const ENDPOINT = 'https://api.routo.com/v1/places/findplacefromtext';
export function createRoutoSearch({ apiKey = '', usageApproved = false, fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const configured = typeof apiKey === 'string' && apiKey.trim().length > 0;
  return {
    status: () => ({ provider: 'routo', ready: configured && usageApproved === true,
      reason: !configured ? 'KEY_MISSING' : usageApproved !== true ? 'USAGE_PENDING' : null }),
    async search({ query, near, signal } = {}) {
      if (!configured) throw new RoutoError('KEY_MISSING', 'routo 검색 키가 아직 설정되지 않았습니다.', 503);
      if (usageApproved !== true) throw new RoutoError('USAGE_PENDING', 'routo 이용 조건 확인이 필요합니다.', 503);
      if (typeof query !== 'string' || !query.trim() || query.trim().length > 80) throw new RoutoError('INVALID_QUERY', '검색어는 1~80자로 입력하세요.', 400);
      const url = new URL(ENDPOINT); url.searchParams.set('key', apiKey); url.searchParams.set('input', query.trim());
      url.searchParams.set('size', '10'); url.searchParams.set('from', '0');
      if (near !== undefined) { const p = coordinate(near); url.searchParams.set('location', `${p.latitude},${p.longitude}`); }
      const timeout = AbortSignal.timeout(timeoutMs), combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      try {
        combined.throwIfAborted();
        const res = await fetchImpl(url, { method: 'GET', signal: combined, redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!res.ok) {
          if ([401,403].includes(res.status)) throw new RoutoError('KEY_REJECTED', 'routo 키 또는 사용 권한을 확인하세요.', 502);
          if (res.status === 429) throw new RoutoError('QUOTA', '검색 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.', 429);
          throw new RoutoError('UPSTREAM', '검색 서비스에 연결하지 못했습니다.');
        }
        // Bounded streaming read; never log a URL containing the server key or raw provider errors.
        const reader = res.body.getReader(); const chunks = []; let length = 0;
        try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength;
          if (length > 512000) { await reader.cancel(); throw new RoutoError('INVALID_RESPONSE', '검색 응답 크기를 초과했습니다.'); } chunks.push(value); }
        } finally { reader.releaseLock(); }
        combined.throwIfAborted();
        const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        return normalizeResults(JSON.parse(new TextDecoder().decode(bytes)));
      } catch (error) {
        if (signal?.aborted) throw new RoutoError('CANCELLED', '검색을 취소했습니다.', 499);
        if (timeout.aborted) throw new RoutoError('TIMEOUT', '검색 응답 시간이 초과됐습니다.', 504);
        if (error instanceof RoutoError) throw error;
        throw new RoutoError('UPSTREAM', '검색 응답을 처리하지 못했습니다.');
      }
    }
  };
}
