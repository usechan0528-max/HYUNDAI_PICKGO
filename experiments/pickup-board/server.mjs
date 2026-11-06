import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Fault } from './domain.mjs';
import { MapBoard } from './map/board.mjs';
import {mapModel, mapData} from './map/service.mjs';
import {mapSearch} from './map/search.mjs';
import { parsePublicOrigin, requestOrigin } from './web-origin.mjs';
import { MultiBoard } from './multi/board.mjs';
const files = { '/place-label.mjs': ['place-label.mjs', 'text/javascript'], '/phone': ['phone.html','text/html'], '/phone.css': ['phone.css','text/css'], '/phone-page.mjs': ['phone-page.mjs','text/javascript'], '/phone-controller.mjs': ['phone-controller.mjs','text/javascript'], '/': ['index.html', 'text/html'], '/app.mjs': ['app.mjs', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/fonts/AstaSans.ttf': ['fonts/AstaSans.ttf', 'font/ttf'], '/fonts/OFL.txt': ['fonts/OFL.txt', 'text/plain'] };
Object.assign(files, {
  '/proximity': ['proximity-page.html', 'text/html'],
  '/proximity-page.mjs': ['proximity-page.mjs', 'text/javascript'],
  '/proximity-page.css': ['proximity-page.css', 'text/css'],
  '/proximity/detector.mjs': ['proximity/detector.mjs', 'text/javascript'],
  '/location-links.css': ['location-links.css', 'text/css']
});
for (const [name,mime] of [['page.html','text/html'],['page.css','text/css'],['page.mjs','text/javascript'],['controller.mjs','text/javascript']]) files[name==='page.html'?'/recommendation':`/recommendation/${name}`]=[`recommendation/${name}`,mime];
for(const [name,mime] of [['page.html','text/html'],['page.css','text/css'],['page.mjs','text/javascript'],['vendor/leaflet.js','text/javascript'],['vendor/leaflet.css','text/css'],['vendor/LICENSE','text/plain'],['data/yangjae.json','application/json']])files[name==='page.html'?'/map':`/map/${name}`]=[`map/${name}`,mime];
export function createServer(board = new MapBoard(), options = {}) {
  const multi = options.multiBoard || new MultiBoard();
  for (const [name, mime] of [['page.html','text/html'],['page.css','text/css'],['page.mjs','text/javascript']]) files[name === 'page.html' ? '/multi' : `/multi/${name}`] = [`multi/${name}`, mime];
  const publicOrigin = parsePublicOrigin(options.publicOrigin);
  const server = http.createServer(async (req, res) => {
    const reply = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(self)');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const origin = requestOrigin(req.headers, res.socket.localPort, publicOrigin);
      if (!origin) throw new Fault(403, '설정된 서비스 주소에서만 사용할 수 있습니다.');
      const path = new URL(req.url, origin).pathname;
      if(path==='/map'){
        res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
        res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      }
      if(path==='/api/map'&&req.method==='GET'){const place=new URL(req.url,origin).searchParams.get('place');return reply(200,place?mapSearch.mapFor(place):mapData());}
      if (req.method === 'GET' && files[path]) {
        const [name, mime] = files[path]; const body = await readFile(new URL(name, import.meta.url));
        res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` }); res.end(body); return;
      }
      let body = {};
      if (req.method === 'POST') {
        if (req.headers['content-type'] !== 'application/json') throw new Fault(415, 'JSON 요청만 지원합니다.');
        const chunks = []; let length = 0; for await (const chunk of req) { length += chunk.length; if (length > 4096) throw new Fault(413, '요청이 너무 큽니다.'); chunks.push(chunk); }
        const raw = Buffer.concat(chunks).toString('utf8');
        try { body = JSON.parse(raw); } catch { throw new Fault(400, '잘못된 JSON입니다.'); }
        if (!body || Array.isArray(body) || typeof body !== 'object') throw new Fault(400, '요청 객체가 필요합니다.');
      }
      if(path==='/api/map/search'&&req.method==='POST')return reply(200,mapSearch.search(body.query));
      if(path==='/api/map/check'&&req.method==='POST')return reply(200,mapModel.check(body.point));
      if (path === '/api/trips' && req.method === 'POST') return reply(201, multi.create(body));
      const tripMatch = path.match(/^\/api\/trips\/([a-f0-9-]{36})(?:\/(preview|join|actions|recommend))?$/);
      if (tripMatch) {
        const [, tripId, tripAction] = tripMatch, token = req.headers.authorization?.replace(/^Bearer /, '');
        if (req.method === 'GET' && !tripAction) return reply(200, multi.read(tripId, token));
        if (req.method === 'POST' && tripAction === 'preview') return reply(200, multi.preview(tripId, body.invite));
        if (req.method === 'POST' && tripAction === 'join') return reply(200, multi.join(tripId, body));
        if (req.method === 'POST' && tripAction === 'actions') return reply(200, multi.act(tripId, token, body));
        if (req.method === 'POST' && tripAction === 'recommend') return reply(200, await multi.recommend(tripId, token, body));
        throw new Fault(405, '지원하지 않는 요청입니다.');
      }
      if (path === '/api/rooms' && req.method === 'POST') {
        if(body.point!==undefined){if(typeof board.createPoint!=='function')throw new Fault(409,'이 시연 서버는 실제 지도 핀을 지원하지 않습니다.');return reply(201,board.createPoint(body.point));}
        return reply(201, board.create(body.place, body.pickupPoint));
      }
      const match = path.match(/^\/api\/rooms\/([a-f0-9-]{36})(?:\/(join|preview|actions|phone|recommendation))?$/);
      if (!match) throw new Fault(404, '찾을 수 없습니다.');
      const [, id, action] = match, credential = req.headers.authorization?.replace(/^Bearer /, '');
      if (action === 'recommendation' && typeof board.recommend === 'function' && ['GET','POST'].includes(req.method)) return reply(200, await board.recommend(id, credential, req.method === 'POST' ? body : null));
      if (action === 'phone' && typeof board.phone === 'function' && ['GET','POST'].includes(req.method)) return reply(200, board.phone(id, credential, req.method === 'POST' ? body : null));
      if (req.method === 'GET' && !action) return reply(200, board.read(id, credential));
      if (req.method === 'POST' && action === 'preview') return reply(200, board.preview(id, body.invite));
      if (req.method === 'POST' && action === 'join') return reply(200, board.join(id, body.invite, body.joinId));
      if (req.method === 'POST' && action === 'actions') return reply(200, board.act(id, credential, body));
      throw new Fault(405, '지원하지 않는 요청입니다.');
    } catch (error) { if (error instanceof Fault && error.status === 413) res.setHeader('Connection', 'close'); reply(error instanceof Fault ? error.status : 500, { error: error instanceof Fault ? error.message : '서버 오류입니다. 다시 확인해 주세요.' }); }
  });
  const cleanup = setInterval(() => { board.prune(); board.sweep?.(); multi.prune(); }, 1000); cleanup.unref();
  server.on('close', () => clearInterval(cleanup));
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PICKUP_PORT || 4180);
  const publicOrigin = parsePublicOrigin(process.env.PICKUP_PUBLIC_ORIGIN);
  createServer(undefined, { publicOrigin: publicOrigin || undefined }).listen(port, '127.0.0.1', () => console.log(`PICKGO ${publicOrigin || `http://127.0.0.1:${port}`} · ${publicOrigin ? 'HTTPS 프록시 구성 필요' : '로컬 시연'} / 메모리 저장`));
}
