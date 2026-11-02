import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from './server.mjs';
import { mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
test('local server serves only prototype assets and rejects writes', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/', '/domain.js', '/app.js', '/fixtures.js', '/styles.css']) {
      const r = await fetch(base + path); assert.equal(r.status, 200);
      assert.match(r.headers.get('content-security-policy'), /connect-src 'self'/);
    }
    for (const path of ['/../AGENTS.md', '/.ai-memory.toml', '/package.json', '/%2e%2e/CLAUDE.md']) {
      assert.equal((await fetch(base + path)).status, 404);
    }
    assert.equal((await fetch(base, { method: 'POST', body: 'test' })).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('server entry point starts under a path with spaces and Korean characters', async () => {
  const dir = await mkdtemp(join(tmpdir(), '주차 MVP '));
  let child;
  try {
    await copyFile(new URL('./server.mjs', import.meta.url), join(dir, 'server.mjs'));
    await copyFile(new URL('./parking.mjs', import.meta.url), join(dir, 'parking.mjs'));
    child = spawn(process.execPath, [join(dir, 'server.mjs')], { env: { ...process.env, PARKING_MVP_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out')), 3000);
      child.on('error', e => { clearTimeout(timer); reject(e); });
      child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited before readiness: ${code}`)); });
      child.stdout.once('data', data => {
        clearTimeout(timer);
        if (data.toString().includes('Parking MVP:')) resolve();
        else reject(new Error('Missing readiness output'));
      });
    });
  } finally {
    if (child && child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
