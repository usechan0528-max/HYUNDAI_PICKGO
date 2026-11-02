import http from 'node:http';
import { createParkingService } from './parking.mjs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/live', ['live.html', 'text/html']],
  ['/live.js', ['live.js', 'text/javascript']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/domain.js', ['domain.js', 'text/javascript']],
  ['/fixtures.js', ['fixtures.js', 'text/javascript']],
  ['/styles.css', ['styles.css', 'text/css']],
]);
export function createServer({ parkingService = createParkingService() } = {}) {
  return http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
    }
    if (req.url === '/api/parking') {
      if (req.method !== 'GET') { res.writeHead(405, {Allow:'GET'}); res.end(); return; }
      try {
        const data = await parkingService();
        res.writeHead(data.status === 'unavailable' ? 503 : 200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        res.end(JSON.stringify(data));
      } catch { res.writeHead(503); res.end(); }
      return;
    }
    const entry = files.get(req.url);
    if (!entry) { res.writeHead(404); res.end('Not found'); return; }
    try {
      const body = await readFile(new URL(entry[0], import.meta.url));
      res.writeHead(200, {
        'Content-Type': `${entry[1]}; charset=utf-8`, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(500); res.end('Unable to load page'); }
  });
}
if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  const port = Number(process.env.PARKING_MVP_PORT || 4173);
  createServer().listen(port, '127.0.0.1', () => console.log(`Parking MVP: http://127.0.0.1:${port}`));
}
