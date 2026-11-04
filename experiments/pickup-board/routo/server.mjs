import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRoutoSearch } from './search-provider.mjs';
import { RoutoError } from './contracts.mjs';
import { requestOrigin } from '../web-origin.mjs';
// Reusable dispatch: parent server provides its validated JSON body and auth/origin boundary.
export function createRoutoRoutes(search) {
  return async ({ path, method, body, signal }) => {
    if (path === '/api/routo/status' && method === 'GET') return search.status();
    if (path === '/api/routo/search' && method === 'POST') return { results: await search.search({ query: body?.query, near: body?.near, signal }) };
    return undefined;
  };
}
// Loopback-only readiness harness; no map/room state writes and no key ever returned.
export function createPreparationServer(options = {}) {
  const provider = createRoutoSearch(options), dispatch = createRoutoRoutes(provider); let active = 0;
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, value) => { if (!res.destroyed) { res.writeHead(status); res.end(JSON.stringify(value)); } };
    const abort = new AbortController(); res.on('close', () => { if (!res.writableEnded) abort.abort(); });
    let claimed = false;
    try {
      if (!requestOrigin(req.headers, res.socket.localPort, null)) throw new RoutoError('ORIGIN', '허용된 로컬 주소에서만 사용할 수 있습니다.', 403);
      const path = new URL(req.url, 'http://127.0.0.1').pathname;
      if (!['/api/routo/status','/api/routo/search'].includes(path)) throw new RoutoError('NOT_FOUND', '경로를 찾을 수 없습니다.', 404);
      if (req.method !== (path.endsWith('/status') ? 'GET' : 'POST')) throw new RoutoError('METHOD', '지원하지 않는 요청입니다.', 405);
      if (active >= 2) throw new RoutoError('BUSY', '검색 요청 처리 중입니다.', 429);
      active++; claimed = true;
      let body;
      if (req.method === 'POST') {
        if (req.headers['content-type'] !== 'application/json') throw new RoutoError('CONTENT_TYPE', 'JSON 요청이 필요합니다.', 415);
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size > 4096) throw new RoutoError('TOO_LARGE', '검색 요청이 너무 큽니다.', 413); chunks.push(chunk); }
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RoutoError('INVALID_JSON', '요청 형식을 확인하세요.', 400); }
      }
      reply(200, await dispatch({ path, method: req.method, body, signal: abort.signal }));
    } catch (error) { const known = error instanceof RoutoError; reply(known ? error.status : 500, { code: known ? error.code : 'INTERNAL', error: known ? error.message : '요청을 처리하지 못했습니다.' }); }
    finally { if (claimed) active--; }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createPreparationServer({ apiKey: process.env.ROUTO_REST_API_KEY, usageApproved: process.env.ROUTO_USAGE_APPROVED === 'true' })
    .listen(4194, '127.0.0.1', () => console.log('routo 준비 서버 http://127.0.0.1:4194/api/routo/status'));
}
