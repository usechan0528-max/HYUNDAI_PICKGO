import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Board, Fault } from './domain.mjs';
const files = { '/': ['index.html', 'text/html'], '/app.mjs': ['app.mjs', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/fonts/AstaSans.ttf': ['fonts/AstaSans.ttf', 'font/ttf'], '/fonts/OFL.txt': ['fonts/OFL.txt', 'text/plain'] };
export function createServer(board = new Board()) {
  return http.createServer(async (req, res) => {
    const reply = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const origin = `http://127.0.0.1:${res.socket.localPort}`;
      if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) throw new Fault(403, '로컬 주소에서만 사용할 수 있습니다.');
      const path = new URL(req.url, origin).pathname;
      if (req.method === 'GET' && files[path]) {
        const [name, mime] = files[path]; const body = await readFile(new URL(name, import.meta.url));
        res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` }); res.end(body); return;
      }
      let body = {};
      if (req.method === 'POST') {
        if (req.headers['content-type'] !== 'application/json') throw new Fault(415, 'JSON 요청만 지원합니다.');
        let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 4096) throw new Fault(413, '요청이 너무 큽니다.'); }
        try { body = JSON.parse(raw); } catch { throw new Fault(400, '잘못된 JSON입니다.'); }
        if (!body || Array.isArray(body) || typeof body !== 'object') throw new Fault(400, '요청 객체가 필요합니다.');
      }
      if (path === '/api/rooms' && req.method === 'POST') return reply(201, board.create(body.place));
      const match = path.match(/^\/api\/rooms\/([a-f0-9-]{36})(?:\/(join|actions))?$/);
      if (!match) throw new Fault(404, '찾을 수 없습니다.');
      const [, id, action] = match, credential = req.headers.authorization?.replace(/^Bearer /, '');
      if (req.method === 'GET' && !action) return reply(200, board.read(id, credential));
      if (req.method === 'POST' && action === 'join') return reply(200, board.join(id, body.invite));
      if (req.method === 'POST' && action === 'actions') return reply(200, board.act(id, credential, body));
      throw new Fault(405, '지원하지 않는 요청입니다.');
    } catch (error) { reply(error instanceof Fault ? error.status : 500, { error: error instanceof Fault ? error.message : '서버 오류입니다. 다시 확인해 주세요.' }); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PICKUP_PORT || 4180);
  createServer().listen(port, '127.0.0.1', () => console.log(`픽업 약속판 http://127.0.0.1:${port} · 로컬 시연 / 메모리 저장`));
}
